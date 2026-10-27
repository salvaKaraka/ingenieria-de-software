import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

// Viaje del repartidor (E-2) por HTTP contra una base real: el avance es un UPDATE
// condicionado y la entrega devuelve al repartidor a la cola en la misma transacción.
describe('Viaje del repartidor (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;

  const cookieDe = async (id: number) =>
    `access_token=${await jwt.signAsync({ sub: id, rol: 'REPARTIDOR' })}`;

  async function crearRepartidor(estado: 'OCUPADO' | 'FUERA_DE_JORNADA') {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Viaje',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
        estado,
      },
    });
    return repartidor.id;
  }

  let codigo = 0;
  async function crearEnvio(
    estado: EstadoEnvio,
    repartidorId: number | null = null,
  ) {
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `VIAJE${++codigo}`,
        comercioId,
        origenDireccion: 'Calle 7 1234',
        destinoDireccion: 'Calle 50 567',
        destinatarioNombre: 'Ana',
        destinatarioDni: '30111222',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado,
        repartidorId,
      },
    });
    return envio.id;
  }

  const avanzar = async (repartidorId: number) =>
    request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
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
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Kiosco',
          telefono: '221 555',
          email: 'c@test.com',
          direccion: 'Calle 7 1234',
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('devuelve el viaje activo con el contrato de E-3, sin el DNI', async () => {
    const repartidor = await crearRepartidor('OCUPADO');
    const envioId = await crearEnvio('ASIGNADO', repartidor);

    const res = await request(app.getHttpServer())
      .get('/api/repartidor/viajes/actual')
      .set('Cookie', await cookieDe(repartidor))
      .expect(200);

    expect(res.body.viaje).toMatchObject({
      envioId,
      estado: 'ASIGNADO',
      siguienteEstado: 'EN_CAMINO_A_RETIRAR',
      comercio: { nombre: 'Kiosco', telefono: '221 555' },
      destinatario: { nombre: 'Ana' },
    });
    expect(JSON.stringify(res.body)).not.toContain('30111222');
  });

  it('avanza hasta ENTREGADO, deja los eventos y el repartidor recibe el siguiente envío', async () => {
    const repartidor = await crearRepartidor('OCUPADO');
    const envioId = await crearEnvio('ASIGNADO', repartidor);
    const esperando = await crearEnvio('PENDIENTE');

    for (const esperado of [
      'EN_CAMINO_A_RETIRAR',
      'RETIRADO',
      'EN_DOMICILIO',
      'ENTREGADO',
    ]) {
      const res = await avanzar(repartidor);
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe(esperado);
    }

    const eventos = await prisma.eventoEnvio.findMany({ where: { envioId } });
    expect(eventos).toHaveLength(4);
    expect(eventos.every((e) => e.actorTipo === 'REPARTIDOR')).toBe(true);

    const libre = await prisma.repartidor.findUniqueOrThrow({
      where: { id: repartidor },
    });
    expect(libre.estado).toBe('DISPONIBLE');
    expect(libre.viajesConsecutivos).toBe(1);
    const oferta = await prisma.oferta.findFirst({
      where: { envioId: esperando, estado: 'PENDIENTE' },
    });
    expect(oferta?.repartidorId).toBe(repartidor);
  });

  it('un repartidor no puede avanzar el envío de otro', async () => {
    const duenio = await crearRepartidor('OCUPADO');
    const otro = await crearRepartidor('FUERA_DE_JORNADA');
    const envioId = await crearEnvio('ASIGNADO', duenio);

    expect((await avanzar(otro)).status).toBe(409);
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('ASIGNADO');
  });

  it('un envío cancelado ya no es su viaje activo', async () => {
    const repartidor = await crearRepartidor('OCUPADO');
    await crearEnvio('CANCELADO', repartidor);

    const res = await request(app.getHttpServer())
      .get('/api/repartidor/viajes/actual')
      .set('Cookie', await cookieDe(repartidor))
      .expect(200);
    expect(res.body.viaje).toBeNull();
    expect((await avanzar(repartidor)).status).toBe(409);
  });
});
