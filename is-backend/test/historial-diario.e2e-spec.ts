import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

// HU 34 por HTTP contra una base real: lo que importa acá es el filtro de la consulta
// (solo entregados, solo de hoy, solo del repartidor logueado).
describe('Historial diario del repartidor (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;

  const AYER = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const cookieDe = async (id: number, rol = 'REPARTIDOR') =>
    `access_token=${await jwt.signAsync({ sub: id, rol })}`;

  async function crearRepartidor() {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Historial',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
        estado: 'DISPONIBLE',
      },
    });
    return repartidor.id;
  }

  // Crea un envío en el estado dado con el evento que lo dejó ahí, fechado en `cuando`.
  let codigo = 0;
  async function crearEnvio(
    estado: EstadoEnvio,
    repartidorId: number,
    cuando: Date = new Date(),
  ) {
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `HIST${++codigo}`,
        comercioId,
        origenDireccion: 'Calle 7 1234',
        destinoDireccion: 'Calle 50 567',
        destinatarioNombre: 'Ana',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado,
        repartidorId,
        eventos: {
          create: {
            tipo: 'CAMBIO_ESTADO',
            estadoNuevo: estado,
            actorTipo: 'REPARTIDOR',
            actorId: repartidorId,
            creadoEn: cuando,
          },
        },
      },
    });
    return envio.id;
  }

  const historial = async (repartidorId: number) =>
    request(app.getHttpServer())
      .get('/api/repartidor/viajes/historial')
      .set('Cookie', await cookieDe(repartidorId));

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
    jwt = app.get(JwtService);
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

  afterAll(() => app.close());

  it('lista las entregas de hoy con su comercio y la hora de entrega', async () => {
    const repartidor = await crearRepartidor();
    const envioId = await crearEnvio('ENTREGADO', repartidor);

    const res = await historial(repartidor);

    expect(res.status).toBe(200);
    expect(res.body.entregas).toHaveLength(1);
    expect(res.body.entregas[0]).toMatchObject({
      envioId,
      comercio: 'Kiosco',
      destinoDireccion: 'Calle 50 567',
    });
    expect(typeof res.body.entregas[0].entregadoEn).toBe('string');
  });

  it('devuelve la lista vacía si todavía no completó entregas hoy', async () => {
    const repartidor = await crearRepartidor();

    const res = await historial(repartidor);

    expect(res.status).toBe(200);
    expect(res.body.entregas).toEqual([]);
  });

  it('no muestra las entregas de días anteriores', async () => {
    const repartidor = await crearRepartidor();
    await crearEnvio('ENTREGADO', repartidor, AYER);

    const res = await historial(repartidor);

    expect(res.body.entregas).toEqual([]);
  });

  it('no muestra los envíos que no terminaron entregados', async () => {
    const repartidor = await crearRepartidor();
    const entregado = await crearEnvio('ENTREGADO', repartidor);
    await crearEnvio('CANCELADO', repartidor);
    await crearEnvio('EN_DOMICILIO', repartidor);

    const res = await historial(repartidor);

    expect(
      res.body.entregas.map((entrega: { envioId: number }) => entrega.envioId),
    ).toEqual([entregado]);
  });

  it('no muestra las entregas de otro repartidor', async () => {
    const repartidor = await crearRepartidor();
    const otro = await crearRepartidor();
    await crearEnvio('ENTREGADO', otro);

    const res = await historial(repartidor);

    expect(res.body.entregas).toEqual([]);
  });

  it('rechaza a quien no es repartidor', async () => {
    await request(app.getHttpServer())
      .get('/api/repartidor/viajes/historial')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/repartidor/viajes/historial')
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(403);
  });
});
