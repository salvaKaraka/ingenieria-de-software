import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { EstadoEnvio } from '../../generated/prisma/client';
import { CrearComercioDto } from './dto/crear-comercio.dto';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto';

@Injectable()
export class ComerciosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarTodos(q?: string) {
    return this.prisma.comercio.findMany({
      where: {
        activo: true, // Solo mostrar comercios activos
        ...(q ? { nombre: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { id: 'desc' },
    });
  }

  async buscarPorId(id: number) {
    return this.prisma.comercio.findUnique({
      where: { id },
    });
  }

  // Incluye los dados de baja: el nombre tiene que ser único en todo el sistema.
  async buscarPorNombre(nombre: string) {
    return this.prisma.comercio.findFirst({
      where: { nombre: { equals: nombre, mode: 'insensitive' } },
    });
  }

  async crear(data: CrearComercioDto) {
    return this.prisma.comercio.create({
      data: {
        nombre: data.nombre,
        telefono: data.telefono,
        email: data.email,
        direccion: data.direccion,
        requiereFoto: data.requiereFoto,
        requiereDni: data.requiereDni,
        activo: true,
      },
    });
  }

  async actualizar(id: number, data: ActualizarComercioDto) {
    return this.prisma.comercio.update({
      where: { id },
      data,
    });
  }

  // Pendientes o en viaje: todo lo que no está entregado ni cancelado.
  async contarEnviosEnCurso(
    comercioId: number,
    estadosFinales: readonly EstadoEnvio[],
  ) {
    return this.prisma.envio.count({
      where: { comercioId, estado: { notIn: [...estadosFinales] } },
    });
  }

  // Resumen diario por comercio (HU 41): agrupa los envíos del comercio que están en un
  // estado final y cuya finalización (o creación si no tiene evento de cierre) cayó en [desde, hasta].
  async contarFinalizadosPorEstado(
    comercioId: number,
    desde: Date,
    hasta: Date,
    estadosFinales: readonly EstadoEnvio[],
  ): Promise<{ estado: EstadoEnvio; cantidad: number }[]> {
    const grupos = await this.prisma.envio.groupBy({
      by: ['estado'],
      where: {
        comercioId,
        estado: { in: [...estadosFinales] },
        OR: [
          {
            eventos: {
              some: {
                estadoNuevo: { in: [...estadosFinales] },
                creadoEn: { gte: desde, lte: hasta },
              },
            },
          },
          {
            eventos: {
              none: {
                estadoNuevo: { in: [...estadosFinales] },
              },
            },
            creadoEn: { gte: desde, lte: hasta },
          },
        ],
      },
      _count: { _all: true },
    });

    return grupos.map((grupo) => ({
      estado: grupo.estado,
      cantidad: grupo._count._all,
    }));
  }

  // 💥 BAJA LÓGICA (NO BORRAR REGISTRO DE BD)
  async eliminarLogico(id: number) {
    return this.prisma.comercio.update({
      where: { id },
      data: { activo: false }, // 👈 Cambia el estado a inactivo
    });
  }
}
