import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TamanioPaquete } from '../../../generated/prisma/client';

export class CrearEnvioDto {
  @IsInt({ message: 'El ID del comercio es obligatorio' })
  @Min(1, { message: 'El ID del comercio es obligatorio' })
  comercioId: number;

  @IsString()
  @IsNotEmpty({ message: 'La dirección de destino es obligatoria' })
  destinoDireccion: string;

  // Opcional, pero si viene no puede estar vacía: el envío quedaría sin origen.
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La dirección de origen no puede estar vacía' })
  origenDireccion?: string;

  @IsString()
  @IsOptional()
  destinatarioNombre?: string;

  @IsString()
  @IsOptional()
  destinatarioApellido?: string;

  @IsString()
  @IsOptional()
  destinatarioDni?: string;

  @IsString()
  @IsOptional()
  destinatarioTelefono?: string;

  @IsEnum(TamanioPaquete, {
    message: 'El tamaño debe ser CHICO, MEDIANO o GRANDE',
  })
  tamanio: TamanioPaquete;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
