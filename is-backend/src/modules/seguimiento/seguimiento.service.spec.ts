import { NotFoundException } from '@nestjs/common';
import { SeguimientoService } from './seguimiento.service';
import { SeguimientoRepository } from './seguimiento.repository';
import type { MapasService } from '../mapas/mapas.service';
import type { EstadoEnvio } from '../../generated/prisma/client';

describe('SeguimientoService', () => {
  let service: SeguimientoService;
  let repository: {
    buscarPorCodigo: jest.Mock;
    entregasAnteriores: jest.Mock;
    guardarDuracionEstimada: jest.Mock;
  };
  let mapas: { duracionDelViajeMin: jest.Mock };

  beforeEach(() => {
    repository = {
      buscarPorCodigo: jest.fn(),
      entregasAnteriores: jest.fn().mockResolvedValue([]),
      // Devuelve lo mismo que recibe: como si nadie lo hubiera guardado antes.
      guardarDuracionEstimada: jest.fn((_id: number, minutos: number) =>
        Promise.resolve(minutos),
      ),
    };
    // Por defecto el mapa falla: cada test que lo necesita lo pisa.
    mapas = { duracionDelViajeMin: jest.fn().mockResolvedValue(null) };
    service = new SeguimientoService(
      repository as unknown as SeguimientoRepository,
      mapas as unknown as MapasService,
    );
  });

  describe('Enmascaramiento de datos sensibles (Épica 2.5)', () => {
    it('enmascara nombre y apellido mostrando solo la inicial del apellido', () => {
      expect(service.enmascararDestinatario('Juan', 'Perez')).toBe('Juan P.');
      expect(service.enmascararDestinatario('María', 'Gómez')).toBe('María G.');
    });

    it('maneja destinatario sin apellido o sin nombre', () => {
      expect(service.enmascararDestinatario('Carlos', null)).toBe('Carlos');
      expect(service.enmascararDestinatario(null, 'Alvarez')).toBe('A.');
      expect(service.enmascararDestinatario(null, null)).toBe('Destinatario');
    });

    it('enmascara la dirección eliminando la altura numérica y departamento', () => {
      expect(service.enmascararDireccion('Av. Corrientes 1234, 4to B')).toBe(
        'Av. Corrientes',
      );
      expect(service.enmascararDireccion('Calle Falsa 123')).toBe(
        'Calle Falsa',
      );
      expect(service.enmascararDireccion('San Martín 550')).toBe('San Martín');
    });

    it('maneja direcciones nulas', () => {
      expect(service.enmascararDireccion(null)).toBe('Dirección de destino');
      expect(service.enmascararDireccion('')).toBe('Dirección de destino');
    });

    it.each([
      ['calle x, 1234', 'calle x'],
      ['Calle 7 1234', 'Calle 7'],
      ['calle 7, 1234', 'calle 7'],
      ['Calle 50 n° 200, 4to B', 'Calle 50'],
      ['Diagonal 74 1520', 'Diagonal 74'],
      ['Ruta 2 km 45', 'Ruta 2'],
      ['Belgrano 456 piso 2 B', 'Belgrano'],
      ['Calle 7', 'Calle 7'],
      ['Avenida de Mayo', 'Avenida de Mayo'],
    ])(
      'conserva el número del nombre de la calle: "%s" -> "%s"',
      (direccion, esperado) => {
        expect(service.enmascararDireccion(direccion)).toBe(esperado);
      },
    );
  });

  describe('Consultar estado del envío (F-3)', () => {
    it('lanza NotFoundException si el código no existe en la base de datos', async () => {
      repository.buscarPorCodigo.mockResolvedValue(null);

      await expect(service.consultar('CODIGO-INEXISTENTE')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.buscarPorCodigo).toHaveBeenCalledWith(
        'CODIGO-INEXISTENTE',
      );
    });

    it('devuelve los datos enmascarados, línea de tiempo y hora de salida según Supuesto 7', async () => {
      const fechaCreacion = new Date('2026-10-18T10:00:00Z');
      const fechaRetirado = new Date('2026-10-18T11:30:00Z');
      const fechaEntregado = new Date('2026-10-18T13:45:00Z');

      repository.buscarPorCodigo.mockResolvedValue({
        id: 1,
        codigoSeguimiento: 'TRK-ABCD-1234',
        estado: 'ENTREGADO' as EstadoEnvio,
        destinoDireccion: 'Belgrano 456, Piso 2',
        destinatarioNombre: 'Ana',
        destinatarioApellido: 'Rios',
        destinatarioDni: '12345678', // Dato confidencial
        destinatarioTelefono: '1144556677', // Dato confidencial
        creadoEn: fechaCreacion,
        comercio: { nombre: 'Librería Central' },
        eventos: [
          {
            id: 1,
            estadoNuevo: 'PENDIENTE',
            creadoEn: fechaCreacion,
          },
          {
            id: 2,
            estadoNuevo: 'RETIRADO',
            creadoEn: fechaRetirado,
          },
          {
            id: 3,
            estadoNuevo: 'ENTREGADO',
            creadoEn: fechaEntregado,
          },
        ],
      });

      const resultado = await service.consultar('trk-abcd-1234');

      // Verifica normalización a mayúsculas y búsqueda O(1)
      expect(repository.buscarPorCodigo).toHaveBeenCalledWith('TRK-ABCD-1234');

      // Verifica datos públicos
      expect(resultado.trackingCode).toBe('TRK-ABCD-1234');
      expect(resultado.estadoActual).toBe('ENTREGADO');
      expect(resultado.comercio).toBe('Librería Central');

      // Verifica enmascaramiento estricto
      expect(resultado.destinatario).toBe('Ana R.');
      expect(resultado.direccionDestino).toBe('Belgrano');

      // Verifica que NUNCA exponga DNI ni teléfono
      expect(resultado).not.toHaveProperty('destinatarioDni');
      expect(resultado).not.toHaveProperty('destinatarioTelefono');

      // Verifica Supuesto 7: Hora de salida es la de estado RETIRADO
      expect(resultado.horaSalida).toBe(fechaRetirado.toISOString());
      expect(resultado.fechaEntrega).toBe(fechaEntregado.toISOString());

      // Verifica historial cronológico
      expect(resultado.historial).toHaveLength(3);
      expect(resultado.historial[0]).toEqual({
        estado: 'PENDIENTE',
        fecha: fechaCreacion.toISOString(),
      });
      expect(resultado.historial[1]).toEqual({
        estado: 'RETIRADO',
        fecha: fechaRetirado.toISOString(),
      });
    });
  });

  describe('Franja estimada de llegada (HU 70)', () => {
    const salida = new Date('2026-11-12T14:00:00Z');
    const entregaDe40 = {
      retiradoEn: new Date('2026-11-12T10:00:00Z'),
      entregadoEn: new Date('2026-11-12T10:40:00Z'),
    };

    // Envío mínimo en `estado`; si `salio`, tiene el evento de RETIRADO a las 14:00.
    const envioEn = (
      estado: EstadoEnvio,
      { salio = true, duracionEstimadaMin = null as number | null } = {},
    ) => ({
      id: 7,
      codigoSeguimiento: 'TRK1',
      estado,
      origenDireccion: 'Calle 50 567',
      origenLat: -34.914,
      origenLon: -57.949,
      destinoDireccion: 'Avenida 7 1234',
      destinoLat: null,
      destinoLon: null,
      vehiculoRequerido: 'MOTO',
      duracionEstimadaMin,
      creadoEn: new Date('2026-11-12T12:00:00Z'),
      comercio: { nombre: 'Kiosco' },
      eventos: salio ? [{ estadoNuevo: 'RETIRADO', creadoEn: salida }] : [],
    });

    it('calcula la franja con la ruta del mapa más 10 minutos para entregar, y la guarda', async () => {
      repository.buscarPorCodigo.mockResolvedValue(envioEn('RETIRADO'));
      mapas.duracionDelViajeMin.mockResolvedValue(30);

      const resultado = await service.consultar('TRK1');

      // El origen tiene el punto que marcó el operario; el destino no, y se busca por dirección.
      expect(mapas.duracionDelViajeMin).toHaveBeenCalledWith(
        {
          direccion: 'Calle 50 567',
          coordenadas: { lat: -34.914, lon: -57.949 },
        },
        { direccion: 'Avenida 7 1234', coordenadas: null },
        'MOTO',
      );
      // 30 de manejo + 10 para entregar
      expect(repository.guardarDuracionEstimada).toHaveBeenCalledWith(7, 40);
      expect(repository.entregasAnteriores).not.toHaveBeenCalled();
      expect(resultado.franjaEstimadaInicio).toBe('2026-11-12T14:25:00.000Z');
      expect(resultado.franjaEstimadaFin).toBe('2026-11-12T14:55:00.000Z');
    });

    it('si el mapa falla, usa el promedio de las entregas anteriores a la salida', async () => {
      repository.buscarPorCodigo.mockResolvedValue(envioEn('RETIRADO'));
      repository.entregasAnteriores.mockResolvedValue(
        Array(5).fill(entregaDe40),
      );

      const resultado = await service.consultar('TRK1');

      expect(repository.entregasAnteriores).toHaveBeenCalledWith(
        'MOTO',
        salida,
      );
      expect(repository.guardarDuracionEstimada).toHaveBeenCalledWith(7, 40);
      expect(resultado.franjaEstimadaInicio).toBe('2026-11-12T14:25:00.000Z');
    });

    it('si el mapa falla y hay pocas entregas, usa 60 minutos', async () => {
      repository.buscarPorCodigo.mockResolvedValue(envioEn('EN_DOMICILIO'));

      const resultado = await service.consultar('TRK1');

      expect(resultado.franjaEstimadaInicio).toBe('2026-11-12T14:45:00.000Z');
      expect(resultado.franjaEstimadaFin).toBe('2026-11-12T15:15:00.000Z');
    });

    it('si la duración ya estaba guardada, no vuelve a calcularla', async () => {
      repository.buscarPorCodigo.mockResolvedValue(
        envioEn('RETIRADO', { duracionEstimadaMin: 40 }),
      );

      const resultado = await service.consultar('TRK1');

      expect(mapas.duracionDelViajeMin).not.toHaveBeenCalled();
      expect(repository.guardarDuracionEstimada).not.toHaveBeenCalled();
      expect(resultado.franjaEstimadaInicio).toBe('2026-11-12T14:25:00.000Z');
    });

    it('no la muestra si el envío todavía no salió', async () => {
      repository.buscarPorCodigo.mockResolvedValue(
        envioEn('ASIGNADO', { salio: false }),
      );

      const resultado = await service.consultar('TRK1');

      expect(resultado.franjaEstimadaInicio).toBeUndefined();
      expect(resultado.horaSalida).toBeUndefined();
      expect(mapas.duracionDelViajeMin).not.toHaveBeenCalled();
    });

    it.each(['ENTREGADO', 'CANCELADO'] as EstadoEnvio[])(
      'no la muestra si el envío está %s',
      async (estado) => {
        repository.buscarPorCodigo.mockResolvedValue(envioEn(estado));

        const resultado = await service.consultar('TRK1');

        expect(resultado.franjaEstimadaInicio).toBeUndefined();
        expect(resultado.franjaEstimadaFin).toBeUndefined();
        expect(mapas.duracionDelViajeMin).not.toHaveBeenCalled();
      },
    );
  });
});
