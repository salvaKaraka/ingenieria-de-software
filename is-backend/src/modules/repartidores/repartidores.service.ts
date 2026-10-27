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

// El DNI completo nunca sale de la API: al operario le alcanza con los últimos dígitos
// para reconocer a la persona (regla de datos sensibles del AGENTS.md).
function ocultarDni(repartidor: RepartidorPublico): RepartidorPublico {
  if (!repartidor.dni) return repartidor;
  return { ...repartidor, dni: `•••••${repartidor.dni.slice(-3)}` };
}

@Injectable()
export class RepartidoresService {
  constructor(
    private readonly repo: RepartidoresRepository,
    private readonly authService: AuthService,
  ) {}

  async listar(filtros?: FiltroRepartidoresDto): Promise<RepartidorPublico[]> {
    const repartidores = await this.repo.listar(filtros);
    return repartidores.map(ocultarDni);
  }

  async buscarPorId(id: number): Promise<RepartidorPublico> {
    const repartidor = await this.repo.buscarPorId(id);
    if (!repartidor) {
      throw new NotFoundException(`Repartidor #${id} no encontrado`);
    }
    return ocultarDni(repartidor);
  }

  async crear(dto: CrearRepartidorDto): Promise<RepartidorConPin> {
    const repartidor = await this.conDatosUnicos(() =>
      this.repo.crear({
        nombre: dto.nombre.trim(),
        apellido: dto.apellido.trim(),
        dni: dto.dni,
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
      ...ocultarDni(repartidor),
      pin,
    };
  }

  async actualizar(
    id: number,
    dto: ActualizarRepartidorDto,
  ): Promise<RepartidorPublico> {
    await this.buscarPorId(id);

    const repartidor = await this.conDatosUnicos(() =>
      this.repo.actualizar(id, {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.apellido !== undefined && { apellido: dto.apellido.trim() }),
        ...(dto.dni !== undefined && { dni: dto.dni }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono.trim() }),
        ...(dto.email !== undefined && {
          email: dto.email.trim().toLowerCase(),
        }),
        ...(dto.direccion !== undefined && { direccion: dto.direccion.trim() }),
        ...(dto.vehiculo !== undefined && { vehiculo: dto.vehiculo }),
      }),
    );
    return ocultarDni(repartidor);
  }

  // DNI y email son únicos en la base: si ya los usa otro repartidor, se responde 409 en vez
  // de 500. Si es uno dado de baja, lo que corresponde es reactivarlo, no crearlo de nuevo.
  // Lo chequea la base (no un SELECT previo) para que dos altas simultáneas no pasen las dos.
  private async conDatosUnicos<T>(guardar: () => Promise<T>): Promise<T> {
    try {
      return await guardar();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // El detalle trae el índice violado (repartidores_dni_key o repartidores_email_key);
        // su forma cambia según el driver de Prisma, por eso se busca en el texto.
        if (JSON.stringify(error.meta ?? {}).includes('dni')) {
          throw new ConflictException(
            'El repartidor ya se encuentra registrado',
          );
        }
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
