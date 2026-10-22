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
import { Roles } from '../../common/auth';
import {
  ActualizarRepartidorDto,
  CrearRepartidorDto,
  FiltroRepartidoresDto,
} from './dto';
import { RepartidoresService } from './repartidores.service';

@Roles('OPERARIO')
@Controller('repartidores')
export class RepartidoresController {
  constructor(private readonly repartidoresService: RepartidoresService) {}

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
}
