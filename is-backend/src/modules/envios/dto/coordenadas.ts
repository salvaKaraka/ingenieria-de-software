import { applyDecorators } from '@nestjs/common';
import { IsLatitude, IsLongitude, IsNumber, ValidateIf } from 'class-validator';

// Punto en el mapa de una dirección del envío (HU 70). Es opcional, pero la latitud y la
// longitud van juntas: si viene una sola, el punto quedaría a medias.
type Punta = 'origen' | 'destino';

const vieneAlguna = (punta: Punta) => (dto: Partial<Record<string, unknown>>) =>
  dto[`${punta}Lat`] != null || dto[`${punta}Lon`] != null;

export const Latitud = (punta: Punta) =>
  applyDecorators(
    ValidateIf(vieneAlguna(punta)),
    IsNumber({}, { message: `Falta la latitud del punto de ${punta}` }),
    IsLatitude({ message: `La latitud del punto de ${punta} no es válida` }),
  );

export const Longitud = (punta: Punta) =>
  applyDecorators(
    ValidateIf(vieneAlguna(punta)),
    IsNumber({}, { message: `Falta la longitud del punto de ${punta}` }),
    IsLongitude({ message: `La longitud del punto de ${punta} no es válida` }),
  );
