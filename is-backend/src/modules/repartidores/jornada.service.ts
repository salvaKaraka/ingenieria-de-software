import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  type EstadoRepartidor,
  RolUsuario,
  type TipoVehiculo,
} from '../../generated/prisma/client';
import { AsignacionService } from '../asignacion/asignacion.service';
import { AuthService } from '../auth/auth.service';
import type { AprobarCierreDto } from './dto';
import {
  RepartidoresRepository,
  type RepartidorPublico,
} from './repartidores.repository';

type Accion = 'iniciar' | 'pausar' | 'reanudar' | 'terminar';

// Por qué no se pudo hacer cada acción, según el estado en que está el repartidor.
const MOTIVO: Record<Accion, Partial<Record<EstadoRepartidor, string>>> = {
  iniciar: {
    DISPONIBLE: 'Ya estás en jornada',
    EN_PAUSA: 'Estás en pausa: reanudá la jornada',
    OCUPADO: 'Ya estás en jornada',
    ESPERANDO_VALIDACION_CIERRE: 'Estás esperando validación de cierre',
  },
  pausar: {
    FUERA_DE_JORNADA: 'No estás en jornada',
    EN_PAUSA: 'Ya estás en pausa',
    OCUPADO: 'No podés pausar con un viaje en curso',
    // Disponible pero fuera de la cola: tiene una oferta esperando respuesta.
    DISPONIBLE: 'Tenés una oferta pendiente: respondela antes de pausar',
    ESPERANDO_VALIDACION_CIERRE: 'Ya solicitaste el cierre de jornada',
  },
  reanudar: {
    FUERA_DE_JORNADA: 'No estás en jornada: iniciala',
    DISPONIBLE: 'Ya estás en jornada',
    OCUPADO: 'Ya estás en jornada',
    ESPERANDO_VALIDACION_CIERRE: 'Ya solicitaste el cierre de jornada',
  },
  terminar: {
    FUERA_DE_JORNADA: 'No estás en jornada',
    OCUPADO: 'No podés terminar la jornada con un viaje en curso',
    // Disponible pero fuera de la cola: tiene una oferta esperando respuesta.
    DISPONIBLE:
      'Tenés una oferta pendiente: respondela antes de terminar la jornada',
    ESPERANDO_VALIDACION_CIERRE: 'El operario debe validar el cierre',
  },
};

// Jornada del repartidor logueado (C-3 / G-1): entrar y salir de la cola FIFO del motor,
// y solicitud / validación de cierre de jornada.
@Injectable()
export class JornadaService {
  constructor(
    private readonly repo: RepartidoresRepository,
    private readonly asignacion: AsignacionService,
    @Optional() private readonly authService?: AuthService,
  ) {}

  async estado(repartidorId: number): Promise<{
    estado: EstadoRepartidor;
    cierreSolicitado: boolean;
    paquetesADevolver: Awaited<
      ReturnType<RepartidoresRepository['obtenerPaquetesADevolver']>
    >;
  }> {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');

    const paquetesADevolver =
      repartidor.estado === 'ESPERANDO_VALIDACION_CIERRE'
        ? await this.repo.obtenerPaquetesADevolver(repartidorId)
        : [];

    return {
      estado: repartidor.estado,
      cierreSolicitado: repartidor.cierreSolicitado,
      paquetesADevolver,
    };
  }

  // Solicitud de cierre de jornada por el repartidor (G-1)
  async solicitarCierre(repartidorId: number) {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');

    if (repartidor.estado === 'FUERA_DE_JORNADA') {
      throw new ConflictException('No estás en jornada');
    }

    if (repartidor.estado === 'ESPERANDO_VALIDACION_CIERRE') {
      const paquetesADevolver =
        await this.repo.obtenerPaquetesADevolver(repartidorId);
      return {
        estado: 'ESPERANDO_VALIDACION_CIERRE' as const,
        paquetesADevolver,
        mensaje: 'Esperando validación de cierre por parte del operario',
      };
    }

    // Escenario 2: con viaje activo, debe finalizarlo primero
    const tieneViaje = await this.repo.tieneViajeActivo(repartidorId);
    if (tieneViaje || repartidor.estado === 'OCUPADO') {
      await this.repo.marcarCierrePendiente(repartidorId);
      return {
        estado: 'OCUPADO' as const,
        cierrePendiente: true,
        mensaje: 'Finalizá tu viaje en curso para completar el cierre',
      };
    }

    // Escenario 1 y 3: sin viajes en curso
    const paquetesADevolver =
      await this.repo.obtenerPaquetesADevolver(repartidorId);
    const actualizado = await this.repo.solicitarCierreInmediato(repartidorId);
    if (!actualizado) {
      throw new ConflictException('No se pudo solicitar el cierre de jornada');
    }

    return {
      estado: 'ESPERANDO_VALIDACION_CIERRE' as const,
      paquetesADevolver,
      mensaje: 'Solicitud enviada al operario',
    };
  }

  async obtenerPaquetesDevolucion(repartidorId: number) {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');
    return this.repo.obtenerPaquetesADevolver(repartidorId);
  }

  async iniciar(repartidorId: number) {
    if (!(await this.repo.iniciarJornada(repartidorId))) {
      throw await this.conflicto(repartidorId, 'iniciar');
    }
    // Entró a la cola: el motor le ofrece los envíos que estaban esperando repartidor.
    await this.asignacion.reintentarPendientes();
    return { estado: 'DISPONIBLE' as const };
  }

  async pausar(repartidorId: number) {
    if (!(await this.repo.pausar(repartidorId))) {
      throw await this.conflicto(repartidorId, 'pausar');
    }
    return { estado: 'EN_PAUSA' as const };
  }

  async reanudar(repartidorId: number) {
    if (!(await this.repo.reanudar(repartidorId))) {
      throw await this.conflicto(repartidorId, 'reanudar');
    }
    await this.asignacion.reintentarPendientes();
    return { estado: 'DISPONIBLE' as const };
  }

  async terminar(repartidorId: number) {
    if (!(await this.repo.terminarJornada(repartidorId))) {
      throw await this.conflicto(repartidorId, 'terminar');
    }
    return { estado: 'FUERA_DE_JORNADA' as const };
  }

  // Rendición de paquetes del repartidor (G-1)
  async rendicion(repartidorId: number) {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');
    const { viajesTomados, paquetesEntregados, paquetesADevolver } =
      await this.repo.obtenerRendicion(repartidorId);
    return {
      repartidorId,
      viajesTomados,
      paquetesEntregados,
      paquetesPendientes: Math.max(0, viajesTomados - paquetesEntregados),
      paquetesADevolver,
    };
  }

  // Aprobación de cierre de turno por el operario (G-1)
  async aprobarCierre(repartidorId: number, dto?: AprobarCierreDto) {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');

    const dbRendicion = await this.repo.obtenerRendicion(repartidorId);
    const viajesTomados = dto?.viajesTomados ?? dbRendicion.viajesTomados;
    const paquetesEntregados =
      dto?.paquetesEntregados ?? dbRendicion.paquetesEntregados;
    const paquetesDevueltos = dto?.paquetesDevueltos ?? 0;

    const faltantes = viajesTomados - (paquetesEntregados + paquetesDevueltos);
    if (faltantes > 0) {
      throw new BadRequestException(
        `Faltan rendir ${faltantes} ${faltantes === 1 ? 'paquete' : 'paquetes'}`,
      );
    }
    if (faltantes < 0) {
      throw new BadRequestException(
        'La cantidad de paquetes rendidos supera los viajes tomados',
      );
    }

    const actualizado = await this.repo.aprobarCierre(repartidorId);
    if (!actualizado) {
      throw new ConflictException('No se pudo cerrar el turno del repartidor');
    }

    if (this.authService) {
      await this.authService.cerrarSesiones(RolUsuario.REPARTIDOR, repartidorId);
    }

    return {
      repartidorId,
      estado: 'FUERA_DE_JORNADA',
      mensaje: 'Cierre de turno aprobado',
    };
  }

  async flota(): Promise<Record<TipoVehiculo, RepartidorPublico[]>> {
    const repartidores = await this.repo.obtenerFlota();
    const agrupados: Record<TipoVehiculo, RepartidorPublico[]> = {
      MOTO: [],
      AUTO: [],
      CAMION: [],
    };

    for (const rep of repartidores) {
      agrupados[rep.vehiculo].push(rep);
    }

    for (const vehiculo of Object.keys(agrupados) as TipoVehiculo[]) {
      const enCola = agrupados[vehiculo]
        .filter((r) => r.enColaDesde !== null)
        .sort(
          (a, b) =>
            new Date(a.enColaDesde!).getTime() -
            new Date(b.enColaDesde!).getTime(),
        );
      const fueraDeCola = agrupados[vehiculo].filter(
        (r) => r.enColaDesde === null,
      );
      agrupados[vehiculo] = [...enCola, ...fueraDeCola];
    }

    return agrupados;
  }

  private async conflicto(repartidorId: number, accion: Accion) {
    const { estado } = await this.estado(repartidorId);
    return new ConflictException(
      MOTIVO[accion][estado] ?? 'No se puede hacer eso en este momento',
    );
  }
}
