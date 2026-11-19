import {
  Controller,
  Get,
  NotFoundException,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Roles } from '../../common/auth';
import { BuscarDireccionDto } from './dto/buscar-direccion.dto';
import { MapasService, type LugarEncontrado } from './mapas.service';

// Selector de direcciones del operario al cargar o editar un envío.
@Roles('OPERARIO')
@Controller('mapas')
export class MapasController {
  constructor(private readonly mapas: MapasService) {}

  @Get('buscar')
  async buscar(@Query() dto: BuscarDireccionDto): Promise<LugarEncontrado> {
    let lugar: LugarEncontrado | null;
    try {
      lugar = await this.mapas.buscar(dto.direccion);
    } catch {
      throw new ServiceUnavailableException(
        'El mapa no está disponible en este momento',
      );
    }
    if (!lugar) {
      throw new NotFoundException('No encontramos esa dirección en el mapa');
    }
    return lugar;
  }
}
