import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EstadoEnvio } from '../../generated/prisma/client';
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
  estado: EstadoEnvio;
  motivo: MotivoExcepcion;
  aviso: string;
  puedeAsignar: boolean;
  esperaDesde: Date;
  minutosEspera: number;
};

// Panel de excepciones del operario (HU 12, HU 20/21 y HU 22).
@Injectable()
export class ExcepcionesService {
  constructor(private readonly repo: ExcepcionesRepository) {}

  async listar(
    ahora: Date = new Date(),
  ): Promise<{ excepciones: ExcepcionListada[] }> {
    const [sinRepartidor, incidentes] = await Promise.all([
      this.repo.listarSinRepartidor(),
      this.repo.listarIncidentesActivos(),
    ]);

    const excepciones = new Map<number, ExcepcionListada>();
    for (const envio of sinRepartidor) {
      const esperaDesde = envio.ofertas[0].expiraEn;
      excepciones.set(envio.id, {
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
        puedeAsignar: true,
        esperaDesde,
        minutosEspera: minutosDeEspera(esperaDesde, ahora),
      });
    }

    for (const envio of incidentes) {
      const incidente = envio.eventos[0];
      if (!incidente) continue;
      const parado = envio.estado === 'PARADO';
      excepciones.set(envio.id, {
        envioId: envio.id,
        codigoSeguimiento: envio.codigoSeguimiento,
        comercio: envio.comercio.nombre,
        origenDireccion: envio.origenDireccion,
        destinoDireccion: envio.destinoDireccion,
        tamanio: envio.tamanio,
        vehiculoRequerido: envio.vehiculoRequerido,
        estado: envio.estado,
        motivo: parado ? 'PARADO' : 'INCIDENTE',
        aviso: parado
          ? AVISO_MOTIVO.PARADO
          : (incidente.detalle ?? AVISO_MOTIVO.INCIDENTE),
        puedeAsignar:
          parado ||
          (envio.estado === 'PENDIENTE' && envio.ofertas.length === 0),
        esperaDesde: incidente.creadoEn,
        minutosEspera: minutosDeEspera(incidente.creadoEn, ahora),
      });
    }

    return { excepciones: ordenarPorEspera([...excepciones.values()]) };
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
      if (envio.estado !== 'PENDIENTE' && envio.estado !== 'PARADO')
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

      if (
        envio.estado === 'PARADO' &&
        !(await this.repo.reactivarEnvioParado(tx, envioId, operarioId))
      ) {
        throw new ConflictException(
          'El envío cambió de estado. Actualizá el panel e intentá de nuevo.',
        );
      }

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
