// Cliente HTTP mínimo hacia el backend. La URL base sale de VITE_API_URL (ver .env.example).
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...opciones.headers },
  })
  if (!respuesta.ok) {
    throw new Error(`Error ${respuesta.status} en ${ruta}`)
  }
  return respuesta.json() as Promise<T>
}
