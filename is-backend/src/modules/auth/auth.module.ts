import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ACCESS_TOKEN_SEGUNDOS } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AutenticacionGuard } from './guards/autenticacion.guard';
import { HashingService } from './hashing.service';

@Module({
  imports: [
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
  providers: [AuthService, AuthRepository, HashingService, AutenticacionGuard],
  // Otros módulos usan AuthService: asignarNuevoPin (C-1) y cerrarSesiones (C-1, C-3).
  exports: [AuthService],
})
export class AuthModule {}
