import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EstadoEnvio, Prisma } from '../../generated/prisma/client';

export interface FiltrosListado {
  estados?: EstadoEnvio[];
  comercioId?: number;
  desde?: Date;
  hasta?: Date;
  q?: string;
  saltar: number;
  tomar: number;
}

@Injectable()
export class EnviosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(data: {
    codigoSeguimiento: string;
    comercioId: number;
    origenDireccion: string;
    destinoDireccion: string;
    destinatarioNombre?: string;
    destinatarioApellido?: string;
    destinatarioDni?: string;
    destinatarioTelefono?: string;
    tamanio: 'CHICO' | 'MEDIANO' | 'GRANDE';
    vehiculoRequerido: 'MOTO' | 'AUTO' | 'CAMION';
    observaciones?: string;
    requiereFoto: boolean;
    requiereDni: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const envio = await tx.envio.create({
        data: {
          codigoSeguimiento: data.codigoSeguimiento,
          comercioId: data.comercioId,
          origenDireccion: data.origenDireccion,
          destinoDireccion: data.destinoDireccion,
          destinatarioNombre: data.destinatarioNombre,
          destinatarioApellido: data.destinatarioApellido,
          destinatarioDni: data.destinatarioDni,
          destinatarioTelefono: data.destinatarioTelefono,
          tamanio: data.tamanio,
          vehiculoRequerido: data.vehiculoRequerido,
          observaciones: data.observaciones,
          requiereFoto: data.requiereFoto,
          requiereDni: data.requiereDni,
        },
      });

      await tx.eventoEnvio.create({
        data: {
          envioId: envio.id,
          tipo: 'CREADO',
          actorTipo: 'OPERARIO',
        },
      });

      return envio;
    });
  }

  async obtenerPorId(id: number) {
    return this.prisma.envio.findUnique({
      where: { id },
      include: { comercio: true },
    });
  }

  // Listado paginado. Devuelve la página pedida y el total que cumple los filtros.
  async listar(filtros: FiltrosListado) {
    const where: Prisma.EnvioWhereInput = {
      ...(filtros.estados?.length ? { estado: { in: filtros.estados } } : {}),
      ...(filtros.comercioId ? { comercioId: filtros.comercioId } : {}),
      ...(filtros.desde || filtros.hasta
        ? { creadoEn: { gte: filtros.desde, lte: filtros.hasta } }
        : {}),
      // Cada palabra de la búsqueda tiene que aparecer en el código o en el
      // nombre/apellido: así "juan perez" encuentra a Juan Pérez.
      ...(filtros.q
        ? {
            AND: filtros.q.split(/\s+/).map((palabra) => ({
              OR: [
                {
                  codigoSeguimiento: {
                    contains: palabra,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  destinatarioNombre: {
                    contains: palabra,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  destinatarioApellido: {
                    contains: palabra,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            })),
          }
        : {}),
    };

    const [datos, total] = await this.prisma.$transaction([
      this.prisma.envio.findMany({
        where,
        // El desempate por id evita que un envío aparezca en dos páginas.
        orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
        skip: filtros.saltar,
        take: filtros.tomar,
        include: {
          comercio: { select: { id: true, nombre: true } },
          repartidor: { select: { id: true, nombre: true, apellido: true } },
        },
      }),
      this.prisma.envio.count({ where }),
    ]);

    return { datos, total };
  }

  async obtenerDetalle(id: number) {
    return this.prisma.envio.findUnique({
      where: { id },
      include: {
        comercio: true,
        // select explícito: nunca devolver columnas de autenticación (PIN).
        repartidor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            telefono: true,
            vehiculo: true,
            estado: true,
          },
        },
        ofertas: {
          orderBy: { creadaEn: 'asc' },
          include: {
            repartidor: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        eventos: { orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] },
      },
    });
  }

  async obtenerEstado(id: number) {
    return this.prisma.envio.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });
  }

  // Cancela solo si el envío sigue en el estado que el service leyó. Si otro
  // proceso lo cambió en el medio (p. ej. el repartidor lo entregó), no toca
  // nada y devuelve null.
  async cancelar(id: number, estadoAnterior: EstadoEnvio, operarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.envio.updateMany({
        where: { id, estado: estadoAnterior },
        data: { estado: 'CANCELADO' },
      });
      if (count === 0) return null;

      await tx.eventoEnvio.create({
        data: {
          envioId: id,
          tipo: 'CAMBIO_ESTADO',
          estadoAnterior,
          estadoNuevo: 'CANCELADO',
          actorTipo: 'OPERARIO',
          actorId: operarioId,
        },
      });

      return tx.envio.findUnique({ where: { id } });
    });
  }
}
