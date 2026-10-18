import { Module } from '@nestjs/common';
import { AsignacionRepository } from './asignacion.repository';
import { AsignacionService } from './asignacion.service';
import { OfertasController } from './ofertas.controller';
import { OfertasRepository } from './ofertas.repository';
import { OfertasService } from './ofertas.service';
import { VencimientoOfertasJob } from './vencimiento-ofertas.job';

@Module({
  controllers: [OfertasController],
  providers: [
    AsignacionService,
    AsignacionRepository,
    OfertasService,
    OfertasRepository,
    VencimientoOfertasJob,
  ],
  // Envíos, repartidores y la ejecución de entregas disparan el motor.
  // OfertasService: lo usa el probador de desarrollo (src/dev) para responder ofertas en nombre del repartidor.
  exports: [AsignacionService, OfertasService],
})
export class AsignacionModule {}
