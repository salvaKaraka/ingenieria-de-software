import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Todas las rutas quedan bajo /api (ej: GET /api/health)
  app.setGlobalPrefix('api');

  // Valida los DTOs de cada request: descarta campos no declarados y convierte tipos.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });

  // Cierra la conexión a la base prolijamente cuando el proceso se detiene (deploys en Railway)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
