import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AsignacionService } from '../asignacion/asignacion.service';
import type { EnviosRepository } from './envios.repository';
import { ViajesService } from './viajes.service';

describe('ViajesService', () => {
  const repository = {
    buscarViajeActivoPorRepartidor: jest.fn(),
    avanzarViaje: jest.fn(),
    guardarFotoEnvio: jest.fn(),
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
    fotoUrl: null,
    eventos: [] as { detalle: string | null }[],
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

  it('avisa al repartidor si el operario cambió la dirección de entrega', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue({
      ...envioEn('EN_CAMINO_A_RETIRAR'),
      eventos: [{ detalle: 'La dirección de entrega fue modificada' }],
    });
    const { viaje } = await service.obtenerViajeActual(1);
    expect(viaje?.aviso).toBe('La dirección de entrega fue modificada');
  });

  it('sin novedades del operario no muestra aviso', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
      envioEn('ASIGNADO'),
    );
    const { viaje } = await service.obtenerViajeActual(1);
    expect(viaje?.aviso).toBeNull();
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

  describe('evidencia de entrega (E-4 / HU 18)', () => {
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
        undefined,
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

    // Escenario 2: Finalización fallida por falta de foto con texto textual verbatim
    it('rechaza la entrega si el comercio exige foto y no se cargó ninguna (Escenario 2)', async () => {
      entregando({ requiereDni: false, requiereFoto: true });
      await expect(service.avanzarViajeActual(1, {})).rejects.toThrow(
        'Este comercio exige una foto de la entrega',
      );
      expect(repository.avanzarViaje).not.toHaveBeenCalled();
    });

    // Escenario 1: Entrega con foto exitosa
    it('completa la entrega exitosamente cuando se envía la foto requerida (Escenario 1)', async () => {
      entregando({ requiereDni: false, requiereFoto: true });
      repository.avanzarViaje.mockResolvedValue(true);
      const fotoData = 'data:image/jpeg;base64,abc123foto';

      await expect(
        service.avanzarViajeActual(1, { foto: fotoData }),
      ).resolves.toEqual({
        estado: 'ENTREGADO',
        siguienteEstado: null,
      });

      expect(repository.avanzarViaje).toHaveBeenCalledWith(
        5,
        'EN_DOMICILIO',
        'ENTREGADO',
        1,
        'Evidencia: foto adjunta',
        fotoData,
      );
    });

    // Escenario 3: Finalización sin foto cuando no se exige
    it('permite finalizar entrega sin foto si el comercio solo exige DNI y ya se ingresó (Escenario 3)', async () => {
      entregando({ requiereDni: true, requiereFoto: false });
      repository.avanzarViaje.mockResolvedValue(true);

      await expect(
        service.avanzarViajeActual(1, { dni: '30111222' }),
      ).resolves.toEqual({
        estado: 'ENTREGADO',
        siguienteEstado: null,
      });

      expect(repository.avanzarViaje).toHaveBeenCalledWith(
        5,
        'EN_DOMICILIO',
        'ENTREGADO',
        1,
        'Evidencia: DNI verificado',
        undefined,
      );
    });

    it('con DNI y foto deja las dos cosas en el historial', async () => {
      entregando({ requiereDni: true, requiereFoto: true });
      repository.avanzarViaje.mockResolvedValue(true);
      const fotoData = 'data:image/png;base64,fotoprueba';

      await service.avanzarViajeActual(1, {
        dni: '30111222',
        foto: fotoData,
      });

      expect(repository.avanzarViaje).toHaveBeenCalledWith(
        5,
        'EN_DOMICILIO',
        'ENTREGADO',
        1,
        'Evidencia: DNI verificado, foto adjunta',
        fotoData,
      );
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

    it('adjuntarFoto solo permite capturar en EN_DOMICILIO', async () => {
      repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
        envioEn('EN_CAMINO_A_RETIRAR'),
      );
      await expect(
        service.adjuntarFoto(1, 'data:image/jpeg;base64,123'),
      ).rejects.toThrow(ConflictException);

      repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
        envioEn('EN_DOMICILIO'),
      );
      repository.guardarFotoEnvio.mockResolvedValue(true);
      await expect(
        service.adjuntarFoto(1, 'data:image/jpeg;base64,123'),
      ).resolves.toEqual({
        ok: true,
        fotoUrl: 'data:image/jpeg;base64,123',
      });
      expect(repository.guardarFotoEnvio).toHaveBeenCalledWith(
        5,
        'data:image/jpeg;base64,123',
      );
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
