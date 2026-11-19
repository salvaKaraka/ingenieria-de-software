import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { EstadoEnvio, TipoVehiculo } from '../../generated/prisma/client';
import { VEHICULOS_DE_MENOR_A_MAYOR } from '../asignacion/domain/vehiculos';
import {
  DETALLE_DEVUELTO_AL_COMERCIO,
  DETALLE_EN_CUSTODIA,
  DETALLE_EN_DEVOLUCION,
} from './domain/deposito';
import { EnviosRepository } from './envios.repository';

// Acceso a datos del circuito de depósito y devoluciones (HU 37-40). Cada cambio de estado
// es condicional (where estado = el esperado) y deja su evento en el historial del envío.
@Injectable()
export class DepositoRepository {
  constructor(
    private readonly prisma: PrismaService,
    // Para liberar al repartidor con las mismas reglas que al terminar una entrega.
    private readonly enviosRepository: EnviosRepository,
  ) {}

  buscarPorCodigo(codigoSeguimiento: string) {
    return this.prisma.envio.findUnique({
      where: { codigoSeguimiento },
      select: {
        id: true,
        codigoSeguimiento: true,
        estado: true,
        repartidorId: true,
        reintentoPendiente: true,
        comercio: { select: { id: true, nombre: true, direccion: true } },
      },
    });
  }

  async estadoDelRepartidor(repartidorId: number) {
    const repartidor = await this.prisma.repartidor.findUnique({
      where: { id: repartidorId },
      select: { estado: true },
    });
    return repartidor?.estado ?? null;
  }

  // HU 37: el paquete pasa a custodia del depósito y deja de estar en manos del repartidor.
  // Devuelve null si el envío cambió mientras tanto.
  registrarReingresoCustodia(
    envioId: number,
    estadoAnterior: EstadoEnvio,
    operarioId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.envio.updateMany({
        where: { id: envioId, estado: estadoAnterior },
        data: {
          estado: 'EN_CUSTODIA',
          repartidorId: null,
          reintentoPendiente: false,
        },
      });
      if (count === 0) return null;

      const evento = await tx.eventoEnvio.create({
        data: {
          envioId,
          tipo: 'DEVOLUCION',
          estadoAnterior,
          estadoNuevo: 'EN_CUSTODIA',
          detalle: DETALLE_EN_CUSTODIA,
          actorTipo: 'OPERARIO',
          actorId: operarioId,
        },
      });
      const operario = await tx.operario.findUnique({
        where: { id: operarioId },
        select: { nombre: true },
      });
      return {
        fechaReingreso: evento.creadoEn,
        operarioNombre: operario?.nombre ?? null,
      };
    });
  }

  // HU 38 y HU 40: paquetes en custodia, con la fecha de su último reingreso.
  listarEnCustodia(comercioId?: number) {
    return this.prisma.envio.findMany({
      where: {
        estado: 'EN_CUSTODIA',
        ...(comercioId !== undefined && { comercioId }),
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        codigoSeguimiento: true,
        destinoDireccion: true,
        tamanio: true,
        comercio: { select: { id: true, nombre: true, direccion: true } },
        eventos: {
          where: { estadoNuevo: 'EN_CUSTODIA' },
          orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { creadoEn: true },
        },
      },
    });
  }

  // Órdenes de devolución para la pestaña Depósito: las que siguen abiertas y las que se
  // confirmaron desde `confirmadasDesde` (las del día), con sus paquetes y la oferta en curso.
  listarOrdenes(confirmadasDesde: Date) {
    return this.prisma.ordenDevolucion.findMany({
      where: {
        OR: [
          { confirmadaEn: null },
          { confirmadaEn: { gte: confirmadasDesde } },
        ],
      },
      orderBy: [{ creadaEn: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        creadaEn: true,
        confirmadaEn: true,
        comercio: { select: { nombre: true, direccion: true } },
        repartidor: { select: { nombre: true, apellido: true } },
        envios: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            codigoSeguimiento: true,
            estado: true,
            ofertas: {
              where: { estado: 'PENDIENTE' },
              select: { repartidor: { select: { nombre: true, apellido: true } } },
            },
          },
        },
      },
    });
  }

  // HU 38: arma la orden con paquetes en custodia de un comercio y los pasa a "En devolución".
  // Devuelve null si alguno ya no está en custodia (otro operario lo incluyó en otra orden).
  crearOrdenDevolucion(
    comercioId: number,
    envioIds: number[],
    operarioId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const envios = await tx.envio.findMany({
        where: { id: { in: envioIds }, comercioId, estado: 'EN_CUSTODIA' },
        select: { id: true, vehiculoRequerido: true },
      });
      if (envios.length !== envioIds.length) return null;

      const orden = await tx.ordenDevolucion.create({
        data: {
          comercioId,
          vehiculoRequerido: vehiculoMasGrande(
            envios.map((envio) => envio.vehiculoRequerido),
          ),
        },
      });
      const { count } = await tx.envio.updateMany({
        where: { id: { in: envioIds }, estado: 'EN_CUSTODIA' },
        data: { estado: 'EN_DEVOLUCION', ordenDevolucionId: orden.id },
      });
      if (count !== envioIds.length) {
        throw new Error('Los paquetes cambiaron mientras se armaba la orden');
      }
      await tx.eventoEnvio.createMany({
        data: envioIds.map((envioId) => ({
          envioId,
          tipo: 'DEVOLUCION' as const,
          estadoAnterior: 'EN_CUSTODIA' as const,
          estadoNuevo: 'EN_DEVOLUCION' as const,
          detalle: DETALLE_EN_DEVOLUCION,
          actorTipo: 'OPERARIO' as const,
          actorId: operarioId,
        })),
      });
      // El motor ofrece la orden a través de su primer paquete (ver AsignacionRepository).
      return { orden, representanteId: Math.min(...envioIds) };
    });
  }

  // HU 39: la orden que el repartidor está llevando al comercio, si tiene una.
  buscarOrdenActivaPorRepartidor(repartidorId: number) {
    return this.prisma.ordenDevolucion.findFirst({
      where: { repartidorId, confirmadaEn: null },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        comercio: {
          select: { nombre: true, direccion: true, telefono: true },
        },
        envios: {
          where: { estado: 'EN_DEVOLUCION' },
          orderBy: { id: 'asc' },
          select: { id: true, codigoSeguimiento: true, tamanio: true },
        },
      },
    });
  }

  // HU 39: el comercio recibió los paquetes. Todos pasan a "Devuelto al comercio" (estado
  // final), la constancia queda en la orden y el repartidor se libera como al entregar.
  confirmarDevolucion(ordenId: number, repartidorId: number, foto: string) {
    return this.prisma.$transaction(async (tx) => {
      const { count: ordenes } = await tx.ordenDevolucion.updateMany({
        where: { id: ordenId, repartidorId, confirmadaEn: null },
        data: { confirmadaEn: new Date(), fotoConstanciaUrl: foto },
      });
      if (ordenes === 0) return false;

      const envios = await tx.envio.findMany({
        where: { ordenDevolucionId: ordenId, estado: 'EN_DEVOLUCION' },
        select: { id: true },
      });
      await tx.envio.updateMany({
        where: { id: { in: envios.map((envio) => envio.id) } },
        data: { estado: 'DEVUELTO_AL_COMERCIO' },
      });
      await tx.eventoEnvio.createMany({
        data: envios.map((envio) => ({
          envioId: envio.id,
          tipo: 'DEVOLUCION' as const,
          estadoAnterior: 'EN_DEVOLUCION' as const,
          estadoNuevo: 'DEVUELTO_AL_COMERCIO' as const,
          detalle: DETALLE_DEVUELTO_AL_COMERCIO,
          actorTipo: 'REPARTIDOR' as const,
          actorId: repartidorId,
        })),
      });

      await this.enviosRepository.liberarRepartidor(tx, repartidorId, {
        viajesConsecutivos: { increment: 1 },
      });
      return true;
    });
  }
}

function vehiculoMasGrande(vehiculos: TipoVehiculo[]): TipoVehiculo {
  return vehiculos.reduce((mayor, vehiculo) =>
    VEHICULOS_DE_MENOR_A_MAYOR.indexOf(vehiculo) >
    VEHICULOS_DE_MENOR_A_MAYOR.indexOf(mayor)
      ? vehiculo
      : mayor,
  );
}
