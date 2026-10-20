import { Body, Controller, Post } from '@nestjs/common';
import { EnviosService } from './envios.service';
import { CrearEnvioDto } from './dto/crear-envio.dto';
import { Roles } from '../../common/auth';

@Controller('envios')
@Roles('OPERARIO')
export class EnviosController {
  constructor(private readonly enviosService: EnviosService) {}

  @Post()
  async crear(@Body() dto: CrearEnvioDto) {
    return this.enviosService.crear(dto);
  }
}