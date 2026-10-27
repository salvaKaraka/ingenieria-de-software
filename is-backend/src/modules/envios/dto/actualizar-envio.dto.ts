import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TamanioPaquete } from '../../../generated/prisma/client';

export class ActualizarEnvioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La dirección de destino no puede estar vacía' })
  destinoDireccion?: string;

  @IsOptional()
  @IsString()
  destinatarioNombre?: string;

  @IsOptional()
  @IsString()
  destinatarioApellido?: string;

  @IsOptional()
  @IsString()
  destinatarioDni?: string;

  @IsOptional()
  @IsString()
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
