import { ErrorApi } from '../../shared/api.ts'

// Traduce el error de un login a un mensaje para mostrar en pantalla.
export function mensajeDeErrorDeLogin(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.status === 429) return 'Demasiados intentos. Esperá un minuto y probá de nuevo.'
    if (error.status === 401 || error.status === 400) return 'Los datos ingresados no son correctos.'
  }
  return 'No se pudo conectar con el servidor. Probá de nuevo.'
}

// Ruta a la que se quería entrar antes de que RutaProtegida mandara al login.
export function rutaPrevia(estado: unknown): string | undefined {
  return (estado as { desde?: string } | null)?.desde
}
