import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import { DepositoService } from './deposito.service';
import { CrearOrdenDevolucionDto } from './dto/crear-orden-devolucion.dto';
import { ReingresoDepositoDto } from './dto/reingreso-deposito.dto';

// ============================================================================
// CONTROLLER DE DEPÓSITO Y DEVOLUCIONES (HU37, HU38 y HU40)
// ============================================================================
// Todas las rutas requieren rol OPERARIO (`@Roles('OPERARIO')`) y toman el id
// del operario logueado desde `@UsuarioActual()`, nunca desde el body.
// ============================================================================
@Controller('envios/deposito')
@Roles('OPERARIO')
export class DepositoController {
  constructor(private readonly depositoService: DepositoService) {}

  // Pestaña Depósito: paquetes en custodia por comercio y órdenes de devolución.
  // Con subruta: GET /envios/deposito chocaría con GET /envios/:id.
  @Get('resumen')
  async resumen() {
    return this.depositoService.resumen();
  }

  // HU37: Registrar el reingreso de un paquete no entregado al depósito.
  @Post('reingreso')
  @HttpCode(HttpStatus.OK)
  async registrarReingreso(
    @Body() dto: ReingresoDepositoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.depositoService.registrarReingreso(dto, usuario.id);
  }

  // HU40: Obtener alertas de paquetes con 24 h o más en custodia sin orden de devolución.
  @Get('alertas')
  async listarAlertasDemora() {
    return this.depositoService.listarDevolucionesPendientesConAlerta();
  }

  // HU38: Listar los paquetes en custodia disponibles de un comercio para armar una orden.
  @Get('custodia')
  async listarCustodiaPorComercio(
    @Query('comercioId', ParseIntPipe) comercioId: number,
  ) {
    return this.depositoService.listarPaquetesEnCustodiaPorComercio(comercioId);
  }

  // HU38: Crear una orden de devolución agrupando paquetes en custodia de un único comercio.
  @Post('ordenes-devolucion')
  async crearOrdenDevolucion(
    @Body() dto: CrearOrdenDevolucionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.depositoService.crearOrdenDevolucion(dto, usuario.id);
  }
}
