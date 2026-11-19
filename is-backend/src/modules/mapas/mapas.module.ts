import { Module } from '@nestjs/common';
import { MapasController } from './mapas.controller';
import { MapasService } from './mapas.service';

// Acceso a servicios de mapas externos (HU 70). No tiene base de datos.
@Module({
  controllers: [MapasController],
  providers: [MapasService],
  exports: [MapasService],
})
export class MapasModule {}
