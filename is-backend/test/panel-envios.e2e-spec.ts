import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { AVISO_ASIGNACION_EXCEPCION } from '../src/modules/asignacion/asignacion.constants';
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

  interface GrupoPanel {
    estado: string;
    cantidad: number;
    envios: Array<Record<string, unknown> & { id: number }>;
  }

  interface RespuestaPanel {
    total: number;
    grupos: GrupoPanel[];
  }

  async function consultarPanel(): Promise<RespuestaPanel> {
    const res = await request(app.getHttpServer())
      .get('/api/envios/panel')
      .set('Cookie', await cookieDeOperario())
      .expect(200);
    return res.body as RespuestaPanel;
  }

  function grupoDe(panel: RespuestaPanel, estado: string): GrupoPanel {
    const grupo = panel.grupos.find((g) => g.estado === estado);
    if (!grupo) {
      throw new Error(`El panel no trae el grupo ${estado}`);
    }
    return grupo;
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
        email: emailUnico(),
        direccion: 'Calle 1 n° 100',
      },
    });
    comercioId = comercio.id;

    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'Ramiro',
        apellido: 'González',
        telefono: '221 555-9999',
        email: emailUnico(),
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

    it('permite el acceso con rol OPERARIO', async () => {
      const panel = await consultarPanel();

      expect(panel).toHaveProperty('total');
      expect(panel).toHaveProperty('grupos');
    });

    it('no expone el alias /api/operario/envios/panel', async () => {
      await request(app.getHttpServer())
        .get('/api/operario/envios/panel')
        .set('Cookie', await cookieDeOperario())
        .expect(404);
    });
  });

  describe('Escenario 1: Panel con envíos en distintos estados', () => {
    // El destacado de "Con novedad" e "Interrumpido" depende solo del estado del envío. Esos
    // estados todavía no existen en el enum: se prueba cuando los agreguen sus historias.
    it('agrupa los envíos por estado con la cantidad de cada grupo', async () => {
      await crearEnvio({ estado: 'PENDIENTE' });
      await crearEnvio({ estado: 'PENDIENTE' });
      await crearEnvio({ estado: 'PENDIENTE' });
      await crearEnvio({ estado: 'EN_CAMINO_A_RETIRAR', repartidorId });
      await crearEnvio({ estado: 'EN_CAMINO_A_RETIRAR', repartidorId });

      const panel = await consultarPanel();

      expect(panel.total).toBe(5);
      expect(
        panel.grupos.map((g) => ({ estado: g.estado, cantidad: g.cantidad })),
      ).toEqual([
        { estado: 'PENDIENTE', cantidad: 3 },
        { estado: 'ASIGNADO', cantidad: 0 },
        { estado: 'EN_CAMINO_A_RETIRAR', cantidad: 2 },
        { estado: 'RETIRADO', cantidad: 0 },
        { estado: 'EN_DOMICILIO', cantidad: 0 },
      ]);
      expect(grupoDe(panel, 'PENDIENTE').envios).toHaveLength(3);
      expect(grupoDe(panel, 'EN_CAMINO_A_RETIRAR').envios).toHaveLength(2);
    });

    it('un evento de novedad (ej: cambio de dirección) no cambia el grupo ni marca el envío', async () => {
      const envio = await crearEnvio({
        estado: 'EN_CAMINO_A_RETIRAR',
        repartidorId,
      });
      await prisma.eventoEnvio.create({
        data: {
          envioId: envio.id,
          tipo: 'NOVEDAD',
          detalle: 'El operario cambió la dirección de entrega',
          actorTipo: 'OPERARIO',
          actorId: 1,
        },
      });

      const panel = await consultarPanel();

      const tarjeta = grupoDe(panel, 'EN_CAMINO_A_RETIRAR').envios[0];
      expect(tarjeta.id).toBe(envio.id);
      expect(tarjeta).not.toHaveProperty('conNovedad');
      expect(tarjeta).not.toHaveProperty('novedad');
      expect(tarjeta.eventos).toEqual([]);
    });

    it('envía solo los datos que muestra la tarjeta, sin DNI ni teléfono del destinatario', async () => {
      const envio = await crearEnvio({ estado: 'ASIGNADO', repartidorId });
      await prisma.envio.update({
        where: { id: envio.id },
        data: { destinatarioDni: '30111222' },
      });

      const panel = await consultarPanel();

      const tarjeta = grupoDe(panel, 'ASIGNADO').envios[0];
      expect(Object.keys(tarjeta).sort()).toEqual([
        'codigoSeguimiento',
        'comercio',
        'destinatarioApellido',
        'destinatarioNombre',
        'destinoDireccion',
        'estado',
        'eventos',
        'id',
        'repartidor',
        'tamanio',
      ]);
      expect(tarjeta.comercio).toEqual({ nombre: 'Comercio Central' });
      expect(tarjeta.repartidor).toEqual({
        nombre: 'Ramiro',
        apellido: 'González',
      });
      expect(JSON.stringify(panel)).not.toContain('30111222');
      expect(JSON.stringify(panel)).not.toContain('221-555-1234');
    });

    it('incluye el aviso de asignación por excepción del envío (HU10)', async () => {
      const envio = await crearEnvio({ estado: 'ASIGNADO', repartidorId });
      await prisma.eventoEnvio.create({
        data: {
          envioId: envio.id,
          tipo: 'NOVEDAD',
          detalle: AVISO_ASIGNACION_EXCEPCION,
          actorTipo: 'SISTEMA',
        },
      });

      const panel = await consultarPanel();

      expect(grupoDe(panel, 'ASIGNADO').envios[0].eventos).toEqual([
        expect.objectContaining({ detalle: AVISO_ASIGNACION_EXCEPCION }),
      ]);
    });
  });

  describe('Escenario 2: Actualización de estado en segundo plano (sondeo/polling)', () => {
    it('mueve la tarjeta del envío a la columna correspondiente al cambiar de estado', async () => {
      const envio = await crearEnvio({
        estado: 'EN_CAMINO_A_RETIRAR',
        repartidorId,
      });

      // Primera consulta
      const res1 = await consultarPanel();

      expect(grupoDe(res1, 'EN_CAMINO_A_RETIRAR').cantidad).toBe(1);
      expect(grupoDe(res1, 'RETIRADO').cantidad).toBe(0);

      // Transición externa a RETIRADO (paquete retirado)
      await prisma.envio.update({
        where: { id: envio.id },
        data: { estado: 'RETIRADO' },
      });

      // Segunda consulta (simulando siguiente ciclo de polling)
      const res2 = await consultarPanel();

      expect(grupoDe(res2, 'EN_CAMINO_A_RETIRAR').cantidad).toBe(0);
      expect(grupoDe(res2, 'RETIRADO').cantidad).toBe(1);
      expect(grupoDe(res2, 'RETIRADO').envios[0].id).toBe(envio.id);
    });
  });

  describe('Escenario 3: Envío entregado sale del panel', () => {
    it('un envío completado deja de figurar en el panel pero sigue accesible en el listado general', async () => {
      const envio = await crearEnvio({
        estado: 'EN_DOMICILIO',
        repartidorId,
      });

      // Está en el panel
      const resAntes = await consultarPanel();

      expect(resAntes.total).toBe(1);
      expect(grupoDe(resAntes, 'EN_DOMICILIO').envios).toHaveLength(1);

      // Se entrega el envío (ENTREGADO)
      await prisma.envio.update({
        where: { id: envio.id },
        data: { estado: 'ENTREGADO' },
      });

      // Siguiente ciclo de sondeo en el panel
      const resDespues = await consultarPanel();

      expect(resDespues.total).toBe(0);
      expect(grupoDe(resDespues, 'EN_DOMICILIO').envios).toHaveLength(0);

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
      const res1 = await consultarPanel();
      expect(grupoDe(res1, 'PENDIENTE').cantidad).toBe(1);

      // Cancelar el envío a través del endpoint oficial
      await request(app.getHttpServer())
        .post(`/api/envios/${envio.id}/cancelar`)
        .set('Cookie', await cookieDeOperario())
        .expect(200);

      // Verificar que salió del panel inmediatamente
      const res2 = await consultarPanel();

      expect(res2.total).toBe(0);
      expect(grupoDe(res2, 'PENDIENTE').cantidad).toBe(0);
      expect(grupoDe(res2, 'PENDIENTE').envios).toHaveLength(0);
    });
  });

  describe('Escenario 5: Panel sin envíos activos', () => {
    it('devuelve total en 0 y agrupaciones vacías cuando no hay envíos pendientes ni en curso', async () => {
      // Base vacía de envíos activos (podría haber un entregado)
      await crearEnvio({ estado: 'ENTREGADO' });
      await crearEnvio({ estado: 'CANCELADO' });

      const res = await consultarPanel();

      expect(res.total).toBe(0);
      expect(res.grupos.every((g) => g.cantidad === 0)).toBe(true);
      expect(res.grupos.every((g) => g.envios.length === 0)).toBe(true);
    });
  });
});
