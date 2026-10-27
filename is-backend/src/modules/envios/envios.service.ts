import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type EstadoEnvio,
  type TamanioPaquete,
  type TipoVehiculo,
} from '../../generated/prisma/client';
import { AsignacionService } from '../asignacion/asignacion.service';
import { ComerciosService } from '../comercios/comercios.service';
import { generarCodigoSeguimiento } from './codigo-seguimiento.util';
import { esTransicionValida } from './domain/estado-envio';
import { armarHistorial } from './domain/historial';
import { ActualizarEnvioDto } from './dto/actualizar-envio.dto';
import { CrearEnvioDto } from './dto/crear-envio.dto';
import { ListarEnviosDto } from './dto/listar-envios.dto';
import { EnviosRepository } from './envios.repository';

// Vehículo MÍNIMO según el tamaño (supuesto 8): el motor después acepta uno más grande.
const VEHICULO_MINIMO: Record<TamanioPaquete, TipoVehiculo> = {
  CHICO: 'MOTO',
  MEDIANO: 'AUTO',
  GRANDE: 'CAMION',
};

// Cómo se nombra cada dato en el historial cuando el operario lo modifica (HU 31).
const ETIQUETA_CAMPO: Record<keyof ActualizarEnvioDto, string> = {
  destinoDireccion: 'dirección de entrega',
  destinatarioNombre: 'nombre del destinatario',
  destinatarioApellido: 'apellido del destinatario',
  destinatarioDni: 'DNI del destinatario',
  destinatarioTelefono: 'teléfono del destinatario',
  tamanio: 'tamaño',
  observaciones: 'observaciones',
};

@Injectable()
export class EnviosService {
  private readonly logger = new Logger(EnviosService.name);

  constructor(
    private readonly enviosRepository: EnviosRepository,
    private readonly comerciosService: ComerciosService,
    private readonly asignacion: AsignacionService,
  ) {}

  async crear(dto: CrearEnvioDto, operarioId: number) {
    // Si no existe, obtenerPorId ya responde 404.
    const comercio = await this.comerciosService.obtenerPorId(dto.comercioId);
    if (!comercio.activo) {
      throw new BadRequestException('El comercio está dado de baja');
    }
    // Al entregar, el repartidor compara contra este DNI (E-4): sin él no habría cómo verificar.
    if (comercio.requiereDni && !dto.destinatarioDni) {
      throw new BadRequestException(
        'Este comercio exige DNI al entregar: cargá el DNI del destinatario',
      );
    }

    const envio = await this.guardarConCodigoUnico(dto, operarioId, {
      origenDireccion: dto.origenDireccion ?? comercio.direccion,
      requiereFoto: comercio.requiereFoto,
      requiereDni: comercio.requiereDni,
    });

    // El envío ya quedó guardado: si el motor falla, no se le responde error al operario
    // (reintentaría y lo duplicaría). El job de vencimientos lo vuelve a intentar en segundos.
    try {
      await this.asignacion.asignar(envio.id);
    } catch (error) {
      this.logger.error(`No se pudo asignar el envío ${envio.id}`, error);
    }
    return envio;
  }

  private async guardarConCodigoUnico(
    dto: CrearEnvioDto,
    operarioId: number,
    delComercio: {
      origenDireccion: string;
      requiereFoto: boolean;
      requiereDni: boolean;
    },
  ) {
    for (let intento = 0; intento < 5; intento++) {
      try {
        return await this.enviosRepository.crear({
          codigoSeguimiento: generarCodigoSeguimiento(),
          operarioId,
          comercioId: dto.comercioId,
          origenDireccion: delComercio.origenDireccion,
          destinoDireccion: dto.destinoDireccion,
          destinatarioNombre: dto.destinatarioNombre,
          destinatarioApellido: dto.destinatarioApellido,
          destinatarioDni: dto.destinatarioDni,
          destinatarioTelefono: dto.destinatarioTelefono,
          tamanio: dto.tamanio,
          vehiculoRequerido: VEHICULO_MINIMO[dto.tamanio],
          observaciones: dto.observaciones,
          requiereFoto: delComercio.requiereFoto,
          requiereDni: delComercio.requiereDni,
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

    throw new InternalServerErrorException(
      'No se pudo generar un código de seguimiento único',
    );
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
      totalPaginas: Math.ceil(total / limite) || 0,
    };
  }

  async obtenerDetalle(id: number) {
    const envio = await this.enviosRepository.obtenerDetalle(id);
    if (!envio) {
      throw new NotFoundException('El envío no existe');
    }

    const idsDe = (tipo: 'OPERARIO' | 'REPARTIDOR') => [
      ...new Set(
        envio.eventos
          .filter((e) => e.actorTipo === tipo && e.actorId !== null)
          .map((e) => e.actorId as number),
      ),
    ];
    const nombres = await this.enviosRepository.buscarNombresActores(
      idsDe('OPERARIO'),
      idsDe('REPARTIDOR'),
    );
    return {
      ...envio,
      historial: armarHistorial(envio.eventos, envio.ofertas, nombres),
    };
  }

  async cancelar(id: number, operarioId: number) {
    const envio = await this.enviosRepository.obtenerEstado(id);
    if (!envio) {
      throw new NotFoundException('El envío no existe');
    }

    if (!esTransicionValida(envio.estado, 'CANCELADO', 'OPERARIO')) {
      throw new ConflictException(
        envio.estado === 'CANCELADO'
          ? 'El envío ya está cancelado'
          : 'No se puede cancelar un envío entregado',
      );
    }

    const cancelado = await this.enviosRepository.cancelar(
      id,
      envio.estado,
      operarioId,
    );

    if (!cancelado) {
      throw new ConflictException(
        'El envío cambió de estado, intente nuevamente',
      );
    }

    // La cancelación puede haber liberado repartidores (el del viaje o el de una oferta
    // abierta): que el motor les ofrezca los envíos que esperan.
    await this.asignacion.reintentarPendientes();
    return cancelado;
  }

  async actualizar(id: number, dto: ActualizarEnvioDto, operarioId: number) {
    const envio = await this.enviosRepository.buscarParaActualizar(id);
    if (!envio) {
      throw new NotFoundException('El envío no existe');
    }

    const estadosModificables: EstadoEnvio[] = [
      'PENDIENTE',
      'ASIGNADO',
      'EN_CAMINO_A_RETIRAR',
    ];

    if (!estadosModificables.includes(envio.estado)) {
      throw new ConflictException(
        'No se puede modificar: el paquete ya fue retirado',
      );
    }

    // Solo lo que de verdad cambia: así el historial dice qué se modificó y un "Guardar"
    // sin cambios no deja rastro.
    const cambios = Object.fromEntries(
      Object.entries(dto).filter(
        ([campo, valor]) =>
          valor !== undefined && valor !== envio[campo as keyof typeof dto],
      ),
    ) as Pick<ActualizarEnvioDto, keyof ActualizarEnvioDto>;
    const camposCambiados = Object.keys(
      cambios,
    ) as (keyof ActualizarEnvioDto)[];
    if (camposCambiados.length === 0) return envio;

    // Al entregar, el repartidor compara contra este DNI (E-4): si el comercio lo exige, no se borra.
    if (cambios.destinatarioDni === null && envio.requiereDni) {
      throw new BadRequestException(
        'Este comercio exige DNI al entregar: no se puede borrar el DNI del destinatario',
      );
    }

    const nuevoVehiculo = cambios.tamanio
      ? VEHICULO_MINIMO[cambios.tamanio]
      : undefined;
    const cambiaVehiculo =
      nuevoVehiculo !== undefined && nuevoVehiculo !== envio.vehiculoRequerido;

    const avisoDireccion =
      cambios.destinoDireccion !== undefined && envio.repartidorId !== null;

    const actualizado = await this.enviosRepository.actualizar(
      id,
      envio.estado,
      {
        ...cambios,
        ...(cambiaVehiculo ? { vehiculoRequerido: nuevoVehiculo } : {}),
      },
      operarioId,
      {
        cambiaVehiculo,
        avisoDireccion,
        // Sin los valores: el historial no tiene por qué mostrar el DNI.
        detalle: `Datos modificados: ${camposCambiados.map((campo) => ETIQUETA_CAMPO[campo]).join(', ')}`,
      },
    );

    // Otro proceso lo cambió entre la lectura y la transacción (p. ej. el repartidor aceptó
    // la oferta o retiró el paquete): los datos calculados arriba ya no valen.
    if (!actualizado) {
      throw new ConflictException(
        'El envío cambió de estado, intente nuevamente',
      );
    }

    if (cambiaVehiculo) {
      // Si cambia el vehículo requerido, el envío vuelve a PENDIENTE y se ofrece a la cola del nuevo vehículo.
      try {
        await this.asignacion.asignar(envio.id);
      } catch (error) {
        this.logger.error(
          `No se pudo asignar el envío reencolado ${envio.id}`,
          error,
        );
      }
      // Reintentar pendientes para el repartidor que quedó disponible.
      try {
        await this.asignacion.reintentarPendientes();
      } catch (error) {
        this.logger.error(
          'No se pudo reintentar pendientes tras liberar repartidor',
          error,
        );
      }
    }

    return actualizado;
  }

  private finDelDia(fecha: string): Date {
    return fecha.length === 10
      ? new Date(`${fecha}T23:59:59.999Z`)
      : new Date(fecha);
  }
}
