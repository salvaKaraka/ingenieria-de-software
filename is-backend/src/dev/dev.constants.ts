// Datos fijos de las herramientas de desarrollo (probador /dev/motor y script dev:usuarios).

// PIN del repartidor de prueba que crea `npm run dev:usuarios` y que el probador nunca borra.
export const PIN_REPARTIDOR_PRUEBA = '1234';

const HOSTS_LOCALES = ['localhost', '127.0.0.1', 'db'];

// Las herramientas que crean usuarios con claves conocidas o borran datos solo corren contra una base local.
export function verificarBaseLocal() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (!HOSTS_LOCALES.includes(host)) {
    throw new Error(
      `La base "${host}" no es local. Esta herramienta es solo para desarrollo.`,
    );
  }
}
