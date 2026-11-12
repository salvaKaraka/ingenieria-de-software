import { Matches } from 'class-validator';

// Cambio de PIN por el propio repartidor (HU #68).
// Solo viaja el PIN actual: el nuevo lo genera el sistema, el repartidor no lo elige.
export class CambiarPinDto {
  @Matches(/^\d{4}$/, {
    message: 'El PIN actual debe tener exactamente 4 dígitos',
  })
  pinActual: string;
}
