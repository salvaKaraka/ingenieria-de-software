import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OfertasService } from './ofertas.service';

// Cada 10 segundos: vence las ofertas de más de 5 minutos sin respuesta y reintenta los envíos
// que esperan repartidor (D-3). El vencimiento vive en la base (expira_en), no en un setTimeout:
// si el servidor se reinicia, en la primera vuelta procesa todo lo que venció mientras estaba caído (RNF-08).
@Injectable()
export class VencimientoOfertasJob {
  private readonly logger = new Logger(VencimientoOfertasJob.name);
  private ejecutando = false;

  constructor(private readonly ofertas: OfertasService) {}

  @Interval(10_000)
  async ejecutar() {
    // En los tests e2e el job se apaga y se llama a mano, para controlar cuándo corre.
    if (process.env.DESACTIVAR_JOBS === 'true') return;
    // Si la vuelta anterior todavía no terminó, no se arranca otra.
    if (this.ejecutando) return;

    this.ejecutando = true;
    try {
      const { vencidas, ofertasCreadas } =
        await this.ofertas.vencerYReasignar();
      if (vencidas > 0 || ofertasCreadas > 0) {
        this.logger.log(
          `Ofertas vencidas: ${vencidas} · ofertas nuevas: ${ofertasCreadas}`,
        );
      }
    } catch (error) {
      // Un error en una vuelta no tiene que frenar las siguientes.
      this.logger.error(
        'Falló el procesamiento de ofertas',
        error instanceof Error ? error.stack : error,
      );
    } finally {
      this.ejecutando = false;
    }
  }
}
