import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EstadoEnvio, type Prisma } from '../../generated/prisma/client';
import type { FiltroRepartidoresDto } from './dto/filtro-repartidores.dto';

// Proyección segura: pinHmac se excluye a nivel de base de datos para no exponerlo jamás
export const SELECT_REPARTIDOR_PUBLICO = {
  id: true,
  nombre: true,
  apellido: true,
  telefono: true,
  email: true,
  direccion: true,
  vehiculo: true,
  estado: true,
  enColaDesde: true,
  viajesConsecutivos: true,
  activo: true,
  creadoEn: true,
  actualizadoEn: true,
} as const;

export type RepartidorPublico = Prisma.RepartidorGetPayload<{
  select: typeof SELECT_REPARTIDOR_PUBLICO;
}>;

@Injectable()
export class RepartidoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros?: FiltroRepartidoresDto): Promise<RepartidorPublico[]> {
    const where: Prisma.RepartidorWhereInput = {};

    if (filtros?.activo !== undefined) {
      where.activo = filtros.activo;
    }

    if (filtros?.vehiculo) {
      where.vehiculo = filtros.vehiculo;
    }

    if (filtros?.q) {
      const busqueda = filtros.q.trim();
      where.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { apellido: { contains: busqueda, mode: 'insensitive' } },
        { email: { contains: busqueda, mode: 'insensitive' } },
        { telefono: { contains: busqueda, mode: 'insensitive' } },
      ];
    }

    return this.prisma.repartidor.findMany({
      where,
      select: SELECT_REPARTIDOR_PUBLICO,
      orderBy: { id: 'asc' },
    });
  }

  buscarPorId(id: number): Promise<RepartidorPublico | null> {
    return this.prisma.repartidor.findUnique({
      where: { id },
      select: SELECT_REPARTIDOR_PUBLICO,
    });
  }

  crear(datos: Prisma.RepartidorCreateInput): Promise<RepartidorPublico> {
    return this.prisma.repartidor.create({
      data: datos,
      select: SELECT_REPARTIDOR_PUBLICO,
    });
  }

  actualizar(
    id: number,
    datos: Prisma.RepartidorUpdateInput,
  ): Promise<RepartidorPublico> {
    return this.prisma.repartidor.update({
      where: { id },
      data: datos,
      select: SELECT_REPARTIDOR_PUBLICO,
    });
  }

  async tieneViajeActivo(repartidorId: number): Promise<boolean> {
    const estadosActivos: EstadoEnvio[] = [
      EstadoEnvio.ASIGNADO,
      EstadoEnvio.EN_CAMINO_A_RETIRAR,
      EstadoEnvio.RETIRADO,
      EstadoEnvio.EN_DOMICILIO,
    ];

    const cantidad = await this.prisma.envio.count({
      where: {
        repartidorId,
        estado: { in: estadosActivos },
      },
    });

    return cantidad > 0;
  }
}
