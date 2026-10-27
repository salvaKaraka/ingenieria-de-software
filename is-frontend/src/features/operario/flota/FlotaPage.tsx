import { useCallback, useState } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import { ETIQUETA_VEHICULO, type TipoVehiculo } from '../../../shared/tipos.ts'
import { usePolling } from '../../../shared/usePolling.ts'
import {
  COLOR_ESTADO_REPARTIDOR,
  ETIQUETA_ESTADO_REPARTIDOR,
  type Repartidor,
} from '../repartidores/tipos.ts'

type Flota = Record<TipoVehiculo, Repartidor[]>

const VEHICULOS: { tipo: TipoVehiculo; titulo: string; icono: string }[] = [
  { tipo: 'MOTO', titulo: 'Motos', icono: '🛵' },
  { tipo: 'AUTO', titulo: 'Autos', icono: '🚗' },
  { tipo: 'CAMION', titulo: 'Camiones', icono: '🚚' },
]

function horaCorta(fechaIso: string): string {
  try {
    return new Date(fechaIso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function FlotaPage() {
  const [flota, setFlota] = useState<Flota | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const datos = await api<Flota>('/flota')
      setFlota(datos)
      setError(null)
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(err.mensajes[0] || 'Error al cargar la flota.')
      } else {
        setError('No se pudo conectar con el servidor.')
      }
    } finally {
      setCargando(false)
    }
  }, [])

  // Refresco automático cada 15 s para el panel del operario (AGENTS.md)
  usePolling(cargar, 15_000)

  // Detección de emergencias para destacar en la cabecera (Escenario 1)
  const repartidoresEnEmergencia = Object.values(flota ?? {})
    .flat()
    .filter((r) => r.estado === 'EMERGENCIA')

  function renderCard(r: Repartidor, puestoCola?: number) {
    const esEmergencia = r.estado === 'EMERGENCIA'

    return (
      <div
        key={r.id}
        className={`flex flex-col gap-2 rounded-lg p-3 text-xs transition shadow-xs ${
          esEmergencia
            ? 'border-2 border-red-500 bg-red-50/90 shadow-md ring-1 ring-red-400'
            : 'border border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              {esEmergencia && (
                <span className="text-base" role="img" aria-label="Alerta emergencia">
                  🚨
                </span>
              )}
              <p
                className={`font-semibold ${
                  esEmergencia ? 'text-red-900 font-bold' : 'text-gray-900'
                }`}
              >
                {r.nombre} {r.apellido}
              </p>
            </div>
            <p className="text-xs text-gray-500">{r.telefono}</p>
          </div>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              esEmergencia
                ? 'bg-red-600 text-white font-bold'
                : COLOR_ESTADO_REPARTIDOR[r.estado]
            }`}
          >
            {ETIQUETA_ESTADO_REPARTIDOR[r.estado]}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
          {puestoCola ? (
            <div className="flex items-center gap-1.5 font-medium text-blue-700">
              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-bold">
                #{puestoCola}
              </span>
              <span>desde {horaCorta(r.enColaDesde!)}</span>
            </div>
          ) : (
            <span className="text-gray-400">
              Fuera de cola {r.estado === 'OCUPADO' ? '(en viaje)' : ''}
            </span>
          )}

          {r.viajesConsecutivos > 0 && (
            <span
              className="text-gray-500"
              title="Viajes consecutivos completados"
            >
              {r.viajesConsecutivos}{' '}
              {r.viajesConsecutivos === 1 ? 'viaje' : 'viajes'}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Flota en jornada</h1>
        <p className="text-sm text-gray-600">
          Supervisión de colas FIFO y estado operativo de repartidores activos.
          Se actualiza cada 15 segundos.
        </p>
      </div>

      {/* Alerta destacada si hay emergencias (Escenario 1) */}
      {repartidoresEnEmergencia.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-red-500 bg-red-100 p-4 text-red-950 shadow-sm">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-bold">Atención: Repartidor en Emergencia</p>
            <p className="text-sm">
              {repartidoresEnEmergencia
                .map(
                  (r) =>
                    `${r.nombre} ${r.apellido} (${ETIQUETA_VEHICULO[r.vehiculo]})`,
                )
                .join(', ')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {cargando && !flota ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Cargando estado de la flota…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {VEHICULOS.map(({ tipo, titulo, icono }) => {
            const repartidores = flota?.[tipo] ?? []
            // Repartidores en cola FIFO (Disponibles con enColaDesde no nulo)
            const disponibles = repartidores.filter(
              (r) => r.estado === 'DISPONIBLE' && r.enColaDesde !== null,
            )
            // Repartidores en otros estados operativos (Ocupado, En pausa, Emergencia)
            const otros = repartidores.filter(
              (r) => r.estado !== 'DISPONIBLE' || r.enColaDesde === null,
            )

            return (
              <section
                key={tipo}
                className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 p-4 shadow-xs"
              >
                {/* Cabecera de la columna */}
                <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" role="img" aria-label={titulo}>
                      {icono}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
                  </div>
                  <div className="flex gap-1 text-xs">
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-semibold text-blue-800">
                      {disponibles.length} en cola
                    </span>
                    <span className="rounded-full bg-gray-200 px-2.5 py-0.5 font-medium text-gray-700">
                      {repartidores.length} total
                    </span>
                  </div>
                </div>

                {/* Sección: Cola de disponibles (FIFO) */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Cola de disponibles
                  </span>

                  {/* Escenario 3: Mensaje literal si no hay disponibles */}
                  {disponibles.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-300 bg-white/60 py-3 text-center text-xs font-medium text-gray-500">
                      No hay repartidores disponibles
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {disponibles.map((r, index) => renderCard(r, index + 1))}
                    </div>
                  )}
                </div>

                {/* Sección: Otros en jornada (Ocupado, En pausa, Emergencia) */}
                {otros.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-gray-200 pt-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Otros en jornada ({otros.length})
                    </span>
                    <div className="flex flex-col gap-2">
                      {otros.map((r) => renderCard(r))}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
