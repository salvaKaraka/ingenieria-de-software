import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReportarIncidenteDto {
  @IsOptional()
  @IsString({ message: 'Ingresá la ubicación del incidente' })
  @MinLength(3, { message: 'La ubicación debe tener al menos 3 caracteres' })
  @MaxLength(250, { message: 'La ubicación no puede superar 250 caracteres' })
  ubicacion?: string;
}
