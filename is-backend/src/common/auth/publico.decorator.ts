import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

// Marca un endpoint (o un controller entero) como accesible sin sesión.
// Ej: health, login, seguimiento público del destinatario.
export const Public = () => SetMetadata(ES_PUBLICO, true);
