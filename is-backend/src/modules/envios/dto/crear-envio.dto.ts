import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum TamanoPaquete {
  CHICO = 'CHICO',
  MEDIANO = 'MEDIANO',
  GRANDE = 'GRANDE',
}

export class CrearEnvioDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El ID del comercio es obligatorio' })
  comercioId: number;

  @IsString()
  @IsNotEmpty({ message: 'La dirección de destino es obligatoria' })
  destinoDireccion: string;

  @IsString()
  @IsOptional()
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

  @IsEnum(TamanoPaquete, { message: 'El tamaño debe ser CHICO, MEDIANO o GRANDE' })
  tamanio: TamanoPaquete;

  @IsString()
  @IsOptional()
  observaciones?: string;
}