import type {
  EstadoEnvio,
  EstadoOferta,
  TipoActor,
  TipoEvento,
} from '../../../generated/prisma/client';

export type EventoHistorial = {
  id: number;
  tipo: TipoEvento;
  estadoNuevo: EstadoEnvio | null;
  detalle: string | null;
  actorTipo: TipoActor;
  actorId: number | null;
  creadoEn: Date;
};

export type OfertaHistorial = {
  id: number;
  estado: EstadoOferta;
  creadaEn: Date;
  expiraEn: Date;
  respondidaEn: Date | null;
  repartidor: { nombre: string; apellido: string };
};

// Nombres de quienes figuran como actores, por id.
export type NombresActores = {
  operarios: Map<number, string>;
  repartidores: Map<number, string>;
};

export type EntradaHistorial = {
  clave: string;
  fecha: Date;
  tipo: TipoEvento | 'OFERTA_ENVIADA' | 'OFERTA_RECHAZADA' | 'OFERTA_VENCIDA';
  estadoNuevo: EstadoEnvio | null;
  detalle: string | null;
  actorTipo: TipoActor;
  // Quién hizo la acción; null si fue el sistema o no se encontró.
  actorNombre: string | null;
  // A quién se le ofreció el viaje (solo en las entradas de ofertas).
  repartidorNombre: string | null;
};

function nombreDe(
  actorTipo: TipoActor,
  actorId: number | null,
  nombres: NombresActores,
): string | null {
  if (actorId === null) return null;
  if (actorTipo === 'OPERARIO') return nombres.operarios.get(actorId) ?? null;
  if (actorTipo === 'REPARTIDOR')
    return nombres.repartidores.get(actorId) ?? null;
  return null;
}

// Historial del envío para el operario (A-6): los cambios de estado de EventoEnvio más lo que
// pasó con las ofertas, que el motor hace solo y no cambia el estado del envío (sigue
// PENDIENTE). Las ofertas se leen de su propia tabla, que ya guarda cada respuesta con su hora.
export function armarHistorial(
  eventos: EventoHistorial[],
  ofertas: OfertaHistorial[],
  nombres: NombresActores,
): EntradaHistorial[] {
  const entradas: EntradaHistorial[] = eventos.map((evento) => ({
    clave: `evento-${evento.id}`,
    fecha: evento.creadoEn,
    tipo: evento.tipo,
    estadoNuevo: evento.estadoNuevo,
    detalle: evento.detalle,
    actorTipo: evento.actorTipo,
    actorNombre: nombreDe(evento.actorTipo, evento.actorId, nombres),
    repartidorNombre: null,
  }));

  // Cancelar un envío o cambiarle el tamaño a otro vehículo (HU 31) cierra sus ofertas
  // abiertas como VENCIDA antes de tiempo: esas no vencieron por inactividad del repartidor
  // y no se muestran como tales.
  const cierres = eventos
    .filter(
      (evento) =>
        evento.estadoNuevo === 'CANCELADO' || evento.tipo === 'REASIGNACION',
    )
    .map((evento) => evento.creadoEn);

  for (const oferta of ofertas) {
    const repartidorNombre = `${oferta.repartidor.nombre} ${oferta.repartidor.apellido}`;
    const base = {
      estadoNuevo: null,
      detalle: null,
      repartidorNombre,
    };

    entradas.push({
      ...base,
      clave: `oferta-${oferta.id}`,
      fecha: oferta.creadaEn,
      tipo: 'OFERTA_ENVIADA',
      actorTipo: 'SISTEMA',
      actorNombre: null,
    });

    if (oferta.estado === 'RECHAZADA' && oferta.respondidaEn) {
      entradas.push({
        ...base,
        clave: `oferta-${oferta.id}-rechazada`,
        fecha: oferta.respondidaEn,
        tipo: 'OFERTA_RECHAZADA',
        actorTipo: 'REPARTIDOR',
        actorNombre: repartidorNombre,
      });
    }

    const cerradaAntes = cierres.some(
      (cierre) => cierre >= oferta.creadaEn && cierre < oferta.expiraEn,
    );
    if (oferta.estado === 'VENCIDA' && !cerradaAntes) {
      entradas.push({
        ...base,
        clave: `oferta-${oferta.id}-vencida`,
        fecha: oferta.expiraEn,
        tipo: 'OFERTA_VENCIDA',
        actorTipo: 'SISTEMA',
        actorNombre: null,
      });
    }
  }

  // sort es estable: si dos entradas tienen la misma hora, queda primero el evento.
  return entradas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}
