import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { Latitud, Longitud } from './coordenadas';

export class ReintentarEnvioDto {
  @IsString()
  @IsNotEmpty({ message: 'La dirección de destino no puede estar vacía' })
  @Matches(/\S/, { message: 'La dirección de destino no puede estar vacía' })
  destinoDireccion: string;

  @Latitud('destino')
  destinoLat?: number | null;

  @Longitud('destino')
  destinoLon?: number | null;
}
