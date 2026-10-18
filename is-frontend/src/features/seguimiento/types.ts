export type EstadoEnvio = 'PENDIENTE' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

export interface HistorialEstadoItem {
  estado: EstadoEnvio;
  fecha: string; // ISO string
}

export interface TrackingResponseDto {
  trackingCode: string;
  estadoActual: EstadoEnvio;
  horaSalida?: string;
  franjaEstimadaInicio?: string;
  franjaEstimadaFin?: string;
  fechaEntrega?: string;
  historial: HistorialEstadoItem[];
}
