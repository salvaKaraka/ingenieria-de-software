import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import { CrearEnvioDto } from './dto/crear-envio.dto';
import { ListarEnviosDto } from './dto/listar-envios.dto';
import { EnviosService } from './envios.service';

@Controller('envios')
@Roles('OPERARIO')
export class EnviosController {
  constructor(private readonly enviosService: EnviosService) {}

  @Post()
  async crear(@Body() dto: CrearEnvioDto) {
    return this.enviosService.crear(dto);
  }

  @Get()
  async listar(@Query() filtros: ListarEnviosDto) {
    return this.enviosService.listar(filtros);
  }

  @Get(':id')
  async obtener(@Param('id', ParseIntPipe) id: number) {
    return this.enviosService.obtenerDetalle(id);
  }

  // Es una acción, no crea un recurso: por eso responde 200 y no 201.
  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  async cancelar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.enviosService.cancelar(id, usuario.id);
  }
}
