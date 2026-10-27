import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

  // Solo dígitos: el front saca los puntos, así se compara igual que el que tipea el repartidor.
  // Opcional acá; el service lo exige si el comercio pide DNI al entregar.
  @IsOptional()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
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
