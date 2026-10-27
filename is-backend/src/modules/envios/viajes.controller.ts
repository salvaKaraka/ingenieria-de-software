import { Controller, Get, Post } from '@nestjs/common';
import { ViajesService } from './viajes.service';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';

@Controller('repartidor/viajes')
@Roles('REPARTIDOR')
export class ViajesController {
  constructor(private readonly viajesService: ViajesService) {}

  @Get('actual')
  async obtenerActual(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.viajesService.obtenerViajeActual(usuario.id);
  }

  @Post('actual/avanzar')
  async avanzarActual(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.viajesService.avanzarViajeActual(usuario.id);
  }
}