import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoVehiculo } from '../../../generated/prisma/client';

export class FiltroRepartidoresDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsEnum(TipoVehiculo)
  vehiculo?: TipoVehiculo;

  @IsOptional()
  @IsString()
  q?: string;
}
