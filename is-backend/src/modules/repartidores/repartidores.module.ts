import { Module } from '@nestjs/common';
import { AsignacionModule } from '../asignacion/asignacion.module';
import { AuthModule } from '../auth/auth.module';
import { JornadaController } from './jornada.controller';
import { JornadaService } from './jornada.service';
import { RepartidoresController } from './repartidores.controller';
import { RepartidoresRepository } from './repartidores.repository';
import { RepartidoresService } from './repartidores.service';

@Module({
  // AsignacionModule: iniciar o reanudar la jornada dispara el motor (C-3).
  imports: [AuthModule, AsignacionModule],
  controllers: [RepartidoresController, JornadaController],
  providers: [RepartidoresService, JornadaService, RepartidoresRepository],
  // AGENTS.md: repartidores.module.ts exporta SOLO el service
  exports: [RepartidoresService],
})
export class RepartidoresModule {}
