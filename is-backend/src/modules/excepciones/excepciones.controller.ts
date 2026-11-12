import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import { AsignarManualDto } from './dto/asignar-manual.dto';
import { ExcepcionesService } from './excepciones.service';

// Panel de excepciones del operario (HU 12 y HU 22).
// Cancelar un envío desde el panel usa el endpoint que ya existe: POST /api/envios/:id/cancelar.
@Controller('excepciones')
@Roles('OPERARIO')
export class ExcepcionesController {
  constructor(private readonly excepcionesService: ExcepcionesService) {}

  @Get()
  listar() {
    return this.excepcionesService.listar();
  }

  @Get(':envioId/repartidores')
  repartidores(@Param('envioId', ParseIntPipe) envioId: number) {
    return this.excepcionesService.repartidoresAsignables(envioId);
  }

  // Es una acción, no crea un recurso visible: responde 200.
  @Post(':envioId/asignar')
  @HttpCode(HttpStatus.OK)
  asignar(
    @Param('envioId', ParseIntPipe) envioId: number,
    @Body() dto: AsignarManualDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.excepcionesService.asignarManual(
      envioId,
      dto.repartidorId,
      usuario.id,
    );
  }
}
