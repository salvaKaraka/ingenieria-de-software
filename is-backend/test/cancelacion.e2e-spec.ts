import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { AsignacionService } from '../src/modules/asignacion/asignacion.service';
import { OfertasService } from '../src/modules/asignacion/ofertas.service';
import { EnviosService } from '../src/modules/envios/envios.service';
import { emailUnico, vaciarBase } from './utils';

// Cancelar un envío toca ofertas y repartidores en la misma transacción que el envío:
// se prueba contra la base real porque depende de los bloqueos de Postgres.
describe('Cancelación de envíos (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let envios: EnviosService;
  let motor: AsignacionService;
  let ofertas: OfertasService;
  let comercioId: number;
  let operarioId: number;

  async function crearRepartidor(
    minutosEnCola = 30,
    estado: 'DISPONIBLE' | 'OCUPADO' = 'DISPONIBLE',
  ) {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Test',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
        estado,
        enColaDesde:
          estado === 'DISPONIBLE'
            ? new Date(Date.now() - minutosEnCola * 60_000)
            : null,
      },
    });
    return repartidor.id;
  }

  let codigo = 0;
  async function crearEnvio(
    estado: EstadoEnvio = 'PENDIENTE',
    repartidorId?: number,
  ) {
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `CANC${++codigo}`,
        comercioId,
        origenDireccion: 'Comercio',
        destinoDireccion: 'Destino',
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
    envios = app.get(EnviosService);
    motor = app.get(AsignacionService);
    ofertas = app.get(OfertasService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    const comercio = await prisma.comercio.create({
      data: {
        nombre: 'Comercio',
        telefono: '1',
        email: 'c@test.com',
        direccion: 'x',
      },
    });
    comercioId = comercio.id;
    const operario = await prisma.operario.create({
      data: { nombre: 'Op', usuario: 'op', passwordHash: 'x' },
    });
    operarioId = operario.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function cookieDe(id: number, rol: 'OPERARIO' | 'REPARTIDOR') {
    return `access_token=${await jwt.signAsync({ sub: id, rol })}`;
  }

  it('cierra la oferta abierta y el repartidor vuelve a la cola sin quedar en pausa', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio();
    const oferta = await motor.asignar(envioId);
    expect(oferta).not.toBeNull();

    await envios.cancelar(envioId, operarioId);

    const ofertaDespues = await prisma.oferta.findUniqueOrThrow({
      where: { id: oferta!.id },
    });
    expect(ofertaDespues.estado).toBe('VENCIDA');
    const repartidor = await prisma.repartidor.findUniqueOrThrow({
      where: { id: repartidorId },
    });
    expect(repartidor.estado).toBe('DISPONIBLE');
    expect(repartidor.enColaDesde).not.toBeNull();
  });

  it('la oferta de un envío cancelado ya no se puede aceptar', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio();
    const oferta = await motor.asignar(envioId);

    await envios.cancelar(envioId, operarioId);

    await expect(ofertas.aceptar(oferta!.id, repartidorId)).rejects.toThrow();
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('CANCELADO');
  });

  it('libera al repartidor que tenía el viaje y le ofrece otro envío pendiente', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio();
    const oferta = await motor.asignar(envioId);
    await ofertas.aceptar(oferta!.id, repartidorId);
    const otroEnvioId = await crearEnvio(); // espera repartidor: no hay otro libre
    expect(await motor.asignar(otroEnvioId)).toBeNull();

    await envios.cancelar(envioId, operarioId);

    const repartidor = await prisma.repartidor.findUniqueOrThrow({
      where: { id: repartidorId },
    });
    // Disponible, y el motor ya le ofreció el envío que esperaba (por eso salió de la cola).
    expect(repartidor.estado).toBe('DISPONIBLE');
    const nuevaOferta = await prisma.oferta.findFirst({
      where: { envioId: otroEnvioId, estado: 'PENDIENTE' },
    });
    expect(nuevaOferta?.repartidorId).toBe(repartidorId);
  });

  it('cancelar y aceptar a la vez: gana uno solo y no hay deadlock', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio();
    const oferta = await motor.asignar(envioId);

    const [aceptar, cancelar] = await Promise.allSettled([
      ofertas.aceptar(oferta!.id, repartidorId),
      envios.cancelar(envioId, operarioId),
    ]);

    // Si hubiera deadlock, Postgres aborta una transacción y eso no es un 409.
    for (const resultado of [aceptar, cancelar]) {
      if (resultado.status === 'rejected') {
        expect(resultado.reason).toBeInstanceOf(ConflictException);
      }
    }
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    const repartidor = await prisma.repartidor.findUniqueOrThrow({
      where: { id: repartidorId },
    });
    // Cualquier orden es válido, pero el resultado tiene que ser coherente: un envío
    // cancelado nunca deja a su repartidor ocupado.
    if (envio.estado === 'CANCELADO') {
      expect(repartidor.estado).toBe('DISPONIBLE');
    } else {
      expect(envio.estado).toBe('ASIGNADO');
      expect(repartidor.estado).toBe('OCUPADO');
    }
  });

  it('cancela antes del retiro, libera al repartidor y le avisa que no retire el paquete', async () => {
    const repartidorId = await crearRepartidor(30, 'OCUPADO');
    const envioId = await crearEnvio('EN_CAMINO_A_RETIRAR', repartidorId);

    await request(app.getHttpServer())
      .post(`/api/envios/${envioId}/cancelar`)
      .set('Cookie', await cookieDe(operarioId, 'OPERARIO'))
      .expect(200);

    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('CANCELADO');
    expect(envio.repartidorId).toBe(repartidorId);
    expect(
      await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidorId },
      }),
    ).toMatchObject({ estado: 'DISPONIBLE' });

    const viajeActual = await request(app.getHttpServer())
      .get('/api/repartidor/viajes/actual')
      .set('Cookie', await cookieDe(repartidorId, 'REPARTIDOR'))
      .expect(200);
    expect(viajeActual.body).toEqual({
      viaje: null,
      avisoCancelacion: 'El envío fue cancelado. No lo retires.',
    });
  });

  it.each(['RETIRADO', 'EN_DOMICILIO'] as const)(
    'rechaza cancelar en %s con el mensaje exacto y conserva el estado',
    async (estado) => {
      const repartidorId = await crearRepartidor(30, 'OCUPADO');
      const envioId = await crearEnvio(estado, repartidorId);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/envios/${envioId}/cancelar`)
        .set('Cookie', await cookieDe(operarioId, 'OPERARIO'))
        .expect(409);

      expect(respuesta.body.message).toBe(
        'No se puede cancelar: el paquete ya fue retirado',
      );
      expect(
        await prisma.envio.findUniqueOrThrow({ where: { id: envioId } }),
      ).toMatchObject({ estado, repartidorId });
      expect(
        await prisma.repartidor.findUniqueOrThrow({
          where: { id: repartidorId },
        }),
      ).toMatchObject({ estado: 'OCUPADO' });
    },
  );

  it('cancela un envío pendiente sin repartidor y lo excluye de la asignación automática', async () => {
    const envioId = await crearEnvio('PENDIENTE');

    await request(app.getHttpServer())
      .post(`/api/envios/${envioId}/cancelar`)
      .set('Cookie', await cookieDe(operarioId, 'OPERARIO'))
      .expect(200);

    expect(
      await prisma.envio.findUniqueOrThrow({ where: { id: envioId } }),
    ).toMatchObject({ estado: 'CANCELADO', repartidorId: null });
    expect(await motor.asignar(envioId)).toBeNull();
  });

  it('cancela un envío asignado, libera al repartidor y le avisa que no retire el paquete', async () => {
    const repartidorId = await crearRepartidor(30, 'OCUPADO');
    const envioId = await crearEnvio('ASIGNADO', repartidorId);

    await request(app.getHttpServer())
      .post(`/api/envios/${envioId}/cancelar`)
      .set('Cookie', await cookieDe(operarioId, 'OPERARIO'))
      .expect(200);

    expect(
      await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidorId },
      }),
    ).toMatchObject({ estado: 'DISPONIBLE' });
    const viajeActual = await request(app.getHttpServer())
      .get('/api/repartidor/viajes/actual')
      .set('Cookie', await cookieDe(repartidorId, 'REPARTIDOR'))
      .expect(200);
    expect(viajeActual.body.avisoCancelacion).toBe(
      'El envío fue cancelado. No lo retires.',
    );
  });
});
