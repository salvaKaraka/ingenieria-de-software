import { Module } from '@nestjs/common';
import { AsignacionRepository } from './asignacion.repository';
import { AsignacionService } from './asignacion.service';

@Module({
  providers: [AsignacionService, AsignacionRepository],
  // Envíos, repartidores y la ejecución de entregas disparan el motor.
  exports: [AsignacionService],
})
export class AsignacionModule {}
