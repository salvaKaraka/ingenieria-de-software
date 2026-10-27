import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AsignacionService } from '../asignacion/asignacion.service';
import type { EnviosRepository } from './envios.repository';
import { ViajesService } from './viajes.service';

describe('ViajesService', () => {
  const repository = {
    buscarViajeActivoPorRepartidor: jest.fn(),
    avanzarViaje: jest.fn(),
  };
  const asignacion = { reintentarPendientes: jest.fn() };
  let service: ViajesService;

  const envioEn = (estado: string) => ({
    id: 5,
    codigoSeguimiento: 'K7M2X9QP4R',
    estado,
    comercio: { nombre: 'Kiosco', telefono: '221' },
    origenDireccion: 'Calle 7 1234',
    destinoDireccion: 'Calle 50 567',
    destinatarioNombre: 'Ana',
    destinatarioApellido: 'Paz',
    destinatarioTelefono: '221 444',
    destinatarioDni: '30111222',
    observaciones: null,
    requiereFoto: false,
    requiereDni: true,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ViajesService(
      repository as unknown as EnviosRepository,
      asignacion as unknown as AsignacionService,
    );
  });

  it('sin viaje activo devuelve null', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(null);
    await expect(service.obtenerViajeActual(1)).resolves.toEqual({
      viaje: null,
    });
  });

  it('devuelve el viaje con el siguiente estado y sin el DNI del destinatario', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
      envioEn('ASIGNADO'),
    );
    const { viaje } = await service.obtenerViajeActual(1);
    expect(viaje).toMatchObject({
      envioId: 5,
      estado: 'ASIGNADO',
      siguienteEstado: 'EN_CAMINO_A_RETIRAR',
    });
    expect(JSON.stringify(viaje)).not.toContain('30111222');
  });

  it('avanza un paso y no dispara el motor si todavía no entregó', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
      envioEn('RETIRADO'),
    );
    repository.avanzarViaje.mockResolvedValue(true);

    await expect(service.avanzarViajeActual(1)).resolves.toEqual({
      estado: 'EN_DOMICILIO',
      siguienteEstado: 'ENTREGADO',
    });
    expect(repository.avanzarViaje).toHaveBeenCalledWith(
      5,
      'RETIRADO',
      'EN_DOMICILIO',
      1,
      undefined,
    );
    expect(asignacion.reintentarPendientes).not.toHaveBeenCalled();
  });

  it('al entregar, el motor reintenta los envíos pendientes', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
      envioEn('EN_DOMICILIO'),
    );
    repository.avanzarViaje.mockResolvedValue(true);

    await expect(
      service.avanzarViajeActual(1, { dni: '30111222' }),
    ).resolves.toEqual({
      estado: 'ENTREGADO',
      siguienteEstado: null,
    });
    expect(asignacion.reintentarPendientes).toHaveBeenCalled();
  });

  describe('evidencia de entrega (E-4)', () => {
    const entregando = (cambios: object) =>
      repository.buscarViajeActivoPorRepartidor.mockResolvedValue({
        ...envioEn('EN_DOMICILIO'),
        ...cambios,
      });

    it('no entrega sin el DNI de quien recibe', async () => {
      entregando({ requiereDni: true });
      await expect(service.avanzarViajeActual(1, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.avanzarViaje).not.toHaveBeenCalled();
    });

    it('no entrega si el DNI no coincide con el del destinatario', async () => {
      entregando({ requiereDni: true });
      await expect(
        service.avanzarViajeActual(1, { dni: '99888777' }),
      ).rejects.toThrow('El DNI no coincide con el del destinatario');
      expect(repository.avanzarViaje).not.toHaveBeenCalled();
    });

    it('compara sin los puntos con los que se haya cargado el DNI', async () => {
      entregando({ requiereDni: true, destinatarioDni: '30.111.222' });
      repository.avanzarViaje.mockResolvedValue(true);
      await service.avanzarViajeActual(1, { dni: '30111222' });
      expect(repository.avanzarViaje).toHaveBeenCalledWith(
        5,
        'EN_DOMICILIO',
        'ENTREGADO',
        1,
        'Evidencia: DNI verificado',
      );
    });

    it('un envío viejo sin DNI cargado se entrega igual, avisando que no se verificó', async () => {
      entregando({ requiereDni: true, destinatarioDni: null });
      repository.avanzarViaje.mockResolvedValue(true);
      await service.avanzarViajeActual(1, { dni: '30111222' });
      expect(repository.avanzarViaje.mock.calls[0][4]).toContain(
        'DNI sin verificar',
      );
    });

    it('no entrega sin confirmar que mandó la foto por WhatsApp', async () => {
      entregando({ requiereDni: false, requiereFoto: true });
      await expect(
        service.avanzarViajeActual(1, { fotoEnviada: false }),
      ).rejects.toThrow('Confirmá que mandaste la foto por WhatsApp');
    });

    it('con DNI y foto deja las dos cosas en el historial, sin el número de DNI', async () => {
      entregando({ requiereDni: true, requiereFoto: true });
      repository.avanzarViaje.mockResolvedValue(true);
      await service.avanzarViajeActual(1, {
        dni: '30111222',
        fotoEnviada: true,
      });
      const detalle = repository.avanzarViaje.mock.calls[0][4] as string;
      expect(detalle).toBe(
        'Evidencia: DNI verificado, foto enviada por WhatsApp',
      );
      expect(detalle).not.toContain('30111222');
    });

    it('si el comercio no exige nada, entrega sin evidencia', async () => {
      entregando({ requiereDni: false, requiereFoto: false });
      repository.avanzarViaje.mockResolvedValue(true);
      await service.avanzarViajeActual(1);
      expect(repository.avanzarViaje.mock.calls[0][4]).toBeUndefined();
    });

    it('en los pasos anteriores a la entrega no pide evidencia', async () => {
      repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
        envioEn('RETIRADO'),
      );
      repository.avanzarViaje.mockResolvedValue(true);
      await expect(service.avanzarViajeActual(1)).resolves.toMatchObject({
        estado: 'EN_DOMICILIO',
      });
    });
  });

  it('sin viaje activo, avanzar responde 409', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(null);
    await expect(service.avanzarViajeActual(1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('si el envío cambió en el medio (por ejemplo, lo cancelaron), responde 409', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
      envioEn('ASIGNADO'),
    );
    repository.avanzarViaje.mockResolvedValue(false);
    await expect(service.avanzarViajeActual(1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
