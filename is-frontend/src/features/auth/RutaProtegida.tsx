import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { RUTA_LOGIN, useSesion, type Rol } from './sesion.ts'

// Envuelve las rutas que necesitan sesión de un rol. Sin sesión (o con otro rol) manda al login
// correspondiente, recordando a dónde se quería ir para volver después de loguearse.
export function RutaProtegida({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { usuario, cargando } = useSesion()
  const ubicacion = useLocation()

  if (cargando) return <p className="p-6 opacity-70">Cargando…</p>

  if (!usuario || usuario.rol !== rol) {
    return <Navigate to={RUTA_LOGIN[rol]} replace state={{ desde: ubicacion.pathname }} />
  }

  return children
}
