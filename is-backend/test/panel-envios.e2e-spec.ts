import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { emailUnico, vaciarBase } from './utils';

describe('Panel de envíos del día - HU #4 (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comercioId: number;
  let repartidorId: number;
  let codigo = 0;

  async function crearEnvio(
    opciones: {
      codigoSeguimiento?: string;
      comercioId?: number;
      estado?: EstadoEnvio;
      repartidorId?: number;
      destinatarioNombre?: string;
    } = {},
  ) {
    return prisma.envio.create({
      data: {
        codigoSeguimiento: opciones.codigoSeguimiento ?? `PANEL${++codigo}`,
        comercioId: opciones.comercioId ?? comercioId,
        origenDireccion: 'Calle Comercio 123',
        destinoDireccion: 'Calle Destino 456',
        destinatarioNombre: opciones.destinatarioNombre ?? 'Juan',
        destinatarioApellido: 'Pérez',
        destinatarioTelefono: '221-555-1234',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado: opciones.estado ?? 'PENDIENTE',
        repartidorId: opciones.repartidorId,
      },
    });
  }

  async function cookieDeOperario() {
    return `access_token=${await jwt.signAsync({ sub: 1, rol: 'OPERARIO' })}`;
  }

  async function cookieDeRepartidor() {
    return `access_token=${await jwt.signAsync({ sub: repartidorId, rol: 'REPARTIDOR' })}`;
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
    codigo = 0;

    const comercio = await prisma.comercio.create({
      data: {
        nombre: 'Comercio Central',
        telefono: '221 444-0000',
        email: emailUnico('comercio-panel'),
        direccion: 'Calle 1 n° 100',
      },
    });
    comercioId = comercio.id;

    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'Ramiro',
        apellido: 'González',
        telefono: '221 555-9999',
        email: emailUnico('repartidor-panel'),
        direccion: 'Calle 2 n° 200',
        vehiculo: 'MOTO',
        estado: 'DISPONIBLE',
      },
    });
    repartidorId = repartidor.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Control de acceso', () => {
    it('rechaza con 401 si no hay sesión iniciada', async () => {
      await request(app.getHttpServer())
        .get('/api/envios/panel')
        .expect(401);
    });

    it('rechaza con 403 si el rol es REPARTIDOR', async () => {
      await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeRepartidor())
        .expect(403);
    });

    it('permite el acceso con rol OPERARIO tanto en /api/envios/panel como en /api/operario/envios/panel', async () => {
      const cookie = await cookieDeOperario();

      const res1 = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', cookie)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/api/operario/envios/panel')
        .set('Cookie', cookie)
        .expect(200);

      expect(res1.body).toHaveProperty('totales');
      expect(res2.body).toHaveProperty('totales');
    });
  });

  describe('Escenario 1: Panel con envíos en distintos estados y resaltado de novedad', () => {
    it('renderiza agrupaciones, contadores y resalta visualmente el envío con novedad', async () => {
      // 3 PENDIENTES
      await crearEnvio({ estado: 'PENDIENTE' });
      await crearEnvio({ estado: 'PENDIENTE' });
      await crearEnvio({ estado: 'PENDIENTE' });

      // 2 EN_CAMINO_A_RETIRAR (1 normal, 1 con novedad)
      await crearEnvio({
        estado: 'EN_CAMINO_A_RETIRAR',
        repartidorId,
      });

      const envioConNovedad = await crearEnvio({
        estado: 'EN_CAMINO_A_RETIRAR',
        repartidorId,
      });

      // Crear evento de tipo NOVEDAD
      await prisma.eventoEnvio.create({
        data: {
          envioId: envioConNovedad.id,
          tipo: 'NOVEDAD',
          detalle: 'Cliente ausente en primer intento',
          actorTipo: 'REPARTIDOR',
          actorId: repartidorId,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      expect(res.body.totales).toEqual({
        total: 5,
        PENDIENTE: 3,
        ASIGNADO: 0,
        EN_CAMINO_A_RETIRAR: 2,
        RETIRADO: 0,
        EN_DOMICILIO: 0,
      });

      expect(res.body.grupos.PENDIENTE).toHaveLength(3);
      expect(res.body.grupos.EN_CAMINO_A_RETIRAR).toHaveLength(2);

      const tarjetaNovedad = res.body.grupos.EN_CAMINO_A_RETIRAR.find(
        (e: any) => e.id === envioConNovedad.id,
      );
      expect(tarjetaNovedad.conNovedad).toBe(true);
      expect(tarjetaNovedad.novedad).toMatchObject({
        tipo: 'NOVEDAD',
        detalle: 'Cliente ausente en primer intento',
      });

      const tarjetaNormal = res.body.grupos.EN_CAMINO_A_RETIRAR.find(
        (e: any) => e.id !== envioConNovedad.id,
      );
      expect(tarjetaNormal.conNovedad).toBe(false);
      expect(tarjetaNormal.novedad).toBeNull();
    });
  });

  describe('Escenario 2: Actualización de estado en segundo plano (sondeo/polling)', () => {
    it('mueve la tarjeta del envío a la columna correspondiente al cambiar de estado', async () => {
      const envio = await crearEnvio({
        estado: 'EN_CAMINO_A_RETIRAR',
        repartidorId,
      });

      // Primera consulta
      const res1 = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      expect(res1.body.totales.EN_CAMINO_A_RETIRAR).toBe(1);
      expect(res1.body.totales.RETIRADO).toBe(0);

      // Transición externa a RETIRADO (paquete retirado)
      await prisma.envio.update({
        where: { id: envio.id },
        data: { estado: 'RETIRADO' },
      });

      // Segunda consulta (simulando siguiente ciclo de polling)
      const res2 = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      expect(res2.body.totales.EN_CAMINO_A_RETIRAR).toBe(0);
      expect(res2.body.totales.RETIRADO).toBe(1);
      expect(res2.body.grupos.RETIRADO[0].id).toBe(envio.id);
    });
  });

  describe('Escenario 3: Envío entregado sale del panel', () => {
    it('un envío completado deja de figurar en el panel pero sigue accesible en el listado general', async () => {
      const envio = await crearEnvio({
        estado: 'EN_DOMICILIO',
        repartidorId,
      });

      // Está en el panel
      const resAntes = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      expect(resAntes.body.totales.total).toBe(1);
      expect(resAntes.body.grupos.EN_DOMICILIO).toHaveLength(1);

      // Se entrega el envío (ENTREGADO)
      await prisma.envio.update({
        where: { id: envio.id },
        data: { estado: 'ENTREGADO' },
      });

      // Siguiente ciclo de sondeo en el panel
      const resDespues = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      expect(resDespues.body.totales.total).toBe(0);
      expect(resDespues.body.grupos.EN_DOMICILIO).toHaveLength(0);

      // Pero sigue consultable en el buscador general
      const resGeneral = await request(app.getHttpServer())
        .get(`/api/envios?estado=ENTREGADO`)
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      expect(resGeneral.body.datos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: envio.id, estado: 'ENTREGADO' }),
        ]),
      );
    });
  });

  describe('Escenario 4: Envío cancelado sale del panel', () => {
    it('al cancelar un envío, este desaparece del panel de envíos del día', async () => {
      const envio = await crearEnvio({ estado: 'PENDIENTE' });

      // Verificar que está en el panel
      const res1 = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(200);
      expect(res1.body.totales.PENDIENTE).toBe(1);

      // Cancelar el envío a través del endpoint oficial
      await request(app.getHttpServer())
        .post(`/api/envios/${envio.id}/cancelar`)
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      // Verificar que salió del panel inmediatamente
      const res2 = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      expect(res2.body.totales.total).toBe(0);
      expect(res2.body.totales.PENDIENTE).toBe(0);
      expect(res2.body.grupos.PENDIENTE).toHaveLength(0);
    });
  });

  describe('Escenario 5: Panel sin envíos activos', () => {
    it('devuelve total en 0 y agrupaciones vacías cuando no hay envíos pendientes ni en curso', async () => {
      // Base vacía de envíos activos (podría haber un entregado)
      await crearEnvio({ estado: 'ENTREGADO' });
      await crearEnvio({ estado: 'CANCELADO' });

      const res = await request(app.getHttpServer())
        .get('/api/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      expect(res.body.totales).toEqual({
        total: 0,
        PENDIENTE: 0,
        ASIGNADO: 0,
        EN_CAMINO_A_RETIRAR: 0,
        RETIRADO: 0,
        EN_DOMICILIO: 0,
      });

      expect(res.body.grupos.PENDIENTE).toEqual([]);
      expect(res.body.grupos.ASIGNADO).toEqual([]);
      expect(res.body.grupos.EN_CAMINO_A_RETIRAR).toEqual([]);
      expect(res.body.grupos.RETIRADO).toEqual([]);
      expect(res.body.grupos.EN_DOMICILIO).toEqual([]);
    });
  });
});
