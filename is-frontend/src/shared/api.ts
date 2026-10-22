// Cliente HTTP hacia el backend. Usalo siempre en lugar de fetch directo.
//
// Las rutas son relativas (/api/...): en desarrollo las reenvía el proxy de Vite y en producción
// el rewrite de Vercel. Para el navegador, front y API están en el mismo origen, así que las
// cookies de sesión (httpOnly) viajan solas: el código del front nunca ve ni guarda tokens.

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

type Opciones = {
  metodo?: Metodo
  // Objeto que se manda como JSON en el body
  datos?: unknown
}

// Error de la API con su código HTTP y los mensajes del backend.
// En errores de validación (400) `mensajes` trae uno por campo inválido.
export class ErrorApi extends Error {
  readonly status: number
  readonly mensajes: string[]

  constructor(status: number, mensajes: string[]) {
    super(mensajes[0] ?? `Error ${status}`)
    this.status = status
    this.mensajes = mensajes
  }
}

// Rutas en las que un 401 NO significa "access token vencido".
const RUTAS_SIN_RENOVACION = ['/auth/operario/login', '/auth/repartidor/login', '/auth/refresh', '/auth/logout']

let renovacionEnCurso: Promise<boolean> | null = null
const alExpirar = new Set<() => void>()

// Permite reaccionar cuando la sesión ya no se puede renovar (lo usa SesionProvider para mandar al login).
export function alExpirarSesion(callback: () => void): () => void {
  alExpirar.add(callback)
  return () => alExpirar.delete(callback)
}

// Si varias requests reciben 401 al mismo tiempo, todas esperan la MISMA renovación.
// Renovar dos veces en paralelo rotaría el refresh token dos veces y el backend lo tomaría como robo.
function renovarSesion(): Promise<boolean> {
  renovacionEnCurso ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((respuesta) => respuesta.ok)
    .catch(() => false)
    .finally(() => {
      renovacionEnCurso = null
    })
  return renovacionEnCurso
}

function pedir(ruta: string, { metodo = 'GET', datos }: Opciones) {
  return fetch(`/api${ruta}`, {
    method: metodo,
    credentials: 'include',
    headers: datos === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  })
}

async function crearError(respuesta: Response): Promise<ErrorApi> {
  try {
    const cuerpo = (await respuesta.json()) as { message?: string | string[] }
    const mensajes = Array.isArray(cuerpo.message) ? cuerpo.message : cuerpo.message ? [cuerpo.message] : []
    return new ErrorApi(respuesta.status, mensajes)
  } catch {
    return new ErrorApi(respuesta.status, [])
  }
}

// Ej:  const envios = await api<Envio[]>('/envios?estado=PENDIENTE')
//      await api('/comercios', { metodo: 'POST', datos: { nombre, telefono } })
export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  let respuesta = await pedir(ruta, opciones)

  // Access token vencido (dura 15 min): renovamos la sesión y reintentamos una sola vez.
  if (respuesta.status === 401 && !RUTAS_SIN_RENOVACION.includes(ruta)) {
    if (await renovarSesion()) {
      respuesta = await pedir(ruta, opciones)
    } else {
      alExpirar.forEach((callback) => callback())
    }
  }

  if (!respuesta.ok) throw await crearError(respuesta)
  if (respuesta.status === 204) return undefined as T
  return (await respuesta.json()) as T
}
