import { Module } from '@nestjs/common';
import { OfertasController } from './ofertas.controller';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [OfertasController],
  providers: [OfertasService, PrismaService],
})
export class OfertasModule {}