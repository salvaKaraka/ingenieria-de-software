import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import { emailUnico, vaciarBase } from './utils';

const FOTO_VALIDA = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';

// Pruebas e2e de Depósito y Devoluciones (HU37, HU38, HU39 y HU40) contra la base real.
describe('Depósito y devoluciones (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let operarioId: number;
  let comercioId: number;

  const cookieOperario = async () =>
    `access_token=${await jwt.signAsync({ sub: operarioId, rol: 'OPERARIO' })}`;

  const cookieRepartidor = async (repartidorId: number) =>
    `access_token=${await jwt.signAsync({ sub: repartidorId, rol: 'REPARTIDOR' })}`;

  async function crearRepartidor(
    nombre: string,
    estado: 'ESPERANDO_VALIDACION_CIERRE' | 'DISPONIBLE',
  ) {
    const rep = await prisma.repartidor.create({
      data: {
        nombre,
        apellido: 'Gómez',
        telefono: '2215550000',
        email: emailUnico(),
        direccion: 'Calle 1 100',
        vehiculo: 'MOTO',
        estado,
        cierreSolicitado: estado === 'ESPERANDO_VALIDACION_CIERRE',
        enColaDesde: estado === 'DISPONIBLE' ? new Date() : null,
      },
    });
    return rep.id;
  }

  let secuencia = 0;
  // Paquete que el repartidor no pudo entregar y el operario marcó "A devolver" (HU 24).
  async function crearPaqueteADevolver(repartidorId: number) {
    return prisma.envio.create({
      data: {
        codigoSeguimiento: `DEP00000${++secuencia}`,
        comercioId,
        origenDireccion: 'Calle 7 123',
        destinoDireccion: 'Calle 50 567',
        destinatarioNombre: 'Juan',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado: 'A_DEVOLVER',
        repartidorId,
      },
    });
  }

  // Devuelven la respuesta ya resuelta (el body va como tercer/cuarto parámetro).
  const comoOperario = async (
    metodo: 'get' | 'post',
    ruta: string,
    body?: object,
  ) => {
    const pedido = request(app.getHttpServer())
      [metodo](`/api/${ruta}`)
      .set('Cookie', await cookieOperario());
    return body ? pedido.send(body) : pedido;
  };

  const comoRepartidor = async (
    repartidorId: number,
    metodo: 'get' | 'post',
    ruta: string,
    body?: object,
  ) => {
    const pedido = request(app.getHttpServer())
      [metodo](`/api/${ruta}`)
      .set('Cookie', await cookieRepartidor(repartidorId));
    return body ? pedido.send(body) : pedido;
  };

  const reingresar = (repartidorId: number, codigoSeguimiento: string) =>
    comoOperario('post', 'envios/deposito/reingreso', {
      repartidorId,
      codigoSeguimiento,
    });

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
    operarioId = (
      await prisma.operario.create({
        data: {
          usuario: 'admin_dep',
          nombre: 'Ana Pérez',
          passwordHash: 'hash',
        },
      })
    ).id;
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Panadería Sol',
          telefono: '221 555',
          email: 'sol@test.com',
          direccion: 'Calle 7 123',
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('HU 37: reingresa el paquete a custodia, lo saca de la rendición y lo deja en el historial', async () => {
    const repartidorId = await crearRepartidor(
      'Lucas',
      'ESPERANDO_VALIDACION_CIERRE',
    );
    const otroId = await crearRepartidor(
      'Mateo',
      'ESPERANDO_VALIDACION_CIERRE',
    );
    const envio = await crearPaqueteADevolver(repartidorId);
    const envioDeOtro = await crearPaqueteADevolver(otroId);

    const inexistente = await reingresar(repartidorId, 'NOEXISTE00');
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.message).toBe(
      'El código no corresponde a ningún envío',
    );

    const deOtro = await reingresar(
      repartidorId,
      envioDeOtro.codigoSeguimiento,
    );
    expect(deOtro.status).toBe(409);
    expect(deOtro.body.message).toBe(
      'El paquete no pertenece a la jornada de este repartidor',
    );

    const ok = await reingresar(repartidorId, envio.codigoSeguimiento);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      estado: 'EN_CUSTODIA',
      operarioNombre: 'Ana Pérez',
    });

    const rendicion = await comoOperario(
      'get',
      `repartidores/${repartidorId}/rendicion`,
    );
    expect(rendicion.body.paquetesADevolver).toEqual([]);

    const detalle = await comoOperario('get', `envios/${envio.id}`);
    expect(detalle.body.estado).toBe('EN_CUSTODIA');
    expect(detalle.body.historial).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          estadoNuevo: 'EN_CUSTODIA',
          actorTipo: 'OPERARIO',
          actorNombre: 'Ana Pérez',
        }),
      ]),
    );
  });

  it('HU 38, 39, 40 y 41: la orden se ofrece por la cola, el repartidor la entrega con constancia y cuenta como devuelta', async () => {
    const rindiendo = await crearRepartidor(
      'Lucas',
      'ESPERANDO_VALIDACION_CIERRE',
    );
    const a = await crearPaqueteADevolver(rindiendo);
    const b = await crearPaqueteADevolver(rindiendo);
    await reingresar(rindiendo, a.codigoSeguimiento).then((r) =>
      expect(r.status).toBe(200),
    );
    await reingresar(rindiendo, b.codigoSeguimiento).then((r) =>
      expect(r.status).toBe(200),
    );

    // HU 40: con 25 horas en custodia aparece la alerta.
    await prisma.eventoEnvio.updateMany({
      where: { envioId: { in: [a.id, b.id] }, estadoNuevo: 'EN_CUSTODIA' },
      data: { creadoEn: new Date(Date.now() - 25 * 3_600_000) },
    });
    const alertas = await comoOperario('get', 'envios/deposito/alertas');
    expect(alertas.body).toHaveLength(2);

    // HU 38: la orden con los dos paquetes se ofrece al repartidor disponible.
    const repartidorId = await crearRepartidor('Sofía', 'DISPONIBLE');
    const orden = await comoOperario(
      'post',
      'envios/deposito/ordenes-devolucion',
      { comercioId, envioIds: [a.id, b.id] },
    );
    expect(orden.status).toBe(201);
    expect(orden.body).toMatchObject({ cantidadPaquetes: 2, ofrecida: true });

    // HU 40, escenario 3: ya no figuran en la alerta.
    expect((await comoOperario('get', 'envios/deposito/alertas')).body).toEqual(
      [],
    );
    // HU 38, escenario 2: no quedan paquetes en custodia.
    const sinPaquetes = await comoOperario(
      'get',
      `envios/deposito/custodia?comercioId=${comercioId}`,
    );
    expect(sinPaquetes.body.message).toBe(
      'No hay paquetes en custodia para este comercio',
    );

    const oferta = await comoRepartidor(
      repartidorId,
      'get',
      'repartidor/ofertas/actual',
    );
    expect(oferta.body.oferta.envio).toMatchObject({
      origenDireccion: 'Depósito (base)',
      destinoDireccion: 'Calle 7 123',
      observaciones: 'Devolución al comercio: 2 paquetes',
    });
    await comoRepartidor(
      repartidorId,
      'post',
      `repartidor/ofertas/${oferta.body.oferta.id}/aceptar`,
    ).then((r) => expect(r.status).toBe(200));

    const viaje = await comoRepartidor(
      repartidorId,
      'get',
      'repartidor/viajes/actual',
    );
    expect(viaje.body.viaje).toMatchObject({
      esDevolucion: true,
      estado: 'EN_DEVOLUCION',
      paquetes: [a.codigoSeguimiento, b.codigoSeguimiento],
    });
    expect(
      (
        await prisma.repartidor.findUniqueOrThrow({
          where: { id: repartidorId },
        })
      ).estado,
    ).toBe('OCUPADO');

    // HU 39, escenario 2: sin foto no confirma.
    const sinFoto = await comoRepartidor(
      repartidorId,
      'post',
      'repartidor/viajes/actual/confirmar-devolucion',
      {},
    );
    expect(sinFoto.status).toBe(400);
    expect(sinFoto.body.message).toBe('Falta la foto de la constancia');

    const confirmada = await comoRepartidor(
      repartidorId,
      'post',
      'repartidor/viajes/actual/confirmar-devolucion',
      { foto: FOTO_VALIDA },
    );
    expect(confirmada.status).toBe(200);
    expect(
      await prisma.envio.findMany({
        where: { id: { in: [a.id, b.id] } },
        select: { estado: true },
      }),
    ).toEqual([
      { estado: 'DEVUELTO_AL_COMERCIO' },
      { estado: 'DEVUELTO_AL_COMERCIO' },
    ]);
    expect(
      (
        await prisma.repartidor.findUniqueOrThrow({
          where: { id: repartidorId },
        })
      ).estado,
    ).toBe('DISPONIBLE');

    // HU 39, escenario 3: un envío devuelto no se cancela.
    const cancelar = await comoOperario('post', `envios/${a.id}/cancelar`);
    expect(cancelar.status).toBe(409);
    expect(cancelar.body.message).toBe('El envío ya finalizó su ciclo');

    // HU 41: el resumen del día cuenta los devueltos.
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date());
    const resumen = await comoOperario(
      'get',
      `comercios/${comercioId}/resumen?fecha=${hoy}`,
    );
    expect(resumen.body).toMatchObject({ devueltos: 2 });

    // HU 4: los devueltos salen del panel.
    const panel = await comoOperario('get', 'envios/panel');
    expect(panel.body.total).toBe(0);
  });

  it('HU 22 y 38: una orden sin repartidor aparece en excepciones y se asigna a mano', async () => {
    const rindiendo = await crearRepartidor(
      'Lucas',
      'ESPERANDO_VALIDACION_CIERRE',
    );
    const paquete = await crearPaqueteADevolver(rindiendo);
    await reingresar(rindiendo, paquete.codigoSeguimiento).then((r) =>
      expect(r.status).toBe(200),
    );

    // Nadie en la cola: la orden queda esperando repartidor.
    const orden = await comoOperario(
      'post',
      'envios/deposito/ordenes-devolucion',
      {
        comercioId,
        envioIds: [paquete.id],
      },
    );
    expect(orden.body).toMatchObject({ ofrecida: false });

    const panel = await comoOperario('get', 'excepciones');
    expect(panel.body.excepciones).toEqual([
      expect.objectContaining({
        envioId: paquete.id,
        motivo: 'DEVOLUCION_SIN_REPARTIDOR',
        destinoDireccion: 'Calle 7 123',
        puedeAsignar: true,
        puedeCancelar: false,
      }),
    ]);

    const repartidorId = await crearRepartidor('Sofía', 'DISPONIBLE');
    // El motor la reintentaría solo; acá se la asigna el operario antes.
    await prisma.repartidor.update({
      where: { id: repartidorId },
      data: { estado: 'EN_PAUSA', enColaDesde: null },
    });
    const asignada = await comoOperario(
      'post',
      `excepciones/${paquete.id}/asignar`,
      { repartidorId },
    );
    expect(asignada.status).toBe(200);

    const oferta = await comoRepartidor(
      repartidorId,
      'get',
      'repartidor/ofertas/actual',
    );
    await comoRepartidor(
      repartidorId,
      'post',
      `repartidor/ofertas/${oferta.body.oferta.id}/aceptar`,
    ).then((r) => expect(r.status).toBe(200));
    const viaje = await comoRepartidor(
      repartidorId,
      'get',
      'repartidor/viajes/actual',
    );
    expect(viaje.body.viaje).toMatchObject({
      esDevolucion: true,
      paquetes: [paquete.codigoSeguimiento],
    });
    expect((await comoOperario('get', 'excepciones')).body.excepciones).toEqual(
      [],
    );
  });
});
