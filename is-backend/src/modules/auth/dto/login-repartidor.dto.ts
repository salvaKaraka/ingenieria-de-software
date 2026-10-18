import { Matches } from 'class-validator';

export class LoginRepartidorDto {
  @Matches(/^\d{4}$/, { message: 'El PIN debe tener exactamente 4 dígitos' })
  pin: string;
}
