import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoOferta, RolUsuario } from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

describe('Historial de respuestas de ofertas (e2e) - HU #28', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;

  const cookieDe = async (id: number, rol: RolUsuario = 'OPERARIO') =>
    `access_token=${await jwt.signAsync({ sub: id, rol })}`;

  async function crearRepartidor(nombre = 'Carlos') {
    return prisma.repartidor.create({
      data: {
        nombre,
        apellido: 'Test',
        telefono: '1122334455',
        email: emailUnico(),
        direccion: 'Calle Falsa 123',
        vehiculo: 'MOTO',
      },
    });
  }

  async function crearEnvio(codigo: string) {
    return prisma.envio.create({
      data: {
        codigoSeguimiento: codigo,
        comercioId,
        origenDireccion: 'Origen 123',
        destinoDireccion: 'Destino 456',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
      },
    });
  }

  async function crearOferta(
    repartidorId: number,
    envioId: number,
    estado: EstadoOferta,
    fecha: Date,
  ) {
    return prisma.oferta.create({
      data: {
        repartidorId,
        envioId,
        estado,
        // "fecha" es el momento de la respuesta: cuando respondió o, si venció, cuando expiró.
        creadaEn: new Date(fecha.getTime() - 5 * 60_000),
        expiraEn:
          estado === 'VENCIDA' ? fecha : new Date(fecha.getTime() + 3 * 60_000),
        respondidaEn: estado === 'VENCIDA' ? null : fecha,
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
    const comercio = await prisma.comercio.create({
      data: {
        nombre: 'Comercio Auditoria',
        telefono: '11223344',
        email: 'auditoria@test.com',
        direccion: 'Av. Corrientes 1000',
      },
    });
    comercioId = comercio.id;
  });

  afterAll(() => app.close());

  it('Escenario 1: al consultar el historial de un repartidor muestra los 3 totales (8 aceptadas, 2 rechazadas, 1 vencida) y el detalle cronológico', async () => {
    const repartidor = await crearRepartidor('Juan');

    // Creamos 8 ofertas aceptadas
    for (let i = 0; i < 8; i++) {
      const envio = await crearEnvio(`ENV-ACEP-${i}`);
      await crearOferta(
        repartidor.id,
        envio.id,
        'ACEPTADA',
        new Date(`2026-11-01T10:0${i}:00-03:00`),
      );
    }

    // Creamos 2 ofertas rechazadas
    for (let i = 0; i < 2; i++) {
      const envio = await crearEnvio(`ENV-RECH-${i}`);
      await crearOferta(
        repartidor.id,
        envio.id,
        'RECHAZADA',
        new Date(`2026-11-02T11:0${i}:00-03:00`),
      );
    }

    // Creamos 1 oferta vencida
    const envioVencido = await crearEnvio('ENV-VENC-1');
    await crearOferta(
      repartidor.id,
      envioVencido.id,
      'VENCIDA',
      new Date('2026-11-03T12:00:00-03:00'),
    );

    const res = await request(app.getHttpServer())
      .get(`/api/repartidores/${repartidor.id}/historial-respuestas`)
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(200);

    expect(res.body.repartidorId).toBe(repartidor.id);
    expect(res.body.totales).toEqual({
      aceptadas: 8,
      rechazadas: 2,
      vencidas: 1,
    });
    expect(res.body.detalle).toHaveLength(11);
    expect(res.body.detalle[0].estado).toBe('VENCIDA');
    expect(res.body.detalle[0].envioId).toBe(envioVencido.id);
  });

  it('Escenario 2: filtra respuestas y totales dentro del rango de fechas definido', async () => {
    const repartidor = await crearRepartidor('Sofía');

    // Oferta anterior al rango (octubre)
    const envioViejo = await crearEnvio('ENV-VIEJO');
    await crearOferta(
      repartidor.id,
      envioViejo.id,
      'ACEPTADA',
      new Date('2026-10-25T10:00:00-03:00'),
    );

    // Ofertas dentro del rango (noviembre)
    const envioAceptado = await crearEnvio('ENV-NOV-1');
    await crearOferta(
      repartidor.id,
      envioAceptado.id,
      'ACEPTADA',
      new Date('2026-11-02T09:00:00-03:00'),
    );

    const envioRechazado = await crearEnvio('ENV-NOV-2');
    await crearOferta(
      repartidor.id,
      envioRechazado.id,
      'RECHAZADA',
      new Date('2026-11-03T14:30:00-03:00'),
    );

    // Oferta posterior al rango
    const envioFuturo = await crearEnvio('ENV-FUTURO');
    await crearOferta(
      repartidor.id,
      envioFuturo.id,
      'VENCIDA',
      new Date('2026-11-15T10:00:00-03:00'),
    );

    const res = await request(app.getHttpServer())
      .get(
        `/api/repartidores/${repartidor.id}/historial-respuestas?desde=2026-11-01&hasta=2026-11-05`,
      )
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(200);

    expect(res.body.rango).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-05',
    });
    expect(res.body.totales).toEqual({
      aceptadas: 1,
      rechazadas: 1,
      vencidas: 0,
    });
    expect(res.body.detalle).toHaveLength(2);
    expect(res.body.detalle.map((d: { envioId: number }) => d.envioId)).toEqual([
      envioRechazado.id,
      envioAceptado.id,
    ]);
  });

  it('el rango corta los días en hora de Argentina: una respuesta de las 22:30 entra en ese día y no en el siguiente', async () => {
    const repartidor = await crearRepartidor('Nocturno');

    // 22:30 del 3/11 en Argentina: en UTC ya es 4/11 a la 01:30.
    const envioNoche = await crearEnvio('ENV-NOCHE');
    await crearOferta(
      repartidor.id,
      envioNoche.id,
      'RECHAZADA',
      new Date('2026-11-03T22:30:00-03:00'),
    );
    // Vencida a las 23:59 del 3/11 en Argentina.
    const envioVencido = await crearEnvio('ENV-NOCHE-VENC');
    await crearOferta(
      repartidor.id,
      envioVencido.id,
      'VENCIDA',
      new Date('2026-11-03T23:59:00-03:00'),
    );
    // 00:10 del 4/11 en Argentina: ya es el día siguiente.
    const envioMadrugada = await crearEnvio('ENV-MADRUGADA');
    await crearOferta(
      repartidor.id,
      envioMadrugada.id,
      'ACEPTADA',
      new Date('2026-11-04T00:10:00-03:00'),
    );

    const consultar = async (desde: string, hasta: string) => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/repartidores/${repartidor.id}/historial-respuestas?desde=${desde}&hasta=${hasta}`,
        )
        .set('Cookie', await cookieDe(1, 'OPERARIO'))
        .expect(200);
      return res.body as {
        totales: { aceptadas: number; rechazadas: number; vencidas: number };
        detalle: { envioId: number; fecha: string }[];
      };
    };

    const dia3 = await consultar('2026-11-03', '2026-11-03');
    expect(dia3.totales).toEqual({ aceptadas: 0, rechazadas: 1, vencidas: 1 });
    expect(dia3.detalle.map((d) => d.envioId)).toEqual([
      envioVencido.id,
      envioNoche.id,
    ]);

    const dia4 = await consultar('2026-11-04', '2026-11-04');
    expect(dia4.totales).toEqual({ aceptadas: 1, rechazadas: 0, vencidas: 0 });
    expect(dia4.detalle.map((d) => d.envioId)).toEqual([envioMadrugada.id]);
  });

  it('una oferta abierta que se cierra porque el operario cancela el envío no suma una vencida', async () => {
    const repartidor = await crearRepartidor('Paula');
    const operario = await prisma.operario.create({
      data: { nombre: 'Op', usuario: 'op-hu28', passwordHash: 'x' },
    });

    // Una oferta que el repartidor sí dejó vencer.
    const envioVencido = await crearEnvio('ENV-INACTIVO');
    const venceEn = new Date(Date.now() - 60 * 60_000);
    await crearOferta(repartidor.id, envioVencido.id, 'VENCIDA', venceEn);

    // Una oferta todavía abierta sobre un envío que el operario cancela.
    const envioCancelado = await crearEnvio('ENV-CANCELADO');
    await prisma.oferta.create({
      data: {
        repartidorId: repartidor.id,
        envioId: envioCancelado.id,
        estado: 'PENDIENTE',
        creadaEn: new Date(Date.now() - 60_000),
        expiraEn: new Date(Date.now() + 4 * 60_000),
      },
    });
    await request(app.getHttpServer())
      .post(`/api/envios/${envioCancelado.id}/cancelar`)
      .set('Cookie', await cookieDe(operario.id, 'OPERARIO'))
      .expect((res) => expect(res.status).toBeLessThan(300));

    // La cancelación la cerró como VENCIDA en la base, pero no por inactividad.
    const cerrada = await prisma.oferta.findFirstOrThrow({
      where: { envioId: envioCancelado.id },
    });
    expect(cerrada.estado).toBe('VENCIDA');

    const res = await request(app.getHttpServer())
      .get(`/api/repartidores/${repartidor.id}/historial-respuestas`)
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(200);

    expect(res.body.totales).toEqual({
      aceptadas: 0,
      rechazadas: 0,
      vencidas: 1,
    });
    expect(res.body.detalle).toHaveLength(1);
    expect(res.body.detalle[0].envioId).toBe(envioVencido.id);
    // La fecha de una vencida es el momento real en que venció.
    expect(res.body.detalle[0].fecha).toBe(venceEn.toISOString());
  });

  it('Escenario 3: repartidor sin ofertas devuelve lista vacía y contadores en 0 sin errores', async () => {
    const repartidor = await crearRepartidor('Lucas');

    const res = await request(app.getHttpServer())
      .get(`/api/repartidores/${repartidor.id}/historial-respuestas`)
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(200);

    expect(res.body).toEqual({
      repartidorId: repartidor.id,
      rango: { desde: null, hasta: null },
      totales: {
        aceptadas: 0,
        rechazadas: 0,
        vencidas: 0,
      },
      detalle: [],
    });
  });

  it('rechaza el acceso a usuarios sin rol OPERARIO con 403', async () => {
    const repartidor = await crearRepartidor('Valentina');

    await request(app.getHttpServer())
      .get(`/api/repartidores/${repartidor.id}/historial-respuestas`)
      .set('Cookie', await cookieDe(repartidor.id, 'REPARTIDOR'))
      .expect(403);
  });

  it('responde 404 si el repartidor no existe', async () => {
    await request(app.getHttpServer())
      .get('/api/repartidores/99999/historial-respuestas')
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(404);
  });
});
