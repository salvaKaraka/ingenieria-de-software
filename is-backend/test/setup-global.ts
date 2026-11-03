import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { urlBaseDeTest } from './base-de-test';

// Corre una vez antes de todos los tests e2e: crea la base de test si no existe
// y le aplica las migraciones, así siempre tiene el mismo esquema que el código.
export default async function setupGlobal() {
  const url = new URL(urlBaseDeTest());
  const nombre = url.pathname.slice(1);

  // Para crear una base hay que conectarse a otra que ya exista ("postgres").
  const servidor = new URL(url);
  servidor.pathname = '/postgres';
  const cliente = new Client({ connectionString: servidor.toString() });
  await cliente.connect();
  const existe = await cliente.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [nombre],
  );
  if (existe.rowCount === 0) await cliente.query(`CREATE DATABASE "${nombre}"`);
  await cliente.end();

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'ignore',
  });
}
