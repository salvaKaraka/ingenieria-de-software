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
});
