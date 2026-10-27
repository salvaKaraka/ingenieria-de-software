import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  EstadoEnvio,
  Prisma,
  TamanioPaquete,
  TipoVehiculo,
} from '../../generated/prisma/client';

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
    operarioId: number;
    comercioId: number;
    origenDireccion: string;
    destinoDireccion: string;
    destinatarioNombre?: string;
    destinatarioApellido?: string;
    destinatarioDni?: string;
    destinatarioTelefono?: string;
    tamanio: TamanioPaquete;
    vehiculoRequerido: TipoVehiculo;
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
          // estadoNuevo hace que el paso PENDIENTE aparezca en la línea de tiempo (F-3).
          estadoNuevo: 'PENDIENTE',
          actorTipo: 'OPERARIO',
          actorId: data.operarioId,
        },
      });

      return envio;
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

  // Viaje activo del repartidor (E-2): como mucho hay uno, porque el motor solo le ofrece
  // envíos mientras está DISPONIBLE y al aceptar pasa a OCUPADO.
  async buscarViajeActivoPorRepartidor(repartidorId: number) {
    return this.prisma.envio.findFirst({
      where: {
        repartidorId,
        estado: {
          in: ['ASIGNADO', 'EN_CAMINO_A_RETIRAR', 'RETIRADO', 'EN_DOMICILIO'],
        },
      },
      include: { comercio: { select: { nombre: true, telefono: true } } },
    });
  }

  // Avanza el viaje un paso (E-2). Solo si el envío sigue en el estado que leyó el service y
  // sigue siendo de este repartidor: si en el medio el operario lo canceló, no toca nada y
  // devuelve false. Al entregar, el repartidor vuelve al final de la cola en la misma transacción.
  async avanzarViaje(
    envioId: number,
    estadoAnterior: EstadoEnvio,
    estadoNuevo: EstadoEnvio,
    repartidorId: number,
    detalle?: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.envio.updateMany({
        where: { id: envioId, estado: estadoAnterior, repartidorId },
        data: { estado: estadoNuevo },
      });
      if (count === 0) return false;

      await tx.eventoEnvio.create({
        data: {
          envioId,
          tipo: 'CAMBIO_ESTADO',
          estadoAnterior,
          estadoNuevo,
          detalle,
          actorTipo: 'REPARTIDOR',
          actorId: repartidorId,
        },
      });

      if (estadoNuevo === 'ENTREGADO') {
        await tx.repartidor.updateMany({
          where: { id: repartidorId, estado: 'OCUPADO' },
          data: {
            estado: 'DISPONIBLE',
            enColaDesde: new Date(),
            viajesConsecutivos: { increment: 1 },
          },
        });
      }
      return true;
    });
  }

  // Cancela solo si el envío sigue en el estado que el service leyó. Si otro
  // proceso lo cambió en el medio (p. ej. el repartidor lo entregó), no toca
  // nada y devuelve null.
  async cancelar(id: number, estadoAnterior: EstadoEnvio, operarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Primero se bloquean las ofertas abiertas y después el envío: el mismo orden que
      // usa aceptar una oferta (D-2). Con el orden invertido, cancelar y aceptar a la vez
      // se esperarían mutuamente (deadlock). Si el repartidor aceptó primero, el envío ya
      // no está en estadoAnterior y la cancelación no hace nada.
      const ofertasAbiertas = await tx.$queryRaw<
        { id: number; repartidorId: number; creadaEn: Date }[]
      >`
        SELECT id, repartidor_id AS "repartidorId", creada_en AS "creadaEn"
        FROM ofertas
        WHERE envio_id = ${id} AND estado = 'PENDIENTE'
        FOR UPDATE`;

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

      // Una oferta abierta de un envío cancelado no se puede aceptar ni debe vencer:
      // si venciera, el repartidor quedaría EN_PAUSA por algo que no hizo.
      if (ofertasAbiertas.length > 0) {
        await tx.oferta.updateMany({
          where: { id: { in: ofertasAbiertas.map((oferta) => oferta.id) } },
          data: { estado: 'VENCIDA' },
        });
      }
      // Al recibir la oferta había salido de la cola: vuelve con la hora en que se la
      // hicieron, que es aproximadamente el lugar que tenía.
      for (const oferta of ofertasAbiertas) {
        await tx.repartidor.updateMany({
          where: {
            id: oferta.repartidorId,
            estado: 'DISPONIBLE',
            enColaDesde: null,
          },
          data: { enColaDesde: oferta.creadaEn },
        });
      }

      const envio = await tx.envio.findUniqueOrThrow({ where: { id } });
      // Si ya tenía repartidor, el viaje terminó: queda libre y vuelve al final de la cola.
      if (envio.repartidorId !== null) {
        await tx.repartidor.updateMany({
          where: { id: envio.repartidorId, estado: 'OCUPADO' },
          data: { estado: 'DISPONIBLE', enColaDesde: new Date() },
        });
      }
      return envio;
    });
  }
}
