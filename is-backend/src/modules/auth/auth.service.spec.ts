import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '../../generated/prisma/client';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { HashingService } from './hashing.service';

// La base está mockeada: probamos las reglas del service, no Prisma.
describe('AuthService', () => {
  const hashing = new HashingService({
    getOrThrow: () => 'clave-pin-test',
  } as unknown as ConfigService);
  const jwt = new JwtService({
    secret: 'clave-jwt-test',
    signOptions: { expiresIn: 900 },
  });
  let repo: jest.Mocked<AuthRepository>;
  let servicio: AuthService;

  const enUnaHora = () => new Date(Date.now() + 3_600_000);
  const tokenGuardado = (extra: object = {}) => ({
    id: 10,
    tokenHash: 'x',
    rol: RolUsuario.OPERARIO,
    usuarioId: 1,
    expiraEn: enUnaHora(),
    creadoEn: new Date(),
    revocadoEn: null,
    ...extra,
  });

  beforeEach(() => {
    repo = {
      buscarOperarioPorUsuario: jest.fn(),
      buscarOperarioPorId: jest.fn(),
      buscarRepartidorPorPinHmac: jest.fn(),
      buscarRepartidorPorId: jest.fn(),
      existePinHmac: jest.fn().mockResolvedValue(false),
      guardarPinHmac: jest.fn(),
      crearRefreshToken: jest.fn(),
      activarJornada: jest.fn().mockResolvedValue(true),
      buscarRefreshTokenPorHash: jest.fn(),
      revocarRefreshToken: jest.fn(),
      revocarTodos: jest.fn(),
      rotarRefreshToken: jest.fn(),
      crearOperario: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;
    servicio = new AuthService(repo, hashing, jwt);
  });

  describe('loginOperario', () => {
    it('con credenciales correctas emite un JWT con el rol y guarda solo el hash del refresh token', async () => {
      const passwordHash = await hashing.hashearPassword('secreta123');
      repo.buscarOperarioPorUsuario.mockResolvedValue({
        id: 1,
        usuario: 'ana',
        passwordHash,
        nombre: 'Ana',
        activo: true,
      } as never);

      const sesion = await servicio.loginOperario('ana', 'secreta123');

      const payload = await jwt.verifyAsync<{ sub: number; rol: string }>(
        sesion.accessToken,
      );
      expect(payload).toMatchObject({ sub: 1, rol: 'OPERARIO' });
      const guardado = repo.crearRefreshToken.mock.calls[0][0];
      expect(guardado.tokenHash).toBe(
        hashing.hashearToken(sesion.refreshToken),
      );
      expect(guardado.tokenHash).not.toBe(sesion.refreshToken);
    });

    it('rechaza una contraseña incorrecta', async () => {
      const passwordHash = await hashing.hashearPassword('secreta123');
      repo.buscarOperarioPorUsuario.mockResolvedValue({
        id: 1,
        passwordHash,
        activo: true,
      } as never);
      await expect(
        servicio.loginOperario('ana', 'otra'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza a un operario dado de baja', async () => {
      const passwordHash = await hashing.hashearPassword('secreta123');
      repo.buscarOperarioPorUsuario.mockResolvedValue({
        id: 1,
        passwordHash,
        activo: false,
      } as never);
      await expect(
        servicio.loginOperario('ana', 'secreta123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('loginRepartidor', () => {
    it('busca al repartidor por el HMAC del PIN', async () => {
      repo.buscarRepartidorPorPinHmac.mockResolvedValue({
        id: 7,
        nombre: 'Juan',
        apellido: 'Pérez',
        activo: true,
      } as never);

      const sesion = await servicio.loginRepartidor('0427');

      expect(repo.buscarRepartidorPorPinHmac).toHaveBeenCalledWith(
        hashing.hmacPin('0427'),
      );
      expect(sesion.usuario).toEqual({
        id: 7,
        rol: 'REPARTIDOR',
        nombre: 'Juan Pérez',
      });
    });

    it('rechaza un PIN que no es de nadie', async () => {
      repo.buscarRepartidorPorPinHmac.mockResolvedValue(null);
      await expect(servicio.loginRepartidor('0000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('Escenario 3: si el repartidor tenía jornada finalizada (FUERA_DE_JORNADA), pasa a DISPONIBLE al ingresar con PIN', async () => {
      repo.buscarRepartidorPorPinHmac.mockResolvedValue({
        id: 7,
        nombre: 'Juan',
        apellido: 'Pérez',
        estado: 'FUERA_DE_JORNADA',
        activo: true,
      } as never);
      const asignacionMock = { reintentarPendientes: jest.fn().mockResolvedValue(0) };
      const serv = new AuthService(repo, hashing, jwt, asignacionMock as never);

      const sesion = await serv.loginRepartidor('0427');

      expect(repo.activarJornada).toHaveBeenCalledWith(7);
      expect(asignacionMock.reintentarPendientes).toHaveBeenCalled();
      expect(sesion.usuario.id).toBe(7);
    });
  });

  describe('refrescar', () => {
    it('rota el token: revoca el viejo y entrega uno nuevo', async () => {
      repo.buscarRefreshTokenPorHash.mockResolvedValue(tokenGuardado());
      repo.buscarOperarioPorId.mockResolvedValue({
        id: 1,
        nombre: 'Ana',
        activo: true,
      } as never);

      const sesion = await servicio.refrescar('token-viejo');

      expect(repo.rotarRefreshToken).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ usuarioId: 1 }),
      );
      expect(sesion.refreshToken).not.toBe('token-viejo');
    });

    it('si llega un token ya revocado, cierra todas las sesiones del usuario', async () => {
      repo.buscarRefreshTokenPorHash.mockResolvedValue(
        tokenGuardado({ revocadoEn: new Date() }),
      );

      await expect(servicio.refrescar('token-robado')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.revocarTodos).toHaveBeenCalledWith('OPERARIO', 1);
    });

    it('rechaza un token vencido', async () => {
      repo.buscarRefreshTokenPorHash.mockResolvedValue(
        tokenGuardado({ expiraEn: new Date(Date.now() - 1000) }),
      );
      await expect(servicio.refrescar('token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rechaza si el usuario fue dado de baja después de loguearse', async () => {
      repo.buscarRefreshTokenPorHash.mockResolvedValue(tokenGuardado());
      repo.buscarOperarioPorId.mockResolvedValue({
        id: 1,
        nombre: 'Ana',
        activo: false,
      } as never);

      await expect(servicio.refrescar('token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.revocarRefreshToken).toHaveBeenCalledWith(10);
    });
  });

  describe('asignarNuevoPin', () => {
    it('devuelve un PIN de 4 dígitos, guarda su HMAC y cierra las sesiones del repartidor', async () => {
      repo.buscarRepartidorPorId.mockResolvedValue({ id: 7 } as never);

      const pin = await servicio.asignarNuevoPin(7);

      expect(pin).toMatch(/^\d{4}$/);
      expect(repo.guardarPinHmac).toHaveBeenCalledWith(7, hashing.hmacPin(pin));
      expect(repo.revocarTodos).toHaveBeenCalledWith('REPARTIDOR', 7);
    });

    it('si el PIN generado ya está en uso, prueba con otro', async () => {
      repo.buscarRepartidorPorId.mockResolvedValue({ id: 7 } as never);
      repo.existePinHmac
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await servicio.asignarNuevoPin(7);

      expect(repo.existePinHmac).toHaveBeenCalledTimes(2);
    });
  });
});
