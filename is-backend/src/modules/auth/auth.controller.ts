import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { COOKIE_REFRESH } from './auth.constants';
import { AuthService } from './auth.service';
import { borrarCookiesDeSesion, guardarSesionEnCookies } from './cookies';
import { LoginOperarioDto } from './dto/login-operario.dto';
import { LoginRepartidorDto } from './dto/login-repartidor.dto';
import {
  Public,
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';

// Máximo 5 intentos de login por minuto por IP: con un PIN de 4 dígitos, probar los 10.000
// a este ritmo llevaría más de un día (riesgo de fuerza bruta).
const LIMITE_LOGIN = { default: { limit: 5, ttl: 60_000 } };

function leerRefreshToken(req: Request): string | undefined {
  return (req.cookies as Record<string, string | undefined>)[COOKIE_REFRESH];
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('operario/login')
  @Public()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle(LIMITE_LOGIN)
  async loginOperario(
    @Body() dto: LoginOperarioDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sesion = await this.auth.loginOperario(dto.usuario, dto.password);
    guardarSesionEnCookies(res, sesion);
    return { usuario: sesion.usuario };
  }

  @Post('repartidor/login')
  @Public()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle(LIMITE_LOGIN)
  async loginRepartidor(
    @Body() dto: LoginRepartidorDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sesion = await this.auth.loginRepartidor(dto.pin);
    guardarSesionEnCookies(res, sesion);
    return { usuario: sesion.usuario };
  }

  // El front lo llama cuando una request devuelve 401 por access token vencido.
  @Post('refresh')
  @Public() // el access token ya venció: se identifica con el refresh token
  @HttpCode(200)
  async refrescar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = leerRefreshToken(req);
    if (!refreshToken) throw new UnauthorizedException('No hay sesión');
    try {
      const sesion = await this.auth.refrescar(refreshToken);
      guardarSesionEnCookies(res, sesion);
      return { usuario: sesion.usuario };
    } catch (error) {
      borrarCookiesDeSesion(res); // sesión inválida: limpiamos para que el front mande al login
      throw error;
    }
  }

  @Post('logout')
  @Public() // tiene que funcionar aunque el access token haya vencido
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(leerRefreshToken(req));
    borrarCookiesDeSesion(res);
  }

  @Get('me')
  @Roles('OPERARIO', 'REPARTIDOR')
  perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.auth.perfil(usuario);
  }
}
