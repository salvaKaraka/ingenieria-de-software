import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoVehiculo } from '../../../generated/prisma/client';

export class ActualizarRepartidorDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsEnum(TipoVehiculo, {
    message: 'El vehículo debe ser MOTO, AUTO o CAMION',
  })
  vehiculo?: TipoVehiculo;
}
