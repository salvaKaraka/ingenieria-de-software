import { ETIQUETA_ESTADO_ENVIO, type EstadoEnvio } from '../tipos.ts'

const COLORES: Record<EstadoEnvio, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  ASIGNADO: 'bg-sky-100 text-sky-800',
  EN_CAMINO_A_RETIRAR: 'bg-indigo-100 text-indigo-800',
  RETIRADO: 'bg-violet-100 text-violet-800',
  EN_DOMICILIO: 'bg-blue-100 text-blue-800',
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
