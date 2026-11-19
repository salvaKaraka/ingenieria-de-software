import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { LARGO_MAXIMO_FOTO } from './avanzar-viaje.dto';

const FOTO_DATA_URI =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

// HU39: Datos que envía el repartidor al confirmar la entrega de un paquete devuelto al comercio.
// Nota: `foto` se marca @IsOptional() acá para que cuando venga vacía o ausente sea el Service
// (o esta misma validación) quien responda con el mensaje exacto del criterio de aceptación:
// "Falta la foto de la constancia" (Escenario 2 de HU39).
export class ConfirmarDevolucionDto {
  @IsOptional()
  @IsString({ message: 'Falta la foto de la constancia' })
  @MaxLength(LARGO_MAXIMO_FOTO, { message: 'La foto es demasiado pesada' })
  @Matches(FOTO_DATA_URI, {
    message: 'La foto tiene que ser una imagen JPEG, PNG o WebP',
  })
  foto?: string;
}
