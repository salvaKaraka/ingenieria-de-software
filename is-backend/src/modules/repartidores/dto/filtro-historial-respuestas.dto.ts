import { IsISO8601, IsOptional } from 'class-validator';

// Filtro opcional por rango de fechas para el historial de respuestas de ofertas (HU #28).
// Acepta formato ISO 8601 completo o fechas YYYY-MM-DD.
export class FiltroHistorialRespuestasDto {
  @IsOptional()
  @IsISO8601(
    {},
    { message: 'La fecha "desde" debe tener un formato ISO 8601 válido o YYYY-MM-DD' },
  )
  desde?: string;

  @IsOptional()
  @IsISO8601(
    {},
    { message: 'La fecha "hasta" debe tener un formato ISO 8601 válido o YYYY-MM-DD' },
  )
  hasta?: string;
}
