import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);

  // Cierra la conexión a la base prolijamente cuando el proceso se detiene (deploys en Railway)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
