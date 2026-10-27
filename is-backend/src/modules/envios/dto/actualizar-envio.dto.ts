import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { TamanioPaquete } from '../../../generated/prisma/client';

// Solo viajan los datos que cambian. Los obligatorios en el alta no se pueden vaciar (ni con
// null); el DNI y las observaciones sí se borran mandando null.
const SI_VIENE = (_: object, valor: unknown) => valor !== undefined;

export class ActualizarEnvioDto {
  @ValidateIf(SI_VIENE)
  @IsString()
  @IsNotEmpty({ message: 'La dirección de destino no puede estar vacía' })
  destinoDireccion?: string;

  @ValidateIf(SI_VIENE)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del destinatario no puede estar vacío' })
  destinatarioNombre?: string;

  @ValidateIf(SI_VIENE)
  @IsString()
  @IsNotEmpty({ message: 'El apellido del destinatario no puede estar vacío' })
  destinatarioApellido?: string;

  // Mismo formato que en el alta: el repartidor lo compara contra el que tipea al entregar (E-4).
  @IsOptional()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  destinatarioDni?: string | null;

  @ValidateIf(SI_VIENE)
  @IsString()
  @IsNotEmpty({ message: 'El teléfono del destinatario no puede estar vacío' })
  destinatarioTelefono?: string;

  @ValidateIf(SI_VIENE)
  @IsEnum(TamanioPaquete, {
    message: 'El tamaño debe ser CHICO, MEDIANO o GRANDE',
  })
  tamanio?: TamanioPaquete;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}
