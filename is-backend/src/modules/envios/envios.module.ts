import { Module } from '@nestjs/common';
import { EnviosController } from './envios.controller';
import { EnviosService } from './envios.service';
import { EnviosRepository } from './envios.repository';
import { AsignacionModule } from '../asignacion/asignacion.module';
import { ComerciosModule } from '../comercios/comercios.module';
import { DepositoController } from './deposito.controller';
import { DepositoRepository } from './deposito.repository';
import { DepositoService } from './deposito.service';
import { ViajesController } from './viajes.controller';
import { ViajesService } from './viajes.service';

@Module({
  imports: [ComerciosModule, AsignacionModule],
  controllers: [EnviosController, ViajesController, DepositoController],
  providers: [
    EnviosService,
    EnviosRepository,
    ViajesService,
    DepositoService,
    DepositoRepository,
  ],
  exports: [EnviosService, DepositoService],
})
export class EnviosModule {}
