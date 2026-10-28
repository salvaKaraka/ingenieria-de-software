import { useCallback, useState } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import type { TipoVehiculo } from '../../../shared/tipos.ts'
import { Boton } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'
import { AprobarCierreModal } from '../repartidores/AprobarCierreModal.tsx'
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
  const [repartidorParaCierre, setRepartidorParaCierre] = useState<Repartidor | null>(null)

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

  // Refresco cada 15 s para el panel del operario (AGENTS.md)
  usePolling(cargar, 15_000)

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
            const enCola = repartidores.filter((r) => r.enColaDesde !== null)

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
                      {enCola.length} en cola
                    </span>
                    <span className="rounded-full bg-gray-200 px-2.5 py-0.5 font-medium text-gray-700">
                      {repartidores.length} total
                    </span>
                  </div>
                </div>

                {/* Lista de repartidores */}
                {repartidores.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">
                    No hay {titulo.toLowerCase()} en jornada
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {repartidores.map((r, index) => {
                      const estaEnCola = r.enColaDesde !== null

                      return (
                        <div
                          key={r.id}
                          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-xs transition hover:border-gray-300"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {r.nombre} {r.apellido}
                              </p>
                              <p className="text-xs text-gray-500">{r.telefono}</p>
                            </div>
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO_REPARTIDOR[r.estado]}`}
                            >
                              {ETIQUETA_ESTADO_REPARTIDOR[r.estado]}
                            </span>
                          </div>

                          <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                            {estaEnCola ? (
                              <div className="flex items-center gap-1.5 font-medium text-blue-700">
                                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-bold">
                                  #{index + 1}
                                </span>
                                <span>desde {horaCorta(r.enColaDesde!)}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">
                                Fuera de cola (en viaje / oferta)
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

                          <div className="flex justify-end border-t border-gray-100 pt-2">
                            <Boton
                              variante="secundario"
                              onClick={() => setRepartidorParaCierre(r)}
                            >
                              Aprobar cierre
                            </Boton>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <AprobarCierreModal
        abierto={repartidorParaCierre !== null}
        onCerrar={() => setRepartidorParaCierre(null)}
        onAprobado={() => void cargar()}
        repartidor={repartidorParaCierre}
      />
    </div>
  )
}
