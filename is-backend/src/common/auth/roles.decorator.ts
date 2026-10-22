import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '../../generated/prisma/client';

export const ROLES_PERMITIDOS = 'rolesPermitidos';

// Qué roles pueden usar un endpoint (o un controller entero).
// Ej: @Roles('OPERARIO')  ·  @Roles('REPARTIDOR')  ·  @Roles('OPERARIO', 'REPARTIDOR')
// Un endpoint sin @Roles ni @Public queda cerrado (403): así nadie lo deja abierto por olvido.
export const Roles = (...roles: RolUsuario[]) =>
  SetMetadata(ROLES_PERMITIDOS, roles);
