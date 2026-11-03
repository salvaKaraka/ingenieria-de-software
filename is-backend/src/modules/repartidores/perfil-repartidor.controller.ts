import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import { ActualizarPerfilRepartidorDto, CambiarPinDto } from './dto';
import { RepartidoresService } from './repartidores.service';

// Endpoints del repartidor logueado sobre su propio perfil (HU #68).
@Roles('REPARTIDOR')
@Controller('repartidor/perfil')
export class PerfilRepartidorController {
  constructor(private readonly repartidoresService: RepartidoresService) {}

  @Get()
  obtener(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.repartidoresService.buscarPorId(usuario.id);
  }

  @Patch()
  @HttpCode(200)
  actualizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarPerfilRepartidorDto,
  ) {
    return this.repartidoresService.actualizarPerfil(usuario.id, dto);
  }

  @Post('cambiar-pin')
  @HttpCode(200)
  cambiarPin(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: CambiarPinDto,
  ) {
    return this.repartidoresService.cambiarPin(usuario.id, dto);
  }
}
