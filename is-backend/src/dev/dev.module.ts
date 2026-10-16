import { Module } from '@nestjs/common';
import { AsignacionModule } from '../modules/asignacion/asignacion.module';
import { AuthModule } from '../modules/auth/auth.module';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';

// Solo existe fuera de producción. Borrar cuando estén B-3/B-5 (alta de envíos) y C-3/C-4 (jornada).
@Module({
  imports: [AsignacionModule, AuthModule],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
