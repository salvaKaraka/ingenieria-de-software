import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
}
