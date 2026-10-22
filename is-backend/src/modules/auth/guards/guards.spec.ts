import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Public, Roles, type RequestAutenticado } from '../../../common/auth';
import { COOKIE_ACCESS } from '../auth.constants';
import { AutenticacionGuard } from './autenticacion.guard';
import { RolesGuard } from './roles.guard';

// Controller de mentira solo para leer los decoradores.
class ControllerDePrueba {
  @Public() abierto() {}
  @Roles('OPERARIO') soloOperario() {}
  sinAnotar() {}
}

// Arma un ExecutionContext falso como el que Nest le pasa a un guard.
function contexto(
  metodo: keyof ControllerDePrueba,
  request: Partial<RequestAutenticado>,
): ExecutionContext {
  return {
    getHandler: () => ControllerDePrueba.prototype[metodo],
    getClass: () => ControllerDePrueba,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('Guards de autenticación', () => {
  const reflector = new Reflector();
  const jwt = new JwtService({ secret: 'clave-test' });

  describe('AutenticacionGuard', () => {
    const guard = new AutenticacionGuard(jwt, reflector);

    it('deja pasar un endpoint @Public sin cookie', async () => {
      await expect(
        guard.canActivate(contexto('abierto', { cookies: {} })),
      ).resolves.toBe(true);
    });

    it('sin cookie da 401', async () => {
      await expect(
        guard.canActivate(contexto('soloOperario', { cookies: {} })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('con un token firmado con otra clave da 401', async () => {
      const falso = await new JwtService({ secret: 'otra' }).signAsync({
        sub: 1,
        rol: 'OPERARIO',
      });
      await expect(
        guard.canActivate(
          contexto('soloOperario', { cookies: { [COOKIE_ACCESS]: falso } }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('con un token válido deja el usuario en el request', async () => {
      const token = await jwt.signAsync({ sub: 5, rol: 'OPERARIO' });
      const request: Partial<RequestAutenticado> = {
        cookies: { [COOKIE_ACCESS]: token },
      };
      await expect(
        guard.canActivate(contexto('soloOperario', request)),
      ).resolves.toBe(true);
      expect(request.usuario).toEqual({ id: 5, rol: 'OPERARIO' });
    });
  });

  describe('RolesGuard', () => {
    const guard = new RolesGuard(reflector);

    it('deja pasar al rol permitido', () => {
      expect(
        guard.canActivate(
          contexto('soloOperario', { usuario: { id: 1, rol: 'OPERARIO' } }),
        ),
      ).toBe(true);
    });

    it('rechaza a otro rol con 403', () => {
      expect(() =>
        guard.canActivate(
          contexto('soloOperario', { usuario: { id: 1, rol: 'REPARTIDOR' } }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('un endpoint sin @Roles ni @Public queda cerrado', () => {
      expect(() =>
        guard.canActivate(
          contexto('sinAnotar', { usuario: { id: 1, rol: 'OPERARIO' } }),
        ),
      ).toThrow(/sin @Roles ni @Public/);
    });
  });
});
