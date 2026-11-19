import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AVISO_ASIGNACION_EXCEPCION } from '../asignacion/asignacion.constants';
import type {
  EstadoEnvio,
  EstadoRepartidor,
  Prisma,
  TamanioPaquete,
  TipoVehiculo,
} from '../../generated/prisma/client';
import type { NombresActores } from './domain/historial';
import { AVISO_CANCELACION_REPARTIDOR } from './domain/cancelacion';
import {
  ETIQUETA_MOTIVO_NOVEDAD,
  ReportarNovedadDto,
} from './dto/reportar-novedad.dto';
import { ReintentarEnvioDto } from './dto/reintentar-envio.dto';
import { DETALLE_REINTENTO } from './domain/reintento';
const ESTADOS_VIAJE_ACTIVO: EstadoEnvio[] = [
  'ASIGNADO',
  'EN_CAMINO_A_RETIRAR',
  'RETIRADO',
  'EN_DOMICILIO',
];

// Cuánto tiempo ve el repartidor el aviso de un viaje cancelado (HU 30).
const VIGENCIA_AVISO_CANCELACION_MS = 30 * 60 * 1000;

const ETIQUETA_TAMANIO: Record<TamanioPaquete, string> = {
  CHICO: 'Chico',
  MEDIANO: 'Mediano',
  GRANDE: 'Grande',
};

const ETIQUETA_VEHICULO: Record<TipoVehiculo, string> = {
  MOTO: 'Moto',
  AUTO: 'Auto',
  CAMION: 'Camión',
};

export interface FiltrosListado {
  estados?: EstadoEnvio[];
  comercioId?: number;
  desde?: Date;
  hasta?: Date;
  q?: string;
  orden?: 'registro' | 'actividad';
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
    origenLat?: number;
    origenLon?: number;
    destinoLat?: number;
    destinoLon?: number;
    destinatarioNombre: string;
    destinatarioApellido: string;
    destinatarioDni?: string;
    destinatarioTelefono: string;
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
          origenLat: data.origenLat,
          origenLon: data.origenLon,
          destinoLat: data.destinoLat,
          destinoLon: data.destinoLon,
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
        orderBy:
          filtros.orden === 'actividad'
            ? [{ actualizadoEn: 'desc' }, { id: 'desc' }]
            : [{ creadoEn: 'desc' }, { id: 'desc' }],
        skip: filtros.saltar,
        take: filtros.tomar,
        // La foto pesa cientos de kb y el listado no la muestra: solo sale en el detalle.
        omit: { fotoUrl: true },
        include: {
          comercio: { select: { id: true, nombre: true } },
          repartidor: { select: { id: true, nombre: true, apellido: true } },
          eventos: {
            where: { detalle: AVISO_ASIGNACION_EXCEPCION },
            select: { id: true, detalle: true },
          },
        },
      }),
      this.prisma.envio.count({ where }),
    ]);

    return { datos, total };
  }

  async obtenerDetalle(id: number) {
    // Único lugar que devuelve la foto de la entrega (fotoUrl): la pantalla de detalle la muestra.
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
        // Orden de devolución en la que viaja (HU 38), con los demás paquetes y sus ofertas:
        // la orden se ofrece a través de su primer paquete, pero vale para todos.
        ordenDevolucion: {
          select: {
            id: true,
            creadaEn: true,
            confirmadaEn: true,
            envios: {
              orderBy: { id: 'asc' },
              select: {
                id: true,
                codigoSeguimiento: true,
                ofertas: {
                  orderBy: { creadaEn: 'asc' },
                  include: {
                    repartidor: {
                      select: { id: true, nombre: true, apellido: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // EventoEnvio guarda solo el id del actor (puede ser un operario o un repartidor), así que
  // los nombres para el historial se buscan aparte.
  async buscarNombresActores(
    operarioIds: number[],
    repartidorIds: number[],
  ): Promise<NombresActores> {
    const [operarios, repartidores] = await Promise.all([
      this.prisma.operario.findMany({
        where: { id: { in: operarioIds } },
        select: { id: true, nombre: true },
      }),
      this.prisma.repartidor.findMany({
        where: { id: { in: repartidorIds } },
        select: { id: true, nombre: true, apellido: true },
      }),
    ]);
    return {
      operarios: new Map(operarios.map((o) => [o.id, o.nombre])),
      repartidores: new Map(
        repartidores.map((r) => [r.id, `${r.nombre} ${r.apellido}`]),
      ),
    };
  }

  async obtenerEstado(id: number) {
    return this.prisma.envio.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        // Si alguna vez se retiró, el paquete ya no está en el comercio (HU 30).
        _count: { select: { eventos: { where: { estadoNuevo: 'RETIRADO' } } } },
      },
    });
  }

  async reintentar(
    id: number,
    estadoEsperado: EstadoEnvio,
    dto: ReintentarEnvioDto,
    operarioId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const [referencia] = await tx.$queryRaw<
        { repartidorId: number | null }[]
      >`
        SELECT repartidor_id AS "repartidorId"
        FROM envios
        WHERE id = ${id}`;
      if (!referencia || referencia.repartidorId === null) return null;

      const [repartidor] = await tx.$queryRaw<
        {
          estado: EstadoRepartidor;
          cierreSolicitado: boolean;
        }[]
      >`
        SELECT estado, cierre_solicitado AS "cierreSolicitado"
        FROM repartidores
        WHERE id = ${referencia.repartidorId}
        FOR UPDATE`;
      if (!repartidor) return null;
      // El paquete lo tiene un repartidor que no está trabajando (en pausa, en emergencia o
      // rindiendo la jornada): no se le puede asignar el reintento.
      if (repartidor.estado !== 'DISPONIBLE' && repartidor.estado !== 'OCUPADO') {
        return 'REPARTIDOR_NO_DISPONIBLE' as const;
      }

      const [envio] = await tx.$queryRaw<
        {
          estado: EstadoEnvio;
          repartidorId: number | null;
          destinoDireccion: string;
          destinoLat: number | null;
          destinoLon: number | null;
          reintentoPendiente: boolean;
        }[]
      >`
        SELECT
          estado,
          repartidor_id AS "repartidorId",
          destino_direccion AS "destinoDireccion",
          destino_lat AS "destinoLat",
          destino_lon AS "destinoLon",
          reintento_pendiente AS "reintentoPendiente"
        FROM envios
        WHERE id = ${id}
        FOR UPDATE`;
      if (
        !envio ||
        envio.estado !== estadoEsperado ||
        envio.repartidorId !== referencia.repartidorId ||
        envio.reintentoPendiente
      ) {
        return null;
      }

      const ofertaPendiente = await tx.oferta.findFirst({
        where: {
          repartidorId: referencia.repartidorId,
          estado: 'PENDIENTE',
        },
        select: { id: true },
      });
      if (ofertaPendiente) return null;

      const [viajeEnCurso] = await tx.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM envios
        WHERE repartidor_id = ${referencia.repartidorId}
          AND estado IN ('ASIGNADO', 'EN_CAMINO_A_RETIRAR', 'RETIRADO', 'EN_DOMICILIO')
          AND id <> ${id}
        LIMIT 1`;
      if (repartidor.estado === 'OCUPADO' && !viajeEnCurso) return null;
      if (repartidor.estado === 'DISPONIBLE' && viajeEnCurso) return null;
      if (repartidor.estado === 'DISPONIBLE' && repartidor.cierreSolicitado) {
        return null;
      }
      const asignadoAhora =
        viajeEnCurso === undefined && repartidor.estado === 'DISPONIBLE';
      const direccion = dto.destinoDireccion.trim();
      const cambiaDireccion = direccion !== envio.destinoDireccion;
      const destinoLat =
        dto.destinoLat !== undefined
          ? dto.destinoLat
          : cambiaDireccion
            ? null
            : envio.destinoLat;
      const destinoLon =
        dto.destinoLon !== undefined
          ? dto.destinoLon
          : cambiaDireccion
            ? null
            : envio.destinoLon;

      // HU 70: el paquete sale de nuevo desde donde lo dejó el intento anterior (la vieja
      // dirección de entrega), no desde el comercio. La franja se recalcula con esa ruta.
      await tx.envio.update({
        where: { id },
        data: {
          estado: asignadoAhora ? 'RETIRADO' : 'CON_NOVEDAD',
          reintentoPendiente: !asignadoAhora,
          origenDireccion: envio.destinoDireccion,
          origenLat: envio.destinoLat,
          origenLon: envio.destinoLon,
          destinoDireccion: direccion,
          destinoLat,
          destinoLon,
          duracionEstimadaMin: null,
        },
      });

      if (asignadoAhora) {
        await tx.repartidor.update({
          where: { id: referencia.repartidorId },
          data: { estado: 'OCUPADO', enColaDesde: null },
        });
      }

      await tx.eventoEnvio.create({
        data: {
          envioId: id,
          tipo: 'REASIGNACION',
          estadoAnterior: 'CON_NOVEDAD',
          estadoNuevo: asignadoAhora ? 'RETIRADO' : 'CON_NOVEDAD',
          detalle: DETALLE_REINTENTO,
          actorTipo: 'OPERARIO',
          actorId: operarioId,
        },
      });

      return {
        envioId: id,
        estado: asignadoAhora
          ? ('RETIRADO' as const)
          : ('CON_NOVEDAD' as const),
        repartidorId: referencia.repartidorId,
        asignadoAhora,
      };
    });
  }

  async marcarParaDevolucion(id: number, operarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const [referencia] = await tx.$queryRaw<
        { repartidorId: number | null }[]
      >`
        SELECT repartidor_id AS "repartidorId"
        FROM envios
        WHERE id = ${id}`;
      if (!referencia || referencia.repartidorId === null) return null;

      await tx.$queryRaw`
        SELECT id
        FROM repartidores
        WHERE id = ${referencia.repartidorId}
        FOR UPDATE`;
      const [envio] = await tx.$queryRaw<
        { estado: EstadoEnvio; repartidorId: number | null }[]
      >`
        SELECT estado, repartidor_id AS "repartidorId"
        FROM envios
        WHERE id = ${id}
        FOR UPDATE`;
      if (
        !envio ||
        envio.estado !== 'CON_NOVEDAD' ||
        envio.repartidorId !== referencia.repartidorId
      ) {
        return null;
      }

      await tx.envio.update({
        where: { id },
        data: { estado: 'A_DEVOLVER', reintentoPendiente: false },
      });
      await tx.eventoEnvio.create({
        data: {
          envioId: id,
          tipo: 'CAMBIO_ESTADO',
          estadoAnterior: 'CON_NOVEDAD',
          estadoNuevo: 'A_DEVOLVER',
          detalle: 'Marcado para devolución al comercio',
          actorTipo: 'OPERARIO',
          actorId: operarioId,
        },
      });

      return {
        envioId: id,
        estado: 'A_DEVOLVER' as const,
        repartidorId: referencia.repartidorId,
      };
    });
  }

  async reportarNovedad(
    repartidorId: number,
    dto: ReportarNovedadDto,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const [repartidor] = await tx.$queryRaw<{ estado: EstadoRepartidor }[]>`
        SELECT estado
        FROM repartidores
        WHERE id = ${repartidorId}
        FOR UPDATE`;
      if (repartidor?.estado !== 'OCUPADO') return false;

      const [envio] = await tx.$queryRaw<{ id: number; estado: EstadoEnvio }[]>`
        SELECT id, estado
        FROM envios
        WHERE repartidor_id = ${repartidorId}
          AND estado = 'EN_DOMICILIO'
        ORDER BY id
        LIMIT 1
        FOR UPDATE`;
      if (!envio) return false;

      await tx.envio.update({
        where: { id: envio.id },
        data: { estado: 'CON_NOVEDAD', reintentoPendiente: false },
      });
      const comentario = dto.comentario?.trim();
      await tx.eventoEnvio.create({
        data: {
          envioId: envio.id,
          tipo: 'NOVEDAD',
          estadoAnterior: 'EN_DOMICILIO',
          estadoNuevo: 'CON_NOVEDAD',
          detalle: `${ETIQUETA_MOTIVO_NOVEDAD[dto.motivo]}${comentario ? `: ${comentario}` : ''}`,
          actorTipo: 'REPARTIDOR',
          actorId: repartidorId,
        },
      });

      await this.liberarRepartidor(tx, repartidorId);
      return true;
    });
  }

  // Viaje activo del repartidor (E-2): como mucho hay uno, porque el motor solo le ofrece
  // envíos mientras está DISPONIBLE y al aceptar pasa a OCUPADO.
  async buscarViajeActivoPorRepartidor(repartidorId: number) {
    return this.prisma.envio.findFirst({
      where: {
        repartidorId,
        estado: { in: ESTADOS_VIAJE_ACTIVO },
      },
      omit: { fotoUrl: true },
      include: {
        comercio: { select: { nombre: true, telefono: true } },
        eventos: {
          where: { tipo: 'NOVEDAD' },
          orderBy: { creadoEn: 'desc' },
          take: 1,
        },
      },
    });
  }

  // HU 30: aviso de que le cancelaron el viaje. Se muestra un rato después de la cancelación
  // y hasta que recibe otra oferta: no puede quedar en su pantalla para siempre.
  async buscarAvisoCancelacionPorRepartidor(
    repartidorId: number,
    ahora: Date = new Date(),
  ): Promise<string | null> {
    const evento = await this.prisma.eventoEnvio.findFirst({
      where: {
        tipo: 'CAMBIO_ESTADO',
        estadoNuevo: 'CANCELADO',
        detalle: AVISO_CANCELACION_REPARTIDOR,
        creadoEn: { gte: new Date(ahora.getTime() - VIGENCIA_AVISO_CANCELACION_MS) },
        envio: { repartidorId, estado: 'CANCELADO' },
      },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      select: { detalle: true, creadoEn: true },
    });
    if (!evento) return null;

    const ofertasPosteriores = await this.prisma.oferta.count({
      where: { repartidorId, creadaEn: { gt: evento.creadoEn } },
    });
    return ofertasPosteriores === 0 ? evento.detalle : null;
  }

  // Historial del día del repartidor (HU 34): solo envíos ENTREGADOS cuya entrega fue desde `desde`.
  // La hora de entrega sale del evento que pasó el envío a ENTREGADO.
  async listarEntregadosDelRepartidorDesde(repartidorId: number, desde: Date) {
    return this.prisma.envio.findMany({
      where: {
        repartidorId,
        estado: 'ENTREGADO',
        eventos: {
          some: { estadoNuevo: 'ENTREGADO', creadoEn: { gte: desde } },
        },
      },
      select: {
        id: true,
        codigoSeguimiento: true,
        destinoDireccion: true,
        comercio: { select: { nombre: true } },
        eventos: {
          where: { estadoNuevo: 'ENTREGADO' },
          orderBy: { creadoEn: 'desc' },
          take: 1,
          select: { creadoEn: true },
        },
      },
    });
  }

  async reportarIncidente(
    repartidorId: number,
    ubicacion?: string,
  ): Promise<{ envioId: number; estadoAnterior: EstadoEnvio } | null> {
    return this.prisma.$transaction(async (tx) => {
      const repartidores = await tx.$queryRaw<{ estado: EstadoRepartidor }[]>`
        SELECT estado
        FROM repartidores
        WHERE id = ${repartidorId}
        FOR UPDATE`;
      if (repartidores[0]?.estado !== 'OCUPADO') return null;

      const envios = await tx.$queryRaw<{ id: number; estado: EstadoEnvio }[]>`
        SELECT id, estado
        FROM envios
        WHERE repartidor_id = ${repartidorId}
          AND estado IN ('ASIGNADO', 'EN_CAMINO_A_RETIRAR', 'RETIRADO', 'EN_DOMICILIO')
        ORDER BY id
        LIMIT 1
        FOR UPDATE`;
      const envio = envios[0];
      if (!envio) return null;

      const paqueteRetirado =
        envio.estado === 'RETIRADO' || envio.estado === 'EN_DOMICILIO';
      const ubicacionActual = ubicacion?.trim();
      if (paqueteRetirado && !ubicacionActual) return null;
      await tx.envio.update({
        where: { id: envio.id },
        data: {
          estado: 'INTERRUMPIDO',
          repartidorId: null,
          // La dirección escrita a mano invalida el punto del mapa y la duración ya calculados
          // (HU 70): se vuelven a resolver desde la nueva ubicación.
          ...(paqueteRetirado && {
            origenDireccion: ubicacionActual,
            origenLat: null,
            origenLon: null,
            duracionEstimadaMin: null,
          }),
        },
      });
      await tx.repartidor.update({
        where: { id: repartidorId },
        data: { estado: 'EMERGENCIA', enColaDesde: null },
      });
      await tx.eventoEnvio.create({
        data: {
          envioId: envio.id,
          tipo: 'INCIDENTE',
          estadoAnterior: envio.estado,
          estadoNuevo: 'INTERRUMPIDO',
          detalle: 'Incidente reportado en ruta',
          actorTipo: 'REPARTIDOR',
          actorId: repartidorId,
        },
      });
      return { envioId: envio.id, estadoAnterior: envio.estado };
    });
  }

  async buscarParaActualizar(id: number) {
    return this.prisma.envio.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        tamanio: true,
        vehiculoRequerido: true,
        destinoDireccion: true,
        destinoLat: true,
        destinoLon: true,
        destinatarioNombre: true,
        destinatarioApellido: true,
        destinatarioDni: true,
        destinatarioTelefono: true,
        observaciones: true,
        requiereDni: true,
        repartidorId: true,
      },
    });
  }

  async actualizar(
    id: number,
    estadoEsperado: EstadoEnvio,
    datos: {
      destinoDireccion?: string;
      destinoLat?: number | null;
      destinoLon?: number | null;
      destinatarioNombre?: string;
      destinatarioApellido?: string;
      destinatarioDni?: string | null;
      destinatarioTelefono?: string;
      observaciones?: string | null;
      tamanio?: TamanioPaquete;
      vehiculoRequerido?: TipoVehiculo;
    },
    operarioId: number,
    opciones: {
      cambiaVehiculo: boolean;
      avisoDireccion: boolean;
      detalle: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Bloquear ofertas abiertas si cambia el vehículo para evitar deadlocks y carreras
      const ofertasAbiertas = opciones.cambiaVehiculo
        ? await tx.$queryRaw<
            { id: number; repartidorId: number; creadaEn: Date }[]
          >`
            SELECT id, repartidor_id AS "repartidorId", creada_en AS "creadaEn"
            FROM ofertas
            WHERE envio_id = ${id} AND estado = 'PENDIENTE'
            FOR UPDATE`
        : [];

      // Si se libera a su repartidor, bloquearlo antes del envío mantiene el mismo orden
      // que los reintentos y evita que una entrega concurrente deje un reintento sin asignar.
      if (opciones.cambiaVehiculo) {
        const [referencia] = await tx.$queryRaw<
          { repartidorId: number | null }[]
        >`
          SELECT repartidor_id AS "repartidorId"
          FROM envios
          WHERE id = ${id}`;
        if (referencia?.repartidorId !== null && referencia) {
          await tx.$queryRaw`
            SELECT id
            FROM repartidores
            WHERE id = ${referencia.repartidorId}
            FOR UPDATE`;
        }
      }

      // Después se bloquea el envío. Sin el bloqueo, si el repartidor marcaba "Paquete
      // retirado" entre la lectura y el update, un cambio de tamaño podía reasignar un
      // paquete que ya estaba en la calle.
      const [envioActual] = await tx.$queryRaw<
        { estado: EstadoEnvio; repartidorId: number | null }[]
      >`
        SELECT estado, repartidor_id AS "repartidorId"
        FROM envios
        WHERE id = ${id}
        FOR UPDATE`;
      if (!envioActual || envioActual.estado !== estadoEsperado) {
        return null;
      }

      const repartidorAnteriorId = envioActual.repartidorId;

      const dataUpdate: Prisma.EnvioUpdateInput = {};
      if (datos.destinoDireccion !== undefined)
        dataUpdate.destinoDireccion = datos.destinoDireccion;
      if (datos.destinoLat !== undefined)
        dataUpdate.destinoLat = datos.destinoLat;
      if (datos.destinoLon !== undefined)
        dataUpdate.destinoLon = datos.destinoLon;
      if (datos.destinatarioNombre !== undefined)
        dataUpdate.destinatarioNombre = datos.destinatarioNombre;
      if (datos.destinatarioApellido !== undefined)
        dataUpdate.destinatarioApellido = datos.destinatarioApellido;
      if (datos.destinatarioDni !== undefined)
        dataUpdate.destinatarioDni = datos.destinatarioDni;
      if (datos.destinatarioTelefono !== undefined)
        dataUpdate.destinatarioTelefono = datos.destinatarioTelefono;
      if (datos.observaciones !== undefined)
        dataUpdate.observaciones = datos.observaciones;
      if (datos.tamanio !== undefined) dataUpdate.tamanio = datos.tamanio;
      if (datos.vehiculoRequerido !== undefined)
        dataUpdate.vehiculoRequerido = datos.vehiculoRequerido;

      if (opciones.cambiaVehiculo) {
        dataUpdate.estado = 'PENDIENTE';
        dataUpdate.repartidor = { disconnect: true };
      }

      const envioActualizado = await tx.envio.update({
        where: { id },
        data: dataUpdate,
        omit: { fotoUrl: true },
      });

      // Si cambia el vehículo y había ofertas abiertas, vencerlas y devolver repartidores a la cola
      if (ofertasAbiertas.length > 0) {
        await tx.oferta.updateMany({
          where: { id: { in: ofertasAbiertas.map((o) => o.id) } },
          data: { estado: 'VENCIDA' },
        });
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
      }

      // Si cambia el vehículo y tenía repartidor asignado, queda DISPONIBLE al final de la cola
      if (opciones.cambiaVehiculo && repartidorAnteriorId !== null) {
        await this.liberarRepartidor(tx, repartidorAnteriorId);
      }

      if (opciones.cambiaVehiculo && datos.tamanio && datos.vehiculoRequerido) {
        // Con los nombres que ve el operario, no los del enum (lo lee en el historial).
        const liberado =
          repartidorAnteriorId !== null
            ? ' El repartidor que lo tenía vuelve a la cola.'
            : '';
        await tx.eventoEnvio.create({
          data: {
            envioId: id,
            tipo: 'REASIGNACION',
            estadoAnterior: estadoEsperado,
            estadoNuevo: 'PENDIENTE',
            detalle: `Cambio de tamaño a ${ETIQUETA_TAMANIO[datos.tamanio]}: ahora requiere ${ETIQUETA_VEHICULO[datos.vehiculoRequerido]} y vuelve a Pendiente.${liberado}`,
            actorTipo: 'OPERARIO',
            actorId: operarioId,
          },
        });
      }

      // Si cambia la dirección con repartidor asignado (y no cambió de vehículo)
      if (opciones.avisoDireccion && !opciones.cambiaVehiculo) {
        await tx.eventoEnvio.create({
          data: {
            envioId: id,
            tipo: 'NOVEDAD',
            detalle: 'La dirección de entrega fue modificada',
            actorTipo: 'OPERARIO',
            actorId: operarioId,
          },
        });
      }

      // Registrar modificación en el historial del envío
      await tx.eventoEnvio.create({
        data: {
          envioId: id,
          tipo: 'NOTA',
          detalle: opciones.detalle,
          actorTipo: 'OPERARIO',
          actorId: operarioId,
        },
      });

      return envioActualizado;
    });
  }

  // Avanza el viaje un paso (E-2). Solo si el envío sigue en el estado que leyó el service y
  // sigue siendo de este repartidor: si en el medio el operario lo canceló, no toca nada y
  // devuelve false. Al entregar, el repartidor vuelve al final de la cola en la misma transacción.
  // La foto de la entrega (HU 18) se guarda solo en el envío; el evento lleva el texto de la evidencia.
  async avanzarViaje(
    envioId: number,
    estadoAnterior: EstadoEnvio,
    estadoNuevo: EstadoEnvio,
    repartidorId: number,
    detalle?: string,
    fotoUrl?: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const [repartidor] = await tx.$queryRaw<{ estado: EstadoRepartidor }[]>`
        SELECT estado
        FROM repartidores
        WHERE id = ${repartidorId}
        FOR UPDATE`;
      if (repartidor?.estado !== 'OCUPADO') return false;

      const dataEnvio: Prisma.EnvioUpdateManyMutationInput = {
        estado: estadoNuevo,
      };
      if (fotoUrl !== undefined) {
        dataEnvio.fotoUrl = fotoUrl;
      }

      const { count } = await tx.envio.updateMany({
        where: { id: envioId, estado: estadoAnterior, repartidorId },
        data: dataEnvio,
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
        await this.liberarRepartidor(tx, repartidorId, {
          viajesConsecutivos: { increment: 1 },
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

      const [referencia] = await tx.$queryRaw<
        { repartidorId: number | null }[]
      >`
        SELECT repartidor_id AS "repartidorId"
        FROM envios
        WHERE id = ${id}`;
      if (referencia?.repartidorId !== null && referencia) {
        await tx.$queryRaw`
          SELECT id
          FROM repartidores
          WHERE id = ${referencia.repartidorId}
          FOR UPDATE`;
      }

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
          detalle: AVISO_CANCELACION_REPARTIDOR,
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

      const envio = await tx.envio.findUniqueOrThrow({
        where: { id },
        omit: { fotoUrl: true },
      });
      // Si ya tenía repartidor, el viaje terminó: queda libre y vuelve al final de la cola.
      if (envio.repartidorId !== null) {
        await this.liberarRepartidor(tx, envio.repartidorId);
      }
      return envio;
    });
  }

  async asignarReintentoPendiente(repartidorId: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const [repartidor] = await tx.$queryRaw<{ estado: EstadoRepartidor }[]>`
        SELECT estado
        FROM repartidores
        WHERE id = ${repartidorId}
        FOR UPDATE`;
      if (repartidor?.estado !== 'DISPONIBLE') return false;

      const ofertaPendiente = await tx.oferta.findFirst({
        where: { repartidorId, estado: 'PENDIENTE' },
        select: { id: true },
      });
      if (ofertaPendiente) return false;

      const [envio] = await tx.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM envios
        WHERE repartidor_id = ${repartidorId}
          AND estado = 'CON_NOVEDAD'
          AND reintento_pendiente = true
        ORDER BY actualizado_en, id
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      if (!envio) return false;

      const { count } = await tx.envio.updateMany({
        where: {
          id: envio.id,
          repartidorId,
          estado: 'CON_NOVEDAD',
          reintentoPendiente: true,
        },
        data: { estado: 'RETIRADO', reintentoPendiente: false },
      });
      if (count === 0) return false;

      await tx.repartidor.updateMany({
        where: { id: repartidorId, estado: 'DISPONIBLE' },
        data: { estado: 'OCUPADO', enColaDesde: null },
      });
      await tx.eventoEnvio.create({
        data: {
          envioId: envio.id,
          tipo: 'REASIGNACION',
          estadoAnterior: 'CON_NOVEDAD',
          estadoNuevo: 'RETIRADO',
          detalle: DETALLE_REINTENTO,
          actorTipo: 'SISTEMA',
        },
      });
      return true;
    });
  }

  // Envíos del panel del día (HU4): todos los que no están en un estado final. Se excluye
  // por estados finales (y no con una lista de estados activos) para que un estado nuevo
  // del enum aparezca en el panel sin tocar esta consulta.
  async obtenerPanelEnvios(estadosFinales: readonly EstadoEnvio[]) {
    return this.prisma.envio.findMany({
      where: { estado: { notIn: [...estadosFinales] } },
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
      // Solo lo que muestra la tarjeta: el DNI y el teléfono del destinatario no viajan.
      select: {
        id: true,
        codigoSeguimiento: true,
        estado: true,
        destinoDireccion: true,
        destinatarioNombre: true,
        destinatarioApellido: true,
        tamanio: true,
        comercio: { select: { nombre: true } },
        repartidor: { select: { nombre: true, apellido: true } },
        // El aviso de asignación por excepción (HU 10) y las novedades que reportó el
        // repartidor (HU 23), para mostrar el motivo en la tarjeta del envío con novedad.
        eventos: {
          where: {
            OR: [
              { detalle: AVISO_ASIGNACION_EXCEPCION },
              { tipo: 'NOVEDAD', actorTipo: 'REPARTIDOR' },
            ],
          },
          orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
          select: { id: true, tipo: true, detalle: true },
        },
      },
    });
  }

  // El repartidor terminó su viaje, o se lo sacaron (cancelación o cambio de vehículo). Si
  // había pedido cerrar la jornada (G-1), pasa a esperar la validación del operario en vez
  // de volver a la cola, así no le llegan más ofertas. Público para que el depósito lo use
  // al confirmar una devolución (HU 39) dentro de su propia transacción.
  async liberarRepartidor(
    tx: Prisma.TransactionClient,
    repartidorId: number,
    extra: Prisma.RepartidorUpdateManyMutationInput = {},
  ) {
    const [repartidor] = await tx.$queryRaw<
      { estado: EstadoRepartidor; cierreSolicitado: boolean }[]
    >`
      SELECT estado, cierre_solicitado AS "cierreSolicitado"
      FROM repartidores
      WHERE id = ${repartidorId}
      FOR UPDATE`;
    if (repartidor?.estado !== 'OCUPADO') return;

    const [reintentoPendiente] = await tx.$queryRaw<{ id: number }[]>`
      SELECT id
      FROM envios
      WHERE repartidor_id = ${repartidorId}
        AND estado = 'CON_NOVEDAD'
        AND reintento_pendiente = true
      ORDER BY actualizado_en, id
      LIMIT 1
      FOR UPDATE`;
    if (reintentoPendiente) {
      const { count } = await tx.envio.updateMany({
        where: {
          id: reintentoPendiente.id,
          repartidorId,
          estado: 'CON_NOVEDAD',
          reintentoPendiente: true,
        },
        data: { estado: 'RETIRADO', reintentoPendiente: false },
      });
      if (count === 0) return;

      await tx.eventoEnvio.create({
        data: {
          envioId: reintentoPendiente.id,
          tipo: 'REASIGNACION',
          estadoAnterior: 'CON_NOVEDAD',
          estadoNuevo: 'RETIRADO',
          detalle: DETALLE_REINTENTO,
          actorTipo: 'SISTEMA',
        },
      });
      await tx.repartidor.update({
        where: { id: repartidorId },
        data: { estado: 'OCUPADO', enColaDesde: null, ...extra },
      });
      return;
    }

    if (repartidor.cierreSolicitado) {
      await tx.repartidor.update({
        where: { id: repartidorId },
        data: {
          estado: 'ESPERANDO_VALIDACION_CIERRE',
          enColaDesde: null,
          ...extra,
        },
      });
      return;
    }

    await tx.repartidor.update({
      where: { id: repartidorId },
      data: { estado: 'DISPONIBLE', enColaDesde: new Date(), ...extra },
    });
  }
}
