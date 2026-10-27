import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { RolUsuario, TipoVehiculo } from '../src/generated/prisma/client';
import { AsignacionService } from '../src/modules/asignacion/asignacion.service';
import { OfertasService } from '../src/modules/asignacion/ofertas.service';
import { emailUnico, vaciarBase } from './utils';

// Respuestas a las ofertas (D-2) y su vencimiento (D-3), por HTTP y contra una base real.
describe('Ofertas (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let motor: AsignacionService;
  let ofertas: OfertasService;
  let jwt: JwtService;
  let comercioId: number;
  const haceUnaHora = Date.now() - 3_600_000;

  // Firmamos el access token directo (el login ya está probado en auth.e2e) para no chocar con el límite de intentos.
  const cookieDe = async (id: number, rol: RolUsuario = 'REPARTIDOR') =>
    `access_token=${await jwt.signAsync({ sub: id, rol })}`;

  async function crearRepartidor(
    llegoEnMinuto = 0,
    vehiculo: TipoVehiculo = 'MOTO',
  ) {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: String(llegoEnMinuto),
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo,
        estado: 'DISPONIBLE',
        enColaDesde: new Date(haceUnaHora + llegoEnMinuto * 60_000),
      },
    });
    return repartidor.id;
  }

  let codigo = 0;
  async function crearEnvio() {
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `OF${++codigo}`,
        comercioId,
        origenDireccion: 'Calle 7 1234',
        destinoDireccion: 'Calle 50 567',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
      },
    });
    return envio.id;
  }

  async function ofertaPara(envioId: number) {
    const oferta = await motor.asignar(envioId);
    if (!oferta) throw new Error('El motor no creó la oferta');
    return oferta;
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
    motor = app.get(AsignacionService);
    ofertas = app.get(OfertasService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Kiosco Don Pepe',
          telefono: '1',
          email: 'c@test.com',
          direccion: 'Calle 7 1234',
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('el repartidor ve su oferta vigente con los segundos restantes', async () => {
    const repartidor = await crearRepartidor();
    await ofertaPara(await crearEnvio());

    const res = await request(app.getHttpServer())
      .get('/api/repartidor/ofertas/actual')
      .set('Cookie', await cookieDe(repartidor))
      .expect(200);

    expect(res.body.oferta.envio).toMatchObject({
      comercio: 'Kiosco Don Pepe',
      destinoDireccion: 'Calle 50 567',
    });
    expect(res.body.oferta.segundosRestantes).toBeGreaterThan(290);
  });

  it('sin oferta vigente devuelve null', async () => {
    const repartidor = await crearRepartidor();
    const res = await request(app.getHttpServer())
      .get('/api/repartidor/ofertas/actual')
      .set('Cookie', await cookieDe(repartidor))
      .expect(200);
    expect(res.body.oferta).toBeNull();
  });

  it('un operario no puede usar los endpoints de ofertas', async () => {
    await request(app.getHttpServer())
      .get('/api/repartidor/ofertas/actual')
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(403);
  });

  it('aceptar: el envío queda ASIGNADO, el repartidor OCUPADO y se registra el evento', async () => {
    const repartidor = await crearRepartidor();
    const envioId = await crearEnvio();
    const oferta = await ofertaPara(envioId);

    await request(app.getHttpServer())
      .post(`/api/repartidor/ofertas/${oferta.id}/aceptar`)
      .set('Cookie', await cookieDe(repartidor))
      .expect(200)
      .expect({ envioId });

    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
      include: { eventos: true },
    });
    expect(envio).toMatchObject({
      estado: 'ASIGNADO',
      repartidorId: repartidor,
    });
    expect(envio.eventos[0]).toMatchObject({
      estadoNuevo: 'ASIGNADO',
      actorTipo: 'REPARTIDOR',
      actorId: repartidor,
    });
    const despues = await prisma.repartidor.findUniqueOrThrow({
      where: { id: repartidor },
    });
    expect(despues).toMatchObject({ estado: 'OCUPADO', enColaDesde: null });
  });

  it('no se puede responder una oferta ajena (403) ni dos veces (409)', async () => {
    const repartidor = await crearRepartidor(0);
    const otro = await crearRepartidor(1);
    const oferta = await ofertaPara(await crearEnvio());
    const servidor = app.getHttpServer();

    await request(servidor)
      .post(`/api/repartidor/ofertas/${oferta.id}/aceptar`)
      .set('Cookie', await cookieDe(otro))
      .expect(403);
    await request(servidor)
      .post(`/api/repartidor/ofertas/${oferta.id}/aceptar`)
      .set('Cookie', await cookieDe(repartidor))
      .expect(200);
    await request(servidor)
      .post(`/api/repartidor/ofertas/${oferta.id}/rechazar`)
      .set('Cookie', await cookieDe(repartidor))
      .expect(409);
  });

  it('una oferta vencida no se puede aceptar', async () => {
    const repartidor = await crearRepartidor();
    const oferta = await ofertaPara(await crearEnvio());
    await prisma.oferta.update({
      where: { id: oferta.id },
      data: { expiraEn: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post(`/api/repartidor/ofertas/${oferta.id}/aceptar`)
      .set('Cookie', await cookieDe(repartidor))
      .expect(409);
  });

  it('rechazar: vuelve al final de la cola y el envío se ofrece al siguiente', async () => {
    const primero = await crearRepartidor(0);
    const segundo = await crearRepartidor(1);
    const envioId = await crearEnvio();
    const oferta = await ofertaPara(envioId);
    expect(oferta.repartidorId).toBe(primero);

    await request(app.getHttpServer())
      .post(`/api/repartidor/ofertas/${oferta.id}/rechazar`)
      .set('Cookie', await cookieDe(primero))
      .expect(204);

    const nueva = await prisma.oferta.findFirstOrThrow({
      where: { envioId, estado: 'PENDIENTE' },
    });
    expect(nueva.repartidorId).toBe(segundo);
    const rechazo = await prisma.repartidor.findUniqueOrThrow({
      where: { id: primero },
    });
    expect(rechazo.enColaDesde!.getTime()).toBeGreaterThan(
      haceUnaHora + 60_000,
    );
  });

  describe('vencimiento (D-3)', () => {
    it('vence la oferta, pausa al repartidor y ofrece el envío al siguiente', async () => {
      const dormido = await crearRepartidor(0);
      const siguiente = await crearRepartidor(1);
      const envioId = await crearEnvio();
      const oferta = await ofertaPara(envioId);
      await prisma.oferta.update({
        where: { id: oferta.id },
        data: { expiraEn: new Date(Date.now() - 1000) },
      });

      const resultado = await ofertas.vencerYReasignar();

      expect(resultado).toEqual({ vencidas: 1, ofertasCreadas: 1 });
      expect(
        (await prisma.oferta.findUniqueOrThrow({ where: { id: oferta.id } }))
          .estado,
      ).toBe('VENCIDA');
      expect(
        (await prisma.repartidor.findUniqueOrThrow({ where: { id: dormido } }))
          .estado,
      ).toBe('EN_PAUSA');
      const nueva = await prisma.oferta.findFirstOrThrow({
        where: { envioId, estado: 'PENDIENTE' },
      });
      expect(nueva.repartidorId).toBe(siguiente);
    });

    it('no toca las ofertas que todavía no vencieron', async () => {
      await crearRepartidor();
      await ofertaPara(await crearEnvio());

      await expect(ofertas.vencerYReasignar()).resolves.toEqual({
        vencidas: 0,
        ofertasCreadas: 0,
      });
    });

    it('dos ejecuciones superpuestas no procesan dos veces la misma oferta', async () => {
      await crearRepartidor();
      const oferta = await ofertaPara(await crearEnvio());
      await prisma.oferta.update({
        where: { id: oferta.id },
        data: { expiraEn: new Date(Date.now() - 1000) },
      });

      const [a, b] = await Promise.all([
        ofertas.vencerYReasignar(),
        ofertas.vencerYReasignar(),
      ]);

      expect(a.vencidas + b.vencidas).toBe(1);
    });
  });
});
