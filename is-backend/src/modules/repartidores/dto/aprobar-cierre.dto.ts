import { IsInt, IsOptional, Min } from 'class-validator';

export class AprobarCierreDto {
  @IsOptional()
  @IsInt({ message: 'Los paquetes devueltos deben ser un número entero' })
  @Min(0, { message: 'Los paquetes devueltos no pueden ser negativos' })
  paquetesDevueltos?: number;

  @IsOptional()
  @IsInt({ message: 'Los viajes tomados deben ser un número entero' })
  @Min(0, { message: 'Los viajes tomados no pueden ser negativos' })
  viajesTomados?: number;

  @IsOptional()
  @IsInt({ message: 'Los paquetes entregados deben ser un número entero' })
  @Min(0, { message: 'Los paquetes entregados no pueden ser negativos' })
  paquetesEntregados?: number;
}
