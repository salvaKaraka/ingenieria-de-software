import { PartialType } from '@nestjs/mapped-types';
import { CrearComercioDto } from './crear-comercio.dto';

export class ActualizarComercioDto extends PartialType(CrearComercioDto) {}