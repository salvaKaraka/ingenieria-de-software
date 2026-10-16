import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestAutenticado } from '../../../common/auth';
import { ES_PUBLICO } from '../../../common/auth/publico.decorator';
import { ROLES_PERMITIDOS } from '../../../common/auth/roles.decorator';
import type { RolUsuario } from '../../../generated/prisma/client';

// Segunda "puerta" (corre después de AutenticacionGuard): ¿el rol del usuario puede usar este endpoint?
// Cerrado por defecto: un endpoint sin @Roles ni @Public responde 403.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, objetivos))
      return true;

    const roles = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(
      ROLES_PERMITIDOS,
      objetivos,
    );
    if (!roles || roles.length === 0) {
      // Error de programación, no del usuario: el mensaje ayuda a quien escribió el endpoint.
      throw new ForbiddenException(
        'Endpoint sin @Roles ni @Public: indicá quién puede usarlo',
      );
    }

    const { usuario } = contexto
      .switchToHttp()
      .getRequest<RequestAutenticado>();
    if (!usuario || !roles.includes(usuario.rol)) {
      throw new ForbiddenException('No tenés permiso para esta acción');
    }
    return true;
  }
}
