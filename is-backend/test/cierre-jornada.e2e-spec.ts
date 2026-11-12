import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio, RolUsuario } from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

// Cierre de jornada (G-1): el estado del repartidor cambia en las mismas transacciones que
// entregan o cancelan su viaje, así que se prueba de punta a punta contra la base.
describe('Cierre de jornada (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;
  let operarioId: number;

  const cookieDe = async (id: number, rol: RolUsuario) =>
    `access_token=${await jwt.signAsync({ sub: id, rol })}`;

  const comoRepartidor = async (
    id: number,
    metodo: 'get' | 'post',
    ruta: string,
  ) =>
    request(app.getHttpServer())
      [metodo](`/api/repartidor/${ruta}`)
      .set('Cookie', await cookieDe(id, 'REPARTIDOR'));

  const aprobar = async (repartidorId: number, paquetesDevueltos: number) =>
    request(app.getHttpServer())
      .post(`/api/repartidores/${repartidorId}/aprobar-cierre`)
      .set('Cookie', await cookieDe(operarioId, 'OPERARIO'))
      .send({ paquetesDevueltos });

  const estadoDe = async (id: number) =>
    (await prisma.repartidor.findUniqueOrThrow({ where: { id } })).estado;

  async function crearRepartidor(estado: 'DISPONIBLE' | 'OCUPADO') {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Cierre',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
        estado,
        enColaDesde: estado === 'DISPONIBLE' ? new Date() : null,
      },
    });
    return repartidor.id;
  }

  // Viaje en curso del repartidor, con el historial que dejaría haberlo avanzado hasta `estado`.
  async function crearViaje(repartidorId: number | null, estado: EstadoEnvio) {
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `CIE${Date.now()}${Math.random()}`,
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
    if (estado === 'RETIRADO' || estado === 'EN_DOMICILIO') {
      await prisma.eventoEnvio.create({
        data: {
          envioId: envio.id,
          tipo: 'CAMBIO_ESTADO',
          estadoNuevo: 'RETIRADO',
          actorTipo: 'REPARTIDOR',
          actorId: repartidorId,
        },
      });
    }
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
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'C',
          telefono: '1',
          email: 'c@test.com',
          direccion: 'x',
        },
      })
    ).id;
    operarioId = (
      await prisma.operario.create({
        data: { nombre: 'Op', usuario: 'op_cierre', passwordHash: 'x' },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('con un viaje en curso, el cierre se completa al entregar y no recibe más ofertas', async () => {
    const repartidor = await crearRepartidor('OCUPADO');
    await crearViaje(repartidor, 'EN_DOMICILIO');
    const esperando = await crearViaje(null, 'PENDIENTE');

    const pedido = await comoRepartidor(
      repartidor,
      'post',
      'jornada/solicitar-cierre',
    );
    expect(pedido.body).toMatchObject({
      estado: 'OCUPADO',
      cierrePendiente: true,
    });

    const entrega = await comoRepartidor(
      repartidor,
      'post',
      'viajes/actual/avanzar',
    );
    expect(entrega.body.estado).toBe('ENTREGADO');

    expect(await estadoDe(repartidor)).toBe('ESPERANDO_VALIDACION_CIERRE');
    expect(await prisma.oferta.count({ where: { envioId: esperando } })).toBe(
      0,
    );
  });

  it('un paquete cancelado después del retiro se rinde en la base antes de aprobar el cierre', async () => {
    const repartidor = await crearRepartidor('OCUPADO');
    const envio = await crearViaje(repartidor, 'RETIRADO');
    await comoRepartidor(repartidor, 'post', 'jornada/solicitar-cierre');

    // Le cancelan el viaje con el paquete encima: no vuelve a la cola, queda esperando.
    await request(app.getHttpServer())
      .post(`/api/envios/${envio}/cancelar`)
      .set('Cookie', await cookieDe(operarioId, 'OPERARIO'))
      .expect(200);
    expect(await estadoDe(repartidor)).toBe('ESPERANDO_VALIDACION_CIERRE');

    const jornada = await comoRepartidor(repartidor, 'get', 'jornada');
    expect(jornada.body.paquetesADevolver).toHaveLength(1);

    const faltan = await aprobar(repartidor, 0);
    expect(faltan.status).toBe(400);
    expect(faltan.body.message).toBe('Faltan rendir 1 paquete');
    expect(await estadoDe(repartidor)).toBe('ESPERANDO_VALIDACION_CIERRE');

    await aprobar(repartidor, 1).then((r) => expect(r.status).toBe(200));
    expect(await estadoDe(repartidor)).toBe('FUERA_DE_JORNADA');
    const devolucion = await prisma.eventoEnvio.findFirst({
      where: { envioId: envio, tipo: 'DEVOLUCION' },
    });
    expect(devolucion).toMatchObject({
      actorTipo: 'OPERARIO',
      actorId: operarioId,
    });
  });

  it('no aprueba el cierre de un repartidor que no lo pidió', async () => {
    const repartidor = await crearRepartidor('DISPONIBLE');

    const respuesta = await aprobar(repartidor, 0);

    expect(respuesta.status).toBe(409);
    expect(await estadoDe(repartidor)).toBe('DISPONIBLE');
  });
});
