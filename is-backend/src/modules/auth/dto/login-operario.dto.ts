import { IsNotEmpty, IsString } from 'class-validator';

export class LoginOperarioDto {
  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
