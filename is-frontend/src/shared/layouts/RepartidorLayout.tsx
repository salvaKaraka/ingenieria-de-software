import { Outlet, useNavigate } from 'react-router'
import { useSesion } from '../../features/auth/sesion.ts'

// Estructura de la app del repartidor: pensada para celular, fondo oscuro (ahorra batería, riesgo 10)
// y alto contraste para leer a pleno sol (RNF-10).
export function RepartidorLayout() {
  const { usuario, logout } = useSesion()
  const navegar = useNavigate()

  async function salir() {
    await logout()
    navegar('/repartidor/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-lg text-white">
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <p className="truncate text-xl font-bold">{usuario?.nombre ?? 'Repartos'}</p>
        <button type="button" onClick={salir} className="shrink-0 text-base text-slate-400 underline">
          Salir
        </button>
      </header>
      <main className="mx-auto max-w-md space-y-6 p-4">
        <Outlet />
      </main>
    </div>
  )
}
