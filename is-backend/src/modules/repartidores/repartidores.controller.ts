import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  Roles,
  UsuarioActual,
  type UsuarioAutenticado,
} from '../../common/auth';
import {
  ActualizarRepartidorDto,
  AprobarCierreDto,
  CrearRepartidorDto,
  FiltroRepartidoresDto,
} from './dto';
import { JornadaService } from './jornada.service';
import { RepartidoresService } from './repartidores.service';

@Roles('OPERARIO')
@Controller('repartidores')
export class RepartidoresController {
  constructor(
    private readonly repartidoresService: RepartidoresService,
    private readonly jornadaService: JornadaService,
  ) {}

  @Get()
  listar(@Query() filtros: FiltroRepartidoresDto) {
    return this.repartidoresService.listar(filtros);
  }

  @Get(':id')
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.buscarPorId(id);
  }

  @Post()
  @HttpCode(201)
  crear(@Body() dto: CrearRepartidorDto) {
    return this.repartidoresService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarRepartidorDto,
  ) {
    return this.repartidoresService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  darDeBaja(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.darDeBaja(id);
  }

  @Post(':id/resetear-pin')
  @HttpCode(200)
  resetearPin(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.resetearPin(id);
  }

  // Devuelve el PIN nuevo una única vez, igual que el alta.
  @Post(':id/reactivar')
  @HttpCode(200)
  reactivar(@Param('id', ParseIntPipe) id: number) {
    return this.repartidoresService.reactivar(id);
  }

  @Get(':id/rendicion')
  rendicion(@Param('id', ParseIntPipe) id: number) {
    return this.jornadaService.rendicion(id);
  }

  @Post(':id/aprobar-cierre')
  @HttpCode(200)
  aprobarCierre(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprobarCierreDto,
    @UsuarioActual() operario: UsuarioAutenticado,
  ) {
    return this.jornadaService.aprobarCierre(id, dto, operario.id);
  }
}
