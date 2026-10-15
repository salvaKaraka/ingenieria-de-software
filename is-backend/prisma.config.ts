// Configuración del CLI de Prisma (migraciones, generate, studio).
// Prisma 7 no lee el .env solo: lo carga dotenv.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
