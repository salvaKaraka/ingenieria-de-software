import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import { JornadaService } from './jornada.service';

// Endpoints del repartidor logueado sobre su propia jornada (C-3).
@Roles('REPARTIDOR')
@Controller('repartidor/jornada')
export class JornadaController {
  constructor(private readonly jornada: JornadaService) {}

  // La app lo consulta cada 10 segundos para mostrar el estado.
  @Get()
  estado(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.jornada.estado(usuario.id);
  }

  @Post('iniciar')
  @HttpCode(200)
  iniciar(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.jornada.iniciar(usuario.id);
  }

  @Post('pausar')
  @HttpCode(200)
  pausar(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.jornada.pausar(usuario.id);
  }

  @Post('reanudar')
  @HttpCode(200)
  reanudar(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.jornada.reanudar(usuario.id);
  }

  @Post('terminar')
  @HttpCode(200)
  terminar(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.jornada.terminar(usuario.id);
  }
}
