import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

// Evidencia de entrega (E-4 / HU 18). Solo se mira al pasar a ENTREGADO, y solo lo que exige el comercio.
export class AvanzarViajeDto {
  // DNI de quien recibe. Solo dígitos: el front saca los puntos antes de mandarlo.
  @IsOptional()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni?: string;

  // Foto de evidencia capturada/subida (data URI o URL).
  @IsOptional()
  @IsString()
  foto?: string;

  @IsOptional()
  @IsString()
  fotoUrl?: string;

  // Compatibilidad hacia atrás si algún cliente envía la confirmación booleana
  @IsOptional()
  @IsBoolean()
  fotoEnviada?: boolean;
}

export class AdjuntarFotoDto {
  @IsString()
  foto!: string;
}
