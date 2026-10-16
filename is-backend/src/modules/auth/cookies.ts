import type { CookieOptions, Response } from 'express';
import {
  ACCESS_TOKEN_SEGUNDOS,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  RUTA_COOKIE_REFRESH,
} from './auth.constants';
import type { Sesion } from './tipos';

// httpOnly: JavaScript no puede leerlas (un XSS no las roba).
// secure: solo por HTTPS (en desarrollo local usamos http, por eso depende del entorno).
// sameSite lax: otros sitios no pueden mandar requests "en nombre" del usuario con estas cookies.
function opcionesBase(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
}

export function guardarSesionEnCookies(res: Response, sesion: Sesion) {
  res.cookie(COOKIE_ACCESS, sesion.accessToken, {
    ...opcionesBase(),
    path: '/',
    maxAge: ACCESS_TOKEN_SEGUNDOS * 1000,
  });
  res.cookie(COOKIE_REFRESH, sesion.refreshToken, {
    ...opcionesBase(),
    path: RUTA_COOKIE_REFRESH,
    expires: sesion.refreshExpiraEn,
  });
}

export function borrarCookiesDeSesion(res: Response) {
  res.clearCookie(COOKIE_ACCESS, { ...opcionesBase(), path: '/' });
  res.clearCookie(COOKIE_REFRESH, {
    ...opcionesBase(),
    path: RUTA_COOKIE_REFRESH,
  });
}
