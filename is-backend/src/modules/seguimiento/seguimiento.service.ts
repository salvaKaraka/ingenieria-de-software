import { Injectable, NotFoundException } from '@nestjs/common';
import { SeguimientoRepository } from './seguimiento.repository';
import type { HistorialEstadoDto, TrackingPublicoDto } from './seguimiento.dto';

@Injectable()
export class SeguimientoService {
  constructor(private readonly repository: SeguimientoRepository) {}

  /**
   * Enmascara el nombre del destinatario (Épica 2.5):
   * Solo muestra el primer nombre y la inicial del apellido con punto.
   * Ej: "Juan", "Perez" -> "Juan P."
   */
  enmascararDestinatario(
    nombre?: string | null,
    apellido?: string | null,
  ): string {
    const nom = nombre?.trim();
    const ape = apellido?.trim();

    if (nom && ape) {
      return `${nom} ${ape[0].toUpperCase()}.`;
    }
    if (nom) return nom;
    if (ape) return `${ape[0].toUpperCase()}.`;
    return 'Destinatario';
  }

  /**
   * Enmascara la dirección de destino (Épica 2.5):
   * Oculta la altura numérica y piso/departamento para resguardar la privacidad.
   * Ej: "Av. Corrientes 1234, 4to B" -> "Av. Corrientes"
   */
  enmascararDireccion(direccion?: string | null): string {
    if (!direccion) return 'Dirección de destino';
    // Remueve a partir del primer número que represente la altura
    const sinAltura = direccion.replace(/\s+\d+.*$/, '').trim();
    return sinAltura || 'Dirección de destino';
  }

  async consultar(codigo: string): Promise<TrackingPublicoDto> {
    const codigoNormalizado = codigo.trim().toUpperCase();
    const envio = await this.repository.buscarPorCodigo(codigoNormalizado);

    if (!envio) {
      throw new NotFoundException('Código de seguimiento no encontrado');
    }

    // Supuesto 7: Hora de salida = momento en que el envío pasó a RETIRADO
    const eventoRetirado = envio.eventos.find(
      (ev) => ev.estadoNuevo === 'RETIRADO',
    );
    const horaSalida = eventoRetirado
      ? eventoRetirado.creadoEn.toISOString()
      : undefined;

    // Fecha de entrega efectiva
    const eventoEntregado = envio.eventos.find(
      (ev) => ev.estadoNuevo === 'ENTREGADO',
    );
    const fechaEntrega = eventoEntregado
      ? eventoEntregado.creadoEn.toISOString()
      : undefined;

    // Línea de tiempo de cambios de estado
    const historial: HistorialEstadoDto[] = envio.eventos
      .filter((ev) => ev.estadoNuevo !== null)
      .map((ev) => ({
        estado: ev.estadoNuevo as string,
        fecha: ev.creadoEn.toISOString(),
      }));

    // Si no hay eventos aún, al menos registra el estado de creación
    if (historial.length === 0) {
      historial.push({
        estado: envio.estado,
        fecha: envio.creadoEn.toISOString(),
      });
    }

    return {
      trackingCode: envio.codigoSeguimiento,
      estadoActual: envio.estado,
      comercio: envio.comercio.nombre,
      destinatario: this.enmascararDestinatario(
        envio.destinatarioNombre,
        envio.destinatarioApellido,
      ),
      direccionDestino: this.enmascararDireccion(envio.destinoDireccion),
      horaSalida,
      fechaEntrega,
      historial,
    };
  }
}
