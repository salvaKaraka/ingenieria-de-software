import {
  generarCodigoSeguimiento,
  LONGITUD_CODIGO_SEGUIMIENTO,
} from './codigo-seguimiento.util';

describe('Generador de código de seguimiento (B-3)', () => {
  it('genera códigos con exactamente 10 caracteres', () => {
    const codigo = generarCodigoSeguimiento();
    expect(codigo).toHaveLength(LONGITUD_CODIGO_SEGUIMIENTO);
  });

  it('utiliza exclusivamente el alfabeto permitido sin caracteres ambiguos (0/O/1/I)', () => {
    for (let i = 0; i < 50; i++) {
      const codigo = generarCodigoSeguimiento();
      expect(codigo).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
      expect(codigo).not.toMatch(/[0O1I]/);
    }
  });

  it('genera códigos distintos en llamadas sucesivas', () => {
    const codigos = new Set(
      Array.from({ length: 20 }, () => generarCodigoSeguimiento()),
    );
    expect(codigos.size).toBe(20);
  });
});
