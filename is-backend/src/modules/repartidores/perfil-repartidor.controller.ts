import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import { guardarSesionEnCookies } from '../auth/cookies';
import { ActualizarPerfilRepartidorDto, CambiarPinDto } from './dto';
import { RepartidoresService } from './repartidores.service';

// Mismo límite que el login (5 por minuto por IP): este endpoint confirma si un PIN es el
// actual, así que sin límite serviría para adivinarlo probando los 10.000.
const LIMITE_CAMBIO_PIN = { default: { limit: 5, ttl: 60_000 } };

// Endpoints del repartidor logueado sobre su propio perfil (HU #68).
@Roles('REPARTIDOR')
@Controller('repartidor/perfil')
export class PerfilRepartidorController {
  constructor(private readonly repartidoresService: RepartidoresService) {}

  @Get()
  obtener(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.repartidoresService.buscarPorId(usuario.id);
  }

  @Patch()
  @HttpCode(200)
  actualizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarPerfilRepartidorDto,
  ) {
    return this.repartidoresService.actualizarPerfil(usuario.id, dto);
  }

  // El repartidor no elige el PIN: manda el actual y el sistema le genera uno nuevo.
  // La respuesta es la única vez que el PIN nuevo viaja en texto plano (RNF-02).
  @Post('cambiar-pin')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle(LIMITE_CAMBIO_PIN)
  async cambiarPin(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarPinDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pin, sesion } = await this.repartidoresService.cambiarPin(
      usuario.id,
      dto.pinActual,
    );
    // El cambio cerró todas las sesiones: dejamos la nueva en este dispositivo para que siga logueado.
    guardarSesionEnCookies(res, sesion);
    return { pin };
  }
}
