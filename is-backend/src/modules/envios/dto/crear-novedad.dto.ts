import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CrearNovedadDto {
  @IsString()
  @IsEnum(['Cliente ausente', 'Dirección incorrecta'])
  tipo: string;

  @IsOptional()
  @IsString()
  comentario?: string;
}