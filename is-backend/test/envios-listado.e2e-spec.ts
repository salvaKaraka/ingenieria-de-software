import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

describe('Listado de envíos (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;
  let otroComercioId: number;
  let codigo = 0;

  const FECHA = '2026-10-21';
  const CREADO_EN_FECHA = new Date('2026-10-21T04:00:00.000Z');

  async function crearEnvio(
    opciones: {
      codigoSeguimiento?: string;
      comercioId?: number;
      estado?: EstadoEnvio;
      creadoEn?: Date;
      repartidorId?: number;
    } = {},
  ) {
    return prisma.envio.create({
      data: {
        codigoSeguimiento: opciones.codigoSeguimiento ?? `LIST${++codigo}`,
        comercioId: opciones.comercioId ?? comercioId,
        origenDireccion: 'Comercio',
        destinoDireccion: 'Destino',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado: opciones.estado ?? 'PENDIENTE',
        creadoEn: opciones.creadoEn ?? CREADO_EN_FECHA,
        repartidorId: opciones.repartidorId,
      },
    });
  }

  async function cookieDeOperario() {
    return `access_token=${await jwt.signAsync({ sub: 1, rol: 'OPERARIO' })}`;
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
    codigo = 0;
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Comercio principal',
          telefono: '1',
          email: 'principal@test.com',
          direccion: 'Origen',
        },
      })
    ).id;
    otroComercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Otro comercio',
          telefono: '2',
          email: 'otro@test.com',
          direccion: 'Otro origen',
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('busca por código e incluye estado y repartidor asignado', async () => {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'Rita',
        apellido: 'Prueba',
        telefono: '1',
        email: emailUnico(),
        direccion: 'Base',
        vehiculo: 'MOTO',
      },
    });
    const envio = await crearEnvio({
      codigoSeguimiento: 'CODIGO123',
      estado: 'ASIGNADO',
      repartidorId: repartidor.id,
    });

    await request(app.getHttpServer())
      .get('/api/envios')
      .query({ q: 'DIGO12' })
      .set('Cookie', await cookieDeOperario())
      .expect(200)
      .expect(({ body }) => {
        expect(body.datos).toHaveLength(1);
        expect(body.datos[0]).toMatchObject({
          id: envio.id,
          estado: 'ASIGNADO',
          repartidor: { nombre: 'Rita', apellido: 'Prueba' },
        });
      });
  });

  it('combina estado, comercio y fecha local; sin coincidencias devuelve una lista vacía', async () => {
    const coincide = await crearEnvio({
      codigoSeguimiento: 'COINCIDE',
      estado: 'ENTREGADO',
    });
    await crearEnvio({ estado: 'PENDIENTE' });
    await crearEnvio({ estado: 'ENTREGADO', comercioId: otroComercioId });
    await crearEnvio({
      estado: 'ENTREGADO',
      creadoEn: new Date('2026-10-22T03:00:00.000Z'),
    });

    const respuesta = await request(app.getHttpServer())
      .get('/api/envios')
      .query({
        estado: 'ENTREGADO',
        comercioId,
        desde: FECHA,
        hasta: FECHA,
      })
      .set('Cookie', await cookieDeOperario())
      .expect(200);
    expect(
      respuesta.body.datos.map((envio: { id: number }) => envio.id),
    ).toEqual([coincide.id]);

    await request(app.getHttpServer())
      .get('/api/envios')
      .query({ comercioId, desde: '2026-10-20', hasta: '2026-10-20' })
      .set('Cookie', await cookieDeOperario())
      .expect(200)
      .expect(({ body }) => {
        expect(body.datos).toEqual([]);
        expect(body.total).toBe(0);
      });
  });

  it('responde una búsqueda paginada de mil envíos en menos de dos segundos', async () => {
    await prisma.envio.createMany({
      data: Array.from({ length: 1000 }, (_, indice) => ({
        codigoSeguimiento: `PERF${indice.toString().padStart(4, '0')}`,
        comercioId,
        origenDireccion: 'Comercio',
        destinoDireccion: 'Destino',
        tamanio: 'CHICO' as const,
        vehiculoRequerido: 'MOTO' as const,
        requiereFoto: false,
        requiereDni: false,
        creadoEn: CREADO_EN_FECHA,
      })),
    });

    const inicio = performance.now();
    const respuesta = await request(app.getHttpServer())
      .get('/api/envios')
      .query({ q: 'PERF' })
      .set('Cookie', await cookieDeOperario())
      .expect(200);
    const duracion = performance.now() - inicio;

    expect(respuesta.body.total).toBe(1000);
    expect(respuesta.body.datos).toHaveLength(20);
    expect(duracion).toBeLessThan(2000);
  });
});
