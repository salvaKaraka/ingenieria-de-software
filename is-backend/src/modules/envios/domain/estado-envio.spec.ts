import type { EstadoEnvio, TipoActor } from '../../../generated/prisma/client';
import { esTransicionValida, siguienteEstado } from './estado-envio';

describe('Máquina de estados del envío', () => {
  describe('transiciones válidas', () => {
    it.each<[EstadoEnvio, EstadoEnvio, TipoActor]>([
      ['PENDIENTE', 'ASIGNADO', 'REPARTIDOR'],
      ['ASIGNADO', 'EN_CAMINO_A_RETIRAR', 'REPARTIDOR'],
      ['EN_CAMINO_A_RETIRAR', 'RETIRADO', 'REPARTIDOR'],
      ['RETIRADO', 'EN_DOMICILIO', 'REPARTIDOR'],
      ['EN_DOMICILIO', 'ENTREGADO', 'REPARTIDOR'],
      ['PENDIENTE', 'CANCELADO', 'OPERARIO'],
      ['ASIGNADO', 'CANCELADO', 'OPERARIO'],
      ['EN_CAMINO_A_RETIRAR', 'CANCELADO', 'OPERARIO'],
      ['RETIRADO', 'CANCELADO', 'OPERARIO'],
      ['EN_DOMICILIO', 'CANCELADO', 'OPERARIO'],
    ])('%s → %s por %s', (actual, destino, actor) => {
      expect(esTransicionValida(actual, destino, actor)).toBe(true);
    });
  });

  describe('transiciones inválidas', () => {
    it.each<[string, EstadoEnvio, EstadoEnvio, TipoActor]>([
      [
        'el repartidor no puede cancelar',
        'ASIGNADO',
        'CANCELADO',
        'REPARTIDOR',
      ],
      [
        'el operario no avanza el viaje',
        'ASIGNADO',
        'EN_CAMINO_A_RETIRAR',
        'OPERARIO',
      ],
      ['el sistema no avanza el viaje', 'RETIRADO', 'EN_DOMICILIO', 'SISTEMA'],
      ['el sistema no cancela', 'PENDIENTE', 'CANCELADO', 'SISTEMA'],
      ['no se saltean pasos', 'ASIGNADO', 'RETIRADO', 'REPARTIDOR'],
      ['no se retrocede', 'RETIRADO', 'ASIGNADO', 'REPARTIDOR'],
      ['no se queda en el mismo estado', 'RETIRADO', 'RETIRADO', 'REPARTIDOR'],
      [
        'no se cancela un envío entregado',
        'ENTREGADO',
        'CANCELADO',
        'OPERARIO',
      ],
      ['no se cancela dos veces', 'CANCELADO', 'CANCELADO', 'OPERARIO'],
      ['no se sale de ENTREGADO', 'ENTREGADO', 'PENDIENTE', 'REPARTIDOR'],
      ['no se sale de CANCELADO', 'CANCELADO', 'ASIGNADO', 'REPARTIDOR'],
    ])('%s (%s → %s por %s)', (_caso, actual, destino, actor) => {
      expect(esTransicionValida(actual, destino, actor)).toBe(false);
    });
  });

  describe('siguienteEstado', () => {
    it.each<[EstadoEnvio, EstadoEnvio | null]>([
      ['PENDIENTE', 'ASIGNADO'],
      ['ASIGNADO', 'EN_CAMINO_A_RETIRAR'],
      ['EN_CAMINO_A_RETIRAR', 'RETIRADO'],
      ['RETIRADO', 'EN_DOMICILIO'],
      ['EN_DOMICILIO', 'ENTREGADO'],
      ['ENTREGADO', null],
      ['CANCELADO', null],
    ])('después de %s viene %s', (actual, siguiente) => {
      expect(siguienteEstado(actual)).toBe(siguiente);
    });
  });
});
