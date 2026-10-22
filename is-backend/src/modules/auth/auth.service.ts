import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '../../generated/prisma/client';
import {
  REFRESH_OPERARIO_SEGUNDOS,
  REFRESH_REPARTIDOR_SEGUNDOS,
} from './auth.constants';
import { AuthRepository } from './auth.repository';
import { HashingService } from './hashing.service';
import type { PerfilUsuario, Sesion, UsuarioAutenticado } from './tipos';

// Mismo mensaje para todo fallo de credenciales: no revelamos si existe el usuario o el PIN.
const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
const SESION_INVALIDA = 'Sesión inválida o vencida';

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly hashing: HashingService,
    private readonly jwt: JwtService,
  ) {}

  async loginOperario(usuario: string, password: string): Promise<Sesion> {
    const operario = await this.repo.buscarOperarioPorUsuario(usuario);
    if (!operario || !operario.activo)
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);

    const passwordOk = await this.hashing.verificarPassword(
      operario.passwordHash,
      password,
    );
    if (!passwordOk) throw new UnauthorizedException(CREDENCIALES_INVALIDAS);

    return this.iniciarSesion({
      id: operario.id,
      rol: RolUsuario.OPERARIO,
      nombre: operario.nombre,
    });
  }

  async loginRepartidor(pin: string): Promise<Sesion> {
    // El PIN es a la vez identificador y secreto: buscamos directamente por su HMAC.
    const repartidor = await this.repo.buscarRepartidorPorPinHmac(
      this.hashing.hmacPin(pin),
    );
    if (!repartidor || !repartidor.activo)
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);

    return this.iniciarSesion({
      id: repartidor.id,
      rol: RolUsuario.REPARTIDOR,
      nombre: `${repartidor.nombre} ${repartidor.apellido}`,
    });
  }

  // Cambia un refresh token válido por una sesión nueva (rotación).
  async refrescar(refreshToken: string): Promise<Sesion> {
    const guardado = await this.repo.buscarRefreshTokenPorHash(
      this.hashing.hashearToken(refreshToken),
    );
    if (!guardado) throw new UnauthorizedException(SESION_INVALIDA);

    if (guardado.revocadoEn) {
      // Un token ya rotado que vuelve a aparecer significa que alguien tiene una copia:
      // cerramos todas las sesiones de ese usuario por las dudas.
      await this.repo.revocarTodos(guardado.rol, guardado.usuarioId);
      throw new UnauthorizedException(SESION_INVALIDA);
    }
    if (guardado.expiraEn <= new Date())
      throw new UnauthorizedException(SESION_INVALIDA);

    // El usuario pudo haber sido dado de baja después de loguearse.
    const perfil = await this.buscarPerfilActivo(
      guardado.rol,
      guardado.usuarioId,
    );
    if (!perfil) {
      await this.repo.revocarRefreshToken(guardado.id);
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    const nuevo = this.generarRefreshToken(perfil);
    await this.repo.rotarRefreshToken(guardado.id, nuevo.datos);
    return this.armarSesion(perfil, nuevo.token, nuevo.datos.expiraEn as Date);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const guardado = await this.repo.buscarRefreshTokenPorHash(
      this.hashing.hashearToken(refreshToken),
    );
    if (guardado && !guardado.revocadoEn)
      await this.repo.revocarRefreshToken(guardado.id);
  }

  async perfil(usuario: UsuarioAutenticado): Promise<PerfilUsuario> {
    const perfil = await this.buscarPerfilActivo(usuario.rol, usuario.id);
    if (!perfil) throw new UnauthorizedException(SESION_INVALIDA);
    return perfil;
  }

  // ---- Usado por otros módulos (C-1, C-3) ----

  // Genera un PIN nuevo para el repartidor, guarda su HMAC y cierra sus sesiones abiertas.
  // Devuelve el PIN en texto plano UNA sola vez: el operario lo ve y se lo entrega (RNF-02).
  async asignarNuevoPin(repartidorId: number): Promise<string> {
    const repartidor = await this.repo.buscarRepartidorPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('Repartidor inexistente');

    // Con 10.000 PINs posibles y ~30 repartidores, un choque es raro: alcanza con reintentar.
    for (let intento = 0; intento < 20; intento++) {
      const pin = this.hashing.generarPin();
      const pinHmac = this.hashing.hmacPin(pin);
      if (await this.repo.existePinHmac(pinHmac)) continue;

      await this.repo.guardarPinHmac(repartidorId, pinHmac);
      await this.repo.revocarTodos(RolUsuario.REPARTIDOR, repartidorId);
      return pin;
    }
    throw new ConflictException(
      'No se pudo generar un PIN libre, intentá de nuevo',
    );
  }

  // Cierra todas las sesiones de un usuario (al darlo de baja o al terminar la jornada).
  cerrarSesiones(rol: RolUsuario, usuarioId: number) {
    return this.repo.revocarTodos(rol, usuarioId);
  }

  // Para el script de creación de operarios (no hay registro público).
  async crearOperario(usuario: string, password: string, nombre: string) {
    const existente = await this.repo.buscarOperarioPorUsuario(usuario);
    if (existente)
      throw new ConflictException(`Ya existe el usuario "${usuario}"`);
    const passwordHash = await this.hashing.hashearPassword(password);
    return this.repo.crearOperario({ usuario, passwordHash, nombre });
  }

  // ---- Internos ----

  private async iniciarSesion(perfil: PerfilUsuario): Promise<Sesion> {
    const nuevo = this.generarRefreshToken(perfil);
    await this.repo.crearRefreshToken(nuevo.datos);
    return this.armarSesion(perfil, nuevo.token, nuevo.datos.expiraEn as Date);
  }

  private generarRefreshToken(perfil: PerfilUsuario) {
    const token = this.hashing.generarTokenAleatorio();
    const duracion =
      perfil.rol === RolUsuario.OPERARIO
        ? REFRESH_OPERARIO_SEGUNDOS
        : REFRESH_REPARTIDOR_SEGUNDOS;
    return {
      token, // en texto plano: va a la cookie y nunca se guarda así
      datos: {
        tokenHash: this.hashing.hashearToken(token), // esto es lo único que va a la base
        rol: perfil.rol,
        usuarioId: perfil.id,
        expiraEn: new Date(Date.now() + duracion * 1000),
      },
    };
  }

  private async armarSesion(
    perfil: PerfilUsuario,
    refreshToken: string,
    refreshExpiraEn: Date,
  ): Promise<Sesion> {
    // "sub" (subject) es el nombre estándar del campo con el id del usuario en un JWT.
    const accessToken = await this.jwt.signAsync({
      sub: perfil.id,
      rol: perfil.rol,
    });
    return { accessToken, refreshToken, refreshExpiraEn, usuario: perfil };
  }

  private async buscarPerfilActivo(
    rol: RolUsuario,
    id: number,
  ): Promise<PerfilUsuario | null> {
    if (rol === RolUsuario.OPERARIO) {
      const operario = await this.repo.buscarOperarioPorId(id);
      return operario?.activo ? { id, rol, nombre: operario.nombre } : null;
    }
    const repartidor = await this.repo.buscarRepartidorPorId(id);
    return repartidor?.activo
      ? { id, rol, nombre: `${repartidor.nombre} ${repartidor.apellido}` }
      : null;
  }
}
