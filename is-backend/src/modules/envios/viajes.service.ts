import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AsignacionService } from '../asignacion/asignacion.service';
import { inicioDelDia } from './domain/dia';
import { esTransicionValida, siguienteEstado } from './domain/estado-envio';
import { AvanzarViajeDto } from './dto/avanzar-viaje.dto';
import { EnviosRepository } from './envios.repository';

type ExigenciasEntrega = {
  requiereDni: boolean;
  requiereFoto: boolean;
  destinatarioDni: string | null;
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
        aviso,
      },
    };
  }

  // HU 34: entregas que el repartidor completó hoy (día de Argentina), la más reciente primero.
  // Las novedades, cancelaciones y entregas de días anteriores no aparecen.
  async historialDelDia(repartidorId: number, ahora: Date = new Date()) {
    const envios =
      await this.enviosRepository.listarEntregadosDelRepartidorDesde(
        repartidorId,
        inicioDelDia(ahora),
      );

    const entregas = envios
      .map((envio) => ({
        envioId: envio.id,
        codigoSeguimiento: envio.codigoSeguimiento,
        comercio: envio.comercio.nombre,
        destinoDireccion: envio.destinoDireccion,
        entregadoEn: envio.eventos[0].creadoEn,
      }))
      .sort((a, b) => b.entregadoEn.getTime() - a.entregadoEn.getTime());

    return { entregas };
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

    // HU 18: la foto es de la entrega, así que solo se acepta en el paso que entrega.
    if (evidencia.foto && nuevo !== 'ENTREGADO') {
      throw new ConflictException(
        'La fotografía solo puede capturarse en el domicilio de entrega',
      );
    }

    const detalle =
      nuevo === 'ENTREGADO'
        ? this.verificarEvidencia(envio, evidencia)
        : undefined;

    const avanzado = await this.enviosRepository.avanzarViaje(
      envio.id,
      envio.estado,
      nuevo,
      repartidorId,
      detalle,
      evidencia.foto,
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
  // Devuelve el texto que queda en el historial del envío.
  private verificarEvidencia(
    envio: ExigenciasEntrega,
    evidencia: AvanzarViajeDto,
  ): string | undefined {
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

    // La foto tiene que venir en este mismo pedido: no alcanza con decir que se mandó.
    if (envio.requiereFoto && !evidencia.foto) {
      throw new BadRequestException(
        'Este comercio exige una foto de la entrega',
      );
    }
    if (evidencia.foto) registro.push('foto adjunta');

    return registro.length > 0
      ? `Evidencia: ${registro.join(', ')}`
      : undefined;
  }
}
