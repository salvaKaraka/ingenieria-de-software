import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CrearComercioDto } from './dto/crear-comercio.dto';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto';

@Injectable()
export class ComerciosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarTodos(q?: string) {
    return this.prisma.comercio.findMany({
      where: {
        activo: true, // Solo mostrar comercios activos
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { id: 'desc' },
    });
  }

  async buscarPorId(id: number) {
    return this.prisma.comercio.findUnique({
      where: { id },
    });
  }

  async crear(data: CrearComercioDto) {
    return this.prisma.comercio.create({
      data: {
        ...data,
        activo: true,
      },
    });
  }

  async actualizar(id: number, data: ActualizarComercioDto) {
    return this.prisma.comercio.update({
      where: { id },
      data,
    });
  }

  // 💥 BAJA LÓGICA (NO BORRAR REGISTRO DE BD)
  async eliminarLogico(id: number) {
    return this.prisma.comercio.update({
      where: { id },
      data: { activo: false }, // 👈 Cambia el estado a inactivo
    });
  }
}