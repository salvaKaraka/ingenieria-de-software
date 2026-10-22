import { Injectable, NotFoundException } from '@nestjs/common';
import { SeguimientoRepository } from './seguimiento.repository';
import type { HistorialEstadoDto, TrackingPublicoDto } from './seguimiento.dto';

// Piso o departamento escritos sin coma: "Belgrano 456 piso 2 B".
const PISO_O_DEPTO = /\s+(piso|dpto\.?|depto\.?|departamento|dto\.?)\b.*$/i;
// La altura al final de la calle, con o sin "n°", "nro", "#" o "km": "San Martín 550", "Calle 50 n° 200".
const ALTURA_AL_FINAL =
  /\s+(?:(?:n[°º]|nro\.?|n[uú]mero|#|km)\s*)?\d+\s*[a-z]?$/i;
// Tipos de calle que se nombran con un número: "Calle 7", "Diagonal 74", "Ruta 2".
const PALABRA_DE_CALLE_NUMERADA =
  /^(calle|diagonal|diag\.?|ruta|avenida|av\.?|camino|pasaje)$/i;

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
   * Oculta la altura y el piso/departamento para resguardar la privacidad.
   * Ej: "Av. Corrientes 1234, 4to B" -> "Av. Corrientes"; "Calle 7 1234" -> "Calle 7"
   */
  enmascararDireccion(direccion?: string | null): string {
    const sinDatos = 'Dirección de destino';
    if (!direccion) return sinDatos;

    // Lo que va después de la primera coma (altura, piso, depto, localidad) nunca es la calle.
    let calle = direccion.split(',')[0].trim();
    calle = calle.replace(PISO_O_DEPTO, '').trim();
    // La altura es el número del FINAL, no el primero: en La Plata las calles se llaman
    // por número ("Calle 7 1234") y cortar en el primero dejaba solo "Calle".
    const sinAltura = calle.replace(ALTURA_AL_FINAL, '').trim();
    // "Calle 7" sin altura: el número es el nombre de la calle y se conserva.
    if (!PALABRA_DE_CALLE_NUMERADA.test(sinAltura)) calle = sinAltura;

    return calle || sinDatos;
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
