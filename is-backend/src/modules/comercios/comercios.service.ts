import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    return this.comerciosRepository.eliminarLogico(id);
  }
}
