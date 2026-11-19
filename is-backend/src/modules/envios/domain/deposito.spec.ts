import {
  calcularHorasEnCustodia,
  requiereAlertaDemoraCustodia,
} from './deposito';

const AHORA = new Date('2026-11-17T18:00:00.000Z');
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

describe('Dominio de depósito (HU 40)', () => {
  it('cuenta las horas enteras desde el reingreso', () => {
    expect(calcularHorasEnCustodia(hace(25.5), AHORA)).toBe(25);
    expect(calcularHorasEnCustodia(hace(-1), AHORA)).toBe(0);
  });

  it('escenario 1: alerta un paquete con 25 horas en custodia', () => {
    expect(requiereAlertaDemoraCustodia(hace(25), AHORA)).toBe(true);
  });

  it('escenario 2: no alerta un paquete con 10 horas en custodia', () => {
    expect(requiereAlertaDemoraCustodia(hace(10), AHORA)).toBe(false);
  });

  it('escenario 4: alerta un paquete con 24 horas exactas', () => {
    expect(requiereAlertaDemoraCustodia(hace(24), AHORA)).toBe(true);
  });
});
