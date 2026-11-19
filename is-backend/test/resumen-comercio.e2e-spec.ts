import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { vaciarBase } from './utils';

// HU 41 por HTTP contra la base de test: verifica que el resumen diario por comercio
// cuente solo los estados finales en la fecha indicada y excluya los envíos en curso.
describe('Resumen diario por comercio (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;

  const HOY = '2026-11-17';
  const INSTANTE_HOY = new Date('2026-11-17T15:00:00-03:00');
  const INSTANTE_AYER = new Date('2026-11-16T15:00:00-03:00');

  const cookieOperario = async () =>
    `access_token=${await jwt.signAsync({ sub: 1, rol: 'OPERARIO' })}`;

  let codigo = 0;
  async function crearEnvio(
    comercio: number,
    estado: EstadoEnvio,
    cuando: Date = INSTANTE_HOY,
  ) {
    return prisma.envio.create({
      data: {
        codigoSeguimiento: `RES${++codigo}`,
        comercioId: comercio,
        origenDireccion: 'Calle 7 1234',
        destinoDireccion: 'Calle 50 567',
        destinatarioNombre: 'Ana',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado,
        creadoEn: cuando,
        eventos: {
          create: {
            tipo: 'CAMBIO_ESTADO',
            estadoNuevo: estado,
            actorTipo: 'OPERARIO',
            actorId: 1,
            creadoEn: cuando,
          },
        },
      },
    });
  }

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
          nombre: 'Panadería Sol',
          telefono: '221 555',
          email: 'sol@test.com',
          direccion: 'Calle 7 1234',
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('Escenario 1: muestra la cantidad de envíos entregados, devueltos y cancelados del día', async () => {
    await crearEnvio(comercioId, 'ENTREGADO', INSTANTE_HOY);
    await crearEnvio(comercioId, 'ENTREGADO', INSTANTE_HOY);
    await crearEnvio(comercioId, 'CANCELADO', INSTANTE_HOY);
    // De ayer: no debe sumarse en el resumen de HOY
    await crearEnvio(comercioId, 'ENTREGADO', INSTANTE_AYER);

    const res = await request(app.getHttpServer())
      .get(`/api/comercios/${comercioId}/resumen?fecha=${HOY}`)
      .set('Cookie', await cookieOperario());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      comercioId,
      comercioNombre: 'Panadería Sol',
      fecha: HOY,
      entregados: 2,
      devueltos: 0,
      cancelados: 1,
    });
  });

  it('Escenario 2: muestra todos los totales en 0 cuando el comercio no tuvo envíos en la fecha seleccionada', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/comercios/${comercioId}/resumen?fecha=${HOY}`)
      .set('Cookie', await cookieOperario());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      comercioId,
      comercioNombre: 'Panadería Sol',
      fecha: HOY,
      entregados: 0,
      devueltos: 0,
      cancelados: 0,
    });
  });

  it('Escenario 3: cuenta los 4 envíos entregados y no incluye los 2 que están en curso', async () => {
    for (let i = 0; i < 4; i++) {
      await crearEnvio(comercioId, 'ENTREGADO', INSTANTE_HOY);
    }
    await crearEnvio(comercioId, 'RETIRADO', INSTANTE_HOY);
    await crearEnvio(comercioId, 'EN_DOMICILIO', INSTANTE_HOY);

    const res = await request(app.getHttpServer())
      .get(`/api/comercios/${comercioId}/resumen?fecha=${HOY}`)
      .set('Cookie', await cookieOperario());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      comercioId,
      comercioNombre: 'Panadería Sol',
      fecha: HOY,
      entregados: 4,
      devueltos: 0,
      cancelados: 0,
    });
  });
});
