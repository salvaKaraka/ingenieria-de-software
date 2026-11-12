import type { EstadoEnvio } from '../../../shared/tipos.ts'

// El motor lo deja en el historial cuando le ofrece el envío a un repartidor con 2 viajes
// seguidos porque no había otro con ese vehículo (D-1). Mismo texto que en el backend.
export const AVISO_EXCEPCION = 'Asignación por excepción: único repartidor disponible'

// Se destaca solo mientras el envío está en curso; después queda como registro en el historial.
export function esAsignacionPorExcepcion(estado: EstadoEnvio, eventos: { detalle: string | null }[]): boolean {
  return estado !== 'ENTREGADO' && estado !== 'CANCELADO' && eventos.some((e) => e.detalle === AVISO_EXCEPCION)
}
