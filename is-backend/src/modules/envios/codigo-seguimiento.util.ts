import { randomInt } from 'crypto';

// Alfabeto de 32 caracteres (Base 32) según especificación B-3 de TAREAS.md:
// Excluye intencionalmente 0, O, 1, I para evitar ambigüedades visuales en comprobantes impresos y URLs.
export const ALFABETO_CODIGO_SEGUIMIENTO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const LONGITUD_CODIGO_SEGUIMIENTO = 10;

/**
 * Genera un código de seguimiento alfanumérico aleatorio y seguro para nuevos envíos (B-3).
 * Utiliza crypto.randomInt para garantizar una distribución uniforme sin sesgo de módulo.
 */
export function generarCodigoSeguimiento(): string {
  let codigo = '';
  for (let i = 0; i < LONGITUD_CODIGO_SEGUIMIENTO; i++) {
    const indice = randomInt(0, ALFABETO_CODIGO_SEGUIMIENTO.length);
    codigo += ALFABETO_CODIGO_SEGUIMIENTO[indice];
  }
  return codigo;
}
