import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ComerciosService } from '../comercios/comercios.service';
import { CrearEnvioDto, TamanoPaquete } from './dto/crear-envio.dto';
import { EnviosRepository } from './envios.repository';
import { EnviosService } from './envios.service';

const comercio = {
  id: 1,
  direccion: 'Calle 1 n° 100',
  activo: true,
  requiereFoto: true,
  requiereDni: false,
};

function dto(cambios: Partial<CrearEnvioDto> = {}): CrearEnvioDto {
  return {
    comercioId: 1,
    destinoDireccion: 'Calle 50 n° 200',
    tamanio: TamanoPaquete.CHICO,
    ...cambios,
  };
}

describe('EnviosService.crear', () => {
  // Los repositories se mockean: acá solo se prueban las reglas de negocio.
  const repository = { crear: jest.fn() };
  const comerciosService = { obtenerPorId: jest.fn() };
  let service: EnviosService;

  function datosGuardados(llamada = 0): Record<string, unknown> {
    return repository.crear.mock.calls[llamada][0] as Record<string, unknown>;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    comerciosService.obtenerPorId.mockResolvedValue(comercio);
    repository.crear.mockImplementation((datos: object) =>
      Promise.resolve({ id: 7, ...datos }),
    );
    service = new EnviosService(
      repository as unknown as EnviosRepository,
      comerciosService as unknown as ComerciosService,
    );
  });

  it.each([
    [TamanoPaquete.CHICO, 'MOTO'],
    [TamanoPaquete.MEDIANO, 'AUTO'],
    [TamanoPaquete.GRANDE, 'CAMION'],
  ])('un paquete %s requiere vehículo %s', async (tamanio, vehiculo) => {
    await service.crear(dto({ tamanio }));
    expect(datosGuardados()).toMatchObject({ vehiculoRequerido: vehiculo });
  });

  it('rechaza un envío de un comercio inactivo', async () => {
    comerciosService.obtenerPorId.mockResolvedValue({
      ...comercio,
      activo: false,
    });
    await expect(service.crear(dto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.crear).not.toHaveBeenCalled();
  });

  it('usa la dirección del comercio como origen si no viene otra', async () => {
    await service.crear(dto());
    expect(datosGuardados()).toMatchObject({
      origenDireccion: comercio.direccion,
    });
  });

  it('copia requiereFoto y requiereDni del comercio', async () => {
    await service.crear(dto());
    expect(datosGuardados()).toMatchObject({
      requiereFoto: true,
      requiereDni: false,
    });
  });

  it('genera un código de 10 caracteres sin 0, O, 1 ni I', async () => {
    for (let i = 0; i < 100; i++) await service.crear(dto());
    for (let i = 0; i < 100; i++) {
      expect(datosGuardados(i).codigoSeguimiento).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/,
      );
    }
  });

  it('si el código de seguimiento choca, genera otro', async () => {
    repository.crear.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await service.crear(dto());
    expect(repository.crear).toHaveBeenCalledTimes(2);
  });
});
