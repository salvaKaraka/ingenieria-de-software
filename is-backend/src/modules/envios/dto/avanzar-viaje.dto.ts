import { IsBoolean, IsOptional, Matches } from 'class-validator';

// Evidencia de entrega (E-4). Solo se mira al pasar a ENTREGADO, y solo lo que exige el comercio.
export class AvanzarViajeDto {
  // DNI de quien recibe. Solo dígitos: el front saca los puntos antes de mandarlo.
  @IsOptional()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni?: string;

  // La foto no pasa por el sistema: se manda por WhatsApp y acá el repartidor confirma que lo hizo.
  @IsOptional()
  @IsBoolean()
  fotoEnviada?: boolean;
}
