import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { EstadoOferta, Prisma } from '../../generated/prisma/client';

type Tx = Prisma.TransactionClient;

export type OfertaBloqueada = {
  id: number;
  envioId: number;
  repartidorId: number;
  estado: EstadoOferta;
  expiraEn: Date;
};

// Acceso a datos de las ofertas (respuestas del repartidor y vencimientos).
@Injectable()
export class OfertasRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaccion<T>(trabajo: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(trabajo);
  }

  buscarVigenteDe(repartidorId: number) {
    return this.prisma.oferta.findFirst({
      where: {
        repartidorId,
        estado: 'PENDIENTE',
        expiraEn: { gt: new Date() },
      },
      include: {
        envio: { include: { comercio: { select: { nombre: true } } } },
      },
    });
  }

  // Bloquea la oferta: si el repartidor responde justo cuando el job la está venciendo,
  // uno de los dos espera al otro y nunca quedan los dos cambios aplicados.
  async bloquear(tx: Tx, ofertaId: number): Promise<OfertaBloqueada | null> {
    const filas = await tx.$queryRaw<OfertaBloqueada[]>`
      SELECT id, envio_id AS "envioId", repartidor_id AS "repartidorId", estado, expira_en AS "expiraEn"
      FROM ofertas
      WHERE id = ${ofertaId}
      FOR UPDATE`;
    return filas[0] ?? null;
  }

  async aceptar(tx: Tx, oferta: OfertaBloqueada) {
    const envio = await tx.envio.findUniqueOrThrow({
      where: { id: oferta.envioId },
    });
    await tx.oferta.update({
      where: { id: oferta.id },
      data: { estado: 'ACEPTADA', respondidaEn: new Date() },
    });
    await tx.envio.update({
      where: { id: oferta.envioId },
      data: { estado: 'ASIGNADO', repartidorId: oferta.repartidorId },
    });
    await tx.repartidor.update({
      where: { id: oferta.repartidorId },
      data: { estado: 'OCUPADO', enColaDesde: null },
    });
    await tx.eventoEnvio.create({
      data: {
        envioId: oferta.envioId,
        tipo: 'CAMBIO_ESTADO',
        estadoAnterior: envio.estado,
        estadoNuevo: 'ASIGNADO',
        actorTipo: 'REPARTIDOR',
        actorId: oferta.repartidorId,
      },
    });
  }

  async rechazar(tx: Tx, oferta: OfertaBloqueada) {
    await tx.oferta.update({
      where: { id: oferta.id },
      data: { estado: 'RECHAZADA', respondidaEn: new Date() },
    });
    // Vuelve al final de la cola (supuesto 3), si sigue disponible.
    await tx.repartidor.updateMany({
      where: { id: oferta.repartidorId, estado: 'DISPONIBLE' },
      data: { enColaDesde: new Date() },
    });
  }

  // Vence las ofertas cuyo plazo pasó. SKIP LOCKED: si dos ejecuciones del job se superponen,
  // o el repartidor está respondiendo justo esa oferta, no se procesa dos veces.
  vencerExpiradas(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const vencidas = await tx.$queryRaw<
        { id: number; repartidorId: number }[]
      >`
        SELECT id, repartidor_id AS "repartidorId"
        FROM ofertas
        WHERE estado = 'PENDIENTE' AND expira_en <= now()
        FOR UPDATE SKIP LOCKED`;
      if (vencidas.length === 0) return 0;

      await tx.oferta.updateMany({
        where: { id: { in: vencidas.map((oferta) => oferta.id) } },
        data: { estado: 'VENCIDA' },
      });
      // No respondió en 5 minutos: queda en pausa hasta que se reactive (supuesto 4) y reinicia contador.
      await tx.repartidor.updateMany({
        where: {
          id: { in: vencidas.map((oferta) => oferta.repartidorId) },
          estado: 'DISPONIBLE',
        },
        data: { estado: 'EN_PAUSA', enColaDesde: null, viajesConsecutivos: 0 },
      });
      return vencidas.length;
    });
  }
}
