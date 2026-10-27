import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/auth';
import { JornadaService } from './jornada.service';

// Vista de la flota en jornada para el operario (C-3/C-4).
@Roles('OPERARIO')
@Controller('flota')
export class FlotaController {
  constructor(private readonly jornada: JornadaService) {}

  @Get()
  obtenerFlota() {
    return this.jornada.flota();
  }
}
