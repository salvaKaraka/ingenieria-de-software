import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RepartidoresController } from './repartidores.controller';
import { RepartidoresRepository } from './repartidores.repository';
import { RepartidoresService } from './repartidores.service';

@Module({
  imports: [AuthModule],
  controllers: [RepartidoresController],
  providers: [RepartidoresService, RepartidoresRepository],
  // AGENTS.md: repartidores.module.ts exporta SOLO el service
  exports: [RepartidoresService],
})
export class RepartidoresModule {}
