import { ETIQUETA_ESTADO_ENVIO, type EstadoEnvio } from '../tipos.ts'

const COLORES: Record<EstadoEnvio, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  ASIGNADO: 'bg-sky-100 text-sky-800',
  EN_CAMINO_A_RETIRAR: 'bg-indigo-100 text-indigo-800',
  RETIRADO: 'bg-violet-100 text-violet-800',
  EN_DOMICILIO: 'bg-blue-100 text-blue-800',
  INTERRUMPIDO: 'bg-red-100 text-red-800',
  PARADO: 'bg-orange-100 text-orange-800',
  CON_NOVEDAD: 'bg-rose-100 text-rose-800',
  A_DEVOLVER: 'bg-purple-100 text-purple-800',
  EN_CUSTODIA: 'bg-fuchsia-100 text-fuchsia-800',
  EN_DEVOLUCION: 'bg-teal-100 text-teal-800',
  DEVUELTO_AL_COMERCIO: 'bg-emerald-100 text-emerald-800',
  ENTREGADO: 'bg-green-100 text-green-800',
  CANCELADO: 'bg-gray-200 text-gray-700',
}

// Chip de color con el estado de un envío.
export function EtiquetaEstado({ estado }: { estado: EstadoEnvio }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORES[estado]}`}>
      {ETIQUETA_ESTADO_ENVIO[estado]}
    </span>
  )
}
