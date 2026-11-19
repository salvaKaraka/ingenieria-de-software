// Los filtros por fecha del operario hablan de días de Argentina, no del servidor (que corre
// en UTC): una respuesta de las 22:30 de Argentina ya es "mañana" en UTC. Vive en common
// porque lo usan varios módulos (listado de envíos, historial de respuestas).
const ZONA_HORARIA_OPERATIVA = 'America/Argentina/Buenos_Aires';
const FORMATEADOR_OPERATIVO = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA_OPERATIVA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

// Instante (UTC) en que empieza en Argentina el día AAAA-MM-DD.
export function convertirMedianocheArgentinaAUTC(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const medianocheComoUTC = Date.UTC(anio, mes - 1, dia);
  let instanteUTC = medianocheComoUTC;

  // Recalcular el desfase en el instante resultante contempla cambios horarios de la zona.
  for (let intento = 0; intento < 3; intento++) {
    const partes = new Map(
      FORMATEADOR_OPERATIVO.formatToParts(new Date(instanteUTC)).map(
        (parte) => [parte.type, parte.value],
      ),
    );
    const fechaLocalComoUTC = Date.UTC(
      Number(partes.get('year')),
      Number(partes.get('month')) - 1,
      Number(partes.get('day')),
      Number(partes.get('hour')),
      Number(partes.get('minute')),
      Number(partes.get('second')),
    );
    const desfase = fechaLocalComoUTC - instanteUTC;
    const siguienteInstanteUTC = medianocheComoUTC - desfase;
    if (siguienteInstanteUTC === instanteUTC) break;
    instanteUTC = siguienteInstanteUTC;
  }

  return new Date(instanteUTC);
}

// Último milisegundo del día AAAA-MM-DD en Argentina: sirve como tope inclusivo de un rango.
export function finDelDiaArgentina(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const diaSiguiente = new Date(Date.UTC(anio, mes - 1, dia + 1))
    .toISOString()
    .slice(0, 10);
  return new Date(convertirMedianocheArgentinaAUTC(diaSiguiente).getTime() - 1);
}
