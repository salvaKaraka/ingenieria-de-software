import { Injectable, ConflictException } from '@nestjs/common';
import { EnviosRepository } from './envios.repository';
import { AsignacionService } from '../asignacion/asignacion.service';
import { esTransicionValida } from './domain/estado-envio';

@Injectable()
export class ViajesService {
  constructor(
    private readonly enviosRepository: EnviosRepository,
    private readonly asignacionService: AsignacionService,
  ) {}

  private obtenerSiguienteEstado(estadoActual: string): string | null {
    const flujo: Record<string, string> = {
      ASIGNADO: 'EN_CAMINO_A_RETIRAR',
      EN_CAMINO_A_RETIRAR: 'RETIRADO',
      RETIRADO: 'EN_DOMICILIO',
      EN_DOMICILIO: 'ENTREGADO',
    };
    return flujo[estadoActual] || null;
  }

  async obtenerViajeActual(repartidorId: number) {
    const envio = await this.enviosRepository.buscarViajeActivoPorRepartidor(repartidorId);

    if (!envio) {
      return { viaje: null };
    }

    const siguienteEstadoCalculado = this.obtenerSiguienteEstado(envio.estado);

    return {
      viaje: {
        envioId: envio.id,
        codigoSeguimiento: envio.codigoSeguimiento,
        estado: envio.estado,
        siguienteEstado: siguienteEstadoCalculado,
        comercio: {
          nombre: envio.comercio.nombre,
          telefono: envio.comercio.telefono,
        },
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
    const envio = await this.enviosRepository.buscarViajeActivoPorRepartidor(repartidorId);

    if (!envio) {
      throw new ConflictException('No tienes ningún viaje activo en este momento.');
    }

    const estadoActual = envio.estado;
    const siguienteEstado = this.obtenerSiguienteEstado(estadoActual);

    if (!siguienteEstado) {
      throw new ConflictException('El envío ya no tiene un estado siguiente válido.');
    }

    // Validar transición con la regla de E-1 (forzando tipo any para evitar conflictos de TS)
    const esValida = esTransicionValida(estadoActual as any, siguienteEstado as any, 'REPARTIDOR');
    if (!esValida) {
      throw new ConflictException('Transición de estado no permitida para el repartidor.');
    }

    const esEntregado = siguienteEstado === 'ENTREGADO';
    const siguienteDelSiguiente = esEntregado ? null : this.obtenerSiguienteEstado(siguienteEstado);

    try {
      const resultado = await this.enviosRepository.avanzarEstadoEnvioTransaccional(
        envio.id,
        estadoActual,
        siguienteEstado,
        siguienteDelSiguiente,
        repartidorId,
        esEntregado,
      );

      // Si se entregó, reintentar pendientes en la cola de asignación
      if (esEntregado) {
        await this.asignacionService.reintentarPendientes();
      }

      return resultado;
    } catch (error) {
      throw new ConflictException('El estado del envío cambió concurrentemente o no se pudo procesar.');
    }
  }
}