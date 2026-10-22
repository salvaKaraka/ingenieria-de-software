export enum EstadoEnvio {
  PENDIENTE = 'PENDIENTE',
  ASIGNADO = 'ASIGNADO',
  EN_CAMINO_A_RETIRAR = 'EN_CAMINO_A_RETIRAR',
  RETIRADO = 'RETIRADO',
  EN_DOMICILIO = 'EN_DOMICILIO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

export enum TipoActor {
  OPERARIO = 'OPERARIO',
  REPARTIDOR = 'REPARTIDOR',
  SISTEMA = 'SISTEMA',
}

export function esTransicionValida(
  estadoActual: EstadoEnvio,
  estadoDestino: EstadoEnvio,
  actor: TipoActor,
): boolean {
  if (estadoDestino === EstadoEnvio.CANCELADO) {
    return (
      actor === TipoActor.OPERARIO &&
      estadoActual !== EstadoEnvio.ENTREGADO &&
      estadoActual !== EstadoEnvio.CANCELADO
    );
  }

  if (actor !== TipoActor.REPARTIDOR) {
    return false;
  }

  switch (estadoActual) {
    case EstadoEnvio.PENDIENTE:
      return estadoDestino === EstadoEnvio.ASIGNADO;
    case EstadoEnvio.ASIGNADO:
      return estadoDestino === EstadoEnvio.EN_CAMINO_A_RETIRAR;
    case EstadoEnvio.EN_CAMINO_A_RETIRAR:
      return estadoDestino === EstadoEnvio.RETIRADO;
    case EstadoEnvio.RETIRADO:
      return estadoDestino === EstadoEnvio.EN_DOMICILIO;
    case EstadoEnvio.EN_DOMICILIO:
      return estadoDestino === EstadoEnvio.ENTREGADO;
    default:
      return false;
  }
}

export function siguienteEstado(estadoActual: EstadoEnvio): EstadoEnvio | null {
  switch (estadoActual) {
    case EstadoEnvio.PENDIENTE:
      return EstadoEnvio.ASIGNADO;
    case EstadoEnvio.ASIGNADO:
      return EstadoEnvio.EN_CAMINO_A_RETIRAR;
    case EstadoEnvio.EN_CAMINO_A_RETIRAR:
      return EstadoEnvio.RETIRADO;
    case EstadoEnvio.RETIRADO:
      return EstadoEnvio.EN_DOMICILIO;
    case EstadoEnvio.EN_DOMICILIO:
      return EstadoEnvio.ENTREGADO;
    default:
      return null;
  }
}
