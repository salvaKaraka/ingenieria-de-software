import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EstadoEnvio } from '../../../generated/prisma/client';

// Los query params siempre llegan como texto: @Type(() => Number) los convierte
// (requiere ValidationPipe con transform: true, ver main.ts).
export class ListarEnviosDto {
  // Acepta uno o varios estados separados por coma: ?estado=ASIGNADO,RETIRADO
  // (el panel "En curso" de B-5 necesita varios a la vez).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsEnum(EstadoEnvio, {
    each: true,
    message: 'El estado no es válido',
  })
  estado?: EstadoEnvio[];

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'comercioId debe ser un número entero' })
  @Min(1)
  comercioId?: number;

  @IsOptional()
  @IsDateString({}, { message: 'desde debe ser una fecha (AAAA-MM-DD)' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'hasta debe ser una fecha (AAAA-MM-DD)' })
  hasta?: string;

  // Busca por código de seguimiento o por nombre/apellido del destinatario.
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;
}
