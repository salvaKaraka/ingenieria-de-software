import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth';
import { SeguimientoService } from './seguimiento.service';
import type { TrackingPublicoDto } from './seguimiento.dto';

// Pantalla pública del destinatario: no requiere sesión ni credenciales de usuario.
@Public()
@Controller('seguimiento')
export class SeguimientoController {
  constructor(private readonly service: SeguimientoService) {}

  // Límite de 30 consultas por minuto por IP para prevenir ataques de fuerza bruta / enumeración
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':codigo')
  consultar(@Param('codigo') codigo: string): Promise<TrackingPublicoDto> {
    return this.service.consultar(codigo);
  }
}
