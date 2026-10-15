// Tipos del dominio compartidos por todo el frontend.
// Deben coincidir con los enums de is-backend/prisma/schema.prisma.

export type EstadoEnvio =
  | 'PENDIENTE'
  | 'ASIGNADO'
  | 'EN_CAMINO_A_RETIRAR'
  | 'RETIRADO'
  | 'EN_DOMICILIO'
  | 'ENTREGADO'
  | 'CANCELADO'

export const ETIQUETA_ESTADO_ENVIO: Record<EstadoEnvio, string> = {
  PENDIENTE: 'Pendiente',
  ASIGNADO: 'Asignado',
  EN_CAMINO_A_RETIRAR: 'En camino a retirar',
  RETIRADO: 'Paquete retirado',
  EN_DOMICILIO: 'En domicilio de entrega',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}

export type TamanioPaquete = 'CHICO' | 'MEDIANO' | 'GRANDE'
export type TipoVehiculo = 'MOTO' | 'AUTO' | 'CAMION'

export const ETIQUETA_VEHICULO: Record<TipoVehiculo, string> = {
  MOTO: 'Moto',
  AUTO: 'Auto',
  CAMION: 'Camión',
}
