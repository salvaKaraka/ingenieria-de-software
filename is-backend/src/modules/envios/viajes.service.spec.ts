import { ConflictException } from '@nestjs/common';
import type { AsignacionService } from '../asignacion/asignacion.service';
import type { EnviosRepository } from './envios.repository';
import { ViajesService } from './viajes.service';

describe('ViajesService', () => {
  const repository = {
    buscarViajeActivoPorRepartidor: jest.fn(),
    avanzarViaje: jest.fn(),
    buscarRepartidor: jest.fn(),
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
    );
    expect(asignacion.reintentarPendientes).not.toHaveBeenCalled();
  });

  it('al entregar, el motor reintenta los envíos pendientes', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
      envioEn('EN_DOMICILIO'),
    );
    repository.avanzarViaje.mockResolvedValue(true);
    repository.buscarRepartidor.mockResolvedValue({ estado: 'DISPONIBLE' });

    await expect(service.avanzarViajeActual(1)).resolves.toEqual({
      estado: 'ENTREGADO',
      siguienteEstado: null,
    });
    expect(asignacion.reintentarPendientes).toHaveBeenCalled();
  });

  it('al entregar con cierre solicitado, el motor no reintenta envíos pendientes', async () => {
    repository.buscarViajeActivoPorRepartidor.mockResolvedValue(
      envioEn('EN_DOMICILIO'),
    );
    repository.avanzarViaje.mockResolvedValue(true);
    repository.buscarRepartidor.mockResolvedValue({
      estado: 'ESPERANDO_VALIDACION_CIERRE',
      cierreSolicitado: true,
    });

    await expect(service.avanzarViajeActual(1)).resolves.toEqual({
      estado: 'ENTREGADO',
      siguienteEstado: null,
    });
    expect(asignacion.reintentarPendientes).not.toHaveBeenCalled();
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
