import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OFERTA_SEGUNDOS } from '../asignacion/asignacion.constants';
import {
  AVISO_MOTIVO,
  minutosDeEspera,
  type MotivoExcepcion,
  motivoParaNoAsignar,
  ordenarPorEspera,
} from './domain/excepciones';
import { ExcepcionesRepository } from './excepciones.repository';

// Lo que ve el operario de cada envío del panel.
export type ExcepcionListada = {
  envioId: number;
  codigoSeguimiento: string;
  comercio: string;
  origenDireccion: string;
  destinoDireccion: string;
  tamanio: string;
  vehiculoRequerido: string;
  estado: string;
  motivo: MotivoExcepcion;
  aviso: string;
  esperaDesde: Date;
  minutosEspera: number;
};

// Panel de excepciones del operario (HU 22) y aviso de envío sin repartidor (HU 12).
@Injectable()
export class ExcepcionesService {
  constructor(private readonly repo: ExcepcionesRepository) {}

  async listar(
    ahora: Date = new Date(),
  ): Promise<{ excepciones: ExcepcionListada[] }> {
    const sinRepartidor = await this.repo.listarSinRepartidor();

    const excepciones = sinRepartidor.map((envio): ExcepcionListada => {
      const esperaDesde = envio.ofertas[0].expiraEn;
      return {
        envioId: envio.id,
        codigoSeguimiento: envio.codigoSeguimiento,
        comercio: envio.comercio.nombre,
        origenDireccion: envio.origenDireccion,
        destinoDireccion: envio.destinoDireccion,
        tamanio: envio.tamanio,
        vehiculoRequerido: envio.vehiculoRequerido,
        estado: envio.estado,
        motivo: 'SIN_REPARTIDOR',
        aviso: AVISO_MOTIVO.SIN_REPARTIDOR,
        esperaDesde,
        minutosEspera: minutosDeEspera(esperaDesde, ahora),
      };
    });

    return { excepciones: ordenarPorEspera(excepciones) };
  }

  async repartidoresAsignables(envioId: number) {
    const envio = await this.repo.buscarEnvio(envioId);
    if (!envio) throw new NotFoundException('El envío no existe');
    return this.repo.listarRepartidoresAsignables(envio.vehiculoRequerido);
  }

  // HU 22, escenarios 1 y 5: el operario elige el repartidor y la oferta le llega directo,
  // sin respetar el orden de la cola ni el límite de 2 viajes consecutivos.
  // Tiene los mismos 5 minutos que cualquier oferta: si no responde, el envío vuelve al panel.
  async asignarManual(
    envioId: number,
    repartidorId: number,
    operarioId: number,
  ) {
    return this.repo.transaccion(async (tx) => {
      const envio = await this.repo.bloquearEnvio(tx, envioId);
      if (!envio) throw new NotFoundException('El envío no existe');
      if (envio.estado !== 'PENDIENTE')
        throw new ConflictException('El envío ya no espera repartidor');
      if (await this.repo.envioTieneOfertaVigente(tx, envioId))
        throw new ConflictException(
          'El envío ya tiene una oferta en curso (puede que el sistema haya encontrado un repartidor)',
        );

      const repartidor = await this.repo.bloquearRepartidor(tx, repartidorId);
      if (!repartidor) throw new NotFoundException('El repartidor no existe');
      const motivo = motivoParaNoAsignar(envio.vehiculoRequerido, {
        activo: repartidor.activo,
        estado: repartidor.estado,
        vehiculo: repartidor.vehiculo,
        tieneOfertaPendiente: await this.repo.repartidorTieneOfertaVigente(
          tx,
          repartidorId,
        ),
      });
      if (motivo) throw new ConflictException(motivo);

      const oferta = await this.repo.ofrecerManual(
        tx,
        envioId,
        repartidorId,
        new Date(Date.now() + OFERTA_SEGUNDOS * 1000),
        operarioId,
        `Asignación manual del operario a ${repartidor.nombre} ${repartidor.apellido}`,
      );
      return { ofertaId: oferta.id, expiraEn: oferta.expiraEn };
    });
  }
}
