import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

// HU37: Datos que envía el operario al confirmar el reingreso de un paquete no entregado
// durante la rendición de la jornada de un repartidor.
export class ReingresoDepositoDto {
  @Type(() => Number)
  @IsInt({ message: 'repartidorId debe ser un número entero' })
  @Min(1, { message: 'repartidorId debe ser mayor a 0' })
  repartidorId!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'El código de seguimiento es obligatorio' })
  @IsNotEmpty({ message: 'El código de seguimiento es obligatorio' })
  codigoSeguimiento!: string;
}
