import { randomBytes } from 'crypto';

// Alfabeto base 32 Crockford simplificado: sin caracteres visualmente ambiguos (0/O, 1/I/L)
const CARACTERES = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Genera un código de seguimiento alfanumérico aleatorio, seguro y no predecible.
 * Formato resultante: TRK-XXXX-YYYY (ej: TRK-7K9M-2X4Q).
 *
 * Cumple con RNF-01 (seguridad y no enumerabilidad) para que ningún usuario
 * pueda adivinar paquetes ajenos por fuerza bruta.
 */
export function generarCodigoSeguimiento(): string {
  const bytes = randomBytes(8);
  let resultado = '';
  for (let i = 0; i < 8; i++) {
    resultado += CARACTERES[bytes[i] % CARACTERES.length];
  }
  return `TRK-${resultado.slice(0, 4)}-${resultado.slice(4)}`;
}
