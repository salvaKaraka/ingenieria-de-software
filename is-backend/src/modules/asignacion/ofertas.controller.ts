import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import { OfertasService } from './ofertas.service';

// Endpoints del repartidor logueado sobre sus ofertas (D-2).
@Roles('REPARTIDOR')
@Controller('repartidor/ofertas')
export class OfertasController {
  constructor(private readonly ofertas: OfertasService) {}

  // La app lo consulta cada 10 segundos.
  @Get('actual')
  async actual(@UsuarioActual() usuario: UsuarioAutenticado) {
    return { oferta: await this.ofertas.ofertaActual(usuario.id) };
  }

  @Post(':id/aceptar')
  @HttpCode(200)
  aceptar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.ofertas.aceptar(id, usuario.id);
  }

  @Post(':id/rechazar')
  @HttpCode(204)
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.ofertas.rechazar(id, usuario.id);
  }
}
