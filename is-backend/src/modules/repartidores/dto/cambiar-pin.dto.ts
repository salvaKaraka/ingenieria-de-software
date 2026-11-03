import { IsNotEmpty, IsString, Matches } from 'class-validator';

// Cambio de PIN por el propio repartidor (HU #68).
export class CambiarPinDto {
  @IsNotEmpty({ message: 'El PIN actual es obligatorio' })
  @IsString()
  pinActual: string;

  @IsNotEmpty({ message: 'El nuevo PIN es obligatorio' })
  @IsString()
  @Matches(/^\d{4,6}$/, {
    message: 'El nuevo PIN debe ser estrictamente numérico y tener entre 4 y 6 dígitos',
  })
  nuevoPin: string;
}
