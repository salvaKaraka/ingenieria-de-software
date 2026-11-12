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
export const ESTADOS_FINALES: readonly EstadoEnvio[] = ['ENTREGADO', 'CANCELADO'];

export function esTransicionValida(
  estadoActual: EstadoEnvio,
  estadoDestino: EstadoEnvio,
  actor: TipoActor,
): boolean {
  // El operario no avanza el viaje (lo hace quien tiene el paquete): solo puede cancelarlo,
  // y nunca después de que terminó.
  if (estadoDestino === 'CANCELADO') {
    return (
      actor === 'OPERARIO' &&
      estadoActual !== 'ENTREGADO' &&
      estadoActual !== 'CANCELADO'
    );
  }
  return actor === 'REPARTIDOR' && SIGUIENTE[estadoActual] === estadoDestino;
}

// Para el botón "siguiente" del repartidor. null si el envío ya terminó.
export function siguienteEstado(estadoActual: EstadoEnvio): EstadoEnvio | null {
  return SIGUIENTE[estadoActual] ?? null;
}
