import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestAutenticado } from './usuario-autenticado';

// Entrega al controller el usuario logueado: `iniciar(@UsuarioActual() usuario: UsuarioAutenticado)`.
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext) => {
    return contexto.switchToHttp().getRequest<RequestAutenticado>().usuario;
  },
);
