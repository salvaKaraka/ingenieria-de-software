// Reglas del panel de excepciones (HU 12 y HU 22). Sin dependencias de la base: se testean solas.
import type {
  EstadoRepartidor,
  TipoVehiculo,
} from '../../../generated/prisma/client';
import { vehiculosQuePuedenLlevar } from '../../asignacion/domain/vehiculos';

// Por qué un envío está en el panel. Cuando exista el estado "Parado" (HU 20/21) se suma 'PARADO'.
export type MotivoExcepcion = 'SIN_REPARTIDOR';

// Texto que ve el operario para cada motivo (HU 12, escenario 2).
export const AVISO_MOTIVO: Record<MotivoExcepcion, string> = {
  SIN_REPARTIDOR: 'Envío sin repartidor disponible',
};

export type Excepcion = {
  envioId: number;
  motivo: MotivoExcepcion;
  // Desde cuándo está en el panel: para "sin repartidor", el vencimiento de la última oferta.
  esperaDesde: Date;
};

// Orden por tiempo de espera: primero el que espera hace más (HU 22, escenario 4).
export function ordenarPorEspera<T extends { esperaDesde: Date }>(
  excepciones: T[],
): T[] {
  return [...excepciones].sort(
    (a, b) => a.esperaDesde.getTime() - b.esperaDesde.getTime(),
  );
}

export function minutosDeEspera(esperaDesde: Date, ahora: Date): number {
  return Math.max(
    0,
    Math.floor((ahora.getTime() - esperaDesde.getTime()) / 60_000),
  );
}

// Los repartidores a los que el operario puede asignar a mano: en jornada (disponibles o en pausa),
// sin otra oferta pendiente y con un vehículo que pueda llevar el paquete.
// A propósito NO mira el orden de la cola ni los 2 viajes consecutivos (HU 22, escenario 5).
export const ESTADOS_ASIGNABLES: EstadoRepartidor[] = [
  'DISPONIBLE',
  'EN_PAUSA',
];

export type RepartidorParaAsignar = {
  activo: boolean;
  estado: EstadoRepartidor;
  vehiculo: TipoVehiculo;
  tieneOfertaPendiente: boolean;
};

// Devuelve por qué no se le puede asignar el envío, o null si se puede.
export function motivoParaNoAsignar(
  vehiculoRequerido: TipoVehiculo,
  repartidor: RepartidorParaAsignar,
): string | null {
  if (!repartidor.activo) return 'El repartidor está dado de baja';
  if (!ESTADOS_ASIGNABLES.includes(repartidor.estado))
    return 'El repartidor no está disponible en este momento';
  if (repartidor.tieneOfertaPendiente)
    return 'El repartidor ya tiene una oferta sin responder';
  if (
    !vehiculosQuePuedenLlevar(vehiculoRequerido).includes(repartidor.vehiculo)
  )
    return 'El vehículo del repartidor no puede llevar este paquete';
  return null;
}
