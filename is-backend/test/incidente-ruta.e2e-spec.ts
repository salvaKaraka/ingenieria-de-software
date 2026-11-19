import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import { emailUnico, vaciarBase } from './utils';

// Incidentes en ruta (HU 20/21): el repartidor interrumpe el viaje y el envío vuelve al motor.
describe('Incidentes en ruta (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;

  const cookieDe = (id: number, rol: 'OPERARIO' | 'REPARTIDOR') =>
    jwt.signAsync({ sub: id, rol }).then((t) => `access_token=${t}`);

  const crearRepartidor = (estado: 'OCUPADO' | 'DISPONIBLE') =>
    prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Ruta',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
        estado,
        enColaDesde: estado === 'DISPONIBLE' ? new Date() : null,
      },
    });

  const crearEnvio = (
    estado: 'EN_CAMINO_A_RETIRAR' | 'RETIRADO',
    repartidorId: number,
  ) =>
    prisma.envio.create({
      data: {
        codigoSeguimiento: emailUnico().slice(0, 10).toUpperCase(),
        comercioId,
        origenDireccion: 'Calle 50 567',
        origenLat: -34.9,
        origenLon: -57.9,
        duracionEstimadaMin: 20,
        destinoDireccion: 'Avenida 7 1234',
        destinatarioNombre: 'Ana',
        destinatarioApellido: 'Paz',
        destinatarioTelefono: '221 555',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado,
        repartidorId,
      },
    });

  const reportar = async (repartidorId: number, body: object = {}) =>
    request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/incidente')
      .set('Cookie', await cookieDe(repartidorId, 'REPARTIDOR'))
      .send(body);

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
          direccion: 'Calle 50 567',
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('pone en emergencia al repartidor y deja el envío parado si no hay otro disponible', async () => {
    const repartidor = await crearRepartidor('OCUPADO');
    const envio = await crearEnvio('EN_CAMINO_A_RETIRAR', repartidor.id);

    const res = await reportar(repartidor.id);

    expect(res.status).toBe(200);
    expect(res.body.estadoEnvio).toBe('PARADO');
    expect(
      await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      }),
    ).toMatchObject({ estado: 'EMERGENCIA', enColaDesde: null });
    expect(
      await prisma.envio.findUniqueOrThrow({ where: { id: envio.id } }),
    ).toMatchObject({ estado: 'PARADO', repartidorId: null });
  });

  it('ofrece el envío a otro repartidor disponible', async () => {
    const repartidor = await crearRepartidor('OCUPADO');
    const otro = await crearRepartidor('DISPONIBLE');
    const envio = await crearEnvio('EN_CAMINO_A_RETIRAR', repartidor.id);

    const res = await reportar(repartidor.id);

    expect(res.body.estadoEnvio).toBe('PENDIENTE');
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { envioId: envio.id },
    });
    expect(oferta.repartidorId).toBe(otro.id);
  });

  it('con el paquete retirado exige la ubicación y descarta el punto y la duración viejos', async () => {
    const repartidor = await crearRepartidor('OCUPADO');
    const envio = await crearEnvio('RETIRADO', repartidor.id);

    const sinUbicacion = await reportar(repartidor.id);
    expect(sinUbicacion.status).toBe(400);

    const res = await reportar(repartidor.id, { ubicacion: 'Calle 12 y 60' });

    expect(res.status).toBe(200);
    expect(
      await prisma.envio.findUniqueOrThrow({ where: { id: envio.id } }),
    ).toMatchObject({
      origenDireccion: 'Calle 12 y 60',
      origenLat: null,
      origenLon: null,
      duracionEstimadaMin: null,
    });
  });

  it('rechaza el incidente si no tiene un viaje activo', async () => {
    const repartidor = await crearRepartidor('DISPONIBLE');

    expect((await reportar(repartidor.id)).status).toBe(409);
  });

  it('el operario rehabilita a un repartidor en emergencia y vuelve a la cola', async () => {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Emerg',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
        estado: 'EMERGENCIA',
      },
    });
    const operario = await prisma.operario.create({
      data: { nombre: 'Op', usuario: 'op', passwordHash: 'hash' },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/repartidores/${repartidor.id}/rehabilitar`)
      .set('Cookie', await cookieDe(operario.id, 'OPERARIO'));

    expect(res.status).toBe(200);
    expect(
      await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      }),
    ).toMatchObject({ estado: 'DISPONIBLE' });
  });
});
