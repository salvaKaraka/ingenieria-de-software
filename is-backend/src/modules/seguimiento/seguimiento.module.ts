import { Module } from '@nestjs/common';
import { SeguimientoController } from './seguimiento.controller';
import { SeguimientoService } from './seguimiento.service';
import { SeguimientoRepository } from './seguimiento.repository';
import { MapasModule } from '../mapas/mapas.module';

@Module({
  imports: [MapasModule],
  controllers: [SeguimientoController],
  providers: [SeguimientoService, SeguimientoRepository],
  exports: [SeguimientoService],
})
export class SeguimientoModule {}
