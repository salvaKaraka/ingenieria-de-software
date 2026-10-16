import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestAutenticado } from '../guards/autenticacion.guard';

// Entrega al controller el usuario que dejó el guard: `perfil(@UsuarioActual() usuario)`.
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext) => {
    return contexto.switchToHttp().getRequest<RequestAutenticado>().usuario;
  },
);
