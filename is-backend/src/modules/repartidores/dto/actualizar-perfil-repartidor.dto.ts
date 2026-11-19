import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Actualización de perfil por el propio repartidor (HU #68).
// Únicamente se permite modificar teléfono y email.
export class ActualizarPerfilRepartidorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El teléfono no puede estar vacío' })
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email?: string;
}
