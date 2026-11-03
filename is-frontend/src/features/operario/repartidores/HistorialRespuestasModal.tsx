import { useCallback, useState, type FormEvent } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import { Boton, Modal } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'
import type { Repartidor } from './tipos.ts'

type EstadoOferta = 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA'

type DetalleRespuesta = {
  id: number
  estado: EstadoOferta
  fecha: string
  envioId: number
  codigoSeguimiento?: string
}

type HistorialRespuestas = {
  repartidorId: number
  rango: {
    desde: string | null
    hasta: string | null
  }
  totales: {
    aceptadas: number
    rechazadas: number
    vencidas: number
  }
  detalle: DetalleRespuesta[]
}

type Props = {
  abierto: boolean
  repartidor: Repartidor | null
  onCerrar: () => void
}

const BADGE_ESTADO: Record<EstadoOferta, { clase: string; texto: string }> = {
  ACEPTADA: {
    clase: 'bg-green-100 text-green-800 border-green-300',
    texto: 'Aceptada',
  },
  RECHAZADA: {
    clase: 'bg-red-100 text-red-800 border-red-300',
    texto: 'Rechazada',
  },
  VENCIDA: {
    clase: 'bg-amber-100 text-amber-800 border-amber-300',
    texto: 'Vencida',
  },
}

function HistorialContenido({
  repartidor,
  onCerrar,
}: {
  repartidor: Repartidor
  onCerrar: () => void
}) {
  const [datos, setDatos] = useState<HistorialRespuestas | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros de fecha
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const consultar = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)

      const query = params.toString() ? `?${params.toString()}` : ''
      const res = await api<HistorialRespuestas>(
        `/repartidores/${repartidor.id}/historial-respuestas${query}`,
      )
      setDatos(res)
      setError(null)
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(err.mensajes[0] || 'Error al consultar el historial.')
      } else {
        setError('No se pudo conectar con el servidor.')
      }
    }
  }, [repartidor.id, desde, hasta])

  // Polling de 15 segundos para el panel del operario (AGENTS.md)
  usePolling(consultar, 15_000)

  async function handleFiltrar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)

      const query = params.toString() ? `?${params.toString()}` : ''
      const res = await api<HistorialRespuestas>(
        `/repartidores/${repartidor.id}/historial-respuestas${query}`,
      )
      setDatos(res)
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(err.mensajes[0] || 'Error al consultar el historial.')
      } else {
        setError('No se pudo conectar con el servidor.')
      }
    } finally {
      setCargando(false)
    }
  }

  async function handleLimpiar() {
    setDesde('')
    setHasta('')
    setCargando(true)
    setError(null)
    try {
      const res = await api<HistorialRespuestas>(
        `/repartidores/${repartidor.id}/historial-respuestas`,
      )
      setDatos(res)
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(err.mensajes[0] || 'Error al consultar el historial.')
      } else {
        setError('No se pudo conectar con el servidor.')
      }
    } finally {
      setCargando(false)
    }
  }

  function formatearFecha(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6">
      {/* Subtítulo informativo */}
      <p className="text-sm text-gray-500">
        Registro inmutable y auditoría de ofertas recibidas por el chofer.
      </p>

      {/* Tarjetas con métricas agregadas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-green-200 bg-green-50/70 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
            Ofertas Aceptadas
          </p>
          <p className="mt-1 text-3xl font-bold text-green-900">
            {datos?.totales.aceptadas ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
            Ofertas Rechazadas
          </p>
          <p className="mt-1 text-3xl font-bold text-red-900">
            {datos?.totales.rechazadas ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Ofertas Vencidas
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-900">
            {datos?.totales.vencidas ?? 0}
          </p>
        </div>
      </div>

      {/* Controles de filtrado por rango de fechas */}
      <form
        onSubmit={(e) => void handleFiltrar(e)}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-desde" className="text-xs font-medium text-gray-600">
            Fecha desde
          </label>
          <input
            id="filtro-desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-hasta" className="text-xs font-medium text-gray-600">
            Fecha hasta
          </label>
          <input
            id="filtro-hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <Boton type="submit" disabled={cargando}>
            Filtrar
          </Boton>
          {(desde || hasta) && (
            <Boton
              type="button"
              variante="secundario"
              onClick={() => void handleLimpiar()}
              disabled={cargando}
            >
              Limpiar
            </Boton>
          )}
        </div>
      </form>

      {/* Mensaje de error si ocurre */}
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Detalle cronológico de respuestas */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Detalle de Respuestas ({datos?.detalle.length ?? 0})
        </h3>

        {!datos ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Cargando historial…
          </p>
        ) : datos.detalle.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center">
            <p className="text-sm font-medium text-gray-600">
              No hay ofertas registradas para este repartidor
              {desde || hasta ? ' en el período seleccionado.' : '.'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Los contadores permanecen en 0 y no se registran eventos.
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 sticky top-0 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Fecha y Hora
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Envío / Código
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right">
                    ID Oferta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {datos.detalle.map((item) => {
                  const badge = BADGE_ESTADO[item.estado] ?? {
                    clase: 'bg-gray-100 text-gray-800 border-gray-200',
                    texto: item.estado,
                  }
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.clase}`}
                        >
                          {badge.texto}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                        {formatearFecha(item.fecha)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-800">
                        {item.codigoSeguimiento ? (
                          <span>{item.codigoSeguimiento}</span>
                        ) : (
                          <span>Envío #{item.envioId}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-gray-400">
                        #{item.id}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Botón de cierre */}
      <div className="flex justify-end pt-2">
        <Boton type="button" variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </div>
  )
}

export function HistorialRespuestasModal({ abierto, repartidor, onCerrar }: Props) {
  if (!abierto || !repartidor) return null

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Historial de Respuestas: ${repartidor.nombre} ${repartidor.apellido}`}
      ancho="max-w-3xl"
    >
      <HistorialContenido repartidor={repartidor} onCerrar={onCerrar} />
    </Modal>
  )
}
