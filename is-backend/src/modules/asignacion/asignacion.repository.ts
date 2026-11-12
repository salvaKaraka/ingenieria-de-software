import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  EstadoEnvio,
  Prisma,
  TipoVehiculo,
} from '../../generated/prisma/client';

type Tx = Prisma.TransactionClient;

export type EnvioBloqueado = {
  id: number;
  estado: EstadoEnvio;
  vehiculoRequerido: TipoVehiculo;
};
export type Candidato = {
  id: number;
  viajesConsecutivos: number;
  vehiculo: TipoVehiculo;
};

// Acceso a datos del motor. Las consultas críticas están en SQL a mano porque Prisma no sabe
// expresar los bloqueos de fila (FOR UPDATE / SKIP LOCKED). Todas reciben la transacción `tx`.
@Injectable()
export class AsignacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaccion<T>(trabajo: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(trabajo);
  }

  // Bloquea la fila del envío hasta el final de la transacción: si otro proceso intenta asignar
  // el mismo envío al mismo tiempo, espera acá y después ve la oferta que creamos nosotros.
  async bloquearEnvio(tx: Tx, envioId: number): Promise<EnvioBloqueado | null> {
    const filas = await tx.$queryRaw<EnvioBloqueado[]>`
      SELECT id, estado, vehiculo_requerido AS "vehiculoRequerido"
      FROM envios
      WHERE id = ${envioId}
      FOR UPDATE`;
    return filas[0] ?? null;
  }

  async tieneOfertaVigente(tx: Tx, envioId: number): Promise<boolean> {
    const cantidad = await tx.oferta.count({
      where: { envioId, estado: 'PENDIENTE' },
    });
    return cantidad > 0;
  }

  // Primer repartidor de la cola FIFO que puede recibir este envío.
  // SKIP LOCKED: si otra transacción está ofreciéndole un viaje a alguien, lo saltea en vez de
  // esperar. Así dos envíos simultáneos nunca terminan ofrecidos al mismo repartidor (riesgo 7).
  // `vehiculos`: los que pueden llevar el paquete, en orden de preferencia (ver domain/vehiculos.ts).
  // Se elige primero por vehículo (el más chico que sirva) y, dentro de cada uno, por orden de llegada.
  async tomarCandidato(
    tx: Tx,
    envioId: number,
    vehiculos: TipoVehiculo[],
  ): Promise<Candidato | null> {
    const filas = await tx.$queryRaw<Candidato[]>`
      SELECT r.id, r.viajes_consecutivos AS "viajesConsecutivos", r.vehiculo
      FROM repartidores r
      WHERE r.estado = 'DISPONIBLE'
        AND r.activo
        -- en la cola: al recibir una oferta sale de ella (ver ofrecer). Esta condición está en la
        -- PROPIA fila del repartidor a propósito: es lo que Postgres vuelve a verificar con datos
        -- frescos al bloquear la fila, y lo que impide dos ofertas simultáneas al mismo repartidor.
        AND r.en_cola_desde IS NOT NULL
        AND r.vehiculo = ANY(${vehiculos}::"TipoVehiculo"[])
        -- un viaje a la vez (refuerzo de la condición anterior)
        AND NOT EXISTS (
          SELECT 1 FROM ofertas o WHERE o.repartidor_id = r.id AND o.estado = 'PENDIENTE'
        )
        -- a quien rechazó o dejó vencer este envío no se le vuelve a ofrecer (supuesto 3)
        AND NOT EXISTS (
          SELECT 1 FROM ofertas o
          WHERE o.repartidor_id = r.id AND o.envio_id = ${envioId} AND o.estado IN ('RECHAZADA', 'VENCIDA')
        )
      ORDER BY array_position(${vehiculos}::"TipoVehiculo"[], r.vehiculo), r.en_cola_desde ASC, r.id ASC
      LIMIT 1
      FOR UPDATE OF r SKIP LOCKED`;
    return filas[0] ?? null;
  }

  // Verifica si hay otro repartidor disponible para el mismo vehículo que pueda recibir este envío.
  async hayOtroCandidatoDisponible(
    tx: Tx,
    envioId: number,
    vehiculo: TipoVehiculo,
    excluirRepartidorId: number,
  ): Promise<boolean> {
    const filas = await tx.$queryRaw<{ id: number }[]>`
      SELECT r.id
      FROM repartidores r
      WHERE r.id != ${excluirRepartidorId}
        AND r.estado = 'DISPONIBLE'
        AND r.activo
        AND r.en_cola_desde IS NOT NULL
        AND r.vehiculo = ${vehiculo}
        AND NOT EXISTS (
          SELECT 1 FROM ofertas o WHERE o.repartidor_id = r.id AND o.estado = 'PENDIENTE'
        )
        AND NOT EXISTS (
          SELECT 1 FROM ofertas o
          WHERE o.repartidor_id = r.id AND o.envio_id = ${envioId} AND o.estado IN ('RECHAZADA', 'VENCIDA')
        )
      LIMIT 1`;
    return filas.length > 0;
  }

  // Registra el aviso de asignación por excepción en el historial del envío.
  async registrarAvisoExcepcion(tx: Tx, envioId: number, detalle: string) {
    await tx.eventoEnvio.create({
      data: {
        envioId,
        tipo: 'NOTA',
        detalle,
        actorTipo: 'SISTEMA',
      },
    });
  }

  // Descanso por viajes consecutivos: vuelve a 0 y pasa al final de la cola.
  async mandarADescansar(tx: Tx, repartidorId: number) {
    await tx.repartidor.update({
      where: { id: repartidorId },
      data: { viajesConsecutivos: 0, enColaDesde: new Date() },
    });
  }

  // Crea la oferta y saca al repartidor de la cola, en la misma transacción.
  // Sacarlo de la cola no es solo de negocio: modificar su fila es lo que hace que otra transacción
  // que lo estaba por elegir al mismo tiempo lo descarte (ver tomarCandidato).
  async ofrecer(tx: Tx, envioId: number, repartidorId: number, expiraEn: Date) {
    await tx.repartidor.update({
      where: { id: repartidorId },
      data: { enColaDesde: null },
    });
    return tx.oferta.create({ data: { envioId, repartidorId, expiraEn } });
  }

  // Envíos esperando repartidor, del más viejo al más nuevo (también FIFO).
  async enviosPendientesSinOferta(): Promise<number[]> {
    const envios = await this.prisma.envio.findMany({
      where: {
        estado: 'PENDIENTE',
        ofertas: { none: { estado: 'PENDIENTE' } },
      },
      orderBy: { creadoEn: 'asc' },
      select: { id: true },
    });
    return envios.map((envio) => envio.id);
  }
}
