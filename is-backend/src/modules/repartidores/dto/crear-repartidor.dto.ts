import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TipoVehiculo } from '../../../generated/prisma/client';

export class CrearRepartidorDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  apellido: string;

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
