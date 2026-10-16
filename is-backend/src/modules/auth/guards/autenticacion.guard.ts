import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { RequestAutenticado } from '../../../common/auth';
import { ES_PUBLICO } from '../../../common/auth/publico.decorator';
import type { RolUsuario } from '../../../generated/prisma/client';
import { COOKIE_ACCESS } from '../auth.constants';

// Primera "puerta" de TODA la API (registrado como guard global en AuthModule).
// Verifica la firma y el vencimiento del access token, sin consultar la base,
// y deja el usuario en request.usuario. Los endpoints con @Public() pasan sin sesión.
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    // El decorador puede estar en el método o en la clase del controller.
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;

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
