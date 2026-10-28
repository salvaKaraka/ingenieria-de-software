import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AsignacionModule } from '../asignacion/asignacion.module';
import { ACCESS_TOKEN_SEGUNDOS } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AutenticacionGuard } from './guards/autenticacion.guard';
import { RolesGuard } from './guards/roles.guard';
import { HashingService } from './hashing.service';

@Module({
  imports: [
    AsignacionModule,
    // El JWT se firma con JWT_SECRET: quien no la tenga no puede fabricar ni modificar tokens.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_SEGUNDOS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    HashingService,
    // Guards globales: protegen TODA la API. Corren en este orden: primero quién sos, después qué podés hacer.
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  // Otros módulos usan AuthService: asignarNuevoPin (C-1) y cerrarSesiones (C-1, C-3).
  // HashingService: lo usan las herramientas de desarrollo (src/dev) para reconocer al repartidor de prueba.
  exports: [AuthService, HashingService],
})
export class AuthModule {}
