import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type {
  EstadoEnvio,
  TamanioPaquete,
  TipoVehiculo,
} from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

describe('Modificación de envíos por el operario (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;
  let operarioId: number;

  const cookieOperario = async (id: number) =>
    `access_token=${await jwt.signAsync({ sub: id, rol: 'OPERARIO' })}`;

  const cookieRepartidor = async (id: number) =>
    `access_token=${await jwt.signAsync({ sub: id, rol: 'REPARTIDOR' })}`;

  async function crearRepartidor(
    vehiculo: TipoVehiculo,
    estado: 'DISPONIBLE' | 'OCUPADO',
  ) {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'Repartidor',
        apellido: vehiculo,
        telefono: '112233',
        email: emailUnico(),
        direccion: 'Calle Falsa 123',
        vehiculo,
        estado,
        enColaDesde: estado === 'DISPONIBLE' ? new Date() : null,
      },
    });
    return repartidor.id;
  }

  let codigo = 0;
  async function crearEnvio(datos: {
    estado: EstadoEnvio;
    tamanio?: TamanioPaquete;
    vehiculoRequerido?: TipoVehiculo;
    repartidorId?: number | null;
    destinoDireccion?: string;
    destinatarioNombre?: string;
  }) {
    const tamanio = datos.tamanio ?? 'CHICO';
    const vehiculoRequerido =
      datos.vehiculoRequerido ??
      (tamanio === 'CHICO'
        ? 'MOTO'
        : tamanio === 'MEDIANO'
          ? 'AUTO'
          : 'CAMION');

    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `EDIT${++codigo}`,
        comercioId,
        origenDireccion: 'Calle Origen 100',
        destinoDireccion: datos.destinoDireccion ?? 'Calle Destino 200',
        destinatarioNombre: datos.destinatarioNombre ?? 'Juan',
        tamanio,
        vehiculoRequerido,
        requiereFoto: false,
        requiereDni: false,
        estado: datos.estado,
        repartidorId: datos.repartidorId ?? null,
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
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    const comercio = await prisma.comercio.create({
      data: {
        nombre: 'Comercio Test',
        telefono: '123456',
        email: 'comercio@test.com',
        direccion: 'Calle Origen 100',
      },
    });
    comercioId = comercio.id;

    const operario = await prisma.operario.create({
      data: { nombre: 'Op', usuario: 'op_test', passwordHash: 'hash' },
    });
    operarioId = operario.id;
  });

  afterAll(() => app.close());

  // Escenario 1: Modificación de un envío pendiente
  it('Escenario 1: guarda cambio de nombre de destinatario en envío pendiente y lo registra en historial', async () => {
    const envioId = await crearEnvio({
      estado: 'PENDIENTE',
      destinatarioNombre: 'Original',
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/envios/${envioId}`)
      .set('Cookie', await cookieOperario(operarioId))
      .send({ destinatarioNombre: 'Modificado' });

    expect(res.status).toBe(200);
    expect(res.body.destinatarioNombre).toBe('Modificado');

    // Verificar base de datos
    const actualizado = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
      include: { eventos: true },
    });
    expect(actualizado.destinatarioNombre).toBe('Modificado');

    // Registrado en historial
    const eventoNota = actualizado.eventos.find((e) => e.tipo === 'NOTA');
    expect(eventoNota).toBeDefined();
    expect(eventoNota?.actorTipo).toBe('OPERARIO');
    expect(eventoNota?.actorId).toBe(operarioId);
    expect(eventoNota?.detalle).toBe(
      'Datos modificados: nombre del destinatario',
    );
  });

  // Escenario 2: Cambio de tamaño con repartidor asignado
  it('Escenario 2: cambio de tamaño con repartidor asignado devuelve el envío a PENDIENTE, libera al repartidor y ofrece a la cola del nuevo vehículo', async () => {
    const motoRepartidorId = await crearRepartidor('MOTO', 'OCUPADO');
    const camionRepartidorId = await crearRepartidor('CAMION', 'DISPONIBLE');

    const envioId = await crearEnvio({
      estado: 'ASIGNADO',
      tamanio: 'CHICO',
      vehiculoRequerido: 'MOTO',
      repartidorId: motoRepartidorId,
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/envios/${envioId}`)
      .set('Cookie', await cookieOperario(operarioId))
      .send({ tamanio: 'GRANDE' });

    expect(res.status).toBe(200);

    // El envío vuelve a PENDIENTE con vehiculoRequerido CAMION
    const envioDespues = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
      include: { ofertas: true, eventos: true },
    });
    expect(envioDespues.estado).toBe('PENDIENTE');
    expect(envioDespues.tamanio).toBe('GRANDE');
    expect(envioDespues.vehiculoRequerido).toBe('CAMION');
    expect(envioDespues.repartidorId).toBeNull();

    // El repartidor con moto queda DISPONIBLE en la cola
    const motoRepartidor = await prisma.repartidor.findUniqueOrThrow({
      where: { id: motoRepartidorId },
    });
    expect(motoRepartidor.estado).toBe('DISPONIBLE');
    expect(motoRepartidor.enColaDesde).not.toBeNull();

    // El motor ofreció el envío al repartidor con camión
    const ofertaCamion = envioDespues.ofertas.find(
      (o) => o.repartidorId === camionRepartidorId && o.estado === 'PENDIENTE',
    );
    expect(ofertaCamion).toBeDefined();

    // Evento de reasignación registrado
    const eventoReasignacion = envioDespues.eventos.find(
      (e) => e.tipo === 'REASIGNACION',
    );
    expect(eventoReasignacion?.detalle).toBe(
      'Cambio de tamaño a Grande: ahora requiere Camión y vuelve a Pendiente. El repartidor que lo tenía vuelve a la cola.',
    );
  });

  // Escenario 3: Cambio de dirección con el repartidor en camino
  it('Escenario 3: cambio de dirección con el repartidor en camino a retirar guarda el cambio y le avisa al repartidor', async () => {
    const repartidorId = await crearRepartidor('MOTO', 'OCUPADO');
    const envioId = await crearEnvio({
      estado: 'EN_CAMINO_A_RETIRAR',
      repartidorId,
      destinoDireccion: 'Dirección Vieja 123',
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/envios/${envioId}`)
      .set('Cookie', await cookieOperario(operarioId))
      .send({ destinoDireccion: 'Dirección Nueva 456' });

    expect(res.status).toBe(200);

    // Verificar evento de novedad
    const eventos = await prisma.eventoEnvio.findMany({
      where: { envioId, tipo: 'NOVEDAD' },
    });
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos[0].detalle).toBe('La dirección de entrega fue modificada');

    // El repartidor ve la nueva dirección y el aviso en su endpoint de viaje activo
    const resViaje = await request(app.getHttpServer())
      .get('/api/repartidor/viajes/actual')
      .set('Cookie', await cookieRepartidor(repartidorId));

    expect(resViaje.status).toBe(200);
    expect(resViaje.body.viaje).toMatchObject({
      envioId,
      destinoDireccion: 'Dirección Nueva 456',
      aviso: 'La dirección de entrega fue modificada',
    });
  });

  // Escenario 4: Modificación fallida por paquete retirado
  it('Escenario 4: paquete retirado no permite modificación, mantiene los datos y muestra mensaje exacto', async () => {
    const repartidorId = await crearRepartidor('MOTO', 'OCUPADO');
    const envioId = await crearEnvio({
      estado: 'RETIRADO',
      repartidorId,
      destinatarioNombre: 'Intacto',
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/envios/${envioId}`)
      .set('Cookie', await cookieOperario(operarioId))
      .send({ destinatarioNombre: 'Cambio No Permitido' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'No se puede modificar: el paquete ya fue retirado',
    );

    // Los datos se mantienen
    const envioDespues = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envioDespues.destinatarioNombre).toBe('Intacto');
    expect(envioDespues.estado).toBe('RETIRADO');
  });
});
