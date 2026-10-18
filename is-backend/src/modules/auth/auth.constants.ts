// Duraciones de sesión. Son parámetros: si el cliente pide otros tiempos, se cambian acá.

// Access token (JWT): lo que tarde en vencer es el máximo que sigue sirviendo un token robado.
export const ACCESS_TOKEN_SEGUNDOS = 15 * 60;

// Refresh token del operario: se corta tras 30 min sin uso (RNF-04). Cada uso lo renueva.
export const REFRESH_OPERARIO_SEGUNDOS = 30 * 60;

// Refresh token del repartidor: 12 h sin uso. La app consulta cada pocos segundos mientras
// está abierta, así que en la práctica no se corta durante la jornada.
export const REFRESH_REPARTIDOR_SEGUNDOS = 12 * 60 * 60;

export const COOKIE_ACCESS = 'access_token';
export const COOKIE_REFRESH = 'refresh_token';

// El refresh token solo viaja a las rutas de auth, no en cada request a la API.
export const RUTA_COOKIE_REFRESH = '/api/auth';
