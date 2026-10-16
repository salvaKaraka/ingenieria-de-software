import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { alExpirarSesion, api } from '../../shared/api.ts'
import { SesionContext, type Usuario, type ValorSesion } from './sesion.ts'

// Guarda quién está logueado y lo comparte con toda la app.
// Los tokens NO pasan por acá: viven en cookies httpOnly que el navegador maneja solo.
export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Al abrir la app: ¿ya había una sesión? (si el access token venció, api() lo renueva solo)
    api<Usuario>('/auth/me')
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))

    // Si en algún momento la sesión no se puede renovar, la damos por cerrada.
    return alExpirarSesion(() => setUsuario(null))
  }, [])

  const loginOperario = useCallback(async (nombreUsuario: string, password: string) => {
    const respuesta = await api<{ usuario: Usuario }>('/auth/operario/login', {
      metodo: 'POST',
      datos: { usuario: nombreUsuario, password },
    })
    setUsuario(respuesta.usuario)
  }, [])

  const loginRepartidor = useCallback(async (pin: string) => {
    const respuesta = await api<{ usuario: Usuario }>('/auth/repartidor/login', { metodo: 'POST', datos: { pin } })
    setUsuario(respuesta.usuario)
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout', { metodo: 'POST' }).catch(() => undefined)
    setUsuario(null)
  }, [])

  const valor = useMemo<ValorSesion>(
    () => ({ usuario, cargando, loginOperario, loginRepartidor, logout }),
    [usuario, cargando, loginOperario, loginRepartidor, logout],
  )

  return <SesionContext value={valor}>{children}</SesionContext>
}
