// Todo lo que necesita un controller para declarar quién puede usarlo:
//   import { Public, Roles, UsuarioActual, type UsuarioAutenticado } from '../../common/auth';
export { Public } from './publico.decorator';
export { Roles } from './roles.decorator';
export { UsuarioActual } from './usuario-actual.decorator';
export type {
  RequestAutenticado,
  UsuarioAutenticado,
} from './usuario-autenticado';
