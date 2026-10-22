import { Controller, Get, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { OfertasService } from './ofertas.service';

@Controller('repartidores')
export class OfertasController {
  constructor(private readonly ofertasService: OfertasService) {}

  @Get(':id/ofertas/pendientes')
  async obtenerPendientes(@Param('id', ParseIntPipe) id: number) {
    return this.ofertasService.obtenerOfertasPendientes(id);
  }

  @Post(':id/ofertas/:ofertaId/responder')
  async responder(
    @Param('id', ParseIntPipe) repartidorId: number,
    @Param('ofertaId', ParseIntPipe) ofertaId: number,
    @Body() body: { aceptar: boolean },
  ) {
    return this.ofertasService.responderOferta(ofertaId, repartidorId, body.aceptar);
  }
}