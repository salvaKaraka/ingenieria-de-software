import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  convertirMedianocheArgentinaAUTC,
  finDelDiaArgentina,
} from '../../common/dia-argentina';
import type {
  EstadoOferta,
  TamanioPaquete,
} from '../../generated/prisma/client';
import { AsignacionService } from './asignacion.service';
import { cerradaAntesDeVencer } from './domain/cierre-oferta';
import { type OfertaBloqueada, OfertasRepository } from './ofertas.repository';

// Lo que ve el repartidor de una oferta. Sin datos del destinatario: recién los ve si acepta.
export type OfertaParaRepartidor = {
  id: number;
  // Calculado en el servidor: así el contador del celular no depende de que su reloj esté en hora.
  segundosRestantes: number;
  envio: {
    id: number;
    comercio: string;
    origenDireccion: string;
    destinoDireccion: string;
    tamanio: string;
    observaciones: string | null;
  };
};

export type DetalleHistorialRespuesta = {
  id: number;
  estado: EstadoOferta;
  fecha: string;
  envioId: number;
  codigoSeguimiento?: string;
};

export type HistorialRespuestasResultado = {
  repartidorId: number;
  rango: {
    desde: string | null;
    hasta: string | null;
  };
  totales: {
    aceptadas: number;
    rechazadas: number;
    vencidas: number;
  };
  detalle: DetalleHistorialRespuesta[];
};

// Una fecha AAAA-MM-DD es un día de Argentina; con hora, es ese instante exacto.
function inicioDelRango(valor?: string): Date | undefined {
  if (!valor) return undefined;
  return valor.length === 10
    ? convertirMedianocheArgentinaAUTC(valor)
    : new Date(valor);
}

// "hasta" es inclusivo: abarca todo ese día de Argentina.
function finDelRango(valor?: string): Date | undefined {
  if (!valor) return undefined;
  return valor.length === 10 ? finDelDiaArgentina(valor) : new Date(valor);
}

const TAMANIOS_DE_MENOR_A_MAYOR: TamanioPaquete[] = ['CHICO', 'MEDIANO', 'GRANDE'];

// Una orden de devolución (HU 38) se ofrece como un viaje del depósito al comercio, con el
// paquete más grande como tamaño: es lo que define si entra en el vehículo.
function descripcionDevolucion(
  envio: { id: number; comercio: { nombre: string; direccion: string } },
  orden: { envios: { tamanio: TamanioPaquete }[] },
): OfertaParaRepartidor['envio'] {
  const cantidad = orden.envios.length;
  const tamanio = orden.envios.reduce<TamanioPaquete>(
    (mayor, { tamanio: actual }) =>
      TAMANIOS_DE_MENOR_A_MAYOR.indexOf(actual) >
      TAMANIOS_DE_MENOR_A_MAYOR.indexOf(mayor)
        ? actual
        : mayor,
    'CHICO',
  );
  return {
    id: envio.id,
    comercio: envio.comercio.nombre,
    origenDireccion: 'Depósito (base)',
    destinoDireccion: envio.comercio.direccion,
    tamanio,
    observaciones: `Devolución al comercio: ${cantidad} ${cantidad === 1 ? 'paquete' : 'paquetes'}`,
  };
}

// Respuestas del repartidor a las ofertas (épica 3.3) y su vencimiento.
@Injectable()
export class OfertasService {
  constructor(
    private readonly repo: OfertasRepository,
    private readonly asignacion: AsignacionService,
  ) {}

  async ofertaActual(
    repartidorId: number,
  ): Promise<OfertaParaRepartidor | null> {
    const oferta = await this.repo.buscarVigenteDe(repartidorId);
    if (!oferta) return null;
    return {
      id: oferta.id,
      segundosRestantes: Math.max(
        0,
        Math.floor((oferta.expiraEn.getTime() - Date.now()) / 1000),
      ),
      envio: oferta.envio.ordenDevolucion
        ? descripcionDevolucion(oferta.envio, oferta.envio.ordenDevolucion)
        : {
            id: oferta.envio.id,
            comercio: oferta.envio.comercio.nombre,
            origenDireccion: oferta.envio.origenDireccion,
            destinoDireccion: oferta.envio.destinoDireccion,
            tamanio: oferta.envio.tamanio,
            observaciones: oferta.envio.observaciones,
          },
    };
  }

  async aceptar(
    ofertaId: number,
    repartidorId: number,
  ): Promise<{ envioId: number }> {
    return this.repo.transaccion(async (tx) => {
      const oferta = await this.repo.bloquear(tx, ofertaId);
      this.validarRespuesta(oferta, repartidorId);
      await this.repo.aceptar(tx, oferta);
      return { envioId: oferta.envioId };
    });
  }

  async rechazar(ofertaId: number, repartidorId: number): Promise<void> {
    await this.repo.transaccion(async (tx) => {
      const oferta = await this.repo.bloquear(tx, ofertaId);
      this.validarRespuesta(oferta, repartidorId);
      await this.repo.rechazar(tx, oferta);
    });
    // Recién después de confirmar el rechazo: el motor ofrece el envío al siguiente de la cola.
    await this.asignacion.reintentarPendientes();
  }

  // Vence las ofertas sin respuesta y vuelve a ofrecer esos envíos. Lo corre el job (D-3).
  async vencerYReasignar(): Promise<{
    vencidas: number;
    ofertasCreadas: number;
  }> {
    const vencidas = await this.repo.vencerExpiradas();
    const ofertasCreadas = await this.asignacion.reintentarPendientes();
    return { vencidas, ofertasCreadas };
  }

  private validarRespuesta(
    oferta: OfertaBloqueada | null,
    repartidorId: number,
  ): asserts oferta is OfertaBloqueada {
    if (!oferta) throw new NotFoundException('La oferta no existe');
    if (oferta.repartidorId !== repartidorId)
      throw new ForbiddenException('La oferta no es tuya');
    if (oferta.estado !== 'PENDIENTE')
      throw new ConflictException('La oferta ya fue respondida');
    if (oferta.expiraEn <= new Date())
      throw new ConflictException('La oferta venció');
  }

  // HU 28: cuántas ofertas aceptó, rechazó y dejó vencer un repartidor, con el detalle.
  async consultarHistorial(
    repartidorId: number,
    filtro?: { desde?: string; hasta?: string },
  ): Promise<HistorialRespuestasResultado> {
    const ofertas = await this.repo.buscarHistorialPorRepartidor(
      repartidorId,
      inicioDelRango(filtro?.desde),
      finDelRango(filtro?.hasta),
    );

    const totales = { aceptadas: 0, rechazadas: 0, vencidas: 0 };
    const detalle: DetalleHistorialRespuesta[] = [];

    for (const oferta of ofertas) {
      let momento: Date;
      if (oferta.estado === 'VENCIDA') {
        // Es una métrica de desempeño: si la oferta se cerró porque el operario canceló el
        // envío o le cambió el vehículo, el repartidor no la dejó vencer y no se le cuenta.
        const cierres = oferta.envio.eventos.map((evento) => evento.creadoEn);
        if (cerradaAntesDeVencer(oferta, cierres)) continue;
        momento = oferta.expiraEn;
        totales.vencidas++;
      } else if (oferta.respondidaEn) {
        momento = oferta.respondidaEn;
        if (oferta.estado === 'ACEPTADA') totales.aceptadas++;
        else totales.rechazadas++;
      } else {
        continue;
      }

      detalle.push({
        id: oferta.id,
        estado: oferta.estado,
        fecha: momento.toISOString(),
        envioId: oferta.envioId,
        ...(oferta.envio.codigoSeguimiento && {
          codigoSeguimiento: oferta.envio.codigoSeguimiento,
        }),
      });
    }

    // De la más reciente a la más antigua. Se ordena acá porque la fecha de cada respuesta
    // sale de una columna distinta según el estado.
    // Las fechas ISO en UTC se ordenan igual como texto que como fecha.
    detalle.sort((a, b) => b.fecha.localeCompare(a.fecha));

    return {
      repartidorId,
      rango: {
        desde: filtro?.desde ?? null,
        hasta: filtro?.hasta ?? null,
      },
      totales,
      detalle,
    };
  }
}
