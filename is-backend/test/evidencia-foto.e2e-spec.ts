import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

describe('HU #18: Capturar fotografía como Evidencia de Entrega (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;
  let operarioCookie: string;

  const cookieRepartidor = async (id: number) =>
    `access_token=${await jwt.signAsync({ sub: id, rol: 'REPARTIDOR' })}`;

  async function crearRepartidor() {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'Carlos',
        apellido: 'Chofer',
        telefono: '221444555',
        email: emailUnico(),
        direccion: 'Calle 10 200',
        vehiculo: 'MOTO',
        estado: 'OCUPADO',
      },
    });
    return repartidor.id;
  }

  let codigoSecuencia = 0;
  async function crearEnvio(
    estado: EstadoEnvio,
    repartidorId: number,
    opciones: {
      requiereFoto: boolean;
      requiereDni: boolean;
      destinatarioDni?: string;
    },
  ) {
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `FOTO${++codigoSecuencia}`,
        comercioId,
        origenDireccion: 'Calle 7 1234',
        destinoDireccion: 'Calle 50 567',
        destinatarioNombre: 'Laura',
        destinatarioApellido: 'Gomez',
        destinatarioDni: opciones.destinatarioDni ?? '35111222',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: opciones.requiereFoto,
        requiereDni: opciones.requiereDni,
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

    operarioCookie = `access_token=${await jwt.signAsync({ sub: 1, rol: 'OPERARIO' })}`;
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    comercioId = (
      await prisma.comercio.create({
        data: {
          nombre: 'Farmacia Modelo',
          telefono: '221 400 1111',
          email: 'contacto@farmacia.com',
          direccion: 'Calle 7 1234',
          requiereFoto: true,
          requiereDni: false,
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  // Escenario 2: Finalización fallida por falta de foto
  it('Escenario 2: Si el comercio exige foto y no se toma, rechaza con mensaje verbatim y mantiene EN_DOMICILIO', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Este comercio exige una foto de la entrega');

    // Mantiene el envío en EN_DOMICILIO
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('EN_DOMICILIO');
    expect(envio.fotoUrl).toBeNull();
  });

  // Escenario 1: Entrega con foto exitosa
  it('Escenario 1: Con comercio que exige foto, vincula la foto y completa la entrega', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    const fotoBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto: fotoBase64 });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ENTREGADO');

    // Verifica que la foto queda asociada al envío
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('ENTREGADO');
    expect(envio.fotoUrl).toBe(fotoBase64);

    // Verifica que el evento de entrega tiene la foto y detalle correspondiente
    const evento = await prisma.eventoEnvio.findFirstOrThrow({
      where: { envioId, estadoNuevo: 'ENTREGADO' },
    });
    expect(evento.fotoUrl).toBe(fotoBase64);
    expect(evento.detalle).toContain('foto adjunta');
  });

  // Escenario 3: Finalización sin foto cuando no se exige
  it('Escenario 3: Si el comercio no exige foto pero exige DNI, finaliza la entrega sin foto tras validar el DNI', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: false,
      requiereDni: true,
      destinatarioDni: '35111222',
    });

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ dni: '35111222' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ENTREGADO');

    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('ENTREGADO');
    expect(envio.fotoUrl).toBeNull();
  });

  // Escenario 4: Foto visible en el detalle e historial del envío
  it('Escenario 4: Para un envío entregado con foto, la imagen es visible en el detalle e historial para el operario', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    const fotoUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto: fotoUrl })
      .expect(200);

    // Consulta del operario
    const res = await request(app.getHttpServer())
      .get(`/api/envios/${envioId}`)
      .set('Cookie', operarioCookie)
      .expect(200);

    expect(res.body.id).toBe(envioId);
    expect(res.body.fotoUrl).toBe(fotoUrl);

    // En el historial de eventos
    const eventoEntrega = res.body.historial.find(
      (e: { estadoNuevo: string | null }) => e.estadoNuevo === 'ENTREGADO',
    );
    expect(eventoEntrega).toBeDefined();
    expect(eventoEntrega.fotoUrl).toBe(fotoUrl);
  });

  // Regla: Momento de captura (solo en EN_DOMICILIO)
  it('Momento de captura: No permite capturar/adjuntar foto si el viaje no está en EN_DOMICILIO', async () => {
    const repartidorId = await crearRepartidor();
    await crearEnvio('EN_CAMINO_A_RETIRAR', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/foto')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto: 'data:image/jpeg;base64,fotoPrueba' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('domicilio de entrega');
  });
});
