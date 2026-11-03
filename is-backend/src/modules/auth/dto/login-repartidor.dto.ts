import { Matches } from 'class-validator';

export class LoginRepartidorDto {
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe tener entre 4 y 6 dígitos' })
  pin: string;
}
