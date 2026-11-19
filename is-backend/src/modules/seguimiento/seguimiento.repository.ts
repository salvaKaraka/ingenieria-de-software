import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { TipoVehiculo } from '../../generated/prisma/client';
import {
  ENTREGAS_A_PROMEDIAR,
  type EntregaAnterior,
} from './domain/franja-estimada';

@Injectable()
export class SeguimientoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Búsqueda en orden O(1):
   * La columna `codigoSeguimiento` posee una restricción @unique en schema.prisma,
   * lo cual genera un UNIQUE INDEX en PostgreSQL. findUnique resuelve la búsqueda
   * directamente sobre el índice sin necesidad de escanear la tabla entera.
   */
  async buscarPorCodigo(codigo: string) {
    return this.prisma.envio.findUnique({
      where: { codigoSeguimiento: codigo },
      // Página pública: la foto de la entrega no se trae ni de la base.
      omit: { fotoUrl: true },
      include: {
        comercio: { select: { nombre: true } },
        eventos: {
          orderBy: { creadoEn: 'asc' },
        },
      },
    });
  }

  /**
   * Las últimas entregas hechas con un vehículo que terminaron antes de `antesDe`, con
   * cuándo se retiró y cuándo se entregó cada paquete. Cortar en `antesDe` (la salida
   * del envío consultado) hace que la franja no cambie aunque después se entreguen otros.
   */
  async entregasAnteriores(
    vehiculo: TipoVehiculo,
    antesDe: Date,
  ): Promise<EntregaAnterior[]> {
    const eventosEntrega = await this.prisma.eventoEnvio.findMany({
      where: {
        estadoNuevo: 'ENTREGADO',
        creadoEn: { lt: antesDe },
        envio: { vehiculoRequerido: vehiculo },
      },
      // El id desempata dos entregas en el mismo instante: siempre se eligen las mismas.
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: ENTREGAS_A_PROMEDIAR,
      select: {
        creadoEn: true,
        envio: {
          select: {
            // La última salida: si el envío se reasignó, el viaje que cuenta es el que terminó.
            eventos: {
              where: { estadoNuevo: 'RETIRADO' },
              orderBy: { creadoEn: 'desc' },
              take: 1,
              select: { creadoEn: true },
            },
          },
        },
      },
    });

    return eventosEntrega.flatMap((entrega) => {
      const retiro = entrega.envio.eventos[0];
      // Sin retiro registrado no se puede medir cuánto tardó: no entra en el promedio.
      return retiro
        ? [{ retiradoEn: retiro.creadoEn, entregadoEn: entrega.creadoEn }]
        : [];
    });
  }

  /**
   * Guarda la duración estimada del viaje solo si el envío todavía no tenía una, y devuelve
   * la que quedó guardada. Si dos consultas llegan juntas, gana la primera y las dos
   * muestran la misma franja.
   */
  async guardarDuracionEstimada(
    envioId: number,
    minutos: number,
  ): Promise<number> {
    await this.prisma.envio.updateMany({
      where: { id: envioId, duracionEstimadaMin: null },
      data: { duracionEstimadaMin: minutos },
    });
    const envio = await this.prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
      select: { duracionEstimadaMin: true },
    });
    return envio.duracionEstimadaMin ?? minutos;
  }
}
