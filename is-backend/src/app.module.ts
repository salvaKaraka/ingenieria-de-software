import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

// Módulo raíz. Cada módulo de negocio (src/modules/<nombre>) se registra en `imports`.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
