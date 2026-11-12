import { IsInt, IsPositive } from 'class-validator';

// Asignación manual desde el panel de excepciones (HU 22).
export class AsignarManualDto {
  @IsInt({ message: 'Elegí un repartidor' })
  @IsPositive({ message: 'Elegí un repartidor' })
  repartidorId: number;
}
