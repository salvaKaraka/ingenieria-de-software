import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import { MapasService } from '../src/modules/mapas/mapas.service';
import type { EstadoEnvio, TipoVehiculo } from '../src/generated/prisma/client';
import { vaciarBase } from './utils';

// HU 70 contra una base real. El mapa se simula (los tests no salen a internet); lo que
// importa es el plan B (qué entregas entran al promedio) y que la franja quede guardada.
describe('Franja estimada de llegada (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let comercioId: number;

  const hora = (hhmm: string) => new Date(`2026-11-12T${hhmm}:00Z`);
  const masMinutos = (fecha: Date, minutos: number) =>
    new Date(fecha.getTime() + minutos * 60_000);

  const TAMANIO = { MOTO: 'CHICO', AUTO: 'MEDIANO', CAMION: 'GRANDE' } as const;

  // Crea un envío con los eventos de estado dados (estado y momento), y lo deja en el último.
  let codigo = 0;
  async function crearEnvio(
    vehiculo: TipoVehiculo,
    eventos: [EstadoEnvio, Date][],
  ) {
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `FRANJA${++codigo}`,
        comercioId,
        origenDireccion: 'Calle 7 1234',
        destinoDireccion: 'Calle 50 567',
        tamanio: TAMANIO[vehiculo],
        vehiculoRequerido: vehiculo,
        requiereFoto: false,
        requiereDni: false,
        estado: eventos[eventos.length - 1][0],
        eventos: {
          create: eventos.map(([estadoNuevo, creadoEn]) => ({
            tipo: 'CAMBIO_ESTADO',
            estadoNuevo,
            actorTipo: 'REPARTIDOR',
            creadoEn,
          })),
        },
      },
    });
    return envio.codigoSeguimiento;
  }

  // n entregas ya terminadas: cada una sale a `salida` y tarda `minutos`.
  async function crearEntregas(
    vehiculo: TipoVehiculo,
    n: number,
    salida: Date,
    minutos: number,
  ) {
    for (let i = 0; i < n; i++) {
      await crearEnvio(vehiculo, [
        ['RETIRADO', salida],
        ['ENTREGADO', masMinutos(salida, minutos)],
      ]);
    }
  }

  const consultar = (codigoSeguimiento: string) =>
    request(app.getHttpServer()).get(`/api/seguimiento/${codigoSeguimiento}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configurarApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Kiosco',
          telefono: '221 555',
          email: 'c@test.com',
          direccion: 'Calle 7 1234',
        },
      })
    ).id;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => app.close());

  it('usa la ruta del mapa más 10 minutos para entregar, y la guarda para las próximas consultas', async () => {
    const mapa = jest
      .spyOn(app.get(MapasService), 'duracionDelViajeMin')
      .mockResolvedValueOnce(25)
      // Si se volviera a calcular, el mapa daría otra cosa y la franja cambiaría.
      .mockResolvedValue(90);
    const codigoSeguimiento = await crearEnvio('MOTO', [
      ['RETIRADO', hora('14:00')],
    ]);

    const primera = await consultar(codigoSeguimiento);
    const segunda = await consultar(codigoSeguimiento);

    // 14:00 + 25 de manejo + 10 para entregar = 14:35 -> de 14:20 a 14:50
    expect(primera.body.franjaEstimadaInicio).toBe('2026-11-12T14:20:00.000Z');
    expect(primera.body.franjaEstimadaFin).toBe('2026-11-12T14:50:00.000Z');
    expect(segunda.body.franjaEstimadaInicio).toBe(
      primera.body.franjaEstimadaInicio,
    );
    expect(mapa).toHaveBeenCalledTimes(1);
    expect(mapa).toHaveBeenCalledWith(
      { direccion: 'Calle 7 1234', coordenadas: null },
      { direccion: 'Calle 50 567', coordenadas: null },
      'MOTO',
    );
  });

  it('si el mapa falla, promedia solo las entregas del mismo vehículo', async () => {
    await crearEntregas('MOTO', 5, hora('10:00'), 40);
    // Los camiones tardan otra cosa: no tienen que mover el promedio de las motos.
    await crearEntregas('CAMION', 5, hora('10:00'), 120);
    const codigoSeguimiento = await crearEnvio('MOTO', [
      ['ASIGNADO', hora('13:30')],
      ['RETIRADO', hora('14:00')],
    ]);

    const res = await consultar(codigoSeguimiento);

    expect(res.status).toBe(200);
    expect(res.body.franjaEstimadaInicio).toBe('2026-11-12T14:25:00.000Z');
    expect(res.body.franjaEstimadaFin).toBe('2026-11-12T14:55:00.000Z');
  });

  it('usa 60 minutos si hay menos de 5 entregas con ese vehículo', async () => {
    await crearEntregas('CAMION', 4, hora('08:00'), 20);
    const codigoSeguimiento = await crearEnvio('CAMION', [
      ['RETIRADO', hora('10:00')],
    ]);

    const res = await consultar(codigoSeguimiento);

    expect(res.body.franjaEstimadaInicio).toBe('2026-11-12T10:45:00.000Z');
    expect(res.body.franjaEstimadaFin).toBe('2026-11-12T11:15:00.000Z');
  });

  it('la franja no cambia cuando otros repartidores terminan entregas después', async () => {
    await crearEntregas('MOTO', 5, hora('10:00'), 40);
    const codigoSeguimiento = await crearEnvio('MOTO', [
      ['RETIRADO', hora('14:00')],
    ]);
    const antes = await consultar(codigoSeguimiento);

    // Entregas rapidísimas que terminan después de que salió el paquete consultado.
    await crearEntregas('MOTO', 10, hora('14:05'), 5);
    const despues = await consultar(codigoSeguimiento);

    expect(despues.body.franjaEstimadaInicio).toBe(
      antes.body.franjaEstimadaInicio,
    );
    expect(despues.body.franjaEstimadaFin).toBe(antes.body.franjaEstimadaFin);
  });

  it('no muestra franja si el envío todavía no salió', async () => {
    const codigoSeguimiento = await crearEnvio('MOTO', [
      ['ASIGNADO', hora('13:30')],
    ]);

    const res = await consultar(codigoSeguimiento);

    expect(res.body.franjaEstimadaInicio).toBeUndefined();
    expect(res.body.horaSalida).toBeUndefined();
  });

  it('en un envío entregado muestra la hora de entrega y no la franja', async () => {
    const codigoSeguimiento = await crearEnvio('MOTO', [
      ['RETIRADO', hora('14:00')],
      ['ENTREGADO', hora('14:35')],
    ]);

    const res = await consultar(codigoSeguimiento);

    expect(res.body.fechaEntrega).toBe('2026-11-12T14:35:00.000Z');
    expect(res.body.franjaEstimadaInicio).toBeUndefined();
  });
});
