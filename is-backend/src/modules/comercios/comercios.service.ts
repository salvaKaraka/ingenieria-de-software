import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  convertirMedianocheArgentinaAUTC,
  finDelDiaArgentina,
} from '../../common/dia-argentina';
import { ESTADOS_FINALES } from '../envios/domain/estado-envio';
import { ComerciosRepository } from './comercios.repository';
import { CrearComercioDto } from './dto/crear-comercio.dto';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto';

@Injectable()
export class ComerciosService {
  constructor(private readonly comerciosRepository: ComerciosRepository) {}

  async obtenerTodos(q?: string) {
    return this.comerciosRepository.buscarTodos(q);
  }

  async obtenerPorId(id: number) {
    const comercio = await this.comerciosRepository.buscarPorId(id);
    if (!comercio) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }
    return comercio;
  }

  async crear(dto: CrearComercioDto) {
    await this.validarNombreLibre(dto.nombre);
    return this.comerciosRepository.crear(dto);
  }

  async actualizar(id: number, dto: ActualizarComercioDto) {
    await this.obtenerPorId(id); // Valida que exista
    if (dto.nombre !== undefined) {
      await this.validarNombreLibre(dto.nombre, id);
    }
    return this.comerciosRepository.actualizar(id, dto);
  }

  // Sin distinguir mayúsculas: "Panadería Sol" y "panadería sol" son el mismo comercio.
  // idPropio permite que al editar un comercio se guarde su propio nombre sin cambios.
  private async validarNombreLibre(nombre: string, idPropio?: number) {
    const existente = await this.comerciosRepository.buscarPorNombre(nombre);
    if (existente && existente.id !== idPropio) {
      throw new ConflictException('El comercio ya se encuentra registrado');
    }
  }

  async eliminarLogico(id: number) {
    await this.obtenerPorId(id); // Valida que exista
    // Un envío sin terminar todavía depende del comercio (hay que retirarlo, o el motor lo
    // sigue ofreciendo): se termina o se cancela antes de darlo de baja.
    if ((await this.comerciosRepository.contarEnviosEnCurso(id, ESTADOS_FINALES)) > 0) {
      throw new ConflictException('El comercio tiene envíos en curso');
    }
    return this.comerciosRepository.eliminarLogico(id);
  }

  // HU 41: resumen diario por comercio de envíos en cada estado final (entregados, devueltos y cancelados).
  // Los envíos en curso no están en ESTADOS_FINALES y quedan excluidos; si no hubo movimientos, devuelve 0.
  async obtenerResumenDiario(id: number, fecha: string) {
    const comercio = await this.obtenerPorId(id);
    const desde = convertirMedianocheArgentinaAUTC(fecha);
    const hasta = finDelDiaArgentina(fecha);

    const conteos = await this.comerciosRepository.contarFinalizadosPorEstado(
      id,
      desde,
      hasta,
      ESTADOS_FINALES,
    );

    const porEstado = new Map<string, number>(
      conteos.map((item) => [item.estado, item.cantidad]),
    );

    return {
      comercioId: comercio.id,
      comercioNombre: comercio.nombre,
      fecha,
      entregados: porEstado.get('ENTREGADO') ?? 0,
      devueltos: porEstado.get('DEVUELTO_AL_COMERCIO') ?? 0,
      cancelados: porEstado.get('CANCELADO') ?? 0,
    };
  }
}
