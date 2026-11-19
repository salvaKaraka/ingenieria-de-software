import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum MotivoNovedadDomicilio {
  CLIENTE_AUSENTE = 'CLIENTE_AUSENTE',
  DIRECCION_INCORRECTA = 'DIRECCION_INCORRECTA',
  DEMORADO = 'DEMORADO',
}

export const ETIQUETA_MOTIVO_NOVEDAD: Record<MotivoNovedadDomicilio, string> = {
  CLIENTE_AUSENTE: 'Cliente ausente',
  DIRECCION_INCORRECTA: 'Dirección incorrecta',
  DEMORADO: 'Demorado',
};

export class ReportarNovedadDto {
  @IsEnum(MotivoNovedadDomicilio, {
    message:
      'El motivo debe ser CLIENTE_AUSENTE, DIRECCION_INCORRECTA o DEMORADO',
  })
  motivo: MotivoNovedadDomicilio;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'El comentario no puede superar 250 caracteres' })
  comentario?: string;
}
