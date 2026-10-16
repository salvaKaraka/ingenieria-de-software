import type { RolUsuario } from '../../generated/prisma/client';

// Lo que sabemos del usuario después de validar su access token. Es lo que va dentro del JWT.
export type UsuarioAutenticado = {
  id: number;
  rol: RolUsuario;
};

// Datos del usuario que devolvemos al front (nunca hashes ni credenciales).
export type PerfilUsuario = UsuarioAutenticado & {
  nombre: string;
};

// Resultado de iniciar o renovar una sesión: lo que el controller pone en las cookies.
export type Sesion = {
  accessToken: string;
  refreshToken: string;
  refreshExpiraEn: Date;
  usuario: PerfilUsuario;
};
