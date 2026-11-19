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
} from '../src/generated/prisma/client';
import { HashingService } from '../src/modules/auth/hashing.service';
import { emailUnico, vaciarBase } from './utils';

describe('Perfil del repartidor (e2e) - HU #68', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let hashing: HashingService;
  let comercioId: number;

  const cookieDe = async (id: number, rol: RolUsuario = 'REPARTIDOR') =>
    `access_token=${await jwt.signAsync({ sub: id, rol })}`;

  async function crearRepartidor(
    pin: string = '1234',
    estado: EstadoRepartidor = 'DISPONIBLE',
  ) {
    const pinHmac = hashing.hmacPin(pin);
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'Juan',
        apellido: 'Pérez',
        dni: '38123456',
        telefono: '1144556677',
        email: emailUnico(),
        direccion: 'Calle Falsa 123',
        vehiculo: 'MOTO',
        estado,
        pinHmac,
      },
    });
    return { id: repartidor.id, pin };
  }

  async function crearEnvioConEstado(repartidorId: number, estado: EstadoEnvio) {
    return prisma.envio.create({
      data: {
        codigoSeguimiento: `ENV${Date.now()}-${Math.random()}`,
        comercioId,
        repartidorId,
        origenDireccion: 'Origen 123',
        destinoDireccion: 'Destino 456',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        estado,
        requiereFoto: false,
        requiereDni: false,
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
    hashing = app.get(HashingService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    const comercio = await prisma.comercio.create({
      data: {
        nombre: 'Comercio Test',
        telefono: '11223344',
        email: 'comercio@test.com',
        direccion: 'Av. Test 100',
      },
    });
    comercioId = comercio.id;
  });

  afterAll(() => app.close());

  describe('GET /api/repartidor/perfil', () => {
    it('devuelve el perfil del repartidor autenticado con DNI enmascarado', async () => {
      const { id } = await crearRepartidor();
      const res = await request(app.getHttpServer())
        .get('/api/repartidor/perfil')
        .set('Cookie', await cookieDe(id))
        .expect(200);

      expect(res.body).toMatchObject({
        id,
        nombre: 'Juan',
        apellido: 'Pérez',
        dni: '•••••456',
        telefono: '1144556677',
        vehiculo: 'MOTO',
      });
      expect(res.body.pinHmac).toBeUndefined();
    });

    it('rechaza con 403 a un usuario sin rol REPARTIDOR', async () => {
      await request(app.getHttpServer())
        .get('/api/repartidor/perfil')
        .set('Cookie', await cookieDe(1, 'OPERARIO'))
        .expect(403);
    });
  });

  describe('PATCH /api/repartidor/perfil', () => {
    it('Escenario 1: permite actualizar teléfono y email con chofer en DISPONIBLE sin viajes en tránsito', async () => {
      const { id } = await crearRepartidor('1234', 'DISPONIBLE');

      const res = await request(app.getHttpServer())
        .patch('/api/repartidor/perfil')
        .set('Cookie', await cookieDe(id))
        .send({ telefono: '1199887766' })
        .expect(200);

      expect(res.body.telefono).toBe('1199887766');

      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id },
      });
      expect(enBase.telefono).toBe('1199887766');
    });

    it('Escenario 1 (segunda variante): permite actualizar contacto con chofer EN_PAUSA', async () => {
      const { id } = await crearRepartidor('1234', 'EN_PAUSA');

      const res = await request(app.getHttpServer())
        .patch('/api/repartidor/perfil')
        .set('Cookie', await cookieDe(id))
        .send({ telefono: '1155443322', email: 'modificado@test.com' })
        .expect(200);

      expect(res.body.telefono).toBe('1155443322');
      expect(res.body.email).toBe('modificado@test.com');
    });

    it('Escenario 3: no permite editar el tipo de vehículo (campo no permitido)', async () => {
      const { id } = await crearRepartidor('1234', 'DISPONIBLE');

      // Si envía vehiculo, la API rechaza por forbidNonWhitelisted (400)
      await request(app.getHttpServer())
        .patch('/api/repartidor/perfil')
        .set('Cookie', await cookieDe(id))
        .send({ vehiculo: 'AUTO' })
        .expect(400);

      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id },
      });
      expect(enBase.vehiculo).toBe('MOTO');
    });

    it('Bloqueo por viaje activo en curso: rechaza si el estado es EN_CAMINO_A_RETIRAR', async () => {
      const { id } = await crearRepartidor('1234', 'OCUPADO');
      await crearEnvioConEstado(id, 'EN_CAMINO_A_RETIRAR');

      await request(app.getHttpServer())
        .patch('/api/repartidor/perfil')
        .set('Cookie', await cookieDe(id))
        .send({ telefono: '1199999999' })
        .expect(409);
    });

    it('Bloqueo por viaje activo en curso: rechaza si el estado es RETIRADO ("Paquete en poder")', async () => {
      const { id } = await crearRepartidor('1234', 'OCUPADO');
      await crearEnvioConEstado(id, 'RETIRADO');

      await request(app.getHttpServer())
        .patch('/api/repartidor/perfil')
        .set('Cookie', await cookieDe(id))
        .send({ telefono: '1199999999' })
        .expect(409);
    });

    it('Bloqueo por viaje activo en curso: rechaza si el estado es EN_DOMICILIO', async () => {
      const { id } = await crearRepartidor('1234', 'OCUPADO');
      await crearEnvioConEstado(id, 'EN_DOMICILIO');

      await request(app.getHttpServer())
        .patch('/api/repartidor/perfil')
        .set('Cookie', await cookieDe(id))
        .send({ telefono: '1199999999' })
        .expect(409);
    });
  });

  // Este bloque va último y con pocas llamadas: el endpoint admite 5 intentos por minuto.
  describe('POST /api/repartidor/perfil/cambiar-pin', () => {
    const cambiarPin = async (id: number, cuerpo: object) =>
      request(app.getHttpServer())
        .post('/api/repartidor/perfil/cambiar-pin')
        .set('Cookie', await cookieDe(id))
        .send(cuerpo);

    const login = (pin: string) =>
      request(app.getHttpServer())
        .post('/api/auth/repartidor/login')
        .send({ pin });

    // Reenvía las cookies que dejó una respuesta, como haría el navegador.
    const refrescarCon = (respuesta: request.Response) =>
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set(
          'Cookie',
          (respuesta.get('Set-Cookie') ?? []).map((c) => c.split(';')[0]),
        );

    it('con el PIN actual correcto el sistema genera un PIN nuevo de 4 dígitos: el viejo deja de servir, el nuevo sirve y el dispositivo sigue logueado', async () => {
      const { id } = await crearRepartidor('1234', 'DISPONIBLE');
      const sesionVieja = await login('1234').expect(200);

      const res = await cambiarPin(id, { pinActual: '1234' });

      expect(res.status).toBe(200);
      const { pin } = res.body as { pin: string };
      expect(Object.keys(res.body as object)).toEqual(['pin']);
      expect(pin).toMatch(/^\d{4}$/);
      expect(pin).not.toBe('1234');

      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id },
      });
      expect(enBase.pinHmac).toBe(hashing.hmacPin(pin));

      await login('1234').expect(401);
      await login(pin).expect(200);

      // La respuesta trae una sesión nueva para este dispositivo; las anteriores quedan cerradas.
      await refrescarCon(res).expect(200);
      await refrescarCon(sesionVieja).expect(401);
    });

    it('con un PIN actual que no coincide responde 400 "El PIN actual ingresado es incorrecto" y no cambia el PIN', async () => {
      const { id } = await crearRepartidor('1234', 'DISPONIBLE');

      const res = await cambiarPin(id, { pinActual: '9999' });

      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toBe(
        'El PIN actual ingresado es incorrecto',
      );
      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id },
      });
      expect(enBase.pinHmac).toBe(hashing.hmacPin('1234'));
    });

    it('un PIN elegido por el repartidor no tiene efecto: rechaza el body y el PIN queda igual', async () => {
      const { id } = await crearRepartidor('1234', 'DISPONIBLE');

      const res = await cambiarPin(id, { pinActual: '1234', nuevoPin: '5678' });

      expect(res.status).toBe(400);
      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id },
      });
      expect(enBase.pinHmac).toBe(hashing.hmacPin('1234'));
    });

    it('rechaza cambiar el PIN si posee un viaje en tránsito', async () => {
      const { id } = await crearRepartidor('1234', 'OCUPADO');
      await crearEnvioConEstado(id, 'RETIRADO');

      const res = await cambiarPin(id, { pinActual: '1234' });

      expect(res.status).toBe(409);
      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id },
      });
      expect(enBase.pinHmac).toBe(hashing.hmacPin('1234'));
    });

    // Va último: agota el límite de intentos de esta ruta.
    it('más de 5 intentos por minuto da 429, para que no sirva para adivinar el PIN actual', async () => {
      const { id } = await crearRepartidor('1234', 'DISPONIBLE');
      const codigos: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await cambiarPin(id, { pinActual: '0000' });
        codigos.push(res.status);
      }

      expect(codigos).toContain(429);
      const enBase = await prisma.repartidor.findUniqueOrThrow({
        where: { id },
      });
      expect(enBase.pinHmac).toBe(hashing.hmacPin('1234'));
    });
  });
});
