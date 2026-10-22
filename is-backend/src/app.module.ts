import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { validarEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DevModule } from './dev/dev.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ComerciosModule } from './modules/comercios/comercios.module';
import { EnviosModule } from './modules/envios/envios.module';
import { RepartidoresModule } from './modules/repartidores/repartidores.module';
import { AsignacionModule } from './modules/asignacion/asignacion.module';
import { SeguimientoModule } from './modules/seguimiento/seguimiento.module';
import { OfertasModule } from './modules/ofertas/ofertas.module';
import { PrismaService } from './database/prisma.service';

// Módulo raíz. Cada módulo de negocio (src/modules/<nombre>) se registra en `imports`.
@Module({
  imports: [
    RepartidoresModule,
    OfertasModule,
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    // Límite de requests por IP. Solo aplica donde se usa ThrottlerGuard (ej: login), con su propio @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    // Tareas periódicas (ej: vencimiento de ofertas cada 10 s)
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ComerciosModule,
    EnviosModule,
    RepartidoresModule,
    AsignacionModule,
    SeguimientoModule,
    // Herramientas de prueba (/api/dev/...): nunca en producción.
    ...(process.env.NODE_ENV === 'production' ? [] : [DevModule]),
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
