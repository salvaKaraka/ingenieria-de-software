import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import { PIN_REPARTIDOR_PRUEBA } from '../src/dev/dev.constants';
import { HashingService } from '../src/modules/auth/hashing.service';
import { emailUnico, vaciarBase } from './utils';

// Herramientas de desarrollo del probador /dev/motor.
describe('Probador del motor (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let hashing: HashingService;

  const datosRepartidor = (apellido: string) => ({
    nombre: 'R',
    apellido,
    telefono: '1',
    email: emailUnico(),
    direccion: 'x',
    vehiculo: 'MOTO' as const,
  });

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
    hashing = app.get(HashingService);
  });

  beforeEach(() => vaciarBase(prisma));
  afterAll(() => app.close());

  it('limpiar borra envíos y repartidores, pero conserva al de PIN 1234 (reseteado), operarios y comercios', async () => {
    const dePrueba = await prisma.repartidor.create({
      data: {
        ...datosRepartidor('de Prueba'),
        pinHmac: hashing.hmacPin(PIN_REPARTIDOR_PRUEBA),
        estado: 'OCUPADO',
        viajesConsecutivos: 2,
      },
    });
    const otro = await prisma.repartidor.create({
      data: datosRepartidor('otro'),
    });
    await prisma.repartidor.create({
      data: { ...datosRepartidor('sin PIN'), pinHmac: null },
    });
    await prisma.refreshToken.createMany({
      data: [
        {
          tokenHash: 'a',
          rol: 'REPARTIDOR',
          usuarioId: dePrueba.id,
          expiraEn: new Date(Date.now() + 60_000),
        },
        {
          tokenHash: 'b',
          rol: 'REPARTIDOR',
          usuarioId: otro.id,
          expiraEn: new Date(Date.now() + 60_000),
        },
      ],
    });
    await prisma.operario.create({
      data: { usuario: 'admin', passwordHash: 'x', nombre: 'Admin' },
    });
    const comercio = await prisma.comercio.create({
      data: { nombre: 'C', telefono: '1', email: 'c@test.com', direccion: 'x' },
    });
    await prisma.envio.create({
      data: {
        codigoSeguimiento: 'LIMPIAR1',
        comercioId: comercio.id,
        origenDireccion: 'a',
        destinoDireccion: 'b',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        repartidorId: dePrueba.id,
        estado: 'ASIGNADO',
        eventos: { create: { tipo: 'CREADO', actorTipo: 'SISTEMA' } },
        ofertas: {
          create: {
            repartidorId: dePrueba.id,
            estado: 'ACEPTADA',
            expiraEn: new Date(),
          },
        },
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/dev/limpiar')
      .expect(200);

    expect(res.body).toEqual({
      enviosBorrados: 1,
      repartidoresBorrados: 2,
      conservado: 'R de Prueba',
    });
    expect(await prisma.envio.count()).toBe(0);
    expect(await prisma.oferta.count()).toBe(0);
    expect(await prisma.eventoEnvio.count()).toBe(0);
    const repartidores = await prisma.repartidor.findMany();
    expect(repartidores).toHaveLength(1);
    expect(repartidores[0]).toMatchObject({
      id: dePrueba.id,
      estado: 'FUERA_DE_JORNADA',
      enColaDesde: null,
      viajesConsecutivos: 0,
    });
    // Su sesión sigue viva; la del repartidor borrado no.
    expect(
      await prisma.refreshToken.findMany({ select: { usuarioId: true } }),
    ).toEqual([{ usuarioId: dePrueba.id }]);
    expect(await prisma.operario.count()).toBe(1);
    expect(await prisma.comercio.count()).toBe(1);
  });

  it('limpiar funciona aunque no exista el repartidor de prueba', async () => {
    await prisma.repartidor.create({ data: datosRepartidor('otro') });

    const res = await request(app.getHttpServer())
      .post('/api/dev/limpiar')
      .expect(200);

    expect(res.body).toMatchObject({
      repartidoresBorrados: 1,
      conservado: null,
    });
  });
});
