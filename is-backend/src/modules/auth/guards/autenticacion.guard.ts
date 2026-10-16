import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { RolUsuario } from '../../../generated/prisma/client';
import { COOKIE_ACCESS } from '../auth.constants';
import type { UsuarioAutenticado } from '../tipos';

export type RequestAutenticado = Request & { usuario?: UsuarioAutenticado };

// "Puerta" que corre antes del controller: verifica la firma y el vencimiento del access token
// (sin consultar la base) y deja el usuario en request.usuario.
// Por ahora se usa solo en /auth/me; en A-3 pasa a proteger toda la API por defecto.
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const request = contexto.switchToHttp().getRequest<RequestAutenticado>();
    const token = (request.cookies as Record<string, string | undefined>)[
      COOKIE_ACCESS
    ];
    if (!token) throw new UnauthorizedException('No hay sesión');

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: number;
        rol: RolUsuario;
      }>(token);
      request.usuario = { id: payload.sub, rol: payload.rol };
      return true;
    } catch {
      // Firma inválida o token vencido: el front tiene que llamar a /auth/refresh.
      throw new UnauthorizedException('Sesión vencida');
    }
  }
}
