import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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

type Accion = 'iniciar' | 'pausar' | 'reanudar' | 'terminar' | 'cerrar';

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
  cerrar: {
    FUERA_DE_JORNADA: 'No estás en jornada',
    DISPONIBLE:
      'Tenés una oferta pendiente: respondela antes de cerrar la jornada',
    EMERGENCIA: 'No podés cerrar la jornada durante una emergencia',
  },
};

const MENSAJE_FINALIZA_VIAJE =
  'Finalizá tu viaje en curso para completar el cierre';

// Jornada del repartidor logueado (C-3 / G-1): entrar y salir de la cola FIFO del motor,
// y solicitud / validación de cierre de jornada.
@Injectable()
export class JornadaService {
  constructor(
    private readonly repo: RepartidoresRepository,
    private readonly asignacion: AsignacionService,
    private readonly authService: AuthService,
  ) {}

  async estado(repartidorId: number) {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');

    return {
      estado: repartidor.estado,
      cierreSolicitado: repartidor.cierreSolicitado,
      paquetesADevolver:
        repartidor.estado === 'ESPERANDO_VALIDACION_CIERRE'
          ? await this.repo.obtenerPaquetesADevolver(repartidorId)
          : [],
    };
  }

  // G-1: el repartidor pide cerrar la jornada. Sin viaje sale de la cola en el momento y
  // queda esperando que el operario valide la rendición; con un viaje en curso queda anotado
  // y el cierre se completa al terminar ese viaje (ver EnviosRepository.liberarRepartidor).
  async solicitarCierre(repartidorId: number) {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');

    if (repartidor.estado === 'ESPERANDO_VALIDACION_CIERRE') {
      return this.esperandoValidacion(repartidorId);
    }

    if (repartidor.estado === 'OCUPADO') {
      if (await this.repo.marcarCierrePendiente(repartidorId)) {
        return {
          estado: 'OCUPADO' as const,
          cierrePendiente: true,
          mensaje: MENSAJE_FINALIZA_VIAJE,
        };
      }
    } else if (await this.repo.solicitarCierreInmediato(repartidorId)) {
      return this.esperandoValidacion(repartidorId);
    }

    // El estado cambió entre la lectura y el UPDATE (por ejemplo, le llegó una oferta).
    throw await this.conflicto(repartidorId, 'cerrar');
  }

  private async esperandoValidacion(repartidorId: number) {
    return {
      estado: 'ESPERANDO_VALIDACION_CIERRE' as const,
      paquetesADevolver: await this.repo.obtenerPaquetesADevolver(repartidorId),
      mensaje: 'Solicitud enviada al operario',
    };
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

  // Lo que el operario revisa antes de aprobar el cierre (G-1).
  async rendicion(repartidorId: number) {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');
    return {
      repartidorId,
      estado: repartidor.estado,
      paquetesADevolver: await this.repo.obtenerPaquetesADevolver(repartidorId),
    };
  }

  // G-1: el operario aprueba el cierre cuando recibió en la base todos los paquetes que el
  // repartidor tenía que devolver. Los cuenta el sistema: el operario solo dice cuántos recibió.
  async aprobarCierre(
    repartidorId: number,
    dto: AprobarCierreDto,
    operarioId: number,
  ) {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');
    if (repartidor.estado !== 'ESPERANDO_VALIDACION_CIERRE') {
      throw new ConflictException(
        'El repartidor no solicitó el cierre de jornada',
      );
    }

    const aDevolver = await this.repo.obtenerPaquetesADevolver(repartidorId);
    const faltantes = aDevolver.length - dto.paquetesDevueltos;
    if (faltantes > 0) {
      throw new BadRequestException(
        `Faltan rendir ${faltantes} ${faltantes === 1 ? 'paquete' : 'paquetes'}`,
      );
    }
    if (faltantes < 0) {
      throw new BadRequestException(
        `El repartidor tenía que devolver ${aDevolver.length} ${aDevolver.length === 1 ? 'paquete' : 'paquetes'}`,
      );
    }

    const aprobado = await this.repo.aprobarCierre(
      repartidorId,
      aDevolver.map((paquete) => paquete.id),
      operarioId,
    );
    if (!aprobado) {
      throw new ConflictException(
        'El repartidor no solicitó el cierre de jornada',
      );
    }

    // Termina su sesión: la próxima vez entra con el PIN e inicia una jornada nueva.
    await this.authService.cerrarSesiones(RolUsuario.REPARTIDOR, repartidorId);

    return {
      repartidorId,
      estado: 'FUERA_DE_JORNADA' as const,
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
