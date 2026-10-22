import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';

// En un PATCH los campos que no vienen no se tocan. No se usa @IsOptional porque también
// deja pasar null, y null en una columna obligatoria terminaba en un 500 de Prisma.
const SI_VIENE = (_dto: object, valor: unknown) => valor !== undefined;

export class ActualizarComercioDto {
  @ValidateIf(SI_VIENE)
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre?: string;

  @ValidateIf(SI_VIENE)
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  telefono?: string;

  @ValidateIf(SI_VIENE)
  @IsString({ message: 'La dirección es obligatoria' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  direccion?: string;

  @ValidateIf(SI_VIENE)
  @IsEmail({}, { message: 'El formato de email no es válido' })
  email?: string;

  @ValidateIf(SI_VIENE)
  @IsBoolean({ message: 'requiereFoto debe ser booleano' })
  requiereFoto?: boolean;

  @ValidateIf(SI_VIENE)
  @IsBoolean({ message: 'requiereDni debe ser booleano' })
  requiereDni?: boolean;
}
