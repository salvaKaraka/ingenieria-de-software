import { Module } from '@nestjs/common';
import { EnviosController } from './envios.controller';
import { EnviosService } from './envios.service';
import { EnviosRepository } from './envios.repository';
import { AsignacionModule } from '../asignacion/asignacion.module';
import { ComerciosModule } from '../comercios/comercios.module';
import { ViajesService } from './viajes.service';

@Module({
  imports: [ComerciosModule, AsignacionModule],
  controllers: [
    EnviosController,
  ],
  providers: [
    EnviosService, 
    EnviosRepository,
    ViajesService,    
  ],
  exports: [EnviosService],
})
export class EnviosModule {}