import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../../shared/api.ts'

type Entrega = {
  envioId: number
  codigoSeguimiento: string
  comercio: string
  destinoDireccion: string
  // Llega como texto ISO desde la API
  entregadoEn: string
}

// "Mi historial" · HU 34: las entregas que el repartidor completó hoy, para controlar
// su trabajo antes de cerrar la jornada. Solo ENTREGADOS del día: el filtro lo hace el backend.
export function MiHistorialPage() {
  const [entregas, setEntregas] = useState<Entrega[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api<{ entregas: Entrega[] }>('/repartidor/viajes/historial')
      .then((respuesta) => setEntregas(respuesta.entregas))
      .catch(() => setError(true))
  }, [])

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi historial</h1>
        <Link to="/repartidor" className="inline-flex min-h-12 items-center px-2 text-lg text-slate-300 underline">
          Volver
        </Link>
      </div>

      {error && <p className="rounded-xl bg-red-900 p-4 text-center">No se pudo cargar el historial. Probá de nuevo.</p>}

      {!error && entregas === null && <p className="text-slate-400">Cargando…</p>}

      {entregas?.length === 0 && (
        <p className="rounded-xl bg-slate-800 p-6 text-center">Todavía no completaste entregas hoy</p>
      )}

      {entregas && entregas.length > 0 && (
        <>
          <p className="text-slate-300">
            {entregas.length === 1 ? '1 entrega hoy' : `${entregas.length} entregas hoy`}
          </p>
          <ul className="space-y-3">
            {entregas.map((entrega) => (
              <li key={entrega.envioId} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-bold">{entrega.comercio}</p>
                  <p className="shrink-0 text-xl font-bold text-yellow-400">{horaDe(entrega.entregadoEn)}</p>
                </div>
                <p className="text-lg text-slate-300">{entrega.destinoDireccion}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

// Hora en Argentina (HH:MM), aunque el celular tenga otra zona configurada.
function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}
