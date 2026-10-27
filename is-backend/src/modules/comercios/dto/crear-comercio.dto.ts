import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Sin los espacios de los bordes, "Sol " no pasa como un comercio distinto de "Sol".
export const RECORTAR = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearComercioDto {
  @Transform(RECORTAR)
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  telefono: string;

  @IsEmail({}, { message: 'El formato de email no es válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;

  @IsString({ message: 'La dirección es obligatoria' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  direccion: string;

  @IsBoolean({ message: 'requiereFoto debe ser booleano' })
  @IsOptional()
  requiereFoto?: boolean;

  @IsBoolean({ message: 'requiereDni debe ser booleano' })
  @IsOptional()
  requiereDni?: boolean;
}
