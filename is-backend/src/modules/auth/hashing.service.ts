import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';

// Todas las formas de hashear credenciales del sistema, en un solo lugar.
@Injectable()
export class HashingService {
  constructor(private readonly config: ConfigService) {}

  // Contraseña del operario: argon2 genera una sal aleatoria y la guarda dentro del hash,
  // y es lento a propósito para que probar millones de contraseñas sea carísimo.
  hashearPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  verificarPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  // PIN del repartidor: HMAC con una clave que vive en el .env y no en la base.
  // Sin sal aleatoria (mismo PIN -> mismo resultado) para poder buscar por él.
  hmacPin(pin: string): string {
    const clave = this.config.getOrThrow<string>('PIN_SECRET');
    return createHmac('sha256', clave).update(pin).digest('hex');
  }

  // PIN nuevo de 4 dígitos (puede empezar con 0, por eso se rellena: "0427").
  generarPin(): string {
    return randomInt(0, 10_000).toString().padStart(4, '0');
  }

  // Refresh token: 32 bytes aleatorios en hexadecimal = 64 caracteres.
  generarTokenAleatorio(): string {
    return randomBytes(32).toString('hex');
  }

  // SHA-256 simple alcanza: el token es aleatorio, así que no necesita sal ni ser lento.
  hashearToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
