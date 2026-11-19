import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { RolUsuario } from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

describe('Reintento de envío ante novedades (HU 24, e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;
  let operarioId: number;
  let codigo = 0;

  const cookieDe = (id: number, rol: RolUsuario) =>
    `access_token=${jwt.sign({ sub: id, rol })}`;

  const comoOperario = (id: number, metodo: 'get' | 'post', ruta: string) =>
    request(app.getHttpServer())
      [metodo](`/api/${ruta}`)
      .set('Cookie', cookieDe(id, 'OPERARIO'));

  const comoRepartidor = (id: number, metodo: 'get' | 'post', ruta: string) =>
    request(app.getHttpServer())
      [metodo](`/api/repartidor/${ruta}`)
      .set('Cookie', cookieDe(id, 'REPARTIDOR'));

  async function crearRepartidor(
    estado: 'DISPONIBLE' | 'OCUPADO' | 'EMERGENCIA' = 'OCUPADO',
    cierreSolicitado = false,
  ) {
    return prisma.repartidor.create({
      data: {
        nombre: 'Repartidor',
        apellido: 'Prueba',
        telefono: '1',
        email: emailUnico(),
        direccion: 'Base',
        vehiculo: 'MOTO',
        estado,
        enColaDesde: estado === 'DISPONIBLE' ? new Date() : null,
        cierreSolicitado,
      },
    });
  }

  async function crearEnvio(
    estado: 'PENDIENTE' | 'EN_DOMICILIO' | 'CON_NOVEDAD',
    repartidorId: number | null,
  ) {
    return prisma.envio.create({
      data: {
        codigoSeguimiento: `HU24${++codigo}`,
        comercioId,
        origenDireccion: 'Comercio',
        destinoDireccion: 'Calle 50 123',
        destinoLat: -34.9,
        destinoLon: -57.95,
        destinatarioNombre: 'Ana',
        destinatarioApellido: 'Paz',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado,
        repartidorId,
      },
    });
  }

  const reintentar = (
    envioId: number,
    destinoDireccion = 'Calle 50 123',
    destinoLat?: number | null,
    destinoLon?: number | null,
  ) =>
    comoOperario(operarioId, 'post', `envios/${envioId}/reintentar`).send({
      destinoDireccion,
      ...(destinoLat !== undefined && { destinoLat }),
      ...(destinoLon !== undefined && { destinoLon }),
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configurarApp(app);
    await app.listen(0);
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    codigo = 0;
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Kiosco',
          telefono: '221 555',
          email: 'hu24@test.com',
          direccion: 'Calle 7 123',
        },
      })
    ).id;
    operarioId = (
      await prisma.operario.create({
        data: {
          nombre: 'Operario',
          usuario: 'hu24',
          passwordHash: 'hash',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reporta Dirección incorrecta, conserva al repartidor y reintenta con dirección corregida', async () => {
    const repartidor = await crearRepartidor();
    const envio = await crearEnvio('EN_DOMICILIO', repartidor.id);

    await comoRepartidor(repartidor.id, 'post', 'viajes/actual/novedad')
      .send({
        motivo: 'DIRECCION_INCORRECTA',
        comentario: 'El número indicado no existe',
      })
      .expect(200);

    const conNovedad = await prisma.envio.findUniqueOrThrow({
      where: { id: envio.id },
    });
    expect(conNovedad).toMatchObject({
      estado: 'CON_NOVEDAD',
      repartidorId: repartidor.id,
      reintentoPendiente: false,
    });
    expect(
      await prisma.eventoEnvio.findFirstOrThrow({
        where: { envioId: envio.id, tipo: 'NOVEDAD' },
      }),
    ).toMatchObject({
      estadoAnterior: 'EN_DOMICILIO',
      estadoNuevo: 'CON_NOVEDAD',
      detalle: 'Dirección incorrecta: El número indicado no existe',
      actorTipo: 'REPARTIDOR',
      actorId: repartidor.id,
    });

    await reintentar(envio.id, 'Calle 51 777').expect(200);
    const actualizado = await prisma.envio.findUniqueOrThrow({
      where: { id: envio.id },
    });
    expect(actualizado).toMatchObject({
      estado: 'RETIRADO',
      destinoDireccion: 'Calle 51 777',
      destinoLat: null,
      destinoLon: null,
      repartidorId: repartidor.id,
      reintentoPendiente: false,
    });

    const viaje = await comoRepartidor(
      repartidor.id,
      'get',
      'viajes/actual',
    ).expect(200);
    expect(viaje.body.viaje).toMatchObject({
      envioId: envio.id,
      estado: 'RETIRADO',
      destinoDireccion: 'Calle 51 777',
    });
  });

  it('reintenta sin cambiar la dirección y conserva las coordenadas existentes', async () => {
    const repartidor = await crearRepartidor('DISPONIBLE');
    const envio = await crearEnvio('CON_NOVEDAD', repartidor.id);

    await reintentar(envio.id).expect(200);

    const actualizado = await prisma.envio.findUniqueOrThrow({
      where: { id: envio.id },
    });
    expect(actualizado).toMatchObject({
      estado: 'RETIRADO',
      destinoDireccion: 'Calle 50 123',
      destinoLat: -34.9,
      destinoLon: -57.95,
      repartidorId: repartidor.id,
    });
  });

  it('espera al mismo repartidor ocupado y le asigna el reintento antes de completar su cierre', async () => {
    const repartidor = await crearRepartidor();
    const reintento = await crearEnvio('CON_NOVEDAD', repartidor.id);
    const viajeActual = await crearEnvio('EN_DOMICILIO', repartidor.id);

    const pendiente = await reintentar(reintento.id, 'Calle 51 777').expect(
      200,
    );
    expect(pendiente.body).toMatchObject({
      estado: 'CON_NOVEDAD',
      repartidorId: repartidor.id,
      asignadoAhora: false,
    });
    expect(
      await prisma.envio.findUniqueOrThrow({ where: { id: reintento.id } }),
    ).toMatchObject({ reintentoPendiente: true, estado: 'CON_NOVEDAD' });

    await comoRepartidor(
      repartidor.id,
      'post',
      'jornada/solicitar-cierre',
    ).expect(200);
    await comoRepartidor(repartidor.id, 'post', 'viajes/actual/avanzar').expect(
      200,
    );

    expect(
      await prisma.envio.findUniqueOrThrow({ where: { id: reintento.id } }),
    ).toMatchObject({
      estado: 'RETIRADO',
      reintentoPendiente: false,
      repartidorId: repartidor.id,
    });
    expect(
      await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      }),
    ).toMatchObject({ estado: 'OCUPADO', cierreSolicitado: true });

    const viaje = await comoRepartidor(
      repartidor.id,
      'get',
      'viajes/actual',
    ).expect(200);
    expect(viaje.body.viaje).toMatchObject({
      envioId: reintento.id,
      estado: 'RETIRADO',
    });

    await comoRepartidor(repartidor.id, 'post', 'viajes/actual/avanzar').expect(
      200,
    );
    await comoRepartidor(repartidor.id, 'post', 'viajes/actual/avanzar').expect(
      200,
    );
    expect(
      await prisma.repartidor.findUniqueOrThrow({
        where: { id: repartidor.id },
      }),
    ).toMatchObject({ estado: 'ESPERANDO_VALIDACION_CIERRE' });

    expect(
      await prisma.eventoEnvio.count({
        where: {
          envioId: reintento.id,
          estadoAnterior: 'CON_NOVEDAD',
          estadoNuevo: 'RETIRADO',
        },
      }),
    ).toBe(1);
    expect(viajeActual.id).not.toBe(reintento.id);
  });

  it('marca A_DEVOLVER, lo incluye en la rendición y se reingresa al depósito al cierre', async () => {
    const repartidor = await crearRepartidor('DISPONIBLE');
    const envio = await crearEnvio('CON_NOVEDAD', repartidor.id);

    await comoOperario(
      operarioId,
      'post',
      `envios/${envio.id}/devolver`,
    ).expect(200);
    await comoRepartidor(
      repartidor.id,
      'post',
      'jornada/solicitar-cierre',
    ).expect(200);

    const rendicion = await comoOperario(
      operarioId,
      'get',
      `repartidores/${repartidor.id}/rendicion`,
    ).expect(200);
    expect(rendicion.body.paquetesADevolver).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: envio.id,
          estado: 'A_DEVOLVER',
          motivo: 'Marcado para devolución por novedad',
        }),
      ]),
    );

    await comoOperario(operarioId, 'post', 'envios/deposito/reingreso')
      .send({
        repartidorId: repartidor.id,
        codigoSeguimiento: envio.codigoSeguimiento,
      })
      .expect(200);
    await comoOperario(
      operarioId,
      'post',
      `repartidores/${repartidor.id}/aprobar-cierre`,
    ).expect(200);
    expect(
      await prisma.envio.findUniqueOrThrow({ where: { id: envio.id } }),
    ).toMatchObject({ estado: 'EN_CUSTODIA' });
  });

  it('rechaza reintento y devolución si el envío no está CON_NOVEDAD', async () => {
    const repartidor = await crearRepartidor();
    const envio = await crearEnvio('EN_DOMICILIO', repartidor.id);

    await reintentar(envio.id).expect(409);
    await comoOperario(
      operarioId,
      'post',
      `envios/${envio.id}/devolver`,
    ).expect(409);
    expect(
      await prisma.envio.findUniqueOrThrow({ where: { id: envio.id } }),
    ).toMatchObject({ estado: 'EN_DOMICILIO', repartidorId: repartidor.id });
  });

  it('muestra el aviso exacto solo después de pedir reintento', async () => {
    const repartidor = await crearRepartidor('DISPONIBLE');
    const reprogramado = await crearEnvio('CON_NOVEDAD', repartidor.id);
    const normal = await crearEnvio('PENDIENTE', null);

    const antes = await request(app.getHttpServer())
      .get(`/api/seguimiento/${reprogramado.codigoSeguimiento}`)
      .expect(200);
    expect(antes.body.avisoReprogramacion).toBeUndefined();

    await reintentar(reprogramado.id).expect(200);
    const despues = await request(app.getHttpServer())
      .get(`/api/seguimiento/${reprogramado.codigoSeguimiento}`)
      .expect(200);
    expect(despues.body.avisoReprogramacion).toBe('Tu envío fue reprogramado');

    const sinReprogramar = await request(app.getHttpServer())
      .get(`/api/seguimiento/${normal.codigoSeguimiento}`)
      .expect(200);
    expect(sinReprogramar.body.avisoReprogramacion).toBeUndefined();
  });
});
