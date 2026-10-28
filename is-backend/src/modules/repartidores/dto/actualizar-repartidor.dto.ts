import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { TipoVehiculo } from '../../../generated/prisma/client';

export class ActualizarRepartidorDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  // Solo dígitos: el front saca los puntos antes de mandarlo, así "12.345.678" y
  // "12345678" no quedan como dos DNI distintos.
  @IsOptional()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni?: string;

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
