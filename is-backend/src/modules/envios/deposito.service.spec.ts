import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AsignacionService } from '../asignacion/asignacion.service';
import { ComerciosService } from '../comercios/comercios.service';
import { DepositoRepository } from './deposito.repository';
import { DepositoService } from './deposito.service';
import { EnviosRepository } from './envios.repository';
import { EnviosService } from './envios.service';
import { ViajesService } from './viajes.service';

const FOTO_VALIDA = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
const COMERCIO = { id: 1, nombre: 'Panadería Sol', direccion: 'Calle 7 123' };

describe('Depósito y devoluciones (HU 37, 38, 39 y 40)', () => {
  let depositoService: DepositoService;
  let viajesService: ViajesService;
  let enviosService: EnviosService;

  const depositoRepository = {
    buscarPorCodigo: jest.fn(),
    estadoDelRepartidor: jest.fn(),
    registrarReingresoCustodia: jest.fn(),
    listarEnCustodia: jest.fn(),
    crearOrdenDevolucion: jest.fn(),
    buscarOrdenActivaPorRepartidor: jest.fn(),
    listarOrdenes: jest.fn(),
    confirmarDevolucion: jest.fn(),
  };
  const enviosRepository = {
    obtenerEstado: jest.fn(),
    cancelar: jest.fn(),
    buscarViajeActivoPorRepartidor: jest.fn(),
  };
  const comerciosService = { obtenerPorId: jest.fn() };
  const asignacionService = {
    asignar: jest.fn(),
    reintentarPendientes: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        DepositoService,
        ViajesService,
        EnviosService,
        { provide: DepositoRepository, useValue: depositoRepository },
        { provide: EnviosRepository, useValue: enviosRepository },
        { provide: ComerciosService, useValue: comerciosService },
        { provide: AsignacionService, useValue: asignacionService },
      ],
    }).compile();

    depositoService = modulo.get(DepositoService);
    viajesService = modulo.get(ViajesService);
    enviosService = modulo.get(EnviosService);
  });

  describe('HU 37 · Reingreso al depósito', () => {
    const paqueteADevolver = {
      id: 10,
      codigoSeguimiento: 'PKG1234567',
      estado: 'A_DEVOLVER',
      repartidorId: 5,
      reintentoPendiente: false,
      comercio: COMERCIO,
    };

    it('escenarios 1 y 4: pasa el paquete a En custodia con fecha y operario', async () => {
      const fechaReingreso = new Date('2026-11-17T18:00:00.000Z');
      depositoRepository.buscarPorCodigo.mockResolvedValue(paqueteADevolver);
      depositoRepository.estadoDelRepartidor.mockResolvedValue(
        'ESPERANDO_VALIDACION_CIERRE',
      );
      depositoRepository.registrarReingresoCustodia.mockResolvedValue({
        fechaReingreso,
        operarioNombre: 'Ana Pérez',
      });

      const respuesta = await depositoService.registrarReingreso(
        { repartidorId: 5, codigoSeguimiento: 'PKG1234567' },
        7,
      );

      expect(
        depositoRepository.registrarReingresoCustodia,
      ).toHaveBeenCalledWith(10, 'A_DEVOLVER', 7);
      expect(respuesta).toMatchObject({
        estado: 'EN_CUSTODIA',
        fechaReingreso,
        operarioNombre: 'Ana Pérez',
      });
    });

    it('escenario 2: rechaza un paquete de otro repartidor', async () => {
      depositoRepository.buscarPorCodigo.mockResolvedValue({
        ...paqueteADevolver,
        repartidorId: 99,
      });

      await expect(
        depositoService.registrarReingreso(
          { repartidorId: 5, codigoSeguimiento: 'PKG1234567' },
          7,
        ),
      ).rejects.toThrow(
        new ConflictException(
          'El paquete no pertenece a la jornada de este repartidor',
        ),
      );
    });

    it('rechaza un envío con novedad que el operario mandó a reintentar', async () => {
      depositoRepository.buscarPorCodigo.mockResolvedValue({
        ...paqueteADevolver,
        estado: 'CON_NOVEDAD',
        reintentoPendiente: true,
      });

      await expect(
        depositoService.registrarReingreso(
          { repartidorId: 5, codigoSeguimiento: 'PKG1234567' },
          7,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('exige que el repartidor esté rindiendo su jornada', async () => {
      depositoRepository.buscarPorCodigo.mockResolvedValue(paqueteADevolver);
      depositoRepository.estadoDelRepartidor.mockResolvedValue('DISPONIBLE');

      await expect(
        depositoService.registrarReingreso(
          { repartidorId: 5, codigoSeguimiento: 'PKG1234567' },
          7,
        ),
      ).rejects.toThrow(ConflictException);
      expect(
        depositoRepository.registrarReingresoCustodia,
      ).not.toHaveBeenCalled();
    });

    it('escenario 3: rechaza un código inexistente', async () => {
      depositoRepository.buscarPorCodigo.mockResolvedValue(null);

      await expect(
        depositoService.registrarReingreso(
          { repartidorId: 5, codigoSeguimiento: 'NOEXISTE' },
          7,
        ),
      ).rejects.toThrow(
        new NotFoundException('El código no corresponde a ningún envío'),
      );
    });
  });

  describe('HU 38 · Orden de devolución', () => {
    const custodia = (id: number) => ({
      id,
      codigoSeguimiento: `PKG${id}`,
      destinoDireccion: 'Calle 50 100',
      tamanio: 'CHICO',
      comercio: COMERCIO,
      eventos: [{ creadoEn: new Date() }],
    });

    it('escenario 1: crea la orden y la manda a la asignación', async () => {
      comerciosService.obtenerPorId.mockResolvedValue(COMERCIO);
      depositoRepository.listarEnCustodia.mockResolvedValue([
        custodia(1),
        custodia(2),
        custodia(3),
      ]);
      depositoRepository.crearOrdenDevolucion.mockResolvedValue({
        orden: { id: 4, creadaEn: new Date() },
        representanteId: 1,
      });
      asignacionService.asignar.mockResolvedValue({ id: 9 });

      const respuesta = await depositoService.crearOrdenDevolucion(
        { comercioId: 1, envioIds: [1, 2, 3] },
        7,
      );

      expect(depositoRepository.crearOrdenDevolucion).toHaveBeenCalledWith(
        1,
        [1, 2, 3],
        7,
      );
      expect(asignacionService.asignar).toHaveBeenCalledWith(1);
      expect(respuesta).toMatchObject({
        ordenId: 4,
        estado: 'EN_DEVOLUCION',
        cantidadPaquetes: 3,
        ofrecida: true,
      });
    });

    it('escenario 2: avisa si el comercio no tiene paquetes en custodia', async () => {
      comerciosService.obtenerPorId.mockResolvedValue(COMERCIO);
      depositoRepository.listarEnCustodia.mockResolvedValue([]);

      await expect(
        depositoService.listarPaquetesEnCustodiaPorComercio(1),
      ).rejects.toThrow(
        new BadRequestException(
          'No hay paquetes en custodia para este comercio',
        ),
      );
    });

    it('escenario 3: rechaza un paquete que ya no está en custodia', async () => {
      comerciosService.obtenerPorId.mockResolvedValue(COMERCIO);
      depositoRepository.listarEnCustodia.mockResolvedValue([
        custodia(1),
        custodia(2),
      ]);

      await expect(
        depositoService.crearOrdenDevolucion(
          { comercioId: 1, envioIds: [1, 3] },
          7,
        ),
      ).rejects.toThrow(ConflictException);
      expect(depositoRepository.crearOrdenDevolucion).not.toHaveBeenCalled();
    });
  });

  describe('HU 39 · Confirmar devolución', () => {
    const orden = {
      id: 4,
      comercio: { ...COMERCIO, telefono: '221' },
      envios: [
        { id: 1, codigoSeguimiento: 'PKG1', tamanio: 'CHICO' },
        { id: 2, codigoSeguimiento: 'PKG2', tamanio: 'CHICO' },
      ],
    };

    it('escenario 1: confirma toda la orden y libera al repartidor', async () => {
      depositoRepository.buscarOrdenActivaPorRepartidor.mockResolvedValue(
        orden,
      );
      depositoRepository.confirmarDevolucion.mockResolvedValue(true);

      const respuesta = await viajesService.confirmarDevolucionActual(5, {
        foto: FOTO_VALIDA,
      });

      expect(depositoRepository.confirmarDevolucion).toHaveBeenCalledWith(
        4,
        5,
        FOTO_VALIDA,
      );
      expect(asignacionService.reintentarPendientes).toHaveBeenCalled();
      expect(respuesta).toEqual({
        ordenId: 4,
        estado: 'DEVUELTO_AL_COMERCIO',
        cantidadPaquetes: 2,
        mensaje: 'Devolución confirmada en Panadería Sol',
      });
    });

    it('escenario 2: sin foto muestra "Falta la foto de la constancia"', async () => {
      await expect(
        viajesService.confirmarDevolucionActual(5, {}),
      ).rejects.toThrow(
        new BadRequestException('Falta la foto de la constancia'),
      );
      expect(depositoRepository.confirmarDevolucion).not.toHaveBeenCalled();
    });

    it('escenario 3: no se puede cancelar un envío devuelto al comercio', async () => {
      enviosRepository.obtenerEstado.mockResolvedValue({
        _count: { eventos: 0 },
        id: 1,
        estado: 'DEVUELTO_AL_COMERCIO',
      });

      await expect(enviosService.cancelar(1, 7)).rejects.toThrow(
        new ConflictException('El envío ya finalizó su ciclo'),
      );
      expect(enviosRepository.cancelar).not.toHaveBeenCalled();
    });

    it('muestra la orden como viaje de devolución del repartidor', async () => {
      enviosRepository.buscarViajeActivoPorRepartidor.mockResolvedValue(null);
      depositoRepository.buscarOrdenActivaPorRepartidor.mockResolvedValue(
        orden,
      );

      const { viaje } = await viajesService.obtenerViajeActual(5);

      expect(viaje).toMatchObject({
        estado: 'EN_DEVOLUCION',
        esDevolucion: true,
        destinoDireccion: 'Calle 7 123',
        paquetes: ['PKG1', 'PKG2'],
        requiereFoto: true,
      });
    });
  });

  describe('HU 40 · Alerta de paquetes demorados', () => {
    it('lista solo los que llevan 24 horas o más, los más demorados primero', async () => {
      const ahora = new Date('2026-11-17T18:00:00.000Z');
      const hace = (horas: number) =>
        new Date(ahora.getTime() - horas * 3_600_000);
      depositoRepository.listarEnCustodia.mockResolvedValue([
        {
          id: 1,
          codigoSeguimiento: 'A',
          comercio: COMERCIO,
          eventos: [{ creadoEn: hace(24) }],
        },
        {
          id: 2,
          codigoSeguimiento: 'B',
          comercio: COMERCIO,
          eventos: [{ creadoEn: hace(10) }],
        },
        {
          id: 3,
          codigoSeguimiento: 'C',
          comercio: COMERCIO,
          eventos: [{ creadoEn: hace(25) }],
        },
      ]);

      const alertas =
        await depositoService.listarDevolucionesPendientesConAlerta(ahora);

      expect(
        alertas.map((a) => [a.codigoSeguimiento, a.horasEnCustodia]),
      ).toEqual([
        ['C', 25],
        ['A', 24],
      ]);
    });
  });

  describe('Pestaña Depósito', () => {
    it('agrupa la custodia por comercio y resume el estado de cada orden', async () => {
      const ahora = new Date('2026-11-17T18:00:00.000Z');
      const hace = (horas: number) =>
        new Date(ahora.getTime() - horas * 3_600_000);
      const otro = { id: 2, nombre: 'Almacén Luz', direccion: 'Calle 1 1' };
      depositoRepository.listarEnCustodia.mockResolvedValue([
        {
          id: 1,
          codigoSeguimiento: 'A',
          destinoDireccion: 'x',
          tamanio: 'CHICO',
          comercio: COMERCIO,
          eventos: [{ creadoEn: hace(30) }],
        },
        {
          id: 2,
          codigoSeguimiento: 'B',
          destinoDireccion: 'y',
          tamanio: 'CHICO',
          comercio: otro,
          eventos: [{ creadoEn: hace(2) }],
        },
        {
          id: 3,
          codigoSeguimiento: 'C',
          destinoDireccion: 'z',
          tamanio: 'CHICO',
          comercio: COMERCIO,
          eventos: [{ creadoEn: hace(5) }],
        },
      ]);
      const paquete = (id: number, ofertas: object[] = []) => ({
        id,
        codigoSeguimiento: `P${id}`,
        estado: 'EN_DEVOLUCION',
        ofertas,
      });
      depositoRepository.listarOrdenes.mockResolvedValue([
        {
          id: 1,
          creadaEn: ahora,
          confirmadaEn: null,
          comercio: COMERCIO,
          repartidor: null,
          envios: [paquete(10), paquete(11)],
        },
        {
          id: 2,
          creadaEn: ahora,
          confirmadaEn: null,
          comercio: COMERCIO,
          repartidor: null,
          envios: [
            paquete(12, [{ repartidor: { nombre: 'Ana', apellido: 'Paz' } }]),
          ],
        },
        {
          id: 3,
          creadaEn: ahora,
          confirmadaEn: null,
          comercio: COMERCIO,
          repartidor: { nombre: 'Lu', apellido: 'Gó' },
          envios: [paquete(13)],
        },
        {
          id: 4,
          creadaEn: ahora,
          confirmadaEn: ahora,
          comercio: COMERCIO,
          repartidor: { nombre: 'Lu', apellido: 'Gó' },
          envios: [paquete(14)],
        },
      ]);

      const { custodia, ordenes } = await depositoService.resumen(ahora);

      expect(
        custodia.map((g) => [
          g.comercio.nombre,
          g.paquetes.map((p) => [p.codigoSeguimiento, p.alerta]),
        ]),
      ).toEqual([
        ['Almacén Luz', [['B', false]]],
        [
          'Panadería Sol',
          [
            ['A', true],
            ['C', false],
          ],
        ],
      ]);
      expect(
        ordenes.map((o) => [o.estado, o.repartidor, o.paquetes.length]),
      ).toEqual([
        ['SIN_REPARTIDOR', null, 2],
        ['OFRECIDA', 'Ana Paz', 1],
        ['EN_CAMINO', 'Lu Gó', 1],
        ['DEVUELTA', 'Lu Gó', 1],
      ]);
    });
  });
});
