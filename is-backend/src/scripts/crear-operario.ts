// Crea un operario desde la terminal (no hay registro público en la app).
//   npm run operario:crear -- <usuario> "<nombre>"
// La contraseña se pide por consola para que no quede en el historial de comandos.
// En producción (Railway): node dist/scripts/crear-operario <usuario> "<nombre>"
import { NestFactory } from '@nestjs/core';
import { createInterface } from 'node:readline/promises';
import { AppModule } from '../app.module';
import { AuthService } from '../modules/auth/auth.service';

async function main() {
  const [usuario, nombre] = process.argv.slice(2);
  if (!usuario || !nombre) {
    console.error('Uso: npm run operario:crear -- <usuario> "<nombre>"');
    process.exit(1);
  }

  const consola = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const password = await consola.question('Contraseña (mínimo 8 caracteres): ');
  consola.close();
  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  // Levanta los módulos de Nest sin servidor HTTP, para reusar AuthService (y su hashing).
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const operario = await app
      .get(AuthService)
      .crearOperario(usuario, password, nombre);
    console.log(`Operario "${operario.usuario}" creado (id ${operario.id}).`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
