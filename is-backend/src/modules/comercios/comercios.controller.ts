import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ComerciosService } from './comercios.service';
import { CrearComercioDto } from './dto/crear-comercio.dto';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto';
import { Roles } from '../../common/auth';

@Controller('comercios')
@Roles('OPERARIO') // 👈 Exigido por el Criterio 1: Protege todas las rutas de este controller
export class ComerciosController {
  constructor(private readonly comerciosService: ComerciosService) {}

  // 1. GET /api/comercios (con filtro opcional ?q=)
  @Get()
  async obtenerTodos(@Query('q') q?: string) {
    return this.comerciosService.obtenerTodos(q);
  }

  // 2. GET /api/comercios/:id
  @Get(':id')
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.comerciosService.obtenerPorId(id);
  }

  // 3. POST /api/comercios
  @Post()
  async crear(@Body() dto: CrearComercioDto) {
    return this.comerciosService.crear(dto);
  }

  // 4. PATCH /api/comercios/:id
  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarComercioDto,
  ) {
    return this.comerciosService.actualizar(id, dto);
  }

  // 5. DELETE /api/comercios/:id (Baja lógica)
  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.comerciosService.eliminarLogico(id);
  }
}
