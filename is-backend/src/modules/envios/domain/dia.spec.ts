import { inicioDelDia } from './dia';

describe('inicioDelDia', () => {
  it('a media tarde devuelve las 00:00 de Argentina del mismo día', () => {
    // 15:00 en Argentina = 18:00 UTC
    const ahora = new Date('2026-11-11T18:00:00Z');
    expect(inicioDelDia(ahora).toISOString()).toBe('2026-11-11T03:00:00.000Z');
  });

  it('a las 22 h de Argentina (ya es mañana en UTC) sigue siendo el mismo día', () => {
    // 22:00 en Argentina = 01:00 UTC del día siguiente
    const ahora = new Date('2026-11-12T01:00:00Z');
    expect(inicioDelDia(ahora).toISOString()).toBe('2026-11-11T03:00:00.000Z');
  });

  it('a las 00:30 de Argentina ya es el día nuevo', () => {
    const ahora = new Date('2026-11-12T03:30:00Z');
    expect(inicioDelDia(ahora).toISOString()).toBe('2026-11-12T03:00:00.000Z');
  });
});
