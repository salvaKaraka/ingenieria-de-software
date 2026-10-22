import { Module } from '@nestjs/common';
import { RepartidoresController } from './repartidores.controller';
import { RepartidoresService } from './repartidores.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [RepartidoresController],
  providers: [RepartidoresService, PrismaService],
})
export class RepartidoresModule {}