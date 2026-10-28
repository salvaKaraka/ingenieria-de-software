import { useCallback, useState, type ReactNode } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import type { TipoVehiculo } from '../../../shared/tipos.ts'
import { Boton } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'
import { AprobarCierreModal } from '../repartidores/AprobarCierreModal.tsx'
import {
  COLOR_ESTADO_REPARTIDOR,
  ETIQUETA_ESTADO_REPARTIDOR,
  type EstadoRepartidor,
  type Repartidor,
} from '../repartidores/tipos.ts'

type Flota = Record<TipoVehiculo, Repartidor[]>

const VEHICULOS: { tipo: TipoVehiculo; titulo: string; icono: string }[] = [
  { tipo: 'MOTO', titulo: 'Motos', icono: '🛵' },
  { tipo: 'AUTO', titulo: 'Autos', icono: '🚗' },
  { tipo: 'CAMION', titulo: 'Camiones', icono: '🚚' },
]

// Orden del resto de la flota (los que no están en la cola): primero lo que requiere
// atención del operario.
const PRIORIDAD: Record<EstadoRepartidor, number> = {
  EMERGENCIA: 0,
  ESPERANDO_VALIDACION_CIERRE: 1, // espera que el operario apruebe el cierre (G-1)
  OCUPADO: 2,
  DISPONIBLE: 3, // fuera de la cola = tiene una oferta sin responder
  EN_PAUSA: 4,
  FUERA_DE_JORNADA: 5,
}

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

function TarjetaRepartidor({ repartidor: r, children }: { repartidor: Repartidor; children?: ReactNode }) {
  const enEmergencia = r.estado === 'EMERGENCIA'
  // "Disponible" fuera de la cola = el motor ya le ofreció un viaje y está por responder.
  const conOferta = r.estado === 'DISPONIBLE' && r.enColaDesde === null
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-xs ${
        enEmergencia ? 'border-2 border-red-500 bg-red-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">
            {enEmergencia && '🚨 '}
            {r.nombre} {r.apellido}
          </p>
          <p className="text-xs text-gray-500">{r.telefono}</p>
        </div>
        <span
          className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            conOferta ? 'bg-yellow-100 text-yellow-800' : COLOR_ESTADO_REPARTIDOR[r.estado]
          }`}
        >
          {conOferta ? 'Con oferta' : ETIQUETA_ESTADO_REPARTIDOR[r.estado]}
        </span>
      </div>
      {children}
    </div>
  )
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
          Una cola por vehículo, en el orden en que el motor ofrece los viajes. Se actualiza cada 15 segundos.
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
            // El backend ya los manda con la cola primero, en orden FIFO.
            const enCola = repartidores.filter((r) => r.enColaDesde !== null)
            const resto = repartidores
              .filter((r) => r.enColaDesde === null)
              .sort((a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado])

            return (
              <section
                key={tipo}
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 shadow-xs"
              >
                {/* Cabecera de la columna */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" role="img" aria-label={titulo}>
                      {icono}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
                  </div>
                  <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {repartidores.length} en jornada
                  </span>
                </div>

                {/* Cola FIFO: a quién le toca el próximo viaje de este vehículo */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                    Cola ({enCola.length})
                  </h3>
                  {enCola.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-300 py-4 text-center text-sm text-gray-500">
                      No hay repartidores disponibles
                    </p>
                  ) : (
                    enCola.map((r, index) => (
                      <TarjetaRepartidor key={r.id} repartidor={r}>
                        <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-blue-700">
                            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-bold">#{index + 1}</span>
                            <span>desde {horaCorta(r.enColaDesde!)}</span>
                          </div>
                          {r.viajesConsecutivos > 0 && (
                            <span className="text-gray-500" title="Viajes consecutivos completados">
                              {r.viajesConsecutivos} {r.viajesConsecutivos === 1 ? 'viaje seguido' : 'viajes seguidos'}
                            </span>
                          )}
                        </div>
                      </TarjetaRepartidor>
                    ))
                  )}
                </div>

                {/* El resto de la flota de este vehículo: emergencias primero */}
                {resto.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Fuera de la cola ({resto.length})
                    </h3>
                    {resto.map((r) => (
                      <TarjetaRepartidor key={r.id} repartidor={r}>
                        {r.estado === 'ESPERANDO_VALIDACION_CIERRE' && (
                          <div className="flex justify-end border-t border-gray-100 pt-2">
                            <Boton variante="secundario" onClick={() => setRepartidorParaCierre(r)}>
                              Aprobar cierre
                            </Boton>
                          </div>
                        )}
                      </TarjetaRepartidor>
                    ))}
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
