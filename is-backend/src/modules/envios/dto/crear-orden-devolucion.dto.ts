import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

// HU38: Datos que envía el operario para agrupar paquetes en custodia de un único comercio
// y generar una orden de devolución que entra al motor de asignación automática.
export class CrearOrdenDevolucionDto {
  @Type(() => Number)
  @IsInt({ message: 'comercioId debe ser un número entero' })
  @Min(1, { message: 'comercioId debe ser mayor a 0' })
  comercioId!: number;

  @IsArray({ message: 'envioIds debe ser una lista de identificadores' })
  @ArrayNotEmpty({ message: 'Seleccioná al menos un paquete en custodia' })
  @ArrayUnique({ message: 'No se pueden repetir paquetes en la misma orden' })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: 'Cada id de envío debe ser un número entero',
  })
  @Min(1, { each: true })
  envioIds!: number[];
}
