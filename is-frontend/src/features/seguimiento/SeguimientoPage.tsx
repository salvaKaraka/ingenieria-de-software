import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router'
import { api } from '../../shared/api.ts'
import type { EstadoEnvio, TrackingResponseDto } from './types.ts'

// Mock para desarrollo o fallback offline si el backend no responde
const DEMO_ENVIOS: Record<string, TrackingResponseDto> = {
  DEMO123: {
    trackingCode: 'DEMO123',
    estadoActual: 'EN_CAMINO',
    horaSalida: '2026-10-18T11:30:00Z',
    franjaEstimadaInicio: '14:00',
    franjaEstimadaFin: '17:00',
    historial: [
      { estado: 'PENDIENTE', fecha: '2026-10-18T09:15:00Z' },
      { estado: 'EN_CAMINO', fecha: '2026-10-18T11:30:00Z' },
    ],
  },
  PENDIENTE123: {
    trackingCode: 'PENDIENTE123',
    estadoActual: 'PENDIENTE',
    historial: [
      { estado: 'PENDIENTE', fecha: '2026-10-18T10:00:00Z' },
    ],
  },
  ENTREGADO123: {
    trackingCode: 'ENTREGADO123',
    estadoActual: 'ENTREGADO',
    horaSalida: '2026-10-18T09:00:00Z',
    franjaEstimadaInicio: '11:00',
    franjaEstimadaFin: '13:00',
    fechaEntrega: '2026-10-18T12:45:00Z',
    historial: [
      { estado: 'PENDIENTE', fecha: '2026-10-18T08:00:00Z' },
      { estado: 'EN_CAMINO', fecha: '2026-10-18T09:00:00Z' },
      { estado: 'ENTREGADO', fecha: '2026-10-18T12:45:00Z' },
    ],
  },
  CANCELADO123: {
    trackingCode: 'CANCELADO123',
    estadoActual: 'CANCELADO',
    historial: [
      { estado: 'PENDIENTE', fecha: '2026-10-18T08:00:00Z' },
      { estado: 'CANCELADO', fecha: '2026-10-18T09:30:00Z' },
    ],
  },
}

function formatearFecha(isoString?: string): string {
  if (!isoString) return ''
  try {
    const fecha = new Date(isoString)
    if (isNaN(fecha.getTime())) return isoString
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(fecha) + ' hs'
  } catch {
    return isoString
  }
}

function formatearHora(horaStr?: string): string {
  if (!horaStr) return ''
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(horaStr)) {
    return horaStr.slice(0, 5) + ' hs'
  }
  try {
    const fecha = new Date(horaStr)
    if (!isNaN(fecha.getTime())) {
      return (
        new Intl.DateTimeFormat('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(fecha) + ' hs'
      )
    }
  } catch {
    // ignore
  }
  return horaStr
}

function BadgeEstado({ estado }: { estado: EstadoEnvio }) {
  switch (estado) {
    case 'PENDIENTE':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          PENDIENTE
        </span>
      )
    case 'EN_CAMINO':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          EN CAMINO
        </span>
      )
    case 'ENTREGADO':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          ENTREGADO
        </span>
      )
    case 'CANCELADO':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 border border-rose-200">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          CANCELADO
        </span>
      )
  }
}

export function SeguimientoPage() {
  const { codigo } = useParams<{ codigo?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const codigoUrl = (codigo || searchParams.get('code') || '').trim()

  const [prevCodigoUrl, setPrevCodigoUrl] = useState(codigoUrl)
  const [inputCodigo, setInputCodigo] = useState(codigoUrl)
  const [tracking, setTracking] = useState<TrackingResponseDto | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  if (prevCodigoUrl !== codigoUrl) {
    setPrevCodigoUrl(codigoUrl)
    setInputCodigo(codigoUrl)
  }

  const consultarTracking = async (code: string) => {
    const codeLimpio = code.trim().toUpperCase()
    if (!codeLimpio) {
      setTracking(null)
      setError(null)
      return
    }

    setCargando(true)
    setError(null)

    try {
      // Intento de consulta real a la API compartida
      const data = await api<TrackingResponseDto>(`/seguimiento/${encodeURIComponent(codeLimpio)}`)
      setTracking(data)
    } catch {
      // Fallback a demo data si la API no está disponible o para datos de prueba predefinidos
      if (DEMO_ENVIOS[codeLimpio]) {
        setTracking(DEMO_ENVIOS[codeLimpio])
      } else {
        setTracking(null)
        setError('Código de seguimiento no encontrado')
      }
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (codigoUrl) {
      // oxlint-disable-next-line react/set-state-in-effect
      consultarTracking(codigoUrl)
    } else {
      setTracking(null)
      setError(null)
    }
  }, [codigoUrl])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const codeLimpio = inputCodigo.trim().toUpperCase()
    if (!codeLimpio) return
    navigate(`/seguimiento/${encodeURIComponent(codeLimpio)}`)
  }

  const handleCopiarEnlace = () => {
    if (!tracking?.trackingCode) return
    const url = `${window.location.origin}/seguimiento/${encodeURIComponent(tracking.trackingCode)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    })
  }

  const esPendiente = tracking?.estadoActual === 'PENDIENTE'
  const salioHaciaDomicilio = tracking !== null && tracking.estadoActual !== 'PENDIENTE'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between p-4">
          <Link to="/" className="text-sm font-medium text-gray-500 hover:text-gray-800">
            ← Volver al inicio
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Seguimiento de Envíos
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 sm:p-6 space-y-6">
        {/* Encabezado y buscador */}
        <section className="rounded-2xl border bg-white p-6 shadow-xs space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Seguí tu paquete
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Ingresá tu código de seguimiento para conocer el estado y estimación de entrega.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputCodigo}
                onChange={(e) => setInputCodigo(e.target.value)}
                placeholder="Ej: DEMO123"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 uppercase"
                disabled={cargando}
              />
            </div>
            <button
              type="submit"
              disabled={cargando || !inputCodigo.trim()}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {cargando ? 'Buscando…' : 'Consultar'}
            </button>
          </form>

          {/* Enlaces de prueba rápida en modo desarrollo */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-gray-500">
            <span>Ejemplos:</span>
            {Object.keys(DEMO_ENVIOS).map((demoKey) => (
              <button
                key={demoKey}
                type="button"
                onClick={() => navigate(`/seguimiento/${demoKey}`)}
                className="rounded-md bg-gray-100 px-2 py-1 font-mono text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {demoKey}
              </button>
            ))}
          </div>
        </section>

        {/* Mensaje de código inexistente (Requisito exacto) */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-xs flex items-start gap-3">
            <div className="rounded-full bg-rose-200 p-1 text-rose-700 shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-base">{error}</p>
              <p className="text-sm text-rose-700 mt-1">
                Por favor, comprobá que el código ingresado coincida exactamente con el de tu comprobante.
              </p>
            </div>
          </div>
        )}

        {/* Detalle del Envío Encontrado */}
        {tracking && (
          <section className="space-y-6">
            {/* Tarjeta de estado principal */}
            <div className="rounded-2xl border bg-white p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Código de Envío
                  </span>
                  <p className="text-xl font-mono font-bold text-gray-800">
                    {tracking.trackingCode}
                  </p>
                </div>
                <div>
                  <BadgeEstado estado={tracking.estadoActual} />
                </div>
              </div>

              {/* HU-1: Generar enlace de seguimiento para el destinatario */}
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-800 block">Enlace público de seguimiento</span>
                    Disponible en cualquier momento (durante el envío y luego de la entrega).
                  </div>
                  <button
                    type="button"
                    onClick={handleCopiarEnlace}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-2xs"
                  >
                    {copiado ? (
                      <span className="text-emerald-600 font-semibold">✓ ¡Enlace copiado!</span>
                    ) : (
                      <>
                        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copiar enlace</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Caso Envío PENDIENTE: Mensaje obligatorio y ocultar hora de salida / franja */}
              {esPendiente && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 flex items-start gap-3">
                  <div className="rounded-full bg-amber-200 p-1 text-amber-700 shrink-0">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-base">
                      Tu envío todavía no salió hacia tu domicilio
                    </p>
                    <p className="text-sm text-amber-800 mt-1">
                      El paquete se encuentra en preparación. Apenas comience su recorrido verás aquí la hora de salida y el horario estimado de llegada.
                    </p>
                  </div>
                </div>
              )}

              {/* Hora de salida y franja estimada de entrega (SOLO si ya salió) */}
              {salioHaciaDomicilio && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-blue-50/60 border border-blue-100 p-4">
                  {tracking.horaSalida && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 block">
                        Hora de salida
                      </span>
                      <p className="text-sm font-semibold text-blue-950 mt-0.5">
                        {formatearFecha(tracking.horaSalida)}
                      </p>
                    </div>
                  )}

                  {(tracking.franjaEstimadaInicio || tracking.franjaEstimadaFin) && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 block">
                        Franja estimada de entrega
                      </span>
                      <p className="text-sm font-semibold text-blue-950 mt-0.5">
                        {formatearHora(tracking.franjaEstimadaInicio)} - {formatearHora(tracking.franjaEstimadaFin)}
                      </p>
                    </div>
                  )}

                  {tracking.fechaEntrega && (
                    <div className="sm:col-span-2 border-t border-blue-100 pt-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block">
                        Fecha y hora de entrega efectiva
                      </span>
                      <p className="text-sm font-semibold text-emerald-950 mt-0.5">
                        {formatearFecha(tracking.fechaEntrega)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Historial de estados con fecha y hora */}
              <div className="space-y-4 pt-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                  Historial de estados
                </h2>

                {tracking.historial && tracking.historial.length > 0 ? (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {tracking.historial.map((item, idx) => (
                      <div key={`${item.estado}-${item.fecha}-${idx}`} className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        {/* Nodo de la línea de tiempo */}
                        <span className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-4 ring-white">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              item.estado === tracking.estadoActual ? 'bg-blue-600' : 'bg-gray-400'
                            }`}
                          />
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">
                            {item.estado === 'EN_CAMINO'
                              ? 'En camino'
                              : item.estado === 'PENDIENTE'
                              ? 'Pendiente'
                              : item.estado === 'ENTREGADO'
                              ? 'Entregado'
                              : 'Cancelado'}
                          </span>
                          {item.estado === tracking.estadoActual && (
                            <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              Actual
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-medium text-gray-500">
                          {formatearFecha(item.fecha)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No hay eventos registrados aún.</p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
