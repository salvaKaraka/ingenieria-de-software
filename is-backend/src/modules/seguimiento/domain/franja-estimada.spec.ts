import {
  calcularFranja,
  duracionTipicaMin,
  type EntregaAnterior,
} from './franja-estimada';

// Las horas se escriben en UTC para que el test no dependa de la zona horaria de la máquina.
const hora = (hhmm: string) => new Date(`2026-11-12T${hhmm}:00Z`);
const hhmm = (fecha: Date) => fecha.toISOString().slice(11, 16);

// n entregas que tardaron `minutos` cada una.
const entregasDe = (minutos: number, n: number): EntregaAnterior[] =>
  Array.from({ length: n }, () => ({
    retiradoEn: hora('09:00'),
    entregadoEn: new Date(hora('09:00').getTime() + minutos * 60_000),
  }));

describe('franja estimada de llegada (HU 70)', () => {
  it('promedia la duración de las entregas anteriores', () => {
    const entregas = [...entregasDe(30, 3), ...entregasDe(50, 3)];
    expect(duracionTipicaMin(entregas)).toBe(40);
  });

  it('usa 60 minutos si hay menos de 5 entregas', () => {
    expect(duracionTipicaMin(entregasDe(10, 4))).toBe(60);
    expect(duracionTipicaMin([])).toBe(60);
  });

  it('un viaje de 40 minutos que sale a las 14:00 llega entre 14:25 y 14:55', () => {
    const franja = calcularFranja(hora('14:00'), 40);
    expect(hhmm(franja.inicio)).toBe('14:25');
    expect(hhmm(franja.fin)).toBe('14:55');
  });

  it('escenario 2: sin entregas suficientes, camión que sale a las 10:00 llega entre 10:45 y 11:15', () => {
    const franja = calcularFranja(
      hora('10:00'),
      duracionTipicaMin(entregasDe(10, 2)),
    );
    expect(hhmm(franja.inicio)).toBe('10:45');
    expect(hhmm(franja.fin)).toBe('11:15');
  });

  it('redondea los límites a múltiplos de 5 minutos', () => {
    // 14:03 + 40 = 14:43 -> de 14:28 a 14:58 -> de 14:30 a 15:00
    const franja = calcularFranja(hora('14:03'), 40);
    expect(hhmm(franja.inicio)).toBe('14:30');
    expect(hhmm(franja.fin)).toBe('15:00');
  });

  it('nunca empieza antes de la hora de salida', () => {
    // 14:03 + 5 = 14:08 -> el inicio sería 13:55, antes de salir: se corre a 14:05
    const franja = calcularFranja(hora('14:03'), 5);
    expect(hhmm(franja.inicio)).toBe('14:05');
    expect(hhmm(franja.fin)).toBe('14:25');
  });
});
