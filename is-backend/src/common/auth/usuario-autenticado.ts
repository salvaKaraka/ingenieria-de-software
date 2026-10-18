import type { Request } from 'express';
import type { RolUsuario } from '../../generated/prisma/client';

// Lo que sabemos del usuario después de validar su access token (es lo que va dentro del JWT).
export type UsuarioAutenticado = {
  id: number;
  rol: RolUsuario;
};

export type RequestAutenticado = Request & { usuario?: UsuarioAutenticado };
