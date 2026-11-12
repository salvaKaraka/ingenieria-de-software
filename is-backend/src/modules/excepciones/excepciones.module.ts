import { Module } from '@nestjs/common';
import { ExcepcionesController } from './excepciones.controller';
import { ExcepcionesRepository } from './excepciones.repository';
import { ExcepcionesService } from './excepciones.service';

// Panel de excepciones (HU 12 y HU 22). No exporta nada: solo lo usa su controller.
@Module({
  controllers: [ExcepcionesController],
  providers: [ExcepcionesService, ExcepcionesRepository],
})
export class ExcepcionesModule {}
