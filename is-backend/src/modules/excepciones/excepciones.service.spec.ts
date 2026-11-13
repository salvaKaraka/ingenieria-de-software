import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ExcepcionesRepository } from './excepciones.repository';
import { ExcepcionesService } from './excepciones.service';

describe('ExcepcionesService', () => {
  const tx = {};
  const repo = {
    transaccion: jest.fn((trabajo: (t: object) => unknown) => trabajo(tx)),
    listarSinRepartidor: jest.fn(),
    listarIncidentesActivos: jest.fn(),
    buscarEnvio: jest.fn(),
    listarRepartidoresAsignables: jest.fn(),
    bloquearEnvio: jest.fn(),
    bloquearRepartidor: jest.fn(),
    envioTieneOfertaVigente: jest.fn(),
    repartidorTieneOfertaVigente: jest.fn(),
    ofrecerManual: jest.fn(),
    reactivarEnvioParado: jest.fn(),
  };
  let service: ExcepcionesService;

  const ahora = new Date('2026-11-11T18:00:00Z');
  const haceMinutos = (m: number) => new Date(ahora.getTime() - m * 60_000);
  const sinRepartidor = (id: number, vencioHace: number) => ({
    id,
    codigoSeguimiento: `COD${id}`,
    origenDireccion: 'Calle 7 1234',
    destinoDireccion: 'Calle 50 567',
    tamanio: 'CHICO',
    vehiculoRequerido: 'MOTO',
    estado: 'PENDIENTE',
    comercio: { nombre: 'Kiosco' },
    ofertas: [{ expiraEn: haceMinutos(vencioHace) }],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repo.transaccion.mockImplementation((trabajo: (t: object) => unknown) =>
      trabajo(tx),
    );
    repo.listarIncidentesActivos.mockResolvedValue([]);
    repo.reactivarEnvioParado.mockResolvedValue(true);
    service = new ExcepcionesService(repo as unknown as ExcepcionesRepository);
  });

  describe('listar', () => {
    it('muestra el aviso "Envío sin repartidor disponible" (HU 12, escenario 2)', async () => {
      repo.listarSinRepartidor.mockResolvedValue([sinRepartidor(1, 5)]);
      const { excepciones } = await service.listar(ahora);
      expect(excepciones[0]).toMatchObject({
        envioId: 1,
        motivo: 'SIN_REPARTIDOR',
        aviso: 'Envío sin repartidor disponible',
        minutosEspera: 5,
      });
    });

    it('ordena del que espera hace más al más reciente (HU 22, escenario 4)', async () => {
      repo.listarSinRepartidor.mockResolvedValue([
        sinRepartidor(1, 5),
        sinRepartidor(2, 30),
      ]);
      const { excepciones } = await service.listar(ahora);
      expect(excepciones.map((e) => e.minutosEspera)).toEqual([30, 5]);
    });

    it('sin excepciones devuelve la lista vacía (HU 22, escenario 6)', async () => {
      repo.listarSinRepartidor.mockResolvedValue([]);
      await expect(service.listar(ahora)).resolves.toEqual({
        excepciones: [],
      });
    });

    it('muestra el incidente activo en el panel para el operario', async () => {
      repo.listarSinRepartidor.mockResolvedValue([]);
      repo.listarIncidentesActivos.mockResolvedValue([
        {
          ...sinRepartidor(1, 5),
          estado: 'PARADO',
          eventos: [
            {
              creadoEn: haceMinutos(5),
              detalle: 'Incidente reportado. Ubicación informada: Calle 7',
            },
          ],
          ofertas: [],
        },
      ]);

      const { excepciones } = await service.listar(ahora);
      expect(excepciones[0]).toMatchObject({
        estado: 'PARADO',
        motivo: 'PARADO',
        puedeAsignar: true,
        aviso: 'Envío parado: no hay repartidores compatibles',
      });
    });
  });

  describe('asignarManual', () => {
    const repartidor = {
      id: 9,
      nombre: 'Ana',
      apellido: 'Paz',
      activo: true,
      estado: 'DISPONIBLE',
      vehiculo: 'MOTO',
    };

    beforeEach(() => {
      repo.bloquearEnvio.mockResolvedValue({
        id: 1,
        estado: 'PENDIENTE',
        vehiculoRequerido: 'MOTO',
      });
      repo.envioTieneOfertaVigente.mockResolvedValue(false);
      repo.bloquearRepartidor.mockResolvedValue(repartidor);
      repo.repartidorTieneOfertaVigente.mockResolvedValue(false);
      repo.ofrecerManual.mockResolvedValue({ id: 50, expiraEn: ahora });
    });

    it('le manda la oferta directo al repartidor elegido (HU 22, escenarios 1 y 5)', async () => {
      await expect(service.asignarManual(1, 9, 3)).resolves.toEqual({
        ofertaId: 50,
        expiraEn: ahora,
      });
      expect(repo.ofrecerManual).toHaveBeenCalledWith(
        tx,
        1,
        9,
        expect.any(Date),
        3,
        'Asignación manual del operario a Ana Paz',
      );
    });

    it('permite reactivar un envío parado para asignarlo manualmente', async () => {
      repo.bloquearEnvio.mockResolvedValue({
        id: 1,
        estado: 'PARADO',
        vehiculoRequerido: 'MOTO',
      });

      await service.asignarManual(1, 9, 3);

      expect(repo.reactivarEnvioParado).toHaveBeenCalledWith(tx, 1, 3);
      expect(repo.ofrecerManual).toHaveBeenCalled();
    });

    it('no mira la cola ni los viajes consecutivos (HU 22, escenario 5)', async () => {
      repo.bloquearRepartidor.mockResolvedValue({
        ...repartidor,
        viajesConsecutivos: 2,
      });
      await expect(service.asignarManual(1, 9, 3)).resolves.toBeDefined();
    });

    it('rechaza si el envío ya tiene una oferta en curso', async () => {
      repo.envioTieneOfertaVigente.mockResolvedValue(true);
      await expect(service.asignarManual(1, 9, 3)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.ofrecerManual).not.toHaveBeenCalled();
    });

    it('rechaza si el envío ya no está pendiente', async () => {
      repo.bloquearEnvio.mockResolvedValue({
        id: 1,
        estado: 'CANCELADO',
        vehiculoRequerido: 'MOTO',
      });
      await expect(service.asignarManual(1, 9, 3)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza un repartidor ocupado', async () => {
      repo.bloquearRepartidor.mockResolvedValue({
        ...repartidor,
        estado: 'OCUPADO',
      });
      await expect(service.asignarManual(1, 9, 3)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('404 si el envío no existe', async () => {
      repo.bloquearEnvio.mockResolvedValue(null);
      await expect(service.asignarManual(1, 9, 3)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
