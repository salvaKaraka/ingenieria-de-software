import { IsOptional, Matches, MaxLength } from 'class-validator';

// Largo máximo del data URI de la foto (unos 670 kb de imagen). Tiene que entrar en el límite
// del body JSON de configurar-app.ts (1mb); el front la comprime a mucho menos que esto.
export const LARGO_MAXIMO_FOTO = 900_000;

// Solo una imagen embebida: nunca una URL externa ni otro tipo de contenido, porque el
// panel del operario la muestra tal cual.
const FOTO_DATA_URI =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

// Evidencia de entrega (E-4 / HU 18). Solo se mira al pasar a ENTREGADO, y solo lo que exige el comercio.
export class AvanzarViajeDto {
  // DNI de quien recibe. Solo dígitos: el front saca los puntos antes de mandarlo.
  @IsOptional()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni?: string;

  // Foto de la entrega, sacada en la app y comprimida por el front.
  @IsOptional()
  @MaxLength(LARGO_MAXIMO_FOTO, { message: 'La foto es demasiado pesada' })
  @Matches(FOTO_DATA_URI, {
    message: 'La foto tiene que ser una imagen JPEG, PNG o WebP',
  })
  foto?: string;
}
