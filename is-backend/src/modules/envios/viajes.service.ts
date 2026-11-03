import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AsignacionService } from '../asignacion/asignacion.service';
import { esTransicionValida, siguienteEstado } from './domain/estado-envio';
import { AvanzarViajeDto } from './dto/avanzar-viaje.dto';
import { EnviosRepository } from './envios.repository';

type ExigenciasEntrega = {
  requiereDni: boolean;
  requiereFoto: boolean;
  destinatarioDni: string | null;
  fotoUrl?: string | null;
};

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

    // Si el operario cambió la dirección con el viaje en curso (HU 31), se le avisa.
    const aviso =
      envio.eventos.find(
        (e) => e.detalle === 'La dirección de entrega fue modificada',
      )?.detalle ?? null;

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
        fotoUrl: envio.fotoUrl ?? null,
        aviso,
      },
    };
  }

  // HU #18 (Épica #58): Captura y asociación de fotografía como evidencia de entrega.
  // Solo permitida cuando el envío se encuentra en estado EN_DOMICILIO.
  async adjuntarFoto(repartidorId: number, foto: string) {
    if (!foto || typeof foto !== 'string' || !foto.trim()) {
      throw new BadRequestException('La foto es obligatoria');
    }

    const envio =
      await this.enviosRepository.buscarViajeActivoPorRepartidor(repartidorId);
    if (!envio) {
      throw new ConflictException('No tenés ningún viaje activo');
    }

    if (envio.estado !== 'EN_DOMICILIO') {
      throw new ConflictException(
        'La fotografía solo puede capturarse en el domicilio de entrega',
      );
    }

    await this.enviosRepository.guardarFotoEnvio(envio.id, foto.trim());
    return { ok: true, fotoUrl: foto.trim() };
  }

  async avanzarViajeActual(
    repartidorId: number,
    evidencia: AvanzarViajeDto = {},
  ) {
    const envio =
      await this.enviosRepository.buscarViajeActivoPorRepartidor(repartidorId);
    if (!envio) {
      throw new ConflictException('No tenés ningún viaje activo');
    }

    const nuevo = siguienteEstado(envio.estado);
    if (!nuevo || !esTransicionValida(envio.estado, nuevo, 'REPARTIDOR')) {
      throw new ConflictException('El viaje no se puede avanzar desde acá');
    }

    let detalle: string | undefined = undefined;
    let fotoUrl: string | undefined = undefined;

    if (nuevo === 'ENTREGADO') {
      const resultado = this.verificarEvidencia(envio, evidencia);
      detalle = resultado.detalle;
      fotoUrl = resultado.fotoUrl;
    }

    const avanzado = await this.enviosRepository.avanzarViaje(
      envio.id,
      envio.estado,
      nuevo,
      repartidorId,
      detalle,
      fotoUrl,
    );
    if (!avanzado) {
      throw new ConflictException(
        'El envío cambió mientras lo avanzabas (puede que lo hayan cancelado)',
      );
    }

    // Recién después de confirmar la entrega: el repartidor volvió a la cola y el motor
    // le puede ofrecer el siguiente envío.
    if (nuevo === 'ENTREGADO') {
      await this.asignacionService.reintentarPendientes();
    }
    return { estado: nuevo, siguienteEstado: siguienteEstado(nuevo) };
  }

  // E-4 (épica 4.3 / HU 18): no se entrega sin la evidencia que exige el comercio.
  // La comparación del DNI se hace acá y no en el front para no mandarle al celular el DNI del destinatario.
  // Devuelve el texto que queda en el historial del envío y la foto para persistir.
  private verificarEvidencia(
    envio: ExigenciasEntrega,
    evidencia: AvanzarViajeDto,
  ): { detalle?: string; fotoUrl?: string } {
    const registro: string[] = [];

    if (envio.requiereDni) {
      if (!evidencia.dni) {
        throw new BadRequestException('Ingresá el DNI de quien recibe');
      }
      // Envíos cargados antes de que el alta exigiera el DNI: no hay contra qué comparar,
      // pero no pueden quedar trabados en la puerta del destinatario.
      if (!envio.destinatarioDni) {
        registro.push('DNI sin verificar (el envío no tenía DNI cargado)');
      } else if (envio.destinatarioDni.replace(/\D/g, '') !== evidencia.dni) {
        throw new BadRequestException(
          'El DNI no coincide con el del destinatario',
        );
      } else {
        registro.push('DNI verificado');
      }
    }

    const foto =
      evidencia.foto?.trim() ||
      evidencia.fotoUrl?.trim() ||
      envio.fotoUrl ||
      undefined;

    if (envio.requiereFoto) {
      if (!foto && !evidencia.fotoEnviada) {
        throw new BadRequestException(
          'Este comercio exige una foto de la entrega',
        );
      }
      registro.push(foto ? 'foto adjunta' : 'foto enviada por WhatsApp');
    } else if (foto) {
      registro.push('foto adjunta');
    }

    return {
      detalle:
        registro.length > 0 ? `Evidencia: ${registro.join(', ')}` : undefined,
      fotoUrl: foto,
    };
  }
}
