import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { ComerciosService } from '../comercios/comercios.service';
import { CrearEnvioDto, TamanoPaquete } from './dto/crear-envio.dto';
import { ListarEnviosDto } from './dto/listar-envios.dto';
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
      const codigoSeguimiento = Array.from(
        { length: 10 },
        () => alfabeto[randomInt(alfabeto.length)],
      ).join('');
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
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }
      }
    }

    throw new Error('No se pudo generar un código de seguimiento único');
  }

  async listar(filtros: ListarEnviosDto) {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 20;
    const desde = filtros.desde ? new Date(filtros.desde) : undefined;
    const hasta = filtros.hasta ? this.finDelDia(filtros.hasta) : undefined;

    if (desde && hasta && desde > hasta) {
      throw new BadRequestException('La fecha "desde" es posterior a "hasta"');
    }

    const { datos, total } = await this.enviosRepository.listar({
      estados: filtros.estado,
      comercioId: filtros.comercioId,
      desde,
      hasta,
      q: filtros.q?.trim() || undefined,
      saltar: (pagina - 1) * limite,
      tomar: limite,
    });

    return {
      datos,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  async obtenerDetalle(id: number) {
    const envio = await this.enviosRepository.obtenerDetalle(id);
    if (!envio) {
      throw new NotFoundException('El envío no existe');
    }
    return envio;
  }

  async cancelar(id: number, operarioId: number) {
    const envio = await this.enviosRepository.obtenerEstado(id);
    if (!envio) {
      throw new NotFoundException('El envío no existe');
    }
    if (envio.estado === 'ENTREGADO') {
      throw new ConflictException('No se puede cancelar un envío entregado');
    }
    if (envio.estado === 'CANCELADO') {
      throw new ConflictException('El envío ya está cancelado');
    }

    const cancelado = await this.enviosRepository.cancelar(
      id,
      envio.estado,
      operarioId,
    );
    if (!cancelado) {
      // Cambió de estado mientras lo cancelábamos.
      throw new ConflictException(
        'El envío cambió de estado, intente nuevamente',
      );
    }
    return cancelado;
  }

  // Si "hasta" viene sin hora (2026-10-21), incluye el día completo.
  private finDelDia(fecha: string): Date {
    return fecha.length === 10
      ? new Date(`${fecha}T23:59:59.999Z`)
      : new Date(fecha);
  }
}
