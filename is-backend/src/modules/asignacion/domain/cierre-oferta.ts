// Cancelar un envío o cambiarle el vehículo cierra sus ofertas abiertas como VENCIDA antes
// de tiempo. Esas no vencieron por inactividad del repartidor: se reconocen porque el cierre
// (el evento de cancelación o de reasignación del envío) ocurrió mientras la oferta seguía
// vigente. Lo usan el historial del envío y el historial de respuestas del repartidor (HU 28),
// para que los dos apliquen el mismo criterio.
// La comparación con creadaEn es estricta: cuando el motor reactiva un envío (de PARADO o
// INTERRUMPIDO a PENDIENTE) registra esa reasignación y crea la oferta en la misma
// transacción, con la misma hora. Esa reasignación es anterior a la oferta, no su cierre.
export function cerradaAntesDeVencer(
  oferta: { creadaEn: Date; expiraEn: Date },
  cierres: Date[],
): boolean {
  return cierres.some(
    (cierre) => cierre > oferta.creadaEn && cierre < oferta.expiraEn,
  );
}
