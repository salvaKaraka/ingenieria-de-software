import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BuscarDireccionDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribí una dirección para buscarla en el mapa' })
  @MaxLength(200)
  direccion: string;
}
