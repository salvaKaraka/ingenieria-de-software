import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';
import { TipoVehiculo } from '../../../generated/prisma/client';

export class CrearRepartidorDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  apellido: string;

  // Solo dígitos: el front saca los puntos antes de mandarlo, así "12.345.678" y
  // "12345678" no quedan como dos DNI distintos.
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  telefono: string;

  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  direccion: string;

  @IsEnum(TipoVehiculo, {
    message: 'El vehículo debe ser MOTO, AUTO o CAMION',
  })
  vehiculo: TipoVehiculo;
}
