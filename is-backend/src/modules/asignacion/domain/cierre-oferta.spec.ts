import { cerradaAntesDeVencer } from './cierre-oferta';

describe('cerradaAntesDeVencer', () => {
  const oferta = {
    creadaEn: new Date('2026-11-03T15:00:00Z'),
    expiraEn: new Date('2026-11-03T15:05:00Z'),
  };

  it('es verdadero si el envío se cerró mientras la oferta seguía vigente', () => {
    expect(
      cerradaAntesDeVencer(oferta, [new Date('2026-11-03T15:02:00Z')]),
    ).toBe(true);
  });

  it('es falso si el envío se cerró después de que la oferta venció', () => {
    expect(
      cerradaAntesDeVencer(oferta, [new Date('2026-11-03T15:05:00Z')]),
    ).toBe(false);
  });

  it('es falso si el cierre es anterior a la oferta', () => {
    expect(
      cerradaAntesDeVencer(oferta, [new Date('2026-11-03T14:59:00Z')]),
    ).toBe(false);
  });

  it('es falso si el envío no tuvo cierres', () => {
    expect(cerradaAntesDeVencer(oferta, [])).toBe(false);
  });
});
