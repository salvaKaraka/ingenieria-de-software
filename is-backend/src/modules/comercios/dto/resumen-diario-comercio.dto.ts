import { IsDateString, Matches } from 'class-validator';

// Filtro obligatorio de fecha (AAAA-MM-DD) para generar el resumen diario de un comercio (HU 41).
export class ResumenDiarioComercioDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato AAAA-MM-DD',
  })
  @IsDateString(
    { strict: true },
    { message: 'La fecha debe ser una fecha válida (AAAA-MM-DD)' },
  )
  fecha!: string;
}
