import type { UsuarioAutenticado } from '../../common/auth';

export type { UsuarioAutenticado };

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
