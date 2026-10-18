import { NotFoundException } from '@nestjs/common';
import { SeguimientoService } from './seguimiento.service';
import { SeguimientoRepository } from './seguimiento.repository';
import { generarCodigoSeguimiento } from './codigo-seguimiento.util';
import type { EstadoEnvio } from '../../generated/prisma/client';

describe('SeguimientoService y Utilidades', () => {
  let service: SeguimientoService;
  let repository: { buscarPorCodigo: jest.Mock };

  beforeEach(() => {
    repository = {
      buscarPorCodigo: jest.fn(),
    };
    service = new SeguimientoService(repository as unknown as SeguimientoRepository);
  });

  describe('Generador de código de seguimiento', () => {
    it('genera códigos alfanuméricos con formato seguro y no predecible', () => {
      const codigo1 = generarCodigoSeguimiento();
      const codigo2 = generarCodigoSeguimiento();

      expect(codigo1).toMatch(/^TRK-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      expect(codigo2).toMatch(/^TRK-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      expect(codigo1).not.toBe(codigo2);
    });
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
      expect(service.enmascararDireccion('Av. Corrientes 1234, 4to B')).toBe('Av. Corrientes');
      expect(service.enmascararDireccion('Calle Falsa 123')).toBe('Calle Falsa');
      expect(service.enmascararDireccion('San Martín 550')).toBe('San Martín');
    });

    it('maneja direcciones nulas o sin número', () => {
      expect(service.enmascararDireccion(null)).toBe('Dirección de destino');
      expect(service.enmascararDireccion('Ruta 2 km 45')).toBe('Ruta');
    });
  });

  describe('Consultar estado del envío (F-3)', () => {
    it('lanza NotFoundException si el código no existe en la base de datos', async () => {
      repository.buscarPorCodigo.mockResolvedValue(null);

      await expect(service.consultar('CODIGO-INEXISTENTE')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.buscarPorCodigo).toHaveBeenCalledWith('CODIGO-INEXISTENTE');
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
});
