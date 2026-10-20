import { Module } from '@nestjs/common';
import { EnviosController } from './envios.controller';
import { EnviosService } from './envios.service';
import { EnviosRepository } from './envios.repository';
import { ComerciosModule } from '../comercios/comercios.module';

@Module({
  imports: [ComerciosModule],
  controllers: [EnviosController],
  providers: [EnviosService, EnviosRepository],
  exports: [EnviosService],
})
export class EnviosModule {}