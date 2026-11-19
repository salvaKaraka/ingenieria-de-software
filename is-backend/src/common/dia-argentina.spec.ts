import {
  convertirMedianocheArgentinaAUTC,
  finDelDiaArgentina,
} from './dia-argentina';

describe('día de Argentina', () => {
  it('el día empieza a las 00:00 de Argentina, que son las 03:00 UTC', () => {
    expect(convertirMedianocheArgentinaAUTC('2026-11-03').toISOString()).toBe(
      '2026-11-03T03:00:00.000Z',
    );
  });

  it('el día termina un milisegundo antes de las 00:00 del día siguiente en Argentina', () => {
    expect(finDelDiaArgentina('2026-11-03').toISOString()).toBe(
      '2026-11-04T02:59:59.999Z',
    );
  });

  it('el fin del último día del mes cae en el mes siguiente en UTC', () => {
    expect(finDelDiaArgentina('2026-11-30').toISOString()).toBe(
      '2026-12-01T02:59:59.999Z',
    );
  });
});
