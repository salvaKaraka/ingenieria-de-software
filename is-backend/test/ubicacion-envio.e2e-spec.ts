import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import { MapasService } from '../src/modules/mapas/mapas.service';
import { emailUnico, vaciarBase } from './utils';

// Puntos en el mapa del envío (HU 70): el operario los marca al cargarlo o editarlo, y el
// repartidor los recibe con su viaje. El mapa externo se simula: los tests no salen a internet.
describe('Ubicación del envío en el mapa (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;
  let operarioCookie: string;

  const cookieDe = (id: number, rol: 'OPERARIO' | 'REPARTIDOR') =>
    jwt.signAsync({ sub: id, rol }).then((t) => `access_token=${t}`);

  const ORIGEN = { origenLat: -34.914, origenLon: -57.949 };
  const DESTINO = { destinoLat: -34.919, destinoLon: -57.944 };

  const crearEnvio = (extra: object) =>
    request(app.getHttpServer())
      .post('/api/envios')
      .set('Cookie', operarioCookie)
      .send({
        comercioId,
        destinoDireccion: 'Avenida 7 1234',
        destinatarioNombre: 'Ana',
        destinatarioApellido: 'Paz',
        destinatarioTelefono: '221 555',
        tamanio: 'CHICO',
        ...extra,
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
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Kiosco',
          telefono: '221 555',
          email: 'c@test.com',
          direccion: 'Calle 50 567',
        },
      })
    ).id;
    const operario = await prisma.operario.create({
      data: { nombre: 'Op', usuario: 'op', passwordHash: 'hash' },
    });
    operarioCookie = await cookieDe(operario.id, 'OPERARIO');
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => app.close());

  it('guarda los puntos que marcó el operario al cargar el envío', async () => {
    const res = await crearEnvio({ ...ORIGEN, ...DESTINO });

    expect(res.status).toBe(201);
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { codigoSeguimiento: res.body.codigoSeguimiento },
    });
    expect(envio).toMatchObject({ ...ORIGEN, ...DESTINO });
  });

  it('crea el envío igual si el mapa no encontró las direcciones', async () => {
    const res = await crearEnvio({});

    expect(res.status).toBe(201);
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { codigoSeguimiento: res.body.codigoSeguimiento },
    });
    expect(envio.destinoLat).toBeNull();
  });

  it('rechaza un punto con latitud y sin longitud', async () => {
    const res = await crearEnvio({ destinoLat: -34.9 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(
      'Falta la longitud del punto de destino',
    );
  });

  it('al cambiar la dirección sin punto nuevo, borra el punto viejo', async () => {
    const creado = await crearEnvio({ ...DESTINO });
    const { id } = await prisma.envio.findUniqueOrThrow({
      where: { codigoSeguimiento: creado.body.codigoSeguimiento },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/envios/${id}`)
      .set('Cookie', operarioCookie)
      .send({ destinoDireccion: 'Calle 12 1500' });

    expect(res.status).toBe(200);
    const envio = await prisma.envio.findUniqueOrThrow({ where: { id } });
    expect(envio.destinoLat).toBeNull();
    expect(envio.destinoLon).toBeNull();
  });

  it('el repartidor recibe los dos puntos con su viaje', async () => {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Mapa',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
        estado: 'OCUPADO',
      },
    });
    await prisma.envio.create({
      data: {
        codigoSeguimiento: 'MAPA1',
        comercioId,
        origenDireccion: 'Calle 50 567',
        destinoDireccion: 'Avenida 7 1234',
        ...ORIGEN,
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado: 'ASIGNADO',
        repartidorId: repartidor.id,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/repartidor/viajes/actual')
      .set('Cookie', await cookieDe(repartidor.id, 'REPARTIDOR'));

    expect(res.status).toBe(200);
    expect(res.body.viaje.origen).toEqual({ lat: -34.914, lon: -57.949 });
    // El destino no se ubicó: el front muestra solo el comercio.
    expect(res.body.viaje.destino).toBeNull();
  });

  describe('GET /api/mapas/buscar', () => {
    const buscar = (direccion: string, cookie = operarioCookie) =>
      request(app.getHttpServer())
        .get('/api/mapas/buscar')
        .query({ direccion })
        .set('Cookie', cookie);

    it('devuelve el punto de la dirección', async () => {
      jest
        .spyOn(app.get(MapasService), 'buscar')
        .mockResolvedValue({ lat: -34.9, lon: -57.9, exacta: true });

      const res = await buscar('Avenida 7 1234');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ lat: -34.9, lon: -57.9, exacta: true });
    });

    it('responde 404 si la dirección no está en el mapa', async () => {
      jest.spyOn(app.get(MapasService), 'buscar').mockResolvedValue(null);

      const res = await buscar('Calle Inventada 99');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('No encontramos esa dirección en el mapa');
    });

    it('responde 503 si el mapa no responde', async () => {
      jest
        .spyOn(app.get(MapasService), 'buscar')
        .mockRejectedValue(new Error('timeout'));

      expect((await buscar('Avenida 7 1234')).status).toBe(503);
    });

    it('solo lo puede usar un operario', async () => {
      const res = await buscar(
        'Avenida 7 1234',
        await cookieDe(1, 'REPARTIDOR'),
      );

      expect(res.status).toBe(403);
    });
  });
});
