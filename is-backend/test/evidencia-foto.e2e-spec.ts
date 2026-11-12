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

  // PNG de 1x1.
  const FOTO_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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

    const fotoBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD=';

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

    // La foto se guarda solo en el envío; el evento de entrega lleva el texto de la evidencia.
    const evento = await prisma.eventoEnvio.findFirstOrThrow({
      where: { envioId, estadoNuevo: 'ENTREGADO' },
    });
    expect(evento.detalle).toBe('Evidencia: foto adjunta');
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

  // Escenario 4: Foto visible al abrir el envío
  it('Escenario 4: Para un envío entregado con foto, el operario la ve al abrir el envío', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto: FOTO_PNG })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/envios/${envioId}`)
      .set('Cookie', operarioCookie)
      .expect(200);

    expect(res.body.id).toBe(envioId);
    expect(res.body.fotoUrl).toBe(FOTO_PNG);

    // Va una sola vez en la respuesta: el historial dice que hay foto, pero no la repite.
    const eventoEntrega = res.body.historial.find(
      (e: { estadoNuevo: string | null }) => e.estadoNuevo === 'ENTREGADO',
    );
    expect(eventoEntrega.detalle).toBe('Evidencia: foto adjunta');
    expect(JSON.stringify(res.body.historial)).not.toContain('data:image');
    expect(JSON.stringify(res.body.eventos)).not.toContain('data:image');
  });

  it('acepta una foto de tamaño realista (unos 300 kb), más que el límite por defecto del body', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });
    const foto = `data:image/jpeg;base64,${'A'.repeat(300_000)}`;

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto });

    expect(res.status).toBe(200);
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.fotoUrl).toBe(foto);
  });

  it.each([
    ['una URL externa', 'https://ejemplo.com/foto.jpg'],
    ['un data URI que no es imagen', 'data:text/html;base64,PGgxPkhvbGE8L2gxPg=='],
    ['un SVG', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['texto suelto', 'ya mandé la foto'],
  ])('rechaza con 400 %s en lugar de la foto', async (_caso, foto) => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(
      'La foto tiene que ser una imagen JPEG, PNG o WebP',
    );
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('EN_DOMICILIO');
    expect(envio.fotoUrl).toBeNull();
  });

  it('rechaza con 400 una foto más pesada que el tope', async () => {
    const repartidorId = await crearRepartidor();
    await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto: `data:image/jpeg;base64,${'A'.repeat(900_000)}` });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('La foto es demasiado pesada');
  });

  it('no acepta que se saltee la foto con el aviso viejo de "ya la mandé"', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ fotoEnviada: true });

    expect(res.status).toBe(400);
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('EN_DOMICILIO');
  });

  it('la foto solo sale en el detalle del envío: no en el listado, el panel, el historial del repartidor ni el seguimiento público', async () => {
    const repartidorId = await crearRepartidor();
    await crearEnvio('EN_DOMICILIO', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });
    // Otro envío con foto que sigue activo: es el que aparece en el panel y como viaje actual.
    const otroRepartidorId = await crearRepartidor();
    const activoId = await crearEnvio('EN_DOMICILIO', otroRepartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });
    await prisma.envio.update({
      where: { id: activoId },
      data: { fotoUrl: FOTO_PNG },
    });

    await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto: FOTO_PNG })
      .expect(200);
    const entregado = await prisma.envio.findFirstOrThrow({
      where: { repartidorId },
    });

    const consultas: [string, string | null][] = [
      ['/api/envios', operarioCookie],
      [`/api/envios?q=${entregado.codigoSeguimiento}`, operarioCookie],
      ['/api/envios/panel', operarioCookie],
      [
        '/api/repartidor/viajes/historial',
        await cookieRepartidor(repartidorId),
      ],
      [
        '/api/repartidor/viajes/actual',
        await cookieRepartidor(otroRepartidorId),
      ],
      [`/api/seguimiento/${entregado.codigoSeguimiento}`, null],
    ];
    for (const [ruta, cookie] of consultas) {
      const pedido = request(app.getHttpServer()).get(ruta);
      const res = await (cookie ? pedido.set('Cookie', cookie) : pedido);
      expect(res.status).toBe(200);
      const cuerpo = JSON.stringify(res.body);
      // Que la respuesta trae el envío, para que la aserción de abajo no pase en vacío.
      expect(cuerpo).toMatch(/FOTO\d/);
      expect(cuerpo).not.toContain('data:image');
      expect(cuerpo).not.toContain('fotoUrl');
    }
  });

  // Regla: Momento de captura (solo en EN_DOMICILIO)
  it('Momento de captura: no acepta la foto si el viaje todavía no está en el domicilio de entrega', async () => {
    const repartidorId = await crearRepartidor();
    const envioId = await crearEnvio('EN_CAMINO_A_RETIRAR', repartidorId, {
      requiereFoto: true,
      requiereDni: false,
    });

    const res = await request(app.getHttpServer())
      .post('/api/repartidor/viajes/actual/avanzar')
      .set('Cookie', await cookieRepartidor(repartidorId))
      .send({ foto: FOTO_PNG });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('domicilio de entrega');
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('EN_CAMINO_A_RETIRAR');
    expect(envio.fotoUrl).toBeNull();
  });
});
