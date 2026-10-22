import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../../generated/prisma/client';
import { ComerciosService } from '../comercios/comercios.service';
import { CrearEnvioDto, TamanoPaquete } from './dto/crear-envio.dto';
import { ListarEnviosDto } from './dto/listar-envios.dto';
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

describe('EnviosService', () => {
  // Los repositories se mockean: acá solo se prueban las reglas de negocio.
  const repository = {
    crear: jest.fn(),
    listar: jest.fn(),
    obtenerDetalle: jest.fn(),
    obtenerEstado: jest.fn(),
    cancelar: jest.fn(),
  };
  const comerciosService = { obtenerPorId: jest.fn() };
  let service: EnviosService;

  function datosGuardados(llamada = 0): Record<string, unknown> {
    return repository.crear.mock.calls[llamada][0] as Record<string, unknown>;
  }

  function filtrosAlRepository(): Record<string, unknown> {
    return repository.listar.mock.calls[0][0] as Record<string, unknown>;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    comerciosService.obtenerPorId.mockResolvedValue(comercio);
    repository.crear.mockImplementation((datos: object) =>
      Promise.resolve({ id: 7, ...datos }),
    );
    repository.listar.mockResolvedValue({ datos: [], total: 0 });
    service = new EnviosService(
      repository as unknown as EnviosRepository,
      comerciosService as unknown as ComerciosService,
    );
  });

  describe('crear (B-3)', () => {
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

  describe('listar (B-4)', () => {
    it('sin filtros usa la página 1 con 20 resultados', async () => {
      const respuesta = await service.listar({});
      expect(filtrosAlRepository()).toMatchObject({ saltar: 0, tomar: 20 });
      expect(respuesta).toMatchObject({ pagina: 1, limite: 20 });
    });

    it('calcula cuántos envíos saltear según la página', async () => {
      await service.listar({ pagina: 3, limite: 10 });
      expect(filtrosAlRepository()).toMatchObject({ saltar: 20, tomar: 10 });
    });

    it('devuelve el total de páginas', async () => {
      repository.listar.mockResolvedValue({ datos: [], total: 45 });
      const respuesta = await service.listar({ limite: 20 });
      expect(respuesta.totalPaginas).toBe(3);
    });

    it('pasa los filtros al repository y limpia la búsqueda', async () => {
      await service.listar({
        estado: ['PENDIENTE'],
        comercioId: 4,
        q: '  juan  ',
      });
      expect(filtrosAlRepository()).toMatchObject({
        estados: ['PENDIENTE'],
        comercioId: 4,
        q: 'juan',
      });
    });

    it('una búsqueda de solo espacios no filtra nada', async () => {
      await service.listar({ q: '   ' });
      expect(filtrosAlRepository().q).toBeUndefined();
    });

    it('"hasta" sin hora incluye el día completo', async () => {
      await service.listar({ hasta: '2026-10-21' });
      const hasta = filtrosAlRepository().hasta as Date;
      expect(hasta.toISOString()).toBe('2026-10-21T23:59:59.999Z');
    });

    it('rechaza "desde" posterior a "hasta" (400)', async () => {
      await expect(
        service.listar({ desde: '2026-10-22', hasta: '2026-10-21' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.listar).not.toHaveBeenCalled();
    });
  });

  describe('obtenerDetalle (B-4)', () => {
    it('devuelve el envío con su historial', async () => {
      repository.obtenerDetalle.mockResolvedValue({ id: 5, eventos: [] });
      await expect(service.obtenerDetalle(5)).resolves.toMatchObject({ id: 5 });
    });

    it('responde 404 si el envío no existe', async () => {
      repository.obtenerDetalle.mockResolvedValue(null);
      await expect(service.obtenerDetalle(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('cancelar (B-4)', () => {
    it('cancela un envío pendiente y registra quién lo hizo', async () => {
      repository.obtenerEstado.mockResolvedValue({
        id: 5,
        estado: 'PENDIENTE',
      });
      repository.cancelar.mockResolvedValue({ id: 5, estado: 'CANCELADO' });
      await service.cancelar(5, 12);
      expect(repository.cancelar).toHaveBeenCalledWith(5, 'PENDIENTE', 12);
    });

    it.each(['ASIGNADO', 'EN_CAMINO_A_RETIRAR', 'RETIRADO', 'EN_DOMICILIO'])(
      'permite cancelar un envío en estado %s',
      async (estado) => {
        repository.obtenerEstado.mockResolvedValue({ id: 5, estado });
        repository.cancelar.mockResolvedValue({ id: 5, estado: 'CANCELADO' });
        await expect(service.cancelar(5, 12)).resolves.toBeDefined();
      },
    );

    it('cancelar un envío entregado da 409', async () => {
      repository.obtenerEstado.mockResolvedValue({
        id: 5,
        estado: 'ENTREGADO',
      });
      await expect(service.cancelar(5, 12)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.cancelar).not.toHaveBeenCalled();
    });

    it('cancelar un envío ya cancelado da 409', async () => {
      repository.obtenerEstado.mockResolvedValue({
        id: 5,
        estado: 'CANCELADO',
      });
      await expect(service.cancelar(5, 12)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('cancelar un envío inexistente da 404', async () => {
      repository.obtenerEstado.mockResolvedValue(null);
      await expect(service.cancelar(99, 12)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('si el estado cambió mientras se cancelaba, da 409', async () => {
      repository.obtenerEstado.mockResolvedValue({ id: 5, estado: 'RETIRADO' });
      repository.cancelar.mockResolvedValue(null);
      await expect(service.cancelar(5, 12)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});

describe('ListarEnviosDto', () => {
  async function validar(consulta: object) {
    const instancia = plainToInstance(ListarEnviosDto, consulta);
    const errores = await validate(instancia);
    return { instancia, campos: errores.map((e) => e.property).sort() };
  }

  it('convierte los números que llegan como texto', async () => {
    const { instancia, campos } = await validar({
      comercioId: '3',
      pagina: '2',
      limite: '50',
    });
    expect(campos).toEqual([]);
    expect(instancia).toMatchObject({ comercioId: 3, pagina: 2, limite: 50 });
  });

  it('acepta uno o varios estados separados por coma', async () => {
    const uno = await validar({ estado: 'PENDIENTE' });
    const varios = await validar({ estado: 'ASIGNADO,RETIRADO' });
    expect(uno.instancia.estado).toEqual(['PENDIENTE']);
    expect(varios.instancia.estado).toEqual(['ASIGNADO', 'RETIRADO']);
    expect(varios.campos).toEqual([]);
  });

  it('rechaza un estado inventado', async () => {
    expect((await validar({ estado: 'VOLANDO' })).campos).toEqual(['estado']);
  });

  it('rechaza fechas inválidas y límites fuera de rango', async () => {
    const { campos } = await validar({
      desde: 'ayer',
      hasta: '2026-13-45',
      limite: '500',
    });
    expect(campos).toEqual(['desde', 'hasta', 'limite']);
  });

  it('sin parámetros es válido', async () => {
    expect((await validar({})).campos).toEqual([]);
  });
});
