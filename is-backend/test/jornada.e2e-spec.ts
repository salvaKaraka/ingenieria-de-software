import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { RolUsuario } from '../src/generated/prisma/client';
import { AsignacionService } from '../src/modules/asignacion/asignacion.service';
import { emailUnico, vaciarBase } from './utils';

// Jornada del repartidor (C-3) por HTTP: los cambios de estado son UPDATE condicionados
// y la entrada a la cola dispara el motor, así que se prueba contra una base real.
describe('Jornada del repartidor (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let motor: AsignacionService;
  let jwt: JwtService;
  let comercioId: number;

  const cookieDe = async (id: number, rol: RolUsuario = 'REPARTIDOR') =>
    `access_token=${await jwt.signAsync({ sub: id, rol })}`;

  async function crearRepartidor() {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Jornada',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
      },
    });
    return repartidor.id;
  }

  async function crearEnvio() {
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `JOR${Date.now()}`,
        comercioId,
        origenDireccion: 'Comercio',
        destinoDireccion: 'Destino',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
      },
    });
    return envio.id;
  }

  const post = async (repartidorId: number, accion: string) =>
    request(app.getHttpServer())
      .post(`/api/repartidor/jornada/${accion}`)
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
    motor = app.get(AsignacionService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Comercio',
          telefono: '1',
          email: 'c@test.com',
          direccion: 'x',
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('al iniciar la jornada recibe la oferta del envío que esperaba repartidor', async () => {
    const repartidor = await crearRepartidor();
    const envioId = await crearEnvio();
    expect(await motor.asignar(envioId)).toBeNull(); // nadie en la cola todavía

    const res = await post(repartidor, 'iniciar');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ estado: 'DISPONIBLE' });
    const oferta = await prisma.oferta.findFirst({ where: { envioId } });
    expect(oferta?.repartidorId).toBe(repartidor);
  });

  it('pausa y reanuda: sale de la cola y vuelve al final', async () => {
    const repartidor = await crearRepartidor();
    await post(repartidor, 'iniciar');

    expect((await post(repartidor, 'pausar')).body).toEqual({
      estado: 'EN_PAUSA',
    });
    const pausado = await prisma.repartidor.findUniqueOrThrow({
      where: { id: repartidor },
    });
    expect(pausado.enColaDesde).toBeNull();

    expect((await post(repartidor, 'reanudar')).body).toEqual({
      estado: 'DISPONIBLE',
    });
  });

  it('no deja pausar con una oferta pendiente (409)', async () => {
    const repartidor = await crearRepartidor();
    await crearEnvio();
    await post(repartidor, 'iniciar'); // el motor le ofrece el envío

    const res = await post(repartidor, 'pausar');

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('oferta pendiente');
  });

  it('pausar fuera de jornada responde 409', async () => {
    const repartidor = await crearRepartidor();
    expect((await post(repartidor, 'pausar')).status).toBe(409);
  });

  it('un operario no puede usar los endpoints de jornada', async () => {
    await request(app.getHttpServer())
      .post('/api/repartidor/jornada/iniciar')
      .set('Cookie', await cookieDe(1, 'OPERARIO'))
      .expect(403);
  });

  it('termina la jornada desde DISPONIBLE o EN_PAUSA', async () => {
    const repartidor = await crearRepartidor();
    await post(repartidor, 'iniciar');

    const res = await post(repartidor, 'terminar');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ estado: 'FUERA_DE_JORNADA' });

    const enBase = await prisma.repartidor.findUniqueOrThrow({
      where: { id: repartidor },
    });
    expect(enBase.estado).toBe('FUERA_DE_JORNADA');
    expect(enBase.enColaDesde).toBeNull();
  });

  it('no deja terminar la jornada con una oferta pendiente (409)', async () => {
    const repartidor = await crearRepartidor();
    await crearEnvio();
    await post(repartidor, 'iniciar'); // el motor le ofrece el envío

    const res = await post(repartidor, 'terminar');

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('oferta pendiente');
  });

  it('la flota respeta el orden FIFO y la agrupación por vehículo', async () => {
    const r1 = await crearRepartidor();
    await post(r1, 'iniciar');

    await new Promise((r) => setTimeout(r, 10));

    const r2 = await crearRepartidor();
    await post(r2, 'iniciar');

    // Repartidor 3 fuera de jornada: no debe aparecer en la flota
    await crearRepartidor();

    const res = await request(app.getHttpServer())
      .get('/api/flota')
      .set('Cookie', await cookieDe(1, 'OPERARIO'));

    expect(res.status).toBe(200);
    expect(res.body.MOTO).toHaveLength(2);
    expect(res.body.MOTO[0].id).toBe(r1);
    expect(res.body.MOTO[1].id).toBe(r2);
    expect(res.body.MOTO[0].pinHmac).toBeUndefined();
    expect(res.body.AUTO).toEqual([]);
    expect(res.body.CAMION).toEqual([]);
  });

  it('un repartidor no puede acceder a /api/flota (403)', async () => {
    const r = await crearRepartidor();
    await request(app.getHttpServer())
      .get('/api/flota')
      .set('Cookie', await cookieDe(r, 'REPARTIDOR'))
      .expect(403);
  });
});
