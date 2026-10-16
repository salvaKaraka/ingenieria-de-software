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
import { HashingService } from '../modules/auth/hashing.service';

const OPERARIO = {
  usuario: 'admin',
  password: 'admin1234',
  nombre: 'Admin de prueba',
};
const PIN_REPARTIDOR = '1234';
const HOSTS_LOCALES = ['localhost', '127.0.0.1', 'db'];

function verificarBaseLocal() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (!HOSTS_LOCALES.includes(host)) {
    throw new Error(
      `La base "${host}" no es local. Este script es solo para desarrollo.`,
    );
  }
}

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
    const pinHmac = hashing.hmacPin(PIN_REPARTIDOR);
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
      `  Repartidor → http://localhost:5173/repartidor  PIN "${PIN_REPARTIDOR}"`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
