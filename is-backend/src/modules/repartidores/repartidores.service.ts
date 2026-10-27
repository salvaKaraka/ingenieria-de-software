import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolUsuario } from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import {
  type ActualizarRepartidorDto,
  type CrearRepartidorDto,
  type FiltroRepartidoresDto,
} from './dto';
import {
  RepartidoresRepository,
  type RepartidorPublico,
} from './repartidores.repository';

export type RepartidorConPin = RepartidorPublico & { pin: string };

@Injectable()
export class RepartidoresService {
  constructor(
    private readonly repo: RepartidoresRepository,
    private readonly authService: AuthService,
  ) {}

  listar(filtros?: FiltroRepartidoresDto): Promise<RepartidorPublico[]> {
    return this.repo.listar(filtros);
  }

  async buscarPorId(id: number): Promise<RepartidorPublico> {
    const repartidor = await this.repo.buscarPorId(id);
    if (!repartidor) {
      throw new NotFoundException(`Repartidor #${id} no encontrado`);
    }
    return repartidor;
  }

  async crear(dto: CrearRepartidorDto): Promise<RepartidorConPin> {
    const repartidor = await this.conEmailUnico(() =>
      this.repo.crear({
        nombre: dto.nombre.trim(),
        apellido: dto.apellido.trim(),
        telefono: dto.telefono.trim(),
        email: dto.email.trim().toLowerCase(),
        direccion: dto.direccion.trim(),
        vehiculo: dto.vehiculo,
      }),
    );

    // Genera el PIN de acceso y revoca posibles sesiones previas
    const pin = await this.authService.asignarNuevoPin(repartidor.id);

    // El PIN solo se devuelve esta única vez para que el operario se lo entregue al repartidor
    return {
      ...repartidor,
      pin,
    };
  }

  async actualizar(
    id: number,
    dto: ActualizarRepartidorDto,
  ): Promise<RepartidorPublico> {
    await this.buscarPorId(id);

    return this.conEmailUnico(() =>
      this.repo.actualizar(id, {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.apellido !== undefined && { apellido: dto.apellido.trim() }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono.trim() }),
        ...(dto.email !== undefined && {
          email: dto.email.trim().toLowerCase(),
        }),
        ...(dto.direccion !== undefined && { direccion: dto.direccion.trim() }),
        ...(dto.vehiculo !== undefined && { vehiculo: dto.vehiculo }),
      }),
    );
  }

  // El email es único en la base: si ya lo usa otro repartidor, se responde 409 en vez de 500.
  // Si es uno dado de baja, lo que corresponde es reactivarlo, no crearlo de nuevo.
  private async conEmailUnico<T>(guardar: () => Promise<T>): Promise<T> {
    try {
      return await guardar();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un repartidor con ese email');
      }
      throw error;
    }
  }

  async darDeBaja(id: number): Promise<void> {
    await this.buscarPorId(id);

    const tieneViaje = await this.repo.tieneViajeActivo(id);
    if (tieneViaje) {
      throw new ConflictException(
        'No se puede dar de baja a un repartidor con un viaje activo',
      );
    }

    // Su sesión sigue viva hasta 15 minutos: con una oferta abierta podría aceptarla
    // después de la baja y quedar inactivo con un viaje asignado.
    if (await this.repo.tieneOfertaPendiente(id)) {
      throw new ConflictException(
        'El repartidor tiene una oferta sin responder: esperá a que la responda o venza',
      );
    }

    // Baja lógica: se desactiva, termina su jornada y sale de la cola FIFO
    const dadoDeBaja = await this.repo.darDeBajaSiEstaLibre(id);
    if (!dadoDeBaja) {
      throw new ConflictException(
        'El repartidor recibió un viaje mientras se procesaba la baja. Intentá de nuevo.',
      );
    }

    // Cierra inmediatamente todas las sesiones abiertas del repartidor
    await this.authService.cerrarSesiones(RolUsuario.REPARTIDOR, id);
  }

  async resetearPin(id: number): Promise<{ pin: string }> {
    const repartidor = await this.buscarPorId(id);
    if (!repartidor.activo) {
      throw new ConflictException(
        'No se puede resetear el PIN de un repartidor inactivo',
      );
    }

    const nuevoPin = await this.authService.asignarNuevoPin(id);
    return { pin: nuevoPin };
  }
}
