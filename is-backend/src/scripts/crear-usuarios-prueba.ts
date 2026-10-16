// Crea (o deja listos) los usuarios de prueba para desarrollo local:
//   operario:   usuario "admin", contraseña "admin1234"
//   repartidor: PIN "1234" (moto)
//
//   npm run dev:usuarios                                          (backend corriendo en tu máquina)
//   docker compose exec api node dist/scripts/crear-usuarios-prueba   (backend en Docker)
//
// Se puede correr varias veces: si ya existen, los reactiva y les vuelve a poner esas credenciales.
// Se niega a correr contra una base que no sea local: estas credenciales jamás deben llegar a producción.
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import {
  PIN_REPARTIDOR_PRUEBA,
  verificarBaseLocal,
} from '../dev/dev.constants';
import { HashingService } from '../modules/auth/hashing.service';

const OPERARIO = {
  usuario: 'admin',
  password: 'admin1234',
  nombre: 'Admin de prueba',
};

async function main() {
  verificarBaseLocal();

  // Levanta los módulos de Nest sin servidor HTTP para reusar el hashing de la app.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const prisma = app.get(PrismaService);
    const hashing = app.get(HashingService, { strict: false });

    const passwordHash = await hashing.hashearPassword(OPERARIO.password);
    await prisma.operario.upsert({
      where: { usuario: OPERARIO.usuario },
      create: {
        usuario: OPERARIO.usuario,
        nombre: OPERARIO.nombre,
        passwordHash,
      },
      update: { passwordHash, activo: true },
    });

    // El HMAC depende del PIN_SECRET de cada máquina: por eso cada uno corre el script en la suya.
    const pinHmac = hashing.hmacPin(PIN_REPARTIDOR_PRUEBA);
    await prisma.repartidor.upsert({
      where: { pinHmac },
      create: {
        nombre: 'Repartidor',
        apellido: 'de Prueba',
        telefono: '221 000-0000',
        email: 'repartidor.prueba@example.com',
        direccion: 'Calle 1 y 50, La Plata',
        vehiculo: 'MOTO',
        pinHmac,
      },
      update: { activo: true },
    });

    console.log('Usuarios de prueba listos:');
    console.log(
      `  Operario   → http://localhost:5173/operario    usuario "${OPERARIO.usuario}", contraseña "${OPERARIO.password}"`,
    );
    console.log(
      `  Repartidor → http://localhost:5173/repartidor  PIN "${PIN_REPARTIDOR_PRUEBA}"`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
