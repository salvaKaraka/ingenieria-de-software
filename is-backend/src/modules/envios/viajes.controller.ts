import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import { AvanzarViajeDto } from './dto/avanzar-viaje.dto';
import { ReportarIncidenteDto } from './dto/reportar-incidente.dto';
import { ViajesService } from './viajes.service';

// Endpoints del repartidor logueado sobre su viaje activo (E-2).
@Roles('REPARTIDOR')
@Controller('repartidor/viajes')
export class ViajesController {
  constructor(private readonly viajesService: ViajesService) {}

  // La app lo consulta cada 10 segundos.
  @Get('actual')
  obtenerActual(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.viajesService.obtenerViajeActual(usuario.id);
  }

  // HU 34: "Mi historial", las entregas del día en curso.
  @Get('historial')
  obtenerHistorial(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.viajesService.historialDelDia(usuario.id);
  }

  // Es una acción, no crea un recurso: responde 200.
  @Post('actual/avanzar')
  @HttpCode(200)
  avanzarActual(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() evidencia: AvanzarViajeDto,
  ) {
    return this.viajesService.avanzarViajeActual(usuario.id, evidencia);
  }

  @Post('actual/incidente')
  @HttpCode(200)
  reportarIncidente(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ReportarIncidenteDto,
  ) {
    return this.viajesService.reportarIncidente(usuario.id, dto);
  }
}
