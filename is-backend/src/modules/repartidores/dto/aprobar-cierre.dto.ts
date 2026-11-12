import { IsInt, Min } from 'class-validator';

// Lo que el operario contó en la base. Los viajes y los paquetes a devolver los calcula el
// sistema: no se aceptan del cliente para que no se pueda saltear la validación.
export class AprobarCierreDto {
  @IsInt({ message: 'Los paquetes devueltos deben ser un número entero' })
  @Min(0, { message: 'Los paquetes devueltos no pueden ser negativos' })
  paquetesDevueltos: number;
}
