import { Module } from '@nestjs/common';
import { ComerciosController } from './comercios.controller';
import { ComerciosService } from './comercios.service';
import { ComerciosRepository } from './comercios.repository';

@Module({
  controllers: [ComerciosController],
  providers: [ComerciosService, ComerciosRepository],
  exports: [ComerciosService], // 👈 Criterio obligatorio para permitir reutilización en B-3
})
export class ComerciosModule {}
