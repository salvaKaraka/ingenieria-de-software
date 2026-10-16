import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Public } from '../common/auth';
import type { TamanioPaquete, TipoVehiculo } from '../generated/prisma/client';
import { DevService } from './dev.service';

class VehiculoDto {
  @IsIn(['MOTO', 'AUTO', 'CAMION'])
  vehiculo: TipoVehiculo;
}

class TamanioDto {
  @IsIn(['CHICO', 'MEDIANO', 'GRANDE'])
  tamanio: TamanioPaquete;
}

// Herramientas de desarrollo (página /dev/motor del front). Públicas a propósito para probar rápido:
// por eso DevModule solo se registra fuera de producción (ver app.module.ts).
@Public()
@Controller('dev')
export class DevController {
  constructor(private readonly dev: DevService) {}

  @Get('estado')
  estado() {
    return this.dev.estado();
  }

  @Post('envios')
  crearEnvio(@Body() dto: TamanioDto) {
    return this.dev.crearEnvio(dto.tamanio);
  }

  @Post('repartidores')
  crearRepartidor(@Body() dto: VehiculoDto) {
    return this.dev.crearRepartidor(dto.vehiculo);
  }

  @Post('repartidores/:id/disponible')
  @HttpCode(200)
  ponerDisponible(@Param('id', ParseIntPipe) id: number) {
    return this.dev.ponerDisponible(id);
  }

  @Post('ofertas/vencer')
  @HttpCode(200)
  vencerOfertas() {
    return this.dev.vencerOfertas();
  }
}
