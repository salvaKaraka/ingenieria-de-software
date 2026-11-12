import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type {
  EstadoEnvio,
  EstadoRepartidor,
  RolUsuario,
  TipoVehiculo,
} from '../src/generated/prisma/client';
import { AsignacionService } from '../src/modules/asignacion/asignacion.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { emailUnico, vaciarBase } from './utils';

describe('Disponibilidad del Repartidor - HU #8 (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let motor: AsignacionService;
  let authService: AuthService;
  let jwt: JwtService;
  let comercioId: number;

  const cookieDe = async (id: number, rol: RolUsuario = 'REPARTIDOR') =>
    `access_token=${await jwt.signAsync({ sub: id, rol })}`;

  async function crearRepartidor(
    opciones: {
      vehiculo?: TipoVehiculo;
      estado?: EstadoRepartidor;
      enColaDesde?: Date | null;
      viajesConsecutivos?: number;
    } = {},
  ) {
    const {
      vehiculo = 'MOTO',
      estado = 'DISPONIBLE',
      enColaDesde = new Date(),
      viajesConsecutivos = 0,
    } = opciones;

    return prisma.repartidor.create({
      data: {
        nombre: 'Repartidor',
        apellido: 'Test',
        telefono: '221-555-0000',
        email: emailUnico(),
        direccion: 'Calle Test 123',
        vehiculo,
        estado,
        enColaDesde: estado === 'DISPONIBLE' ? enColaDesde : null,
        viajesConsecutivos,
      },
    });
  }

  let codigo = 0;
  async function crearEnvio(
    opciones: {
      vehiculo?: TipoVehiculo;
      estado?: EstadoEnvio;
      repartidorId?: number;
    } = {},
  ) {
    const { vehiculo = 'MOTO', estado = 'PENDIENTE', repartidorId } = opciones;
    const tamanio = {
      MOTO: 'CHICO',
      AUTO: 'MEDIANO',
      CAMION: 'GRANDE',
    } as const;

    return prisma.envio.create({
      data: {
        codigoSeguimiento: `DISP${++codigo}`,
        comercioId,
        origenDireccion: 'Calle Comercio 100',
        destinoDireccion: 'Calle Cliente 200',
        tamanio: tamanio[vehiculo],
        vehiculoRequerido: vehiculo,
        requiereFoto: false,
        requiereDni: false,
        estado,
        repartidorId,
      },
    });
  }

  const postJornada = async (repartidorId: number, accion: string) =>
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
    authService = app.get(AuthService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    codigo = 0;
    const comercio = await prisma.comercio.create({
      data: {
        nombre: 'Comercio Test',
        telefono: '221-111-2222',
        email: 'comercio@test.com',
        direccion: 'Calle 10 n° 100',
      },
    });
    comercioId = comercio.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Escenario 1: Pausa exitosa', () => {
    it('con repartidor Disponible sin viajes, al pausar pasa a En pausa y sale de la cola', async () => {
      const repartidor = await crearRepartidor({
        estado: 'DISPONIBLE',
        enColaDesde: new Date(),
      });

      const res = await postJornada(repartidor.id, 'pausar');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ estado: 'EN_PAUSA' });

      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      });
      expect(enBase.estado).toBe('EN_PAUSA');
      expect(enBase.enColaDesde).toBeNull();
    });
  });

  describe('Escenario 2: Pausa fallida por viaje en curso', () => {
    it('con viaje en EN_CAMINO_A_RETIRAR, responde 409, mantiene estado y muestra mensaje exacto', async () => {
      const repartidor = await crearRepartidor({ estado: 'OCUPADO' });
      await crearEnvio({
        estado: 'EN_CAMINO_A_RETIRAR',
        repartidorId: repartidor.id,
      });

      const res = await postJornada(repartidor.id, 'pausar');

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Finalizá tu viaje en curso antes de pausar');

      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      });
      expect(enBase.estado).toBe('OCUPADO');
    });

    it('con viaje en RETIRADO, responde 409 y mantiene estado', async () => {
      const repartidor = await crearRepartidor({ estado: 'OCUPADO' });
      await crearEnvio({
        estado: 'RETIRADO',
        repartidorId: repartidor.id,
      });

      const res = await postJornada(repartidor.id, 'pausar');

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Finalizá tu viaje en curso antes de pausar');
    });

    it('con viaje en EN_DOMICILIO, responde 409 y mantiene estado', async () => {
      const repartidor = await crearRepartidor({ estado: 'OCUPADO' });
      await crearEnvio({
        estado: 'EN_DOMICILIO',
        repartidorId: repartidor.id,
      });

      const res = await postJornada(repartidor.id, 'pausar');

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Finalizá tu viaje en curso antes de pausar');
    });
  });

  describe('Escenario 3: Reanudación de la jornada', () => {
    it('con repartidor En pausa, al reanudar pasa a Disponible y se ubica al final de la cola', async () => {
      const horaAnterior = new Date(Date.now() - 60_000);
      await crearRepartidor({
        estado: 'DISPONIBLE',
        enColaDesde: horaAnterior,
      });
      const rep2 = await crearRepartidor({
        estado: 'EN_PAUSA',
        enColaDesde: null,
      });

      const res = await postJornada(rep2.id, 'reanudar');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ estado: 'DISPONIBLE' });

      const reanudado = await prisma.repartidor.findUniqueOrThrow({
        where: { id: rep2.id },
      });
      expect(reanudado.estado).toBe('DISPONIBLE');
      expect(reanudado.enColaDesde).not.toBeNull();
      // Está al final de la cola: su enColaDesde es posterior al de rep1
      expect(reanudado.enColaDesde!.getTime()).toBeGreaterThan(
        horaAnterior.getTime(),
      );
    });
  });

  describe('Escenario 4: Inicio de jornada', () => {
    // Ingresar con el PIN solo abre la sesión: el repartidor entra a la cola
    // recién cuando toca "Iniciar jornada" (misma regla que la HU67).
    it('al ingresar con el PIN sigue Fuera de jornada y, al iniciar la jornada, queda Disponible al final de la cola de su vehículo', async () => {
      const horaAnterior = new Date(Date.now() - 60_000);
      const yaEnCola = await crearRepartidor({
        vehiculo: 'MOTO',
        estado: 'DISPONIBLE',
        enColaDesde: horaAnterior,
      });
      const repartidor = await crearRepartidor({
        vehiculo: 'MOTO',
        estado: 'FUERA_DE_JORNADA',
      });
      const pin = await authService.asignarNuevoPin(repartidor.id);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/repartidor/login')
        .send({ pin });

      expect(loginRes.status).toBe(200);
      const despuesLogin = await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      });
      expect(despuesLogin.estado).toBe('FUERA_DE_JORNADA');
      expect(despuesLogin.enColaDesde).toBeNull();

      const iniciarRes = await request(app.getHttpServer())
        .post('/api/repartidor/jornada/iniciar')
        .set('Cookie', loginRes.get('Set-Cookie') ?? []);

      expect(iniciarRes.status).toBe(200);
      expect(iniciarRes.body).toEqual({ estado: 'DISPONIBLE' });
      const despuesIniciar = await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      });
      expect(despuesIniciar.estado).toBe('DISPONIBLE');
      expect(despuesIniciar.enColaDesde).not.toBeNull();
      expect(despuesIniciar.enColaDesde!.getTime()).toBeGreaterThan(
        horaAnterior.getTime(),
      );

      // Al final de la cola: el primer viaje de moto es para el que ya estaba.
      const envio = await crearEnvio({ vehiculo: 'MOTO' });
      const oferta = await motor.asignar(envio.id);
      expect(oferta?.repartidorId).toBe(yaEnCola.id);
    });
  });

  describe('Escenario 5: Repartidor en pausa no recibe ofertas', () => {
    it('si el chofer a la cabeza de la cola está En pausa, la oferta se deriva al siguiente Disponible', async () => {
      const r1 = await crearRepartidor({
        vehiculo: 'MOTO',
        estado: 'EN_PAUSA',
        enColaDesde: null,
      });

      const r2 = await crearRepartidor({
        vehiculo: 'MOTO',
        estado: 'DISPONIBLE',
        enColaDesde: new Date(),
      });

      const envio = await crearEnvio({ vehiculo: 'MOTO' });

      const oferta = await motor.asignar(envio.id);

      expect(oferta).not.toBeNull();
      expect(oferta?.repartidorId).toBe(r2.id);

      // r1 no tiene ofertas creadas
      const ofertaR1 = await prisma.oferta.findFirst({
        where: { repartidorId: r1.id },
      });
      expect(ofertaR1).toBeNull();
    });
  });

  describe('Escenario 6: Pausa fallida por viaje asignado', () => {
    it('con viaje en ASIGNADO, al presionar Pausar responde 409 con mensaje exacto y mantiene estado', async () => {
      const repartidor = await crearRepartidor({ estado: 'OCUPADO' });
      await crearEnvio({
        estado: 'ASIGNADO',
        repartidorId: repartidor.id,
      });

      const res = await postJornada(repartidor.id, 'pausar');

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Finalizá tu viaje en curso antes de pausar');

      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      });
      expect(enBase.estado).toBe('OCUPADO');
    });
  });
});
