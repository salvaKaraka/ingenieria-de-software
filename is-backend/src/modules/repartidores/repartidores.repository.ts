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
  cierreSolicitado: true,
  activo: true,
  creadoEn: true,
  actualizadoEn: true,
} as const;

export type RepartidorPublico = Prisma.RepartidorGetPayload<{
  select: typeof SELECT_REPARTIDOR_PUBLICO;
}>;

const ESTADOS_VIAJE_ACTIVO: EstadoEnvio[] = [
  EstadoEnvio.ASIGNADO,
  EstadoEnvio.EN_CAMINO_A_RETIRAR,
  EstadoEnvio.RETIRADO,
  EstadoEnvio.EN_DOMICILIO,
];

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
    const cantidad = await this.prisma.envio.count({
      where: {
        repartidorId,
        estado: { in: ESTADOS_VIAJE_ACTIVO },
      },
    });

    return cantidad > 0;
  }

  async tieneOfertaPendiente(repartidorId: number): Promise<boolean> {
    const cantidad = await this.prisma.oferta.count({
      where: { repartidorId, estado: 'PENDIENTE' },
    });
    return cantidad > 0;
  }

  // Baja lógica en una sola sentencia que vuelve a exigir que no tenga viaje ni oferta:
  // entre los chequeos del service y este UPDATE el motor pudo haberle ofrecido un envío.
  // Devuelve false si no se pudo dar de baja.
  async darDeBajaSiEstaLibre(id: number): Promise<boolean> {
    const { count } = await this.prisma.repartidor.updateMany({
      where: {
        id,
        envios: { none: { estado: { in: ESTADOS_VIAJE_ACTIVO } } },
        ofertas: { none: { estado: 'PENDIENTE' } },
      },
      data: { activo: false, estado: 'FUERA_DE_JORNADA', enColaDesde: null },
    });
    return count > 0;
  }

  // Jornada (C-3). Cada cambio es un UPDATE condicionado al estado esperado, así una
  // transición que ya no vale (por ejemplo, el motor le acaba de ofrecer un viaje) no se
  // aplica. Devuelven false si no se cambió nada.

  async iniciarJornada(id: number): Promise<boolean> {
    const { count } = await this.prisma.repartidor.updateMany({
      where: { id, activo: true, estado: 'FUERA_DE_JORNADA' },
      data: {
        estado: 'DISPONIBLE',
        enColaDesde: new Date(),
        cierreSolicitado: false,
      },
    });
    return count > 0;
  }

  // enColaDesde no nulo = está en la cola y sin oferta: al ofrecerle un viaje el motor lo
  // saca de la cola en su misma fila, y Postgres vuelve a verificar esa condición al bloquearla.
  async pausar(id: number): Promise<boolean> {
    const { count } = await this.prisma.repartidor.updateMany({
      where: { id, estado: 'DISPONIBLE', enColaDesde: { not: null } },
      data: { estado: 'EN_PAUSA', enColaDesde: null },
    });
    return count > 0;
  }

  // Vuelve al final de la cola (C-3).
  async reanudar(id: number): Promise<boolean> {
    const { count } = await this.prisma.repartidor.updateMany({
      where: { id, activo: true, estado: 'EN_PAUSA' },
      data: { estado: 'DISPONIBLE', enColaDesde: new Date() },
    });
    return count > 0;
  }

  // Termina la jornada (C-3): solo si está DISPONIBLE en la cola (enColaDesde != null) o EN_PAUSA.
  async terminarJornada(id: number): Promise<boolean> {
    const { count } = await this.prisma.repartidor.updateMany({
      where: {
        id,
        activo: true,
        OR: [
          { estado: 'DISPONIBLE', enColaDesde: { not: null } },
          { estado: 'EN_PAUSA' },
        ],
      },
      data: { estado: 'FUERA_DE_JORNADA', enColaDesde: null },
    });
    return count > 0;
  }

  // Flota en jornada (C-3): repartidores activos que no están FUERA_DE_JORNADA
  async obtenerFlota(): Promise<RepartidorPublico[]> {
    return this.prisma.repartidor.findMany({
      where: {
        activo: true,
        estado: { not: 'FUERA_DE_JORNADA' },
      },
      select: SELECT_REPARTIDOR_PUBLICO,
    });
  }

  // Rendición de paquetes para cierre de turno (G-1)
  async obtenerRendicion(repartidorId: number) {
    const [viajesTomados, paquetesEntregados, paquetesADevolver] =
      await Promise.all([
        this.prisma.envio.count({
          where: { repartidorId },
        }),
        this.prisma.envio.count({
          where: { repartidorId, estado: EstadoEnvio.ENTREGADO },
        }),
        this.obtenerPaquetesADevolver(repartidorId),
      ]);

    return {
      viajesTomados,
      paquetesEntregados,
      paquetesADevolver,
    };
  }

  // Marca que el repartidor solicitó el cierre mientras estaba en viaje
  async marcarCierrePendiente(id: number): Promise<boolean> {
    const { count } = await this.prisma.repartidor.updateMany({
      where: { id, activo: true },
      data: { cierreSolicitado: true },
    });
    return count > 0;
  }

  // Cierre inmediato cuando el repartidor no tiene viajes activos
  async solicitarCierreInmediato(id: number): Promise<boolean> {
    const { count } = await this.prisma.repartidor.updateMany({
      where: {
        id,
        activo: true,
        OR: [{ estado: 'DISPONIBLE' }, { estado: 'EN_PAUSA' }],
      },
      data: {
        estado: 'ESPERANDO_VALIDACION_CIERRE',
        enColaDesde: null,
        cierreSolicitado: true,
      },
    });
    return count > 0;
  }

  // Lista de paquetes asignados que no fueron entregados y tienen reporte de novedad
  async obtenerPaquetesADevolver(repartidorId: number) {
    const envios = await this.prisma.envio.findMany({
      where: {
        repartidorId,
        estado: { not: EstadoEnvio.ENTREGADO },
        eventos: {
          some: {
            tipo: 'NOVEDAD',
          },
        },
      },
      include: {
        comercio: {
          select: { nombre: true, direccion: true },
        },
        eventos: {
          where: { tipo: 'NOVEDAD' },
          orderBy: { creadoEn: 'desc' },
          take: 1,
        },
      },
    });

    return envios.map((envio) => ({
      id: envio.id,
      codigoSeguimiento: envio.codigoSeguimiento,
      destinoDireccion: envio.destinoDireccion,
      comercio: {
        nombre: envio.comercio.nombre,
        direccion: envio.comercio.direccion,
      },
      motivo: envio.eventos[0]?.detalle ?? 'Novedad en ruta',
      estado: envio.estado,
    }));
  }

  // Aprobación de cierre de turno por el operario (G-1)
  async aprobarCierre(id: number): Promise<boolean> {
    const { count } = await this.prisma.repartidor.updateMany({
      where: { id, activo: true },
      data: {
        estado: 'FUERA_DE_JORNADA',
        enColaDesde: null,
        cierreSolicitado: false,
        viajesConsecutivos: 0,
      },
    });
    return count > 0;
  }
}
