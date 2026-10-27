import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../../generated/prisma/client';
import { AsignacionService } from '../asignacion/asignacion.service';
import { ComerciosService } from '../comercios/comercios.service';
import { CrearEnvioDto } from './dto/crear-envio.dto';
import { ListarEnviosDto } from './dto/listar-envios.dto';
import { EnviosRepository } from './envios.repository';
import { EnviosService } from './envios.service';

const comercioMock = {
  id: 1,
  direccion: 'Calle 1 n° 100',
  activo: true,
  requiereFoto: true,
  requiereDni: false,
};

function crearDto(cambios: Partial<CrearEnvioDto> = {}): CrearEnvioDto {
  return {
    comercioId: 1,
    destinoDireccion: 'Calle 50 n° 200',
    tamanio: 'CHICO',
    ...cambios,
  };
}

describe('EnviosService', () => {
  const repository = {
    crear: jest.fn(),
    listar: jest.fn(),
    obtenerDetalle: jest.fn(),
    obtenerEstado: jest.fn(),
    cancelar: jest.fn(),
    buscarParaActualizar: jest.fn(),
    actualizar: jest.fn(),
  };

  const comerciosService = {
    obtenerPorId: jest.fn(),
  };

  const asignacion = {
    asignar: jest.fn(),
    reintentarPendientes: jest.fn(),
  };

  const OPERARIO_ID = 3;

  let service: EnviosService;

  function datosGuardados(llamada = 0): Record<string, unknown> {
    return repository.crear.mock.calls[llamada][0] as Record<string, unknown>;
  }

  function filtrosAlRepository(): Record<string, unknown> {
    return repository.listar.mock.calls[0][0] as Record<string, unknown>;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    comerciosService.obtenerPorId.mockResolvedValue(comercioMock);
    repository.crear.mockImplementation((datos: object) =>
      Promise.resolve({ id: 7, ...datos }),
    );
    repository.listar.mockResolvedValue({ datos: [], total: 0 });
    service = new EnviosService(
      repository as unknown as EnviosRepository,
      comerciosService as unknown as ComerciosService,
      asignacion as unknown as AsignacionService,
    );
  });

  describe('crear (B-3)', () => {
    it.each([
      ['CHICO', 'MOTO'],
      ['MEDIANO', 'AUTO'],
      ['GRANDE', 'CAMION'],
    ] as const)(
      'un paquete %s requiere vehículo %s',
      async (tamanio, vehiculo) => {
        await service.crear(crearDto({ tamanio }), OPERARIO_ID);
        expect(datosGuardados()).toMatchObject({ vehiculoRequerido: vehiculo });
      },
    );

    it('rechaza un envío de un comercio inactivo', async () => {
      comerciosService.obtenerPorId.mockResolvedValue({
        ...comercioMock,
        activo: false,
      });

      await expect(
        service.crear(crearDto(), OPERARIO_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('usa la dirección del comercio como origen si no viene otra', async () => {
      await service.crear(crearDto(), OPERARIO_ID);
      expect(datosGuardados()).toMatchObject({
        origenDireccion: comercioMock.direccion,
      });
    });

    it('copia requiereFoto y requiereDni del comercio', async () => {
      await service.crear(crearDto(), OPERARIO_ID);
      expect(datosGuardados()).toMatchObject({
        requiereFoto: true,
        requiereDni: false,
      });
    });

    it('genera un código de 10 caracteres sin 0, O, 1 ni I', async () => {
      for (let i = 0; i < 100; i++)
        await service.crear(crearDto(), OPERARIO_ID);
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
      await service.crear(crearDto(), OPERARIO_ID);
      expect(repository.crear).toHaveBeenCalledTimes(2);
    });

    it('registra qué operario creó el envío', async () => {
      await service.crear(crearDto(), OPERARIO_ID);
      expect(datosGuardados()).toMatchObject({ operarioId: OPERARIO_ID });
    });

    it('le pide al motor que asigne el envío recién creado', async () => {
      await service.crear(crearDto(), OPERARIO_ID);
      expect(asignacion.asignar).toHaveBeenCalledWith(7);
    });

    it('si el motor falla, el envío igual queda creado', async () => {
      asignacion.asignar.mockRejectedValue(new Error('sin conexión'));
      await expect(
        service.crear(crearDto(), OPERARIO_ID),
      ).resolves.toMatchObject({ id: 7 });
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

    it('después de cancelar, el motor reintenta los envíos pendientes', async () => {
      repository.obtenerEstado.mockResolvedValue({ id: 5, estado: 'ASIGNADO' });
      repository.cancelar.mockResolvedValue({ id: 5, estado: 'CANCELADO' });
      await service.cancelar(5, 12);
      expect(asignacion.reintentarPendientes).toHaveBeenCalled();
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

  describe('actualizar', () => {
    it('actualiza un envío en estado PENDIENTE sin cambiar de vehículo', async () => {
      repository.buscarParaActualizar.mockResolvedValue({
        id: 5,
        estado: 'PENDIENTE',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        destinoDireccion: 'Calle 50 123',
        repartidorId: null,
      });
      repository.actualizar.mockResolvedValue({
        id: 5,
        destinatarioNombre: 'Carlos',
      });

      const resultado = await service.actualizar(
        5,
        { destinatarioNombre: 'Carlos' },
        OPERARIO_ID,
      );

      expect(resultado).toMatchObject({ id: 5, destinatarioNombre: 'Carlos' });
      expect(repository.actualizar).toHaveBeenCalledWith(
        5,
        'PENDIENTE',
        { destinatarioNombre: 'Carlos' },
        OPERARIO_ID,
        { cambiaVehiculo: false, avisoDireccion: false },
      );
      expect(asignacion.asignar).not.toHaveBeenCalled();
      expect(asignacion.reintentarPendientes).not.toHaveBeenCalled();
    });

    it('al cambiar el tamaño que requiere otro vehículo, resetea a PENDIENTE, libera al repartidor y llama al motor', async () => {
      repository.buscarParaActualizar.mockResolvedValue({
        id: 5,
        estado: 'ASIGNADO',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        destinoDireccion: 'Calle 50 123',
        repartidorId: 8,
      });
      repository.actualizar.mockResolvedValue({
        id: 5,
        tamanio: 'GRANDE',
        vehiculoRequerido: 'CAMION',
        estado: 'PENDIENTE',
        repartidorId: null,
      });

      await service.actualizar(5, { tamanio: 'GRANDE' }, OPERARIO_ID);

      expect(repository.actualizar).toHaveBeenCalledWith(
        5,
        'ASIGNADO',
        { tamanio: 'GRANDE', vehiculoRequerido: 'CAMION' },
        OPERARIO_ID,
        { cambiaVehiculo: true, avisoDireccion: false },
      );
      expect(asignacion.asignar).toHaveBeenCalledWith(5);
      expect(asignacion.reintentarPendientes).toHaveBeenCalled();
    });

    it('al cambiar la dirección de entrega con repartidor asignado, activa avisoDireccion', async () => {
      repository.buscarParaActualizar.mockResolvedValue({
        id: 5,
        estado: 'EN_CAMINO_A_RETIRAR',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        destinoDireccion: 'Calle 50 123',
        repartidorId: 8,
      });
      repository.actualizar.mockResolvedValue({
        id: 5,
        destinoDireccion: 'Nueva direccion 456',
      });

      await service.actualizar(
        5,
        { destinoDireccion: 'Nueva direccion 456' },
        OPERARIO_ID,
      );

      expect(repository.actualizar).toHaveBeenCalledWith(
        5,
        'EN_CAMINO_A_RETIRAR',
        { destinoDireccion: 'Nueva direccion 456' },
        OPERARIO_ID,
        { cambiaVehiculo: false, avisoDireccion: true },
      );
    });

    it('rechaza con 409 y mensaje exacto si el paquete ya fue retirado', async () => {
      repository.buscarParaActualizar.mockResolvedValue({
        id: 5,
        estado: 'RETIRADO',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        destinoDireccion: 'Calle 50 123',
        repartidorId: 8,
      });

      await expect(
        service.actualizar(5, { destinatarioNombre: 'Juan' }, OPERARIO_ID),
      ).rejects.toThrow(
        new ConflictException(
          'No se puede modificar: el paquete ya fue retirado',
        ),
      );
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('rechaza con 404 si el envío no existe', async () => {
      repository.buscarParaActualizar.mockResolvedValue(null);

      await expect(
        service.actualizar(99, { destinatarioNombre: 'Juan' }, OPERARIO_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
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
