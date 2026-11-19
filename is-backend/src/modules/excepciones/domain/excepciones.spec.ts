import {
  minutosDeEspera,
  motivoParaNoAsignar,
  ordenarPorEspera,
  type RepartidorParaAsignar,
} from './excepciones';

describe('panel de excepciones', () => {
  const ahora = new Date('2026-11-11T18:00:00Z');
  const haceMinutos = (m: number) => new Date(ahora.getTime() - m * 60_000);

  it('ordena del que espera hace más al más reciente (HU 22, escenario 4)', () => {
    const ordenadas = ordenarPorEspera([
      { envioId: 1, esperaDesde: haceMinutos(5) },
      { envioId: 2, esperaDesde: haceMinutos(30) },
    ]);
    expect(ordenadas.map((e) => e.envioId)).toEqual([2, 1]);
  });

  it('calcula los minutos de espera', () => {
    expect(minutosDeEspera(haceMinutos(30), ahora)).toBe(30);
    expect(minutosDeEspera(new Date(ahora.getTime() + 1000), ahora)).toBe(0);
  });

  describe('asignación manual', () => {
    const repartidor = (
      cambios: Partial<RepartidorParaAsignar> = {},
    ): RepartidorParaAsignar => ({
      activo: true,
      estado: 'DISPONIBLE',
      vehiculo: 'MOTO',
      tieneOfertaPendiente: false,
      ...cambios,
    });

    it('permite asignar a un repartidor disponible con vehículo compatible', () => {
      expect(motivoParaNoAsignar('MOTO', repartidor())).toBeNull();
    });

    it('permite asignar a uno en pausa (por ejemplo, el que dejó vencer la oferta)', () => {
      expect(
        motivoParaNoAsignar('MOTO', repartidor({ estado: 'EN_PAUSA' })),
      ).toBeNull();
    });

    it('un vehículo más grande puede llevar un paquete chico', () => {
      expect(
        motivoParaNoAsignar('MOTO', repartidor({ vehiculo: 'AUTO' })),
      ).toBeNull();
    });

    it('rechaza un vehículo que no puede llevar el paquete', () => {
      expect(motivoParaNoAsignar('CAMION', repartidor())).toMatch(/vehículo/);
    });

    it('rechaza repartidores ocupados, fuera de jornada o dados de baja', () => {
      expect(
        motivoParaNoAsignar('MOTO', repartidor({ estado: 'OCUPADO' })),
      ).not.toBeNull();
      expect(
        motivoParaNoAsignar('MOTO', repartidor({ estado: 'FUERA_DE_JORNADA' })),
      ).not.toBeNull();
      expect(
        motivoParaNoAsignar('MOTO', repartidor({ activo: false })),
      ).not.toBeNull();
    });

    it('rechaza a quien ya tiene una oferta sin responder', () => {
      expect(
        motivoParaNoAsignar('MOTO', repartidor({ tieneOfertaPendiente: true })),
      ).toMatch(/oferta/);
    });
  });
});
