// "Hoy" para el negocio es el día en Argentina, no el del servidor: en producción (Railway)
// el servidor corre en UTC, y a partir de las 21 h de Argentina en UTC ya es "mañana".
// Argentina no tiene horario de verano, así que el desfase es siempre -03:00.
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
const DESFASE = '-03:00';

// Devuelve el instante en que empezó el día en curso en Argentina (00:00 hora local).
export function inicioDelDia(ahora: Date = new Date()): Date {
  // 'en-CA' formatea como AAAA-MM-DD, que es justo lo que necesitamos.
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
  return new Date(`${fecha}T00:00:00${DESFASE}`);
}
