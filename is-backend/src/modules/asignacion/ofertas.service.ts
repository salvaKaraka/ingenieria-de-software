import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AsignacionService } from './asignacion.service';
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
      envio: {
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
}
