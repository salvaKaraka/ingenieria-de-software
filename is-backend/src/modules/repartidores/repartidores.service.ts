import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolUsuario } from '../../generated/prisma/client';
import { AsignacionService } from '../asignacion/asignacion.service';
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

const VIAJE_EN_CURSO = 'El repartidor tiene un viaje en curso';

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
    private readonly asignacion: AsignacionService,
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
    const actual = await this.buscarPorId(id);

    const datos = {
      ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
      ...(dto.apellido !== undefined && { apellido: dto.apellido.trim() }),
      ...(dto.dni !== undefined && { dni: dto.dni }),
      ...(dto.telefono !== undefined && { telefono: dto.telefono.trim() }),
      ...(dto.email !== undefined && {
        email: dto.email.trim().toLowerCase(),
      }),
      ...(dto.direccion !== undefined && { direccion: dto.direccion.trim() }),
    };

    // El formulario siempre manda el vehículo: si es el mismo, es una edición común y se
    // permite aunque esté en un viaje (por ejemplo, corregir el teléfono).
    if (dto.vehiculo === undefined || dto.vehiculo === actual.vehiculo) {
      const repartidor = await this.conDatosUnicos(() =>
        this.repo.actualizar(id, datos),
      );
      return ocultarDni(repartidor);
    }

    // El viaje o la oferta que tiene se eligieron para su vehículo actual.
    await this.verificarQueEsteLibre(id);
    const cambiado = await this.conDatosUnicos(() =>
      this.repo.cambiarVehiculoSiEstaLibre(id, {
        ...datos,
        vehiculo: dto.vehiculo,
      }),
    );
    if (!cambiado) {
      throw new ConflictException(
        'El repartidor recibió un viaje mientras se guardaba el cambio. Intentá de nuevo.',
      );
    }

    // Si quedó en la cola del vehículo nuevo, puede tomar envíos que esperaban repartidor.
    await this.asignacion.reintentarPendientes();
    return this.buscarPorId(id);
  }

  // Antes de cambiarle el vehículo o darlo de baja: un viaje en curso u oferta abierta
  // quedaría a cargo de alguien que ya no tiene ese vehículo o no puede entrar.
  private async verificarQueEsteLibre(id: number): Promise<void> {
    if (await this.repo.tieneViajeActivo(id)) {
      throw new ConflictException(VIAJE_EN_CURSO);
    }
    if (await this.repo.tieneOfertaPendiente(id)) {
      throw new ConflictException(
        'El repartidor tiene una oferta sin responder: esperá a que la responda o venza',
      );
    }
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

    // Con una oferta abierta, su sesión (que sigue viva hasta 15 minutos) podría aceptarla
    // después de la baja y quedar inactivo con un viaje asignado.
    await this.verificarQueEsteLibre(id);

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

  // Vuelve a habilitar a un repartidor dado de baja: es la única forma de que regrese, porque
  // su DNI y su email siguen ocupados y no se lo puede dar de alta otra vez.
  async reactivar(id: number): Promise<RepartidorConPin> {
    const repartidor = await this.buscarPorId(id);
    if (repartidor.activo) {
      throw new ConflictException('El repartidor ya está activo');
    }

    // UPDATE condicionado: si dos operarios reactivan a la vez, solo uno genera PIN.
    const reactivado = await this.repo.reactivarSiEstaInactivo(id);
    if (!reactivado) {
      throw new ConflictException('El repartidor ya está activo');
    }

    // PIN nuevo: el anterior pudo quedar anotado en cualquier lado durante la baja.
    // Si esto fallara, queda activo sin PIN conocido y se resuelve con "Resetear PIN".
    const pin = await this.authService.asignarNuevoPin(id);
    return { ...repartidor, activo: true, pin };
  }
}
