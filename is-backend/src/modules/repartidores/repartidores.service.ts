import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { TipoVehiculo } from '../../generated/prisma/client';

@Injectable()
export class RepartidoresService {
  constructor(private prisma: PrismaService) {}

  async obtenerTodos() {
    return this.prisma.repartidor.findMany();
  }

  async crearRepartidor(data: {
    nombre: string;
    apellido: string;
    telefono: string;
    email: string;
    direccion: string;
    vehiculo: TipoVehiculo;
  }) {
    const pinGenerado = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Aquí guardaremos con Prisma y el HMAC del PIN más adelante
    const repartidor = await this.prisma.repartidor.create({
      data: {
        ...data,
        pinHmac: pinGenerado, // Provisional para pruebas
      },
    });

    return {
      mensaje: 'Repartidor creado con éxito',
      pin: pinGenerado, // Se muestra una sola vez por C-1
      repartidor,
    };
  }

  async cambiarEstadoJornada(repartidorId: number, nuevoEstado: 'DISPONIBLE' | 'EN_PAUSA' | 'FUERA_DE_JORNADA') {
    const repartidor = await this.prisma.repartidor.findUnique({
      where: { id: repartidorId },
    });

    if (!repartidor) {
      throw new NotFoundException('Repartidor no encontrado');
    }

    // Validaciones de negocio y transiciones válidas (C-3)
    if (repartidor.estado === 'FUERA_DE_JORNADA' && nuevoEstado === 'EN_PAUSA') {
      throw new ConflictException('No se puede pausar un repartidor que está fuera de jornada.');
    }

    if (nuevoEstado === 'FUERA_DE_JORNADA') {
      // Validar si tiene viaje activo antes de terminar la jornada
      const envioActivo = await this.prisma.envio.findFirst({
        where: {
          repartidorId,
          estado: { notIn: ['ENTREGADO', 'CANCELADO'] },
        },
      });
      if (envioActivo) {
        throw new ConflictException('No se puede finalizar la jornada con un viaje activo.');
      }
    }

    // Definir lógica de la cola FIFO (enColaDesde)
    let enColaDesde: Date | null = repartidor.enColaDesde;
    if (nuevoEstado === 'DISPONIBLE') {
      // Si entra a disponible y no estaba en cola, marca el momento exacto para el FIFO
      if (!enColaDesde || repartidor.estado === 'FUERA_DE_JORNADA' || repartidor.estado === 'EN_PAUSA') {
        enColaDesde = new Date();
      }
    } else {
      // Si se pausas o sale de jornada, sale de la cola FIFO
      enColaDesde = null;
    }

    return this.prisma.repartidor.update({
      where: { id: repartidorId },
      data: {
        estado: nuevoEstado,
        enColaDesde,
      },
    });
  }

  async obtenerFlotaOperario() {
    // Retorna los repartidores ordenados por tipo de vehículo y criterio FIFO (enColaDesde)
    return this.prisma.repartidor.findMany({
      orderBy: [
        { vehiculo: 'asc' },
        { enColaDesde: 'asc' },
      ],
    });
  }

  async actualizarRepartidor(id: number, data: any) {
    return this.prisma.repartidor.update({
      where: { id },
      data,
    });
  }

  async bajaLogica(id: number) {
    // C-1: Verificar si tiene un viaje activo
    const envioActivo = await this.prisma.envio.findFirst({
      where: {
        repartidorId: id,
        estado: { not: 'ENTREGADO' }, // Ajustar según estados activos
      },
    });

    if (envioActivo) {
      throw new ConflictException('No se puede dar de baja al repartidor porque tiene un viaje activo.');
    }

    return this.prisma.repartidor.update({
      where: { id },
      data: { activo: false },
    });
  }

  async resetearPin(id: number) {
    const nuevoPin = Math.floor(1000 + Math.random() * 9000).toString();
    return {
      mensaje: 'PIN blanqueado con éxito',
      pin: nuevoPin,
    };
  }
}