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
  vehiculoRequerido: TipoVehiculo;
};
type RepartidorBloqueado = {
  id: number;
  nombre: string;
  apellido: string;
  activo: boolean;
  estado: EstadoRepartidor;
  vehiculo: TipoVehiculo;
};

// Acceso a datos del panel de excepciones (HU 12 y HU 22).
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

  buscarEnvio(envioId: number) {
    return this.prisma.envio.findUnique({
      where: { id: envioId },
      select: { id: true, vehiculoRequerido: true },
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
      SELECT id, estado, vehiculo_requerido AS "vehiculoRequerido"
      FROM envios
      WHERE id = ${envioId}
      FOR UPDATE`;
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
