import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { TamanioPaquete } from '../../../generated/prisma/client';

export class ActualizarEnvioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La dirección de destino no puede estar vacía' })
  destinoDireccion?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del destinatario no puede estar vacío' })
  destinatarioNombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El apellido del destinatario no puede estar vacío' })
  destinatarioApellido?: string;

  // Mismo formato que en el alta: el repartidor lo compara contra el que tipea al entregar (E-4).
  @IsOptional()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  destinatarioDni?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El teléfono del destinatario no puede estar vacío' })
  destinatarioTelefono?: string;

  @IsOptional()
  @IsEnum(TamanioPaquete, {
    message: 'El tamaño debe ser CHICO, MEDIANO o GRANDE',
  })
  tamanio?: TamanioPaquete;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
