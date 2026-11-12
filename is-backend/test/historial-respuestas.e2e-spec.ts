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
        creadaEn: new Date(fecha.getTime() - 2 * 60_000),
        expiraEn: new Date(fecha.getTime() + 3 * 60_000),
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
        new Date(`2026-11-01T10:0${i}:00Z`),
      );
    }

    // Creamos 2 ofertas rechazadas
    for (let i = 0; i < 2; i++) {
      const envio = await crearEnvio(`ENV-RECH-${i}`);
      await crearOferta(
        repartidor.id,
        envio.id,
        'RECHAZADA',
        new Date(`2026-11-02T11:0${i}:00Z`),
      );
    }

    // Creamos 1 oferta vencida
    const envioVencido = await crearEnvio('ENV-VENC-1');
    await crearOferta(
      repartidor.id,
      envioVencido.id,
      'VENCIDA',
      new Date('2026-11-03T12:00:00Z'),
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

    // También responde en el path alternativo /api/operario/repartidores/:id/historial-respuestas
    const resAlternativo = await request(app.getHttpServer())
      .get(`/api/operario/repartidores/${repartidor.id}/historial-respuestas`)
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(200);
    expect(resAlternativo.body.totales).toEqual(res.body.totales);
  });

  it('Escenario 2: filtra respuestas y totales dentro del rango de fechas definido', async () => {
    const repartidor = await crearRepartidor('Sofía');

    // Oferta anterior al rango (octubre)
    const envioViejo = await crearEnvio('ENV-VIEJO');
    await crearOferta(
      repartidor.id,
      envioViejo.id,
      'ACEPTADA',
      new Date('2026-10-25T10:00:00Z'),
    );

    // Ofertas dentro del rango (noviembre)
    const envioAceptado = await crearEnvio('ENV-NOV-1');
    await crearOferta(
      repartidor.id,
      envioAceptado.id,
      'ACEPTADA',
      new Date('2026-11-02T09:00:00Z'),
    );

    const envioRechazado = await crearEnvio('ENV-NOV-2');
    await crearOferta(
      repartidor.id,
      envioRechazado.id,
      'RECHAZADA',
      new Date('2026-11-03T14:30:00Z'),
    );

    // Oferta posterior al rango
    const envioFuturo = await crearEnvio('ENV-FUTURO');
    await crearOferta(
      repartidor.id,
      envioFuturo.id,
      'VENCIDA',
      new Date('2026-11-15T10:00:00Z'),
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
