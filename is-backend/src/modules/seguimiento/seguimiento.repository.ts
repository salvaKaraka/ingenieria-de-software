import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
      include: {
        comercio: { select: { nombre: true } },
        eventos: {
          orderBy: { creadoEn: 'asc' },
        },
      },
    });
  }
}
