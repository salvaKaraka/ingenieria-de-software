import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  EstadoEnvio,
  EstadoRepartidor,
  Prisma,
  TipoVehiculo,
} from '../../generated/prisma/client';
import { vehiculosQuePuedenLlevar } from '../asignacion/domain/vehiculos';
import { ESTADOS_ASIGNABLES } from './domain/excepciones';

type Tx = Prisma.TransactionClient;

type EnvioBloqueado = {
  id: number;
  estado: EstadoEnvio;
  // En una orden de devolución, el de la orden (HU 38).
  vehiculoRequerido: TipoVehiculo;
  ordenDevolucionId: number | null;
  ordenTieneRepartidor: boolean;
  esRepresentanteDeLaOrden: boolean;
};
type RepartidorBloqueado = {
  id: number;
  nombre: string;
  apellido: string;
  activo: boolean;
  estado: EstadoRepartidor;
  vehiculo: TipoVehiculo;
};

// Acceso a datos del panel de excepciones (HU 12, HU 20/21 y HU 22).
// No modifica el motor (asignacion/): la asignación manual crea la oferta por su cuenta,
// con los mismos bloqueos de fila que usa el motor para no pisarse con el job de reintentos.
@Injectable()
export class ExcepcionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaccion<T>(trabajo: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(trabajo);
  }

  // Envíos que quedaron sin repartidor tras un vencimiento de oferta (HU 12, escenario 2):
  // siguen PENDIENTE, no tienen oferta vigente y al menos una oferta les venció.
  // El motor los sigue reintentando solo cada 10 s; si consigue repartidor, salen del panel.
  listarSinRepartidor() {
    return this.prisma.envio.findMany({
      where: {
        estado: 'PENDIENTE',
        ofertas: {
          none: { estado: 'PENDIENTE' },
          some: { estado: 'VENCIDA' },
        },
      },
      select: {
        id: true,
        codigoSeguimiento: true,
        origenDireccion: true,
        destinoDireccion: true,
        tamanio: true,
        vehiculoRequerido: true,
        estado: true,
        comercio: { select: { nombre: true } },
        _count: { select: { eventos: { where: { estadoNuevo: 'RETIRADO' } } } },
        // La PRIMERA oferta que venció: desde ahí espera el envío. Si se tomara la última,
        // cada asignación manual que vence lo haría "rejuvenecer" y bajar en el panel.
        ofertas: {
          where: { estado: 'VENCIDA' },
          orderBy: [{ expiraEn: 'asc' }, { id: 'asc' }],
          take: 1,
          select: { expiraEn: true },
        },
      },
    });
  }

  listarIncidentesActivos() {
    return this.prisma.envio.findMany({
      where: {
        estado: {
          in: [
            'PENDIENTE',
            'INTERRUMPIDO',
            'ASIGNADO',
            'EN_CAMINO_A_RETIRAR',
            'RETIRADO',
            'EN_DOMICILIO',
            'PARADO',
          ],
        },
        eventos: { some: { tipo: 'INCIDENTE' } },
      },
      orderBy: [{ actualizadoEn: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        codigoSeguimiento: true,
        origenDireccion: true,
        destinoDireccion: true,
        tamanio: true,
        vehiculoRequerido: true,
        estado: true,
        comercio: { select: { nombre: true } },
        _count: { select: { eventos: { where: { estadoNuevo: 'RETIRADO' } } } },
        eventos: {
          where: { tipo: 'INCIDENTE' },
          orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { creadoEn: true, detalle: true },
        },
        ofertas: {
          where: { estado: 'PENDIENTE' },
          take: 1,
          select: { id: true },
        },
      },
    });
  }

  async buscarEnvio(envioId: number) {
    const envio = await this.prisma.envio.findUnique({
      where: { id: envioId },
      select: {
        id: true,
        vehiculoRequerido: true,
        ordenDevolucion: { select: { vehiculoRequerido: true } },
      },
    });
    // Una orden de devolución pide el vehículo de su paquete más grande (HU 38).
    return envio
      ? {
          id: envio.id,
          vehiculoRequerido:
            envio.ordenDevolucion?.vehiculoRequerido ?? envio.vehiculoRequerido,
        }
      : null;
  }

  // Órdenes de devolución que todavía nadie lleva y no tienen una oferta en curso (HU 38).
  // El motor las sigue reintentando; desde el panel el operario puede asignarlas a mano.
  listarDevolucionesSinRepartidor() {
    return this.prisma.ordenDevolucion.findMany({
      where: { repartidorId: null, confirmadaEn: null },
      select: {
        id: true,
        creadaEn: true,
        vehiculoRequerido: true,
        comercio: { select: { nombre: true, direccion: true } },
        envios: {
          where: { estado: 'EN_DEVOLUCION' },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            codigoSeguimiento: true,
            tamanio: true,
            ofertas: { where: { estado: 'PENDIENTE' }, select: { id: true } },
          },
        },
      },
    });
  }

  // Lista para elegir en la asignación manual. Sin orden de cola ni límite de viajes (HU 22, escenario 5).
  listarRepartidoresAsignables(vehiculoRequerido: TipoVehiculo) {
    return this.prisma.repartidor.findMany({
      where: {
        activo: true,
        estado: { in: ESTADOS_ASIGNABLES },
        vehiculo: { in: vehiculosQuePuedenLlevar(vehiculoRequerido) },
        ofertas: { none: { estado: 'PENDIENTE' } },
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        apellido: true,
        vehiculo: true,
        estado: true,
        viajesConsecutivos: true,
      },
    });
  }

  // Bloquea el envío hasta el final de la transacción (igual que el motor).
  async bloquearEnvio(tx: Tx, envioId: number): Promise<EnvioBloqueado | null> {
    const filas = await tx.$queryRaw<EnvioBloqueado[]>`
      SELECT e.id, e.estado,
        COALESCE(o.vehiculo_requerido, e.vehiculo_requerido) AS "vehiculoRequerido",
        e.orden_devolucion_id AS "ordenDevolucionId",
        (o.repartidor_id IS NOT NULL) AS "ordenTieneRepartidor",
        (e.id = (SELECT MIN(id) FROM envios WHERE orden_devolucion_id = e.orden_devolucion_id))
          AS "esRepresentanteDeLaOrden"
      FROM envios e
      LEFT JOIN ordenes_devolucion o ON o.id = e.orden_devolucion_id
      WHERE e.id = ${envioId}
      FOR UPDATE OF e`;
    return filas[0] ?? null;
  }

  // Bloquea al repartidor: si el motor lo está eligiendo al mismo tiempo, uno de los dos espera.
  async bloquearRepartidor(
    tx: Tx,
    repartidorId: number,
  ): Promise<RepartidorBloqueado | null> {
    const filas = await tx.$queryRaw<RepartidorBloqueado[]>`
      SELECT id, nombre, apellido, activo, estado, vehiculo
      FROM repartidores
      WHERE id = ${repartidorId}
      FOR UPDATE`;
    return filas[0] ?? null;
  }

  async envioTieneOfertaVigente(tx: Tx, envioId: number) {
    return (
      (await tx.oferta.count({ where: { envioId, estado: 'PENDIENTE' } })) > 0
    );
  }

  async reactivarEnvioParado(
    tx: Tx,
    envioId: number,
    operarioId: number,
  ): Promise<boolean> {
    const { count } = await tx.envio.updateMany({
      where: { id: envioId, estado: 'PARADO' },
      data: { estado: 'PENDIENTE' },
    });
    if (count === 0) return false;

    await tx.eventoEnvio.create({
      data: {
        envioId,
        tipo: 'REASIGNACION',
        estadoAnterior: 'PARADO',
        estadoNuevo: 'PENDIENTE',
        detalle: 'Envío reactivado para asignación manual',
        actorTipo: 'OPERARIO',
        actorId: operarioId,
      },
    });
    return true;
  }

  async repartidorTieneOfertaVigente(tx: Tx, repartidorId: number) {
    return (
      (await tx.oferta.count({
        where: { repartidorId, estado: 'PENDIENTE' },
      })) > 0
    );
  }

  // Igual que el motor: crea la oferta y saca al repartidor de la cola. Además deja
  // registrado en el historial del envío que fue una asignación manual del operario.
  async ofrecerManual(
    tx: Tx,
    envioId: number,
    repartidorId: number,
    expiraEn: Date,
    operarioId: number,
    detalle: string,
  ) {
    await tx.repartidor.update({
      where: { id: repartidorId },
      data: { enColaDesde: null },
    });
    const oferta = await tx.oferta.create({
      data: { envioId, repartidorId, expiraEn },
    });
    await tx.eventoEnvio.create({
      data: {
        envioId,
        tipo: 'NOTA',
        detalle,
        actorTipo: 'OPERARIO',
        actorId: operarioId,
      },
    });
    return oferta;
  }
}
