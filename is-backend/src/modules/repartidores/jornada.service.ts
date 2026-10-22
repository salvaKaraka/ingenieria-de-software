import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EstadoRepartidor } from '../../generated/prisma/client';
import { AsignacionService } from '../asignacion/asignacion.service';
import { RepartidoresRepository } from './repartidores.repository';

type Accion = 'iniciar' | 'pausar' | 'reanudar';

// Por qué no se pudo hacer cada acción, según el estado en que está el repartidor.
const MOTIVO: Record<Accion, Partial<Record<EstadoRepartidor, string>>> = {
  iniciar: {
    DISPONIBLE: 'Ya estás en jornada',
    EN_PAUSA: 'Estás en pausa: reanudá la jornada',
    OCUPADO: 'Ya estás en jornada',
  },
  pausar: {
    FUERA_DE_JORNADA: 'No estás en jornada',
    EN_PAUSA: 'Ya estás en pausa',
    OCUPADO: 'No podés pausar con un viaje en curso',
    // Disponible pero fuera de la cola: tiene una oferta esperando respuesta.
    DISPONIBLE: 'Tenés una oferta pendiente: respondela antes de pausar',
  },
  reanudar: {
    FUERA_DE_JORNADA: 'No estás en jornada: iniciala',
    DISPONIBLE: 'Ya estás en jornada',
    OCUPADO: 'Ya estás en jornada',
  },
};

// Jornada del repartidor logueado (C-3): entrar y salir de la cola FIFO del motor.
// Por ahora iniciar, pausar y reanudar; terminar la jornada y la flota quedan para C-3/C-4.
@Injectable()
export class JornadaService {
  constructor(
    private readonly repo: RepartidoresRepository,
    private readonly asignacion: AsignacionService,
  ) {}

  async estado(repartidorId: number): Promise<{ estado: EstadoRepartidor }> {
    const repartidor = await this.repo.buscarPorId(repartidorId);
    if (!repartidor) throw new NotFoundException('El repartidor no existe');
    return { estado: repartidor.estado };
  }

  async iniciar(repartidorId: number) {
    if (!(await this.repo.iniciarJornada(repartidorId))) {
      throw await this.conflicto(repartidorId, 'iniciar');
    }
    // Entró a la cola: el motor le ofrece los envíos que estaban esperando repartidor.
    await this.asignacion.reintentarPendientes();
    return this.estado(repartidorId);
  }

  async pausar(repartidorId: number) {
    if (!(await this.repo.pausar(repartidorId))) {
      throw await this.conflicto(repartidorId, 'pausar');
    }
    return this.estado(repartidorId);
  }

  async reanudar(repartidorId: number) {
    if (!(await this.repo.reanudar(repartidorId))) {
      throw await this.conflicto(repartidorId, 'reanudar');
    }
    await this.asignacion.reintentarPendientes();
    return this.estado(repartidorId);
  }

  private async conflicto(repartidorId: number, accion: Accion) {
    const { estado } = await this.estado(repartidorId);
    return new ConflictException(
      MOTIVO[accion][estado] ?? 'No se puede hacer eso en este momento',
    );
  }
}
