import { createContext, useContext } from 'react'

export type Rol = 'OPERARIO' | 'REPARTIDOR'

// Usuario logueado, tal como lo devuelve el backend (GET /api/auth/me).
export type Usuario = { id: number; rol: Rol; nombre: string }

export type ValorSesion = {
  usuario: Usuario | null
  // true mientras se averigua, al abrir la app, si ya había una sesión
  cargando: boolean
  loginOperario: (usuario: string, password: string) => Promise<void>
  loginRepartidor: (pin: string) => Promise<void>
  logout: () => Promise<void>
}

export const SesionContext = createContext<ValorSesion | null>(null)

// Desde cualquier componente: const { usuario, logout } = useSesion()
export function useSesion(): ValorSesion {
  const valor = useContext(SesionContext)
  if (!valor) throw new Error('useSesion se usa dentro de <SesionProvider>')
  return valor
}

export const RUTA_LOGIN: Record<Rol, string> = {
  OPERARIO: '/operario/login',
  REPARTIDOR: '/repartidor/login',
}

export const RUTA_INICIO: Record<Rol, string> = {
  OPERARIO: '/operario/envios',
  REPARTIDOR: '/repartidor',
}
