import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { ComerciosService } from '../comercios/comercios.service';
import { CrearEnvioDto, TamanoPaquete } from './dto/crear-envio.dto';
import { EnviosRepository } from './envios.repository';

@Injectable()
export class EnviosService {
  constructor(
    private readonly enviosRepository: EnviosRepository,
    private readonly comerciosService: ComerciosService,
  ) {}

  async crear(dto: CrearEnvioDto) {
    const comercio = await this.comerciosService.obtenerPorId(dto.comercioId);
    if (!comercio.activo) {
      throw new BadRequestException('El comercio está dado de baja');
    }

    const vehiculoRequerido =
      dto.tamanio === TamanoPaquete.CHICO
        ? 'MOTO'
        : dto.tamanio === TamanoPaquete.MEDIANO
          ? 'AUTO'
          : 'CAMION';
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    for (let intento = 0; intento < 5; intento++) {
      const codigoSeguimiento = Array.from({ length: 10 }, () => alfabeto[randomInt(alfabeto.length)]).join('');
      try {
        return await this.enviosRepository.crear({
          codigoSeguimiento,
          comercioId: dto.comercioId,
          origenDireccion: dto.origenDireccion ?? comercio.direccion,
          destinoDireccion: dto.destinoDireccion,
          destinatarioNombre: dto.destinatarioNombre,
          destinatarioApellido: dto.destinatarioApellido,
          destinatarioDni: dto.destinatarioDni,
          destinatarioTelefono: dto.destinatarioTelefono,
          tamanio: dto.tamanio,
          vehiculoRequerido,
          observaciones: dto.observaciones,
          requiereFoto: comercio.requiereFoto,
          requiereDni: comercio.requiereDni,
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
      }
    }

    throw new Error('No se pudo generar un código de seguimiento único');
  }
}