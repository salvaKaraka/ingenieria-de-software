import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../shared/api.ts'

type Health = { status: string; db: string }

// Página de entrada para desarrollo: links a cada área y estado de la API.
export function InicioPage() {
  const [health, setHealth] = useState<Health | 'error' | null>(null)

  useEffect(() => {
    api<Health>('/health').then(setHealth).catch(() => setHealth('error'))
  }, [])

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <h1 className="text-2xl font-bold">Sistema de repartos</h1>
      <nav className="flex flex-col gap-3">
        <Link className="rounded-lg border p-4 hover:bg-gray-50" to="/operario">Panel del operario</Link>
        <Link className="rounded-lg border p-4 hover:bg-gray-50" to="/repartidor">App del repartidor</Link>
        <Link className="rounded-lg border p-4 hover:bg-gray-50" to="/seguimiento">Seguimiento de envío</Link>
        {import.meta.env.DEV && (
          <Link className="rounded-lg border border-dashed p-4 text-gray-500 hover:bg-gray-50" to="/dev/ui">Componentes (solo desarrollo)</Link>
        )}
      </nav>
      <p className="text-sm text-gray-500">
        API:{' '}
        {health === null ? 'consultando…' : health === 'error' ? 'sin conexión ❌' : `${health.status} · base ${health.db} ✅`}
      </p>
    </main>
  )
}
