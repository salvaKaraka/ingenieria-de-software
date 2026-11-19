// Franja estimada de llegada (HU 70). Lógica pura: recibe la hora de salida y la
// duración del viaje, sin saber si salió del mapa o del promedio de entregas.

const MINUTO = 60 * 1000;

// Con menos entregas que esto el promedio es poco confiable y se usa la duración por defecto.
export const MINIMO_DE_ENTREGAS = 5;
// Cuántas entregas recientes se promedian: suficientes para suavizar casos raros,
// pocas para que el promedio siga los cambios del tráfico.
export const ENTREGAS_A_PROMEDIAR = 20;
export const DURACION_POR_DEFECTO_MIN = 60;
// El mapa da solo el tiempo de manejo: se suma lo que lleva estacionar y entregar.
// El promedio de entregas no lo necesita porque ya mide hasta que se entregó.
export const MINUTOS_PARA_ENTREGAR = 10;
const MARGEN_MIN = 15;
const REDONDEO_MIN = 5;

export interface EntregaAnterior {
  retiradoEn: Date;
  entregadoEn: Date;
}

export interface FranjaEstimada {
  inicio: Date;
  fin: Date;
}

const redondear = (fecha: Date, aproximar: (x: number) => number) => {
  const paso = REDONDEO_MIN * MINUTO;
  return new Date(aproximar(fecha.getTime() / paso) * paso);
};

// Minutos que tarda una entrega típica con este vehículo. Es el plan B de la HU 70:
// se usa cuando no se pudo calcular la ruta con el mapa.
export function duracionTipicaMin(entregas: EntregaAnterior[]): number {
  if (entregas.length < MINIMO_DE_ENTREGAS) return DURACION_POR_DEFECTO_MIN;
  const total = entregas.reduce(
    (suma, e) => suma + (e.entregadoEn.getTime() - e.retiradoEn.getTime()),
    0,
  );
  return total / entregas.length / MINUTO;
}

// Llegada estimada = salida + duración del viaje, con 15 minutos de margen para cada lado.
export function calcularFranja(
  salida: Date,
  duracionMin: number,
): FranjaEstimada {
  const llegada = salida.getTime() + duracionMin * MINUTO;
  const inicio = redondear(new Date(llegada - MARGEN_MIN * MINUTO), Math.round);
  const fin = redondear(new Date(llegada + MARGEN_MIN * MINUTO), Math.round);

  // Nunca antes de que el paquete salga. Se redondea para arriba para que el
  // límite siga siendo múltiplo de 5 y no quede antes de la salida.
  const primeroPosible = redondear(salida, Math.ceil);
  return {
    inicio: inicio < primeroPosible ? primeroPosible : inicio,
    fin,
  };
}
