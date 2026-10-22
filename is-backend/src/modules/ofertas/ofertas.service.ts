import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OfertasService {
  constructor(private prisma: PrismaService) {}

  async responderOferta(ofertaId: number, repartidorId: number, aceptar: boolean) {
    // 1. Buscar la oferta y verificar que pertenezca al repartidor y esté pendiente
    const oferta = await this.prisma.oferta.findUnique({
      where: { id: ofertaId },
      include: { envio: true },
    });

    if (!oferta) {
      throw new NotFoundException('La oferta no fue encontrada.');
    }

    if (oferta.repartidorId !== repartidorId) {
      throw new ConflictException('Esta oferta no pertenece al repartidor autenticado.');
    }

    if (oferta.estado !== 'PENDIENTE') {
      throw new ConflictException(`La oferta ya fue ${oferta.estado.toLowerCase()}.`);
    }

    // Verificar si expiró (por ejemplo, pasaron más de 5 minutos)
    if (new Date() > oferta.expiraEn) {
      await this.prisma.oferta.update({
        where: { id: ofertaId },
        data: { estado: 'VENCIDA' },
      });
      throw new ConflictException('La oferta ha expirado.');
    }

    const nuevoEstadoOferta = aceptar ? 'ACEPTADA' : 'RECHAZADA';

    // Transacción para actualizar oferta y estado del envío/repartidor según corresponda
    return this.prisma.$transaction(async (tx) => {
      // Actualizar estado de la oferta
      const ofertaActualizada = await tx.oferta.update({
        where: { id: ofertaId },
        data: {
          estado: nuevoEstadoOferta,
          respondidaEn: new Date(),
        },
      });

      if (aceptar) {
        // Asignar el envío al repartidor y cambiar su estado a OCUPADO
        await tx.envio.update({
          where: { id: oferta.envioId },
          data: {
            repartidorId: repartidorId,
            estado: 'ASIGNADO',
          },
        });

        await tx.repartidor.update({
          where: { id: repartidorId },
          data: {
            estado: 'OCUPADO',
            enColaDesde: null, // Sale de la cola FIFO al aceptar viaje
          },
        });
      }

      return {
        mensaje: aceptar ? 'Oferta aceptada con éxito. Viaje asignado.' : 'Oferta rechazada.',
        oferta: ofertaActualizada,
      };
    });
  }

  async obtenerOfertasPendientes(repartidorId: number) {
    return this.prisma.oferta.findMany({
      where: {
        repartidorId,
        estado: 'PENDIENTE',
        expiraEn: { gt: new Date() }, // Filtrar las que aún no vencieron
      },
      include: { envio: true },
    });
  }
}