import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AsignacionService } from '../asignacion/asignacion.service';
import { ComerciosService } from '../comercios/comercios.service';
import { DepositoRepository } from './deposito.repository';
import {
  calcularHorasEnCustodia,
  requiereAlertaDemoraCustodia,
} from './domain/deposito';
import { inicioDelDia } from './domain/dia';
import { esTransicionValida } from './domain/estado-envio';
import type { CrearOrdenDevolucionDto } from './dto/crear-orden-devolucion.dto';
import type { ReingresoDepositoDto } from './dto/reingreso-deposito.dto';

// Reglas del depósito (HU 37, 38 y 40). La confirmación en el comercio (HU 39) es del
// repartidor y está en ViajesService.
@Injectable()
export class DepositoService {
  constructor(
    private readonly depositoRepository: DepositoRepository,
    private readonly comerciosService: ComerciosService,
    private readonly asignacionService: AsignacionService,
  ) {}

  // HU 37: el operario recibe en la base un paquete que el repartidor no pudo entregar. Se
  // hace mientras el repartidor rinde su jornada (desde "Aprobar cierre").
  async registrarReingreso(dto: ReingresoDepositoDto, operarioId: number) {
    const envio = await this.depositoRepository.buscarPorCodigo(
      dto.codigoSeguimiento,
    );
    if (!envio) {
      throw new NotFoundException('El código no corresponde a ningún envío');
    }

    // Es de su rendición si lo tiene él y quedó para devolver: marcado "A devolver" o con una
    // novedad que el operario no mandó a reintentar (mismo criterio que la lista de paquetes
    // a devolver del cierre de jornada).
    const esDeSuRendicion =
      envio.repartidorId === dto.repartidorId &&
      esTransicionValida(envio.estado, 'EN_CUSTODIA', 'OPERARIO') &&
      !envio.reintentoPendiente;
    if (!esDeSuRendicion) {
      throw new ConflictException(
        'El paquete no pertenece a la jornada de este repartidor',
      );
    }

    const estadoRepartidor = await this.depositoRepository.estadoDelRepartidor(
      dto.repartidorId,
    );
    if (estadoRepartidor !== 'ESPERANDO_VALIDACION_CIERRE') {
      throw new ConflictException(
        'El repartidor tiene que solicitar el cierre de jornada para rendir los paquetes',
      );
    }

    const reingreso = await this.depositoRepository.registrarReingresoCustodia(
      envio.id,
      envio.estado,
      operarioId,
    );
    if (!reingreso) {
      throw new ConflictException(
        'El envío cambió mientras se registraba el reingreso. Actualizá la pantalla.',
      );
    }

    return {
      envioId: envio.id,
      codigoSeguimiento: envio.codigoSeguimiento,
      estado: 'EN_CUSTODIA' as const,
      comercio: envio.comercio,
      ...reingreso,
    };
  }

  // Pestaña Depósito del operario: todo el circuito en una sola consulta.
  // - custodia: los paquetes en la base agrupados por comercio, listos para armar la orden
  //   (HU 38), con la alerta de 24 horas marcada en cada uno (HU 40).
  // - ordenes: las de devolución abiertas y las que se confirmaron hoy, con su estado.
  async resumen(ahora: Date = new Date()) {
    const [enCustodia, ordenes] = await Promise.all([
      this.depositoRepository.listarEnCustodia(),
      this.depositoRepository.listarOrdenes(inicioDelDia(ahora)),
    ]);

    const porComercio = new Map<
      number,
      {
        comercio: { id: number; nombre: string; direccion: string };
        paquetes: {
          envioId: number;
          codigoSeguimiento: string;
          destinoOriginal: string;
          tamanio: string;
          fechaReingreso: Date;
          horasEnCustodia: number;
          alerta: boolean;
        }[];
      }
    >();
    for (const envio of enCustodia) {
      const fechaReingreso = fechaDeReingreso(envio);
      const grupo = porComercio.get(envio.comercio.id) ?? {
        comercio: envio.comercio,
        paquetes: [],
      };
      grupo.paquetes.push({
        envioId: envio.id,
        codigoSeguimiento: envio.codigoSeguimiento,
        destinoOriginal: envio.destinoDireccion,
        tamanio: envio.tamanio,
        fechaReingreso,
        horasEnCustodia: calcularHorasEnCustodia(fechaReingreso, ahora),
        alerta: requiereAlertaDemoraCustodia(fechaReingreso, ahora),
      });
      porComercio.set(envio.comercio.id, grupo);
    }

    return {
      custodia: [...porComercio.values()].sort((a, b) =>
        a.comercio.nombre.localeCompare(b.comercio.nombre),
      ),
      ordenes: ordenes.map((orden) => {
        const ofertada = orden.envios
          .flatMap((envio) => envio.ofertas)
          .at(0)?.repartidor;
        const estado = orden.confirmadaEn
          ? ('DEVUELTA' as const)
          : orden.repartidor
            ? ('EN_CAMINO' as const)
            : ofertada
              ? ('OFRECIDA' as const)
              : ('SIN_REPARTIDOR' as const);
        const quien = orden.repartidor ?? ofertada;
        return {
          ordenId: orden.id,
          estado,
          comercio: orden.comercio,
          repartidor: quien ? `${quien.nombre} ${quien.apellido}` : null,
          creadaEn: orden.creadaEn,
          confirmadaEn: orden.confirmadaEn,
          paquetes: orden.envios.map((envio) => ({
            envioId: envio.id,
            codigoSeguimiento: envio.codigoSeguimiento,
          })),
        };
      }),
    };
  }

  // HU 40: paquetes con 24 horas o más en custodia, los más demorados primero. Los que ya
  // están en una orden de devolución no figuran: dejaron de estar en custodia.
  async listarDevolucionesPendientesConAlerta(ahora: Date = new Date()) {
    const envios = await this.depositoRepository.listarEnCustodia();
    return envios
      .map((envio) => ({ envio, fechaReingreso: fechaDeReingreso(envio) }))
      .filter(({ fechaReingreso }) =>
        requiereAlertaDemoraCustodia(fechaReingreso, ahora),
      )
      .map(({ envio, fechaReingreso }) => ({
        envioId: envio.id,
        codigoSeguimiento: envio.codigoSeguimiento,
        comercio: envio.comercio,
        fechaReingreso,
        horasEnCustodia: calcularHorasEnCustodia(fechaReingreso, ahora),
      }))
      .sort((a, b) => b.horasEnCustodia - a.horasEnCustodia);
  }

  // HU 38: paquetes de un comercio que se pueden incluir en una orden. Los que ya están en
  // otra orden no aparecen porque dejaron de estar "En custodia" (escenario 3).
  async listarPaquetesEnCustodiaPorComercio(
    comercioId: number,
    ahora: Date = new Date(),
  ) {
    const comercio = await this.comerciosService.obtenerPorId(comercioId);
    const envios = await this.depositoRepository.listarEnCustodia(comercioId);
    if (envios.length === 0) {
      throw new BadRequestException(
        'No hay paquetes en custodia para este comercio',
      );
    }

    return {
      comercio: {
        id: comercio.id,
        nombre: comercio.nombre,
        direccion: comercio.direccion,
      },
      paquetes: envios.map((envio) => {
        const fechaReingreso = fechaDeReingreso(envio);
        return {
          envioId: envio.id,
          codigoSeguimiento: envio.codigoSeguimiento,
          destinoOriginal: envio.destinoDireccion,
          tamanio: envio.tamanio,
          fechaReingreso,
          horasEnCustodia: calcularHorasEnCustodia(fechaReingreso, ahora),
        };
      }),
    };
  }

  // HU 38: la orden vuelve al comercio en un solo viaje, que entra a la asignación
  // automática como cualquier envío.
  async crearOrdenDevolucion(dto: CrearOrdenDevolucionDto, operarioId: number) {
    const { comercio, paquetes } =
      await this.listarPaquetesEnCustodiaPorComercio(dto.comercioId);

    const enCustodia = new Set(paquetes.map((paquete) => paquete.envioId));
    if (dto.envioIds.some((id) => !enCustodia.has(id))) {
      throw new ConflictException(
        'Uno o más paquetes seleccionados no están en custodia para este comercio o ya fueron incluidos en otra orden',
      );
    }

    const creada = await this.depositoRepository.crearOrdenDevolucion(
      dto.comercioId,
      dto.envioIds,
      operarioId,
    );
    if (!creada) {
      throw new ConflictException(
        'Los paquetes cambiaron mientras se armaba la orden. Actualizá la pantalla.',
      );
    }

    const oferta = await this.asignacionService.asignar(creada.representanteId);

    return {
      ordenId: creada.orden.id,
      comercio,
      estado: 'EN_DEVOLUCION' as const,
      creadaEn: creada.orden.creadaEn,
      cantidadPaquetes: dto.envioIds.length,
      paquetes: paquetes.filter((p) => dto.envioIds.includes(p.envioId)),
      ofrecida: oferta !== null,
    };
  }
}

// Todo envío en custodia tiene su evento de reingreso; la fecha de alta es solo un respaldo.
function fechaDeReingreso(envio: { eventos: { creadoEn: Date }[] }): Date {
  return envio.eventos[0]?.creadoEn ?? new Date();
}
