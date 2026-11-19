import type { TipoVehiculo } from '../../../shared/tipos.ts'

export type EstadoRepartidor =
  | 'FUERA_DE_JORNADA'
  | 'DISPONIBLE'
  | 'OCUPADO'
  | 'EN_PAUSA'
  | 'EMERGENCIA'
  | 'ESPERANDO_VALIDACION_CIERRE'

export const ETIQUETA_ESTADO_REPARTIDOR: Record<EstadoRepartidor, string> = {
  FUERA_DE_JORNADA: 'Fuera de jornada',
  DISPONIBLE: 'Disponible',
  OCUPADO: 'Ocupado',
  EN_PAUSA: 'En pausa',
  EMERGENCIA: 'Emergencia',
  ESPERANDO_VALIDACION_CIERRE: 'Esperando validación de cierre',
}

export const COLOR_ESTADO_REPARTIDOR: Record<EstadoRepartidor, string> = {
  FUERA_DE_JORNADA: 'bg-gray-100 text-gray-700',
  DISPONIBLE: 'bg-green-100 text-green-800',
  OCUPADO: 'bg-blue-100 text-blue-800',
  EN_PAUSA: 'bg-amber-100 text-amber-800',
  EMERGENCIA: 'bg-red-100 text-red-800',
  ESPERANDO_VALIDACION_CIERRE: 'bg-purple-100 text-purple-800',
}

export type Repartidor = {
  id: number
  nombre: string
  apellido: string
  // Enmascarado por la API (•••••678): el DNI completo nunca llega al front
  dni: string | null
  telefono: string
  email: string
  direccion: string
  vehiculo: TipoVehiculo
  estado: EstadoRepartidor
  enColaDesde: string | null
  viajesConsecutivos: number
  cierreSolicitado?: boolean
  activo: boolean
  creadoEn: string
  actualizadoEn: string
}

export type RepartidorConPin = Repartidor & { pin: string }

export type FormularioRepartidorDatos = {
  nombre: string
  apellido: string
  telefono: string
  email: string
  direccion: string
  vehiculo: TipoVehiculo
}
