import { Injectable, Logger } from '@nestjs/common';
import type { Oferta } from '../../generated/prisma/client';
import {
  MAX_VIAJES_CONSECUTIVOS,
  OFERTA_SEGUNDOS,
} from './asignacion.constants';
import { AsignacionRepository } from './asignacion.repository';
import { vehiculosQuePuedenLlevar } from './domain/vehiculos';

// Si todos los candidatos tuvieran que descansar, este tope evita un bucle infinito.
const MAX_INTENTOS = 50;

// Motor de asignación (épica 3.2): cruza los envíos pendientes con la cola FIFO de repartidores.
// Lo usan: B-3 (al crear un envío), D-2 (al rechazar), D-3 (al vencer una oferta),
// C-3 (al iniciar la jornada) y E-2 (al terminar una entrega).
@Injectable()
export class AsignacionService {
  private readonly logger = new Logger(AsignacionService.name);

  constructor(private readonly repo: AsignacionRepository) {}

  // Intenta ofrecer el envío al primer repartidor apto de la cola.
  // Devuelve la oferta creada, o null si el envío no necesita oferta o no hay candidato (supuesto 6).
  asignar(envioId: number): Promise<Oferta | null> {
    // Todo en una transacción: los bloqueos de fila duran hasta que termina.
    return this.repo.transaccion(async (tx) => {
      const envio = await this.repo.bloquearEnvio(tx, envioId);
      if (!envio || envio.estado !== 'PENDIENTE') return null;
      if (await this.repo.tieneOfertaVigente(tx, envioId)) return null;

      for (let intento = 0; intento < MAX_INTENTOS; intento++) {
        const candidato = await this.repo.tomarCandidato(
          tx,
          envioId,
          vehiculosQuePuedenLlevar(envio.vehiculoRequerido),
        );
        if (!candidato) {
          this.logger.log(
            `Envío ${envioId}: sin repartidores disponibles (vehículo mínimo: ${envio.vehiculoRequerido})`,
          );
          return null;
        }

        // Regla de los 2 viajes consecutivos:
        // - Si hay otro repartidor disponible para ese vehículo: se lo saltea (descansa, contador a 0 y al final de la cola).
        // - Si es el único repartidor disponible para ese vehículo: se le asigna igual y se avisa al operario.
        let esAsignacionExcepcional = false;
        if (candidato.viajesConsecutivos >= MAX_VIAJES_CONSECUTIVOS) {
          const hayOtro = await this.repo.hayOtroCandidatoDisponible(
            tx,
            envioId,
            candidato.vehiculo,
            candidato.id,
          );
          if (hayOtro) {
            await this.repo.mandarADescansar(tx, candidato.id);
            continue;
          }
          esAsignacionExcepcional = true;
        }

        const expiraEn = new Date(Date.now() + OFERTA_SEGUNDOS * 1000);
        const oferta = await this.repo.ofrecer(
          tx,
          envioId,
          candidato.id,
          expiraEn,
        );

        if (esAsignacionExcepcional) {
          await this.repo.registrarAvisoExcepcion(
            tx,
            envioId,
            'Asignación por excepción: único repartidor disponible',
          );
          this.logger.warn(
            `Envío ${envioId}: asignación por excepción al repartidor ${candidato.id} (único repartidor disponible)`,
          );
        } else {
          this.logger.log(
            `Envío ${envioId} ofrecido al repartidor ${candidato.id}`,
          );
        }

        return oferta;
      }
      return null;
    });
  }

  // Reintenta todos los envíos que esperan repartidor, del más viejo al más nuevo.
  // Devuelve cuántas ofertas se crearon.
  async reintentarPendientes(): Promise<number> {
    let creadas = 0;
    for (const envioId of await this.repo.enviosPendientesSinOferta()) {
      if (await this.asignar(envioId)) creadas++;
    }
    return creadas;
  }
}
