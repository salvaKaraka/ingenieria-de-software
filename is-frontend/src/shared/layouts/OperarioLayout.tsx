import { NavLink, Outlet } from 'react-router'

const SECCIONES = [
  { ruta: '/operario/envios', nombre: 'Envíos' },
  { ruta: '/operario/comercios', nombre: 'Comercios' },
  { ruta: '/operario/repartidores', nombre: 'Repartidores' },
  { ruta: '/operario/flota', nombre: 'Flota' },
  { ruta: '/operario/excepciones', nombre: 'Excepciones' },
]

// Estructura del panel del operario: menú a la izquierda (arriba en pantallas chicas) y la página a la derecha.
export function OperarioLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 text-gray-900 md:flex-row">
      <aside className="border-b border-gray-200 bg-white md:w-56 md:border-r md:border-b-0">
        <p className="px-4 py-4 text-lg font-bold">Repartos</p>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {SECCIONES.map((seccion) => (
            <NavLink
              key={seccion.ruta}
              to={seccion.ruta}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`
              }
            >
              {seccion.nombre}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
