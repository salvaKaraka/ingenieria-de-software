import { Module } from '@nestjs/common';
import { EnviosController } from './envios.controller';
import { EnviosService } from './envios.service';
import { EnviosRepository } from './envios.repository';
import { AsignacionModule } from '../asignacion/asignacion.module';
import { ComerciosModule } from '../comercios/comercios.module';
import { ViajesController } from './viajes.controller';
import { ViajesService } from './viajes.service';

@Module({
  imports: [ComerciosModule, AsignacionModule],
  controllers: [EnviosController, ViajesController],
  providers: [EnviosService, EnviosRepository, ViajesService],
  exports: [EnviosService],
})
export class EnviosModule {}
