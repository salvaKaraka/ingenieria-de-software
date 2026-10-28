import { ConflictException, Injectable } from '@nestjs/common';
import { AsignacionService } from '../asignacion/asignacion.service';
import { esTransicionValida, siguienteEstado } from './domain/estado-envio';
import { EnviosRepository } from './envios.repository';

// Viaje activo del repartidor logueado (E-2): verlo y avanzarlo un paso por vez.
@Injectable()
export class ViajesService {
  constructor(
    private readonly enviosRepository: EnviosRepository,
    private readonly asignacionService: AsignacionService,
  ) {}

  async obtenerViajeActual(repartidorId: number) {
    const envio =
      await this.enviosRepository.buscarViajeActivoPorRepartidor(repartidorId);
    if (!envio) return { viaje: null };

    // Sin el DNI del destinatario: el repartidor no lo necesita (la evidencia es E-4).
    return {
      viaje: {
        envioId: envio.id,
        codigoSeguimiento: envio.codigoSeguimiento,
        estado: envio.estado,
        siguienteEstado: siguienteEstado(envio.estado),
        comercio: envio.comercio,
        origenDireccion: envio.origenDireccion,
        destinoDireccion: envio.destinoDireccion,
        destinatario: {
          nombre: envio.destinatarioNombre,
          apellido: envio.destinatarioApellido,
          telefono: envio.destinatarioTelefono,
        },
        observaciones: envio.observaciones,
        requiereFoto: envio.requiereFoto,
        requiereDni: envio.requiereDni,
      },
    };
  }

  async avanzarViajeActual(repartidorId: number) {
    const envio =
      await this.enviosRepository.buscarViajeActivoPorRepartidor(repartidorId);
    if (!envio) {
      throw new ConflictException('No tenés ningún viaje activo');
    }

    const nuevo = siguienteEstado(envio.estado);
    if (!nuevo || !esTransicionValida(envio.estado, nuevo, 'REPARTIDOR')) {
      throw new ConflictException('El viaje no se puede avanzar desde acá');
    }

    const avanzado = await this.enviosRepository.avanzarViaje(
      envio.id,
      envio.estado,
      nuevo,
      repartidorId,
    );
    if (!avanzado) {
      throw new ConflictException(
        'El envío cambió mientras lo avanzabas (puede que lo hayan cancelado)',
      );
    }

    // Recién después de confirmar la entrega: si el repartidor volvió a DISPONIBLE (no pidió cierre),
    // el motor le puede ofrecer el siguiente envío.
    if (nuevo === 'ENTREGADO') {
      const rep = await this.enviosRepository.buscarRepartidor?.(repartidorId);
      if (!rep || rep.estado === 'DISPONIBLE') {
        await this.asignacionService.reintentarPendientes();
      }
    }
    return { estado: nuevo, siguienteEstado: siguienteEstado(nuevo) };
  }
}
