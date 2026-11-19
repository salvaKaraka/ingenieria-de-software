// Solo tipos: el dominio sigue sin depender de la base, pero usa los mismos estados que
// Prisma. Así un `envio.estado` leído de la base se puede pasar directo, sin casts.
import type { EstadoEnvio, TipoActor } from '../../../generated/prisma/client';

// Camino del envío: cada estado tiene un único siguiente y lo avanza el repartidor.
// PENDIENTE → ASIGNADO ocurre al aceptar una oferta (D-2), no con el botón "siguiente".
const SIGUIENTE: Partial<Record<EstadoEnvio, EstadoEnvio>> = {
  PENDIENTE: 'ASIGNADO',
  ASIGNADO: 'EN_CAMINO_A_RETIRAR',
  EN_CAMINO_A_RETIRAR: 'RETIRADO',
  RETIRADO: 'EN_DOMICILIO',
  EN_DOMICILIO: 'ENTREGADO',
};

// Estados en los que el envío ya terminó: no admite más cambios y sale del panel del día
// (HU4). Si se agrega otro estado final al enum, se suma acá.
export const ESTADOS_FINALES: readonly EstadoEnvio[] = [
  'ENTREGADO',
  'CANCELADO',
  'DEVUELTO_AL_COMERCIO',
];

// El paquete ya salió del comercio: no se puede cancelar ni modificar (HU 30 y 31).
export const ESTADOS_CON_PAQUETE_RETIRADO: readonly EstadoEnvio[] = [
  'RETIRADO',
  'EN_DOMICILIO',
  'CON_NOVEDAD',
  'A_DEVOLVER',
  'EN_CUSTODIA',
  'EN_DEVOLUCION',
];

const ESTADOS_VIAJE_INTERRUMPIBLES: readonly EstadoEnvio[] = [
  'ASIGNADO',
  'EN_CAMINO_A_RETIRAR',
  'RETIRADO',
  'EN_DOMICILIO',
];

// Además, el paquete nunca tiene que haber salido del comercio (lo verifica el service:
// tras un incidente en ruta un envío vuelve a PENDIENTE con el paquete en la calle).
const ESTADOS_CANCELABLES: readonly EstadoEnvio[] = [
  'PENDIENTE',
  'ASIGNADO',
  'EN_CAMINO_A_RETIRAR',
  'PARADO',
];

export function esTransicionValida(
  estadoActual: EstadoEnvio,
  estadoDestino: EstadoEnvio,
  actor: TipoActor,
): boolean {
  // El operario no avanza el viaje (lo hace quien tiene el paquete): solo puede cancelarlo,
  // y nunca después de que terminó.
  if (estadoDestino === 'CANCELADO') {
    return actor === 'OPERARIO' && ESTADOS_CANCELABLES.includes(estadoActual);
  }
  if (actor === 'REPARTIDOR' && estadoDestino === 'INTERRUMPIDO') {
    return ESTADOS_VIAJE_INTERRUMPIBLES.includes(estadoActual);
  }
  if (
    actor === 'REPARTIDOR' &&
    estadoActual === 'EN_DOMICILIO' &&
    estadoDestino === 'CON_NOVEDAD'
  ) {
    return true;
  }
  if (
    actor === 'SISTEMA' &&
    ((estadoActual === 'INTERRUMPIDO' &&
      (estadoDestino === 'PENDIENTE' || estadoDestino === 'PARADO')) ||
      (estadoActual === 'PENDIENTE' && estadoDestino === 'PARADO'))
  ) {
    return true;
  }
  if (
    actor === 'OPERARIO' &&
    estadoActual === 'PARADO' &&
    estadoDestino === 'PENDIENTE'
  ) {
    return true;
  }
  if (actor === 'OPERARIO' && estadoActual === 'CON_NOVEDAD') {
    return estadoDestino === 'RETIRADO' || estadoDestino === 'A_DEVOLVER';
  }
  if (
    actor === 'SISTEMA' &&
    estadoActual === 'CON_NOVEDAD' &&
    estadoDestino === 'RETIRADO'
  ) {
    return true;
  }
  // Circuito de depósito (HU 37-39): el operario recibe el paquete en la base y lo manda de
  // vuelta en una orden; el repartidor que la lleva confirma la entrega en el comercio.
  if (actor === 'OPERARIO' && estadoDestino === 'EN_CUSTODIA') {
    return estadoActual === 'A_DEVOLVER' || estadoActual === 'CON_NOVEDAD';
  }
  if (
    actor === 'OPERARIO' &&
    estadoActual === 'EN_CUSTODIA' &&
    estadoDestino === 'EN_DEVOLUCION'
  ) {
    return true;
  }
  if (
    actor === 'REPARTIDOR' &&
    estadoActual === 'EN_DEVOLUCION' &&
    estadoDestino === 'DEVUELTO_AL_COMERCIO'
  ) {
    return true;
  }
  return actor === 'REPARTIDOR' && SIGUIENTE[estadoActual] === estadoDestino;
}

// Para el botón "siguiente" del repartidor. null si el envío ya terminó.
export function siguienteEstado(estadoActual: EstadoEnvio): EstadoEnvio | null {
  return SIGUIENTE[estadoActual] ?? null;
}
