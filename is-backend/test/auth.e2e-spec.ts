import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Roles } from '../src/common/auth';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/database/prisma.service';
import { RolUsuario } from '../src/generated/prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';

// Endpoints de prueba para verificar la protección global (A-3).
@Controller('prueba-roles')
class PruebaRolesController {
  @Get('operario')
  @Roles('OPERARIO')
  soloOperario() {
    return { ok: true };
  }

  @Get('sin-anotar')
  sinAnotar() {
    return { ok: true };
  }
}

// Flujo completo de sesión contra una base real (requiere `docker compose up -d db`).
describe('Autenticación (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const sufijo = Date.now();
  const usuario = `test-op-${sufijo}`;
  let operarioId: number;
  let repartidorId: number;
  let pin: string;

  // Devuelve las cookies "nombre=valor" de una respuesta, listas para mandar en el próximo request.
  const cookiesDe = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .map((cookie) => cookie.split(';')[0]);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PruebaRolesController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
    operarioId = (
      await auth.crearOperario(usuario, 'secreta123', 'Operaria de prueba')
    ).id;
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'Rita',
        apellido: 'Test',
        telefono: '221',
        email: 'r@t.com',
        direccion: 'Calle 1',
        vehiculo: 'MOTO',
      },
    });
    repartidorId = repartidor.id;
    pin = await auth.asignarNuevoPin(repartidorId);
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { rol: RolUsuario.OPERARIO, usuarioId: operarioId },
          { rol: RolUsuario.REPARTIDOR, usuarioId: repartidorId },
        ],
      },
    });
    await prisma.operario.delete({ where: { id: operarioId } });
    await prisma.repartidor.delete({ where: { id: repartidorId } });
    await app.close();
  });

  it('operario: login, /me, refresh con rotación, reuso detectado y logout', async () => {
    const servidor = app.getHttpServer();

    const login = await request(servidor)
      .post('/api/auth/operario/login')
      .send({ usuario, password: 'secreta123' })
      .expect(200);
    const cookiesLogin = cookiesDe(login);
    expect(login.headers['set-cookie']?.toString()).toContain('HttpOnly');

    await request(servidor)
      .get('/api/auth/me')
      .set('Cookie', cookiesLogin)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ id: operarioId, rol: 'OPERARIO' });
      });

    const refresh = await request(servidor)
      .post('/api/auth/refresh')
      .set('Cookie', cookiesLogin)
      .expect(200);
    const cookiesNuevas = cookiesDe(refresh);

    // Reusar el refresh token viejo (ya rotado) = posible robo: se rechaza y se cierran todas las sesiones
    await request(servidor)
      .post('/api/auth/refresh')
      .set('Cookie', cookiesLogin)
      .expect(401);
    await request(servidor)
      .post('/api/auth/refresh')
      .set('Cookie', cookiesNuevas)
      .expect(401);

    await request(servidor)
      .post('/api/auth/logout')
      .set('Cookie', cookiesNuevas)
      .expect(204);
  });

  it('operario: contraseña incorrecta da 401 sin decir qué falló', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/operario/login')
      .send({ usuario, password: 'incorrecta' })
      .expect(401)
      .expect((res) => expect(res.body.message).toBe('Credenciales inválidas'));
  });

  it('/me sin sesión da 401', () =>
    request(app.getHttpServer()).get('/api/auth/me').expect(401));

  it('repartidor: login con PIN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/repartidor/login')
      .send({ pin })
      .expect(200);
    expect(res.body.usuario).toMatchObject({
      id: repartidorId,
      rol: 'REPARTIDOR',
    });
  });

  it('repartidor: un PIN mal formado da 400', () =>
    request(app.getHttpServer())
      .post('/api/auth/repartidor/login')
      .send({ pin: '12a' })
      .expect(400));

  it('protección global: sin sesión 401, rol equivocado 403, rol correcto 200', async () => {
    const servidor = app.getHttpServer();
    await request(servidor).get('/api/prueba-roles/operario').expect(401);

    const repartidor = await request(servidor)
      .post('/api/auth/repartidor/login')
      .send({ pin })
      .expect(200);
    await request(servidor)
      .get('/api/prueba-roles/operario')
      .set('Cookie', cookiesDe(repartidor))
      .expect(403);

    const operario = await request(servidor)
      .post('/api/auth/operario/login')
      .send({ usuario, password: 'secreta123' })
      .expect(200);
    await request(servidor)
      .get('/api/prueba-roles/operario')
      .set('Cookie', cookiesDe(operario))
      .expect(200);
    await request(servidor)
      .get('/api/prueba-roles/sin-anotar')
      .set('Cookie', cookiesDe(operario))
      .expect(403);
  });

  // Va último: agota el límite de intentos de esta ruta.
  it('repartidor: más de 5 intentos por minuto da 429', async () => {
    const servidor = app.getHttpServer();
    const codigos: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(servidor)
        .post('/api/auth/repartidor/login')
        .send({ pin: '9999' });
      codigos.push(res.status);
    }
    expect(codigos).toContain(429);
  });
});
