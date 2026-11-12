import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type {
  EstadoRepartidor,
  RolUsuario,
  TipoVehiculo,
} from '../src/generated/prisma/client';
import { AsignacionService } from '../src/modules/asignacion/asignacion.service';
import { OfertasService } from '../src/modules/asignacion/ofertas.service';
import { emailUnico, vaciarBase } from './utils';

type ExcepcionDelPanel = {
  envioId: number;
  aviso: string;
  motivo: string;
  esperaDesde: string;
  minutosEspera: number;
};

// Panel de excepciones (HU 12 y HU 22) por HTTP y contra una base real: la asignación manual
// depende de los bloqueos de fila (FOR UPDATE) y de la transacción, que no se pueden probar con mocks.
describe('Panel de excepciones (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let motor: AsignacionService;
  let ofertas: OfertasService;
  let jwt: JwtService;
  let comercioId: number;
  const OPERARIO_ID = 7;
  const haceUnaHora = Date.now() - 3_600_000;
  const haceMinutos = (minutos: number) =>
    new Date(Date.now() - minutos * 60_000);

  // Firmamos el access token directo (el login ya está probado en auth.e2e).
  const cookieDe = async (id: number, rol: RolUsuario) =>
    `access_token=${await jwt.signAsync({ sub: id, rol })}`;
  const cookieOperario = () => cookieDe(OPERARIO_ID, 'OPERARIO');

  async function crearRepartidor(
    opciones: {
      vehiculo?: TipoVehiculo;
      estado?: EstadoRepartidor;
      llegoEnMinuto?: number;
      viajesConsecutivos?: number;
      activo?: boolean;
    } = {},
  ) {
    const {
      vehiculo = 'MOTO',
      estado = 'DISPONIBLE',
      llegoEnMinuto = 0,
      viajesConsecutivos = 0,
      activo = true,
    } = opciones;
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'Ana',
        apellido: `Paz ${llegoEnMinuto}`,
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo,
        estado,
        activo,
        enColaDesde:
          estado === 'DISPONIBLE'
            ? new Date(haceUnaHora + llegoEnMinuto * 60_000)
            : null,
        viajesConsecutivos,
      },
    });
    return repartidor.id;
  }

  let codigo = 0;
  async function crearEnvio(vehiculo: TipoVehiculo = 'MOTO') {
    const tamanio = {
      MOTO: 'CHICO',
      AUTO: 'MEDIANO',
      CAMION: 'GRANDE',
    } as const;
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `EX${++codigo}`,
        comercioId,
        origenDireccion: 'Calle 7 1234',
        destinoDireccion: 'Calle 50 567',
        tamanio: tamanio[vehiculo],
        vehiculoRequerido: vehiculo,
        requiereFoto: false,
        requiereDni: false,
      },
    });
    return envio.id;
  }

  // Simula que pasaron los 5 minutos: mueve el vencimiento al pasado y corre el job a mano.
  async function vencerOferta(ofertaId: number, vencioHaceMinutos: number) {
    const expiraEn = haceMinutos(vencioHaceMinutos);
    await prisma.oferta.update({ where: { id: ofertaId }, data: { expiraEn } });
    await ofertas.vencerYReasignar();
    return expiraEn;
  }

  // Deja un envío en el panel por el camino real (HU 12, escenario 2): el único repartidor
  // compatible deja vencer la oferta (queda EN_PAUSA) y no hay nadie más a quien ofrecérselo.
  async function envioSinRepartidor(
    vencioHaceMinutos: number,
    vehiculo: TipoVehiculo = 'MOTO',
  ) {
    const dormido = await crearRepartidor({ vehiculo });
    const envioId = await crearEnvio(vehiculo);
    const oferta = await motor.asignar(envioId);
    if (!oferta) throw new Error('El motor no creó la oferta');
    const vencioEn = await vencerOferta(oferta.id, vencioHaceMinutos);
    return { envioId, dormido, vencioEn };
  }

  async function panel(): Promise<ExcepcionDelPanel[]> {
    const res = await request(app.getHttpServer())
      .get('/api/excepciones')
      .set('Cookie', await cookieOperario())
      .expect(200);
    return (res.body as { excepciones: ExcepcionDelPanel[] }).excepciones;
  }

  async function asignar(envioId: number, repartidorId: number) {
    return request(app.getHttpServer())
      .post(`/api/excepciones/${envioId}/asignar`)
      .set('Cookie', await cookieOperario())
      .send({ repartidorId });
  }

  const ofertasVigentesDe = (envioId: number) =>
    prisma.oferta.findMany({ where: { envioId, estado: 'PENDIENTE' } });

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

  describe('sesión', () => {
    it('sin sesión responde 401', async () => {
      const servidor = app.getHttpServer();
      await request(servidor).get('/api/excepciones').expect(401);
      await request(servidor)
        .get('/api/excepciones/1/repartidores')
        .expect(401);
      await request(servidor)
        .post('/api/excepciones/1/asignar')
        .send({ repartidorId: 1 })
        .expect(401);
    });

    it('un repartidor no puede usar el panel (403)', async () => {
      const servidor = app.getHttpServer();
      const cookie = await cookieDe(1, 'REPARTIDOR');
      await request(servidor)
        .get('/api/excepciones')
        .set('Cookie', cookie)
        .expect(403);
      await request(servidor)
        .get('/api/excepciones/1/repartidores')
        .set('Cookie', cookie)
        .expect(403);
      await request(servidor)
        .post('/api/excepciones/1/asignar')
        .set('Cookie', cookie)
        .send({ repartidorId: 1 })
        .expect(403);
    });
  });

  describe('qué envíos entran al panel', () => {
    it('sin excepciones devuelve la lista vacía (HU 22, escenario 6)', async () => {
      expect(await panel()).toEqual([]);
    });

    it('un envío cuya oferta venció sin otro repartidor compatible aparece con su aviso (HU 22, escenario 3)', async () => {
      // Hay un repartidor en la cola, pero su moto no puede llevar un paquete mediano.
      await crearRepartidor({ vehiculo: 'MOTO' });
      const { envioId, vencioEn } = await envioSinRepartidor(12, 'AUTO');

      const excepciones = await panel();

      expect(excepciones).toHaveLength(1);
      expect(excepciones[0]).toMatchObject({
        envioId,
        codigoSeguimiento: `EX${codigo}`,
        comercio: 'Kiosco Don Pepe',
        vehiculoRequerido: 'AUTO',
        estado: 'PENDIENTE',
        motivo: 'SIN_REPARTIDOR',
        aviso: 'Envío sin repartidor disponible',
        esperaDesde: vencioEn.toISOString(),
        minutosEspera: 12,
      });
    });

    it('no entran los envíos pendientes a los que nunca les venció una oferta', async () => {
      await crearEnvio(); // sin repartidores: espera en la cola, pero no es una excepción
      const rechazado = await crearEnvio();
      const repartidor = await crearRepartidor();
      const oferta = await motor.asignar(rechazado);
      await ofertas.rechazar(oferta!.id, repartidor);

      expect(await panel()).toEqual([]);
    });

    it('si al vencer la oferta hay otro repartidor, el motor lo reasigna y no entra al panel (HU 12, escenario 1)', async () => {
      await crearRepartidor({ llegoEnMinuto: 0 });
      const siguiente = await crearRepartidor({ llegoEnMinuto: 1 });
      const envioId = await crearEnvio();
      const oferta = await motor.asignar(envioId);

      await vencerOferta(oferta!.id, 1);

      expect(await panel()).toEqual([]);
      const [nueva] = await ofertasVigentesDe(envioId);
      expect(nueva.repartidorId).toBe(siguiente);
    });

    it('un envío cancelado sale del panel', async () => {
      const { envioId } = await envioSinRepartidor(5);
      await request(app.getHttpServer())
        .post(`/api/envios/${envioId}/cancelar`)
        .set('Cookie', await cookieOperario())
        .expect((res) => expect(res.status).toBeLessThan(300));

      expect(await panel()).toEqual([]);
    });
  });

  describe('orden por tiempo de espera', () => {
    it('muestra primero el que espera hace más (HU 22, escenario 4)', async () => {
      const reciente = await envioSinRepartidor(5);
      const antiguo = await envioSinRepartidor(40);
      const intermedio = await envioSinRepartidor(20);

      const excepciones = await panel();

      expect(excepciones.map((e) => e.envioId)).toEqual([
        antiguo.envioId,
        intermedio.envioId,
        reciente.envioId,
      ]);
      expect(excepciones.map((e) => e.minutosEspera)).toEqual([40, 20, 5]);
    });

    it('la espera se cuenta desde el primer vencimiento: si una asignación manual también vence, el envío no baja en el orden', async () => {
      const antiguo = await envioSinRepartidor(40);
      const reciente = await envioSinRepartidor(10);
      const elegido = await crearRepartidor({ estado: 'EN_PAUSA' });

      const res = await asignar(antiguo.envioId, elegido);
      expect(res.status).toBe(200);
      // El repartidor elegido a mano tampoco responde: la oferta manual vence hace 1 minuto.
      await vencerOferta((res.body as { ofertaId: number }).ofertaId, 1);

      const excepciones = await panel();
      expect(excepciones.map((e) => e.envioId)).toEqual([
        antiguo.envioId,
        reciente.envioId,
      ]);
      expect(excepciones[0]).toMatchObject({
        esperaDesde: antiguo.vencioEn.toISOString(),
        minutosEspera: 40,
      });
    });
  });

  describe('repartidores para elegir', () => {
    it('lista a los que están en jornada, sin oferta pendiente y con vehículo que alcanza', async () => {
      const { envioId, dormido } = await envioSinRepartidor(5, 'AUTO');
      const auto = await crearRepartidor({ vehiculo: 'AUTO' });
      const camionConDosViajes = await crearRepartidor({
        vehiculo: 'CAMION',
        viajesConsecutivos: 2,
      });
      await crearRepartidor({ vehiculo: 'MOTO' }); // no puede llevar un paquete mediano
      await crearRepartidor({ vehiculo: 'AUTO', estado: 'OCUPADO' });
      await crearRepartidor({ vehiculo: 'AUTO', estado: 'FUERA_DE_JORNADA' });
      await crearRepartidor({ vehiculo: 'AUTO', activo: false });
      // Un auto que ya tiene otra oferta sin responder.
      const conOferta = await crearRepartidor({
        vehiculo: 'AUTO',
        llegoEnMinuto: -5,
      });
      const otraOferta = await motor.asignar(await crearEnvio('AUTO'));
      expect(otraOferta?.repartidorId).toBe(conOferta);

      const res = await request(app.getHttpServer())
        .get(`/api/excepciones/${envioId}/repartidores`)
        .set('Cookie', await cookieOperario())
        .expect(200);

      const lista = res.body as { id: number; viajesConsecutivos: number }[];
      expect(lista.map((r) => r.id).sort()).toEqual(
        [dormido, auto, camionConDosViajes].sort(),
      );
      expect(
        lista.find((r) => r.id === camionConDosViajes)?.viajesConsecutivos,
      ).toBe(2);
    });

    it('404 si el envío no existe', async () => {
      await request(app.getHttpServer())
        .get('/api/excepciones/999/repartidores')
        .set('Cookie', await cookieOperario())
        .expect(404);
    });
  });

  describe('asignación manual', () => {
    it('le envía la oferta directo al repartidor elegido y el envío sale del panel (HU 22, escenario 1)', async () => {
      const { envioId } = await envioSinRepartidor(5);
      const elegido = await crearRepartidor();

      const res = await asignar(envioId, elegido);

      expect(res.status).toBe(200);
      const vigentes = await ofertasVigentesDe(envioId);
      expect(vigentes).toHaveLength(1);
      expect(vigentes[0]).toMatchObject({
        id: (res.body as { ofertaId: number }).ofertaId,
        repartidorId: elegido,
      });
      // Los mismos 5 minutos que cualquier oferta.
      const segundos = (vigentes[0].expiraEn.getTime() - Date.now()) / 1000;
      expect(segundos).toBeGreaterThan(290);
      expect(segundos).toBeLessThanOrEqual(300);

      expect(await panel()).toEqual([]);

      // Sale de la cola (no puede recibir otra oferta del motor) y queda en el historial quién lo asignó.
      const repartidor = await prisma.repartidor.findUniqueOrThrow({
        where: { id: elegido },
      });
      expect(repartidor).toMatchObject({
        estado: 'DISPONIBLE',
        enColaDesde: null,
      });
      const nota = await prisma.eventoEnvio.findFirstOrThrow({
        where: { envioId, tipo: 'NOTA', actorTipo: 'OPERARIO' },
      });
      expect(nota).toMatchObject({
        actorId: OPERARIO_ID,
        detalle: 'Asignación manual del operario a Ana Paz 0',
      });
    });

    it('el repartidor elegido ve la oferta y, si acepta, el envío queda asignado a él', async () => {
      const { envioId } = await envioSinRepartidor(5);
      const elegido = await crearRepartidor();
      const { ofertaId } = (await asignar(envioId, elegido)).body as {
        ofertaId: number;
      };
      const servidor = app.getHttpServer();
      const cookie = await cookieDe(elegido, 'REPARTIDOR');

      const actual = await request(servidor)
        .get('/api/repartidor/ofertas/actual')
        .set('Cookie', cookie)
        .expect(200);
      expect(actual.body.oferta).toMatchObject({
        id: ofertaId,
        envio: { id: envioId },
      });

      await request(servidor)
        .post(`/api/repartidor/ofertas/${ofertaId}/aceptar`)
        .set('Cookie', cookie)
        .expect(200);
      const envio = await prisma.envio.findUniqueOrThrow({
        where: { id: envioId },
      });
      expect(envio).toMatchObject({
        estado: 'ASIGNADO',
        repartidorId: elegido,
      });
      expect(await panel()).toEqual([]);
    });

    it('no respeta el orden de la cola ni el límite de 2 viajes consecutivos (HU 22, escenario 5)', async () => {
      const { envioId } = await envioSinRepartidor(5);
      const primeroDeLaCola = await crearRepartidor({ llegoEnMinuto: 0 });
      const conDosViajes = await crearRepartidor({
        llegoEnMinuto: 30,
        viajesConsecutivos: 2,
      });

      const res = await asignar(envioId, conDosViajes);

      expect(res.status).toBe(200);
      const vigentes = await ofertasVigentesDe(envioId);
      expect(vigentes.map((o) => o.repartidorId)).toEqual([conDosViajes]);
      // No se lo manda a descansar ni se le reinicia el contador, y el primero sigue en su lugar.
      const elegido = await prisma.repartidor.findUniqueOrThrow({
        where: { id: conDosViajes },
      });
      expect(elegido.viajesConsecutivos).toBe(2);
      const primero = await prisma.repartidor.findUniqueOrThrow({
        where: { id: primeroDeLaCola },
      });
      expect(primero.enColaDesde).not.toBeNull();
      expect(
        await prisma.oferta.count({ where: { repartidorId: primeroDeLaCola } }),
      ).toBe(0);
    });

    it('se puede asignar al mismo repartidor que dejó vencer la oferta (queda en pausa)', async () => {
      const { envioId, dormido } = await envioSinRepartidor(5);

      const res = await asignar(envioId, dormido);

      expect(res.status).toBe(200);
      const vigentes = await ofertasVigentesDe(envioId);
      expect(vigentes.map((o) => o.repartidorId)).toEqual([dormido]);
    });

    it('si el repartidor elegido rechaza, el envío vuelve al panel con la espera original', async () => {
      const { envioId, vencioEn } = await envioSinRepartidor(25);
      const elegido = await crearRepartidor();
      const { ofertaId } = (await asignar(envioId, elegido)).body as {
        ofertaId: number;
      };

      await request(app.getHttpServer())
        .post(`/api/repartidor/ofertas/${ofertaId}/rechazar`)
        .set('Cookie', await cookieDe(elegido, 'REPARTIDOR'))
        .expect(204);

      const excepciones = await panel();
      expect(excepciones.map((e) => e.envioId)).toEqual([envioId]);
      expect(excepciones[0].esperaDesde).toBe(vencioEn.toISOString());
    });

    describe('rechazos (409, sin crear ninguna oferta)', () => {
      async function esperarRechazo(
        envioId: number,
        repartidorId: number,
        mensaje: RegExp,
      ) {
        const res = await asignar(envioId, repartidorId);
        expect(res.status).toBe(409);
        expect((res.body as { message: string }).message).toMatch(mensaje);
        expect(await ofertasVigentesDe(envioId)).toEqual([]);
        expect((await panel()).map((e) => e.envioId)).toContain(envioId);
      }

      it('repartidor ocupado', async () => {
        const { envioId } = await envioSinRepartidor(5);
        const ocupado = await crearRepartidor({ estado: 'OCUPADO' });
        await esperarRechazo(envioId, ocupado, /no está disponible/);
      });

      it('repartidor fuera de jornada', async () => {
        const { envioId } = await envioSinRepartidor(5);
        const fuera = await crearRepartidor({ estado: 'FUERA_DE_JORNADA' });
        await esperarRechazo(envioId, fuera, /no está disponible/);
      });

      it('repartidor dado de baja', async () => {
        const { envioId } = await envioSinRepartidor(5);
        const baja = await crearRepartidor({ activo: false });
        await esperarRechazo(envioId, baja, /dado de baja/);
      });

      it('repartidor con otra oferta sin responder', async () => {
        const { envioId } = await envioSinRepartidor(5);
        // Este repartidor ya tiene vigente la oferta de otro envío.
        const conOferta = await crearRepartidor();
        const otroEnvio = await crearEnvio();
        const otraOferta = await prisma.oferta.create({
          data: {
            envioId: otroEnvio,
            repartidorId: conOferta,
            expiraEn: new Date(Date.now() + 60_000),
          },
        });

        await esperarRechazo(envioId, conOferta, /oferta sin responder/);
        // La oferta que ya tenía sigue intacta.
        expect(
          (
            await prisma.oferta.findUniqueOrThrow({
              where: { id: otraOferta.id },
            })
          ).estado,
        ).toBe('PENDIENTE');
      });

      it('vehículo que no alcanza para el paquete', async () => {
        const { envioId } = await envioSinRepartidor(5, 'AUTO');
        const moto = await crearRepartidor({ vehiculo: 'MOTO' });
        await esperarRechazo(envioId, moto, /vehículo/);
      });

      it('envío que ya tiene una oferta vigente', async () => {
        const { envioId } = await envioSinRepartidor(5);
        const primero = await crearRepartidor({ llegoEnMinuto: 0 });
        const segundo = await crearRepartidor({ llegoEnMinuto: 1 });
        expect((await asignar(envioId, primero)).status).toBe(200);

        const res = await asignar(envioId, segundo);

        expect(res.status).toBe(409);
        expect((res.body as { message: string }).message).toMatch(
          /ya tiene una oferta en curso/,
        );
        const vigentes = await ofertasVigentesDe(envioId);
        expect(vigentes.map((o) => o.repartidorId)).toEqual([primero]);
        // El segundo no perdió su lugar en la cola por el intento fallido.
        const intacto = await prisma.repartidor.findUniqueOrThrow({
          where: { id: segundo },
        });
        expect(intacto.enColaDesde).not.toBeNull();
      });

      it('envío que ya no está pendiente', async () => {
        const { envioId } = await envioSinRepartidor(5);
        const repartidor = await crearRepartidor();
        await prisma.envio.update({
          where: { id: envioId },
          data: { estado: 'CANCELADO' },
        });

        const res = await asignar(envioId, repartidor);

        expect(res.status).toBe(409);
        expect(await ofertasVigentesDe(envioId)).toEqual([]);
      });
    });

    it('404 si el envío o el repartidor no existen, 400 si falta el repartidor', async () => {
      const { envioId } = await envioSinRepartidor(5);
      const repartidor = await crearRepartidor();

      expect((await asignar(999, repartidor)).status).toBe(404);
      expect((await asignar(envioId, 999)).status).toBe(404);
      await request(app.getHttpServer())
        .post(`/api/excepciones/${envioId}/asignar`)
        .set('Cookie', await cookieOperario())
        .send({})
        .expect(400);
      expect(await ofertasVigentesDe(envioId)).toEqual([]);
    });

    describe('concurrencia (bloqueos de fila)', () => {
      it('dos operarios asignan el mismo envío a la vez: queda una sola oferta', async () => {
        const { envioId } = await envioSinRepartidor(5);
        const uno = await crearRepartidor({ llegoEnMinuto: 0 });
        const otro = await crearRepartidor({ llegoEnMinuto: 1 });

        const respuestas = await Promise.all([
          asignar(envioId, uno),
          asignar(envioId, otro),
        ]);

        expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(await ofertasVigentesDe(envioId)).toHaveLength(1);
      });

      it('dos envíos se asignan a la vez al mismo repartidor: recibe una sola oferta', async () => {
        const a = await envioSinRepartidor(5);
        const b = await envioSinRepartidor(6);
        const elegido = await crearRepartidor();

        const respuestas = await Promise.all([
          asignar(a.envioId, elegido),
          asignar(b.envioId, elegido),
        ]);

        expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(
          await prisma.oferta.count({
            where: { repartidorId: elegido, estado: 'PENDIENTE' },
          }),
        ).toBe(1);
      });

      it('la asignación manual y el reintento del motor a la vez no dejan dos ofertas para el envío ni para el repartidor', async () => {
        const { envioId } = await envioSinRepartidor(5);
        const elegido = await crearRepartidor();

        const [res] = await Promise.all([
          asignar(envioId, elegido),
          motor.reintentarPendientes(),
        ]);

        // Gane quien gane, el resultado es consistente: una sola oferta vigente, y es de ese repartidor.
        expect([200, 409]).toContain(res.status);
        const vigentes = await ofertasVigentesDe(envioId);
        expect(vigentes.map((o) => o.repartidorId)).toEqual([elegido]);
      });
    });
  });
});
