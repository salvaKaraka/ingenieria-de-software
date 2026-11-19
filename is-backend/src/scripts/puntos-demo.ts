// Puntos en el mapa de las direcciones de los datos de prueba (HU 70), buscados una vez en
// OpenStreetMap. Así los seeds no consultan el mapa y el repartidor ve su viaje en el mapa.
// En La Plata las avenidas se escriben "Avenida": "Calle 7 1234" el mapa la ubica en Berisso.
const PUNTOS: Record<string, [lat: number, lon: number]> = {
  'Avenida 1 220': [-34.89859, -57.95758],
  'Calle 10 960': [-34.91836, -57.95175],
  'Calle 115 890': [-34.90785, -57.94236],
  'Calle 12 1020': [-34.92109, -57.9526],
  'Avenida 13 1450': [-34.92807, -57.94543],
  'Avenida 137 2200': [-34.95612, -57.96369],
  'Avenida 19 540': [-34.92076, -57.96896],
  'Avenida 32 715': [-34.89546, -57.96439],
  'Avenida 38 505': [-34.90378, -57.96032],
  'Avenida 44 980': [-34.91789, -57.96295],
  'Calle 47 610': [-34.91334, -57.95231],
  'Calle 50 567': [-34.9141, -57.9492],
  'Calle 50 567, 3° B': [-34.9141, -57.9492],
  'Calle 55 870': [-34.92236, -57.95187],
  'Calle 6 1300': [-34.91891, -57.94169],
  'Avenida 60 300': [-34.9151, -57.93501],
  'Avenida 66 410': [-34.92254, -57.93077],
  'Avenida 7 1234': [-34.91895, -57.94407],
  'Calle 8 845': [-34.91521, -57.95167],
  'Diagonal 74 1520': [-34.91645, -57.95477],
  'Diagonal 80 1100': [-34.90767, -57.94889],
};

// Campos del punto listos para el `data` de Prisma: { origenLat, origenLon } o { destinoLat, destinoLon }.
export function puntoDe(punta: 'origen' | 'destino', direccion: string) {
  const punto = PUNTOS[direccion];
  if (!punto) return {};
  return punta === 'origen'
    ? { origenLat: punto[0], origenLon: punto[1] }
    : { destinoLat: punto[0], destinoLon: punto[1] };
}
