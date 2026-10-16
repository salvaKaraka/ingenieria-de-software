// Valida las variables de entorno al arrancar: si falta algo, la app no levanta
// y el error dice qué falta (mejor que un fallo raro a mitad de un request).
const REQUERIDAS = ['DATABASE_URL', 'JWT_SECRET', 'PIN_SECRET'] as const;

export function validarEnv(config: Record<string, unknown>) {
  const faltantes = REQUERIDAS.filter((clave) => !config[clave]);
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno: ${faltantes.join(', ')}. Revisá el .env (plantilla en .env.example).`,
    );
  }
  return config;
}
