import { ConflictException } from '@nestjs/common';
import type { AsignacionService } from '../asignacion/asignacion.service';
import { JornadaService } from './jornada.service';
import type { RepartidoresRepository } from './repartidores.repository';

describe('JornadaService', () => {
  const repo = {
    buscarPorId: jest.fn(),
    iniciarJornada: jest.fn(),
    pausar: jest.fn(),
    reanudar: jest.fn(),
    terminarJornada: jest.fn(),
    obtenerFlota: jest.fn(),
  };
  const asignacion = { reintentarPendientes: jest.fn() };
  let servicio: JornadaService;

  const estaEn = (estado: string) =>
    repo.buscarPorId.mockResolvedValue({ id: 1, estado });

  beforeEach(() => {
    jest.resetAllMocks();
    servicio = new JornadaService(
      repo as unknown as RepartidoresRepository,
      asignacion as unknown as AsignacionService,
    );
  });

  it('al iniciar la jornada el motor reintenta los envíos pendientes', async () => {
    repo.iniciarJornada.mockResolvedValue(true);
    estaEn('DISPONIBLE');

    await expect(servicio.iniciar(1)).resolves.toEqual({
      estado: 'DISPONIBLE',
    });
    expect(asignacion.reintentarPendientes).toHaveBeenCalled();
  });

  it('iniciar estando ya en jornada responde 409 y no dispara el motor', async () => {
    repo.iniciarJornada.mockResolvedValue(false);
    estaEn('DISPONIBLE');

    await expect(servicio.iniciar(1)).rejects.toThrow('Ya estás en jornada');
    expect(asignacion.reintentarPendientes).not.toHaveBeenCalled();
  });

  it('pausar fuera de jornada responde 409', async () => {
    repo.pausar.mockResolvedValue(false);
    estaEn('FUERA_DE_JORNADA');

    await expect(servicio.pausar(1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('no deja pausar con una oferta esperando respuesta', async () => {
    repo.pausar.mockResolvedValue(false);
    estaEn('DISPONIBLE');

    await expect(servicio.pausar(1)).rejects.toThrow('oferta pendiente');
  });

  it('no deja pausar con un viaje en curso', async () => {
    repo.pausar.mockResolvedValue(false);
    estaEn('OCUPADO');

    await expect(servicio.pausar(1)).rejects.toThrow('viaje en curso');
  });

  it('al reanudar vuelve a la cola y el motor reintenta los pendientes', async () => {
    repo.reanudar.mockResolvedValue(true);
    estaEn('DISPONIBLE');

    await servicio.reanudar(1);
    expect(asignacion.reintentarPendientes).toHaveBeenCalled();
  });

  it('reanudar sin estar en pausa responde 409', async () => {
    repo.reanudar.mockResolvedValue(false);
    estaEn('FUERA_DE_JORNADA');

    await expect(servicio.reanudar(1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  describe('terminar', () => {
    it('termina la jornada y pasa a FUERA_DE_JORNADA', async () => {
      repo.terminarJornada.mockResolvedValue(true);
      estaEn('FUERA_DE_JORNADA');

      await expect(servicio.terminar(1)).resolves.toEqual({
        estado: 'FUERA_DE_JORNADA',
      });
      expect(repo.terminarJornada).toHaveBeenCalledWith(1);
    });

    it('no deja terminar la jornada con una oferta pendiente (409)', async () => {
      repo.terminarJornada.mockResolvedValue(false);
      estaEn('DISPONIBLE');

      await expect(servicio.terminar(1)).rejects.toThrow('oferta pendiente');
    });

    it('no deja terminar la jornada con un viaje en curso (409)', async () => {
      repo.terminarJornada.mockResolvedValue(false);
      estaEn('OCUPADO');

      await expect(servicio.terminar(1)).rejects.toThrow('viaje en curso');
    });

    it('terminar fuera de jornada responde 409', async () => {
      repo.terminarJornada.mockResolvedValue(false);
      estaEn('FUERA_DE_JORNADA');

      await expect(servicio.terminar(1)).rejects.toThrow('No estás en jornada');
    });
  });

  describe('flota', () => {
    it('agrupa por vehículo y ordena primero la cola FIFO y luego el resto', async () => {
      const t1 = new Date('2026-01-01T10:00:00Z');
      const t2 = new Date('2026-01-01T10:05:00Z');

      const repMotoSinCola = {
        id: 1,
        nombre: 'M1',
        vehiculo: 'MOTO',
        estado: 'OCUPADO',
        enColaDesde: null,
      };
      const repMotoCola2 = {
        id: 2,
        nombre: 'M2',
        vehiculo: 'MOTO',
        estado: 'DISPONIBLE',
        enColaDesde: t2,
      };
      const repMotoCola1 = {
        id: 3,
        nombre: 'M3',
        vehiculo: 'MOTO',
        estado: 'DISPONIBLE',
        enColaDesde: t1,
      };
      const repAutoCola = {
        id: 4,
        nombre: 'A1',
        vehiculo: 'AUTO',
        estado: 'DISPONIBLE',
        enColaDesde: t1,
      };

      repo.obtenerFlota.mockResolvedValue([
        repMotoSinCola,
        repMotoCola2,
        repMotoCola1,
        repAutoCola,
      ]);

      const resultado = await servicio.flota();

      expect(resultado.CAMION).toEqual([]);
      expect(resultado.AUTO).toEqual([repAutoCola]);
      // En MOTO: repMotoCola1 (t1) -> repMotoCola2 (t2) -> repMotoSinCola (null)
      expect(resultado.MOTO).toEqual([
        repMotoCola1,
        repMotoCola2,
        repMotoSinCola,
      ]);
    });
  });
});
