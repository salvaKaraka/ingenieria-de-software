import { Outlet } from 'react-router'

// Estructura de la app del repartidor: pensada para celular, fondo oscuro (ahorra batería, riesgo 10)
// y alto contraste para leer a pleno sol (RNF-10).
export function RepartidorLayout() {
  return (
    <div className="min-h-dvh bg-slate-950 text-lg text-white">
      <header className="border-b border-slate-800 px-4 py-3">
        <p className="text-xl font-bold">Repartos</p>
      </header>
      <main className="mx-auto max-w-md space-y-6 p-4">
        <Outlet />
      </main>
    </div>
  )
}
