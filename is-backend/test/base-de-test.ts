import 'dotenv/config';

// Los tests e2e usan una base propia (<base>_test) para no tocar los datos de desarrollo
// y para poder vaciarla antes de cada test. Ej: .../is_db -> .../is_db_test
export function urlBaseDeTest(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const nombre = url.pathname.slice(1);
  if (!nombre.endsWith('_test')) url.pathname = `/${nombre}_test`;
  return url.toString();
}
