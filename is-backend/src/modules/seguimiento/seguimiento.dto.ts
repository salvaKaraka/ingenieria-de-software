export interface HistorialEstadoDto {
  estado: string;
  fecha: string; // ISO string
}

export interface TrackingPublicoDto {
  trackingCode: string;
  estadoActual: string;
  comercio: string;
  destinatario: string; // Enmascarado: Nombre e inicial de apellido (ej: "Juan P.")
  direccionDestino: string; // Enmascarada: Calle sin altura (ej: "Av. Corrientes")
  horaSalida?: string; // Momento en que pasó a RETIRADO (Supuesto 7)
  franjaEstimadaInicio?: string;
  franjaEstimadaFin?: string;
  fechaEntrega?: string;
  historial: HistorialEstadoDto[];
}
