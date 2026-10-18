import { Injectable, NotFoundException } from '@nestjs/common';
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
    if (!comercio || !comercio.activo) {
      throw new NotFoundException(`Comercio con ID ${id} no encontrado`);
    }
    return comercio;
  }

  async crear(dto: CrearComercioDto) {
    return this.comerciosRepository.crear(dto);
  }

  async actualizar(id: number, dto: ActualizarComercioDto) {
    await this.obtenerPorId(id); // Valida que exista
    return this.comerciosRepository.actualizar(id, dto);
  }

  async eliminarLogico(id: number) {
    await this.obtenerPorId(id); // Valida que exista
    return this.comerciosRepository.eliminarLogico(id);
  }
}