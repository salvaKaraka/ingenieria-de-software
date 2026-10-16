import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

// Configuración común de la app. La usan main.ts y los tests e2e, así se prueba lo mismo que corre en producción.
export function configurarApp(app: NestExpressApplication) {
  // Todas las rutas quedan bajo /api (ej: GET /api/health)
  app.setGlobalPrefix('api');

  // Lee las cookies del request (ahí viajan los tokens de sesión)
  app.use(cookieParser());

  // En producción la API está detrás de proxies (Vercel, Railway): para saber la IP real del
  // cliente (límite de intentos de login) hay que confiar en el header X-Forwarded-For.
  app.set('trust proxy', true);

  // Valida los DTOs de cada request: descarta campos no declarados y convierte tipos.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // credentials: permite que el navegador mande las cookies cuando el front está en otro origen.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
}
