// Circuito de depósito y devoluciones (HU 37-40): lógica pura, sin base de datos.
//
// Recorrido de un paquete que no se pudo entregar:
//   A_DEVOLVER / CON_NOVEDAD  →  EN_CUSTODIA  →  EN_DEVOLUCION  →  DEVUELTO_AL_COMERCIO
//   (lo tiene el repartidor)     (en la base)    (en una orden)     (estado final)

// Textos que quedan en el historial del envío (los ve el operario).
export const DETALLE_EN_CUSTODIA = 'En custodia';
export const DETALLE_EN_DEVOLUCION = 'En devolución';
export const DETALLE_DEVUELTO_AL_COMERCIO = 'Devuelto al comercio';

// HU 40: la alerta aparece al cumplirse 24 horas exactas desde el reingreso.
export const UMBRAL_ALERTA_CUSTODIA_HORAS = 24;

// Horas enteras desde que el paquete reingresó al depósito.
export function calcularHorasEnCustodia(
  fechaReingreso: Date,
  ahora: Date = new Date(),
): number {
  const diferenciaMs = ahora.getTime() - fechaReingreso.getTime();
  return Math.max(0, Math.floor(diferenciaMs / (1000 * 60 * 60)));
}

// HU 40: solo alertan los paquetes que siguen en custodia (si ya están en una orden de
// devolución la alerta desaparece) y llevan 24 horas o más.
export function requiereAlertaDemoraCustodia(
  fechaReingreso: Date,
  ahora: Date = new Date(),
): boolean {
  return (
    calcularHorasEnCustodia(fechaReingreso, ahora) >=
    UMBRAL_ALERTA_CUSTODIA_HORAS
  );
}
