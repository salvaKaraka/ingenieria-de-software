import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { RepartidoresService } from './repartidores.service';
import type { TipoVehiculo } from '../../generated/prisma/client';
@Controller('repartidores')
export class RepartidoresController {
  constructor(private readonly repartidoresService: RepartidoresService) {}

  @Get()
  async obtenerTodos() {
  return this.repartidoresService.obtenerTodos(); 
  }

  @Post()
  async crear(
    @Body()
    body: {
      nombre: string;
      apellido: string;
      telefono: string;
      email: string;
      direccion: string;
      vehiculo: TipoVehiculo;
    },
  ) {
    return this.repartidoresService.crearRepartidor(body);
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.repartidoresService.actualizarRepartidor(id, body);
  }

  @Delete(':id')
  async bajaLogica(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.bajaLogica(id);
  }

  @Post(':id/resetear-pin')
  async resetearPin(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.resetearPin(id);
  }

  @Post(':id/jornada/iniciar')
  async iniciarJornada(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.cambiarEstadoJornada(id, 'DISPONIBLE');
  }

  @Post(':id/jornada/pausar')
  async pausarJornada(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.cambiarEstadoJornada(id, 'EN_PAUSA');
  }

  @Post(':id/jornada/reanudar')
  async reanudarJornada(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.cambiarEstadoJornada(id, 'DISPONIBLE');
  }

  @Post(':id/jornada/terminar')
  async terminarJornada(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.cambiarEstadoJornada(id, 'FUERA_DE_JORNADA');
  }

  @Get('flota')
  async obtenerFlota() {
    return this.repartidoresService.obtenerFlotaOperario();
  }
}