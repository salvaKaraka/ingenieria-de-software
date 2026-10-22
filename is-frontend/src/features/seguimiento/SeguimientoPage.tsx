import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router'
import { api, ErrorApi } from '../../shared/api.ts'
import { usePolling } from '../../shared/usePolling.ts'
import { ETIQUETA_ESTADO_ENVIO, type EstadoEnvio } from '../../shared/tipos.ts'
import type { TrackingResponseDto } from './types.ts'

const NO_ENCONTRADO = 'Código de seguimiento no encontrado'

// Mock para desarrollo local (solo accesible cuando import.meta.env.DEV)
const DEMO_ENVIOS: Record<string, TrackingResponseDto> = {
  DEMO123: {
    trackingCode: 'DEMO123',
    estadoActual: 'RETIRADO',
    comercio: 'Pizzería Los Hijos',
    destinatario: 'Carlos M.',
    direccionDestino: 'Av. Corrientes',
    horaSalida: '2026-10-18T11:30:00Z',
    franjaEstimadaInicio: '14:00',
    franjaEstimadaFin: '17:00',
    historial: [
      { estado: 'PENDIENTE', fecha: '2026-10-18T09:15:00Z' },
      { estado: 'ASIGNADO', fecha: '2026-10-18T10:00:00Z' },
      { estado: 'EN_CAMINO_A_RETIRAR', fecha: '2026-10-18T10:30:00Z' },
      { estado: 'RETIRADO', fecha: '2026-10-18T11:30:00Z' },
    ],
  },
  PENDIENTE123: {
    trackingCode: 'PENDIENTE123',
    estadoActual: 'PENDIENTE',
    comercio: 'Librería Central',
    destinatario: 'Laura G.',
    direccionDestino: 'San Martín',
    historial: [
      { estado: 'PENDIENTE', fecha: '2026-10-18T10:00:00Z' },
    ],
  },
  ENTREGADO123: {
    trackingCode: 'ENTREGADO123',
    estadoActual: 'ENTREGADO',
    comercio: 'Farmacia Sol',
    destinatario: 'Ana R.',
    direccionDestino: 'Belgrano',
    horaSalida: '2026-10-18T09:00:00Z',
    franjaEstimadaInicio: '11:00',
    franjaEstimadaFin: '13:00',
    fechaEntrega: '2026-10-18T12:45:00Z',
    historial: [
      { estado: 'PENDIENTE', fecha: '2026-10-18T08:00:00Z' },
      { estado: 'ASIGNADO', fecha: '2026-10-18T08:15:00Z' },
      { estado: 'EN_CAMINO_A_RETIRAR', fecha: '2026-10-18T08:30:00Z' },
      { estado: 'RETIRADO', fecha: '2026-10-18T09:00:00Z' },
      { estado: 'EN_DOMICILIO', fecha: '2026-10-18T12:00:00Z' },
      { estado: 'ENTREGADO', fecha: '2026-10-18T12:45:00Z' },
    ],
  },
  CANCELADO123: {
    trackingCode: 'CANCELADO123',
    estadoActual: 'CANCELADO',
    comercio: 'Ropa Express',
    destinatario: 'Marcos P.',
    direccionDestino: 'Rivadavia',
    historial: [
      { estado: 'PENDIENTE', fecha: '2026-10-18T08:00:00Z' },
      { estado: 'CANCELADO', fecha: '2026-10-18T09:30:00Z' },
    ],
  },
}

// Pasos secuenciales del progreso normal de entrega (F-4: 6 estados)
const PASOS_PROGRESO: { estado: EstadoEnvio; titulo: string; descripcion: string }[] = [
  { estado: 'PENDIENTE', titulo: 'Pendiente', descripcion: 'Pedido registrado' },
  { estado: 'ASIGNADO', titulo: 'Asignado', descripcion: 'Repartidor asignado' },
  { estado: 'EN_CAMINO_A_RETIRAR', titulo: 'A retirar', descripcion: 'En camino al comercio' },
  { estado: 'RETIRADO', titulo: 'Retirado', descripcion: 'En viaje a destino' },
  { estado: 'EN_DOMICILIO', titulo: 'En destino', descripcion: 'En domicilio de entrega' },
  { estado: 'ENTREGADO', titulo: 'Entregado', descripcion: 'Paquete entregado' },
]

function formatearFecha(isoString?: string): string {
  if (!isoString) return ''
  try {
    const fecha = new Date(isoString)
    if (isNaN(fecha.getTime())) return isoString
    return (
      new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(fecha) + ' hs'
    )
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

const CONFIG_BADGE: Record<EstadoEnvio, { clases: string; dotClases: string; pulsante?: boolean }> = {
  PENDIENTE: {
    clases: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClases: 'bg-amber-500',
    pulsante: true,
  },
  ASIGNADO: {
    clases: 'bg-sky-100 text-sky-800 border-sky-200',
    dotClases: 'bg-sky-500',
    pulsante: true,
  },
  EN_CAMINO_A_RETIRAR: {
    clases: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotClases: 'bg-indigo-500',
    pulsante: true,
  },
  RETIRADO: {
    clases: 'bg-violet-100 text-violet-800 border-violet-200',
    dotClases: 'bg-violet-500',
    pulsante: true,
  },
  EN_DOMICILIO: {
    clases: 'bg-blue-100 text-blue-800 border-blue-200',
    dotClases: 'bg-blue-500',
    pulsante: true,
  },
  ENTREGADO: {
    clases: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotClases: 'bg-emerald-500',
  },
  CANCELADO: {
    clases: 'bg-rose-100 text-rose-800 border-rose-200',
    dotClases: 'bg-rose-500',
  },
}

function BadgeEstado({ estado }: { estado: EstadoEnvio }) {
  const conf = CONFIG_BADGE[estado] ?? {
    clases: 'bg-gray-100 text-gray-800 border-gray-200',
    dotClases: 'bg-gray-500',
  }
  const texto = ETIQUETA_ESTADO_ENVIO[estado] ?? estado

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${conf.clases}`}
    >
      <span className={`h-2 w-2 rounded-full ${conf.dotClases} ${conf.pulsante ? 'animate-pulse' : ''}`} />
      {texto}
    </span>
  )
}

function LineaProgreso({
  estadoActual,
  historial,
}: {
  estadoActual: EstadoEnvio
  historial: { estado: EstadoEnvio; fecha: string }[]
}) {
  const esCancelado = estadoActual === 'CANCELADO'
  const indiceActual = PASOS_PROGRESO.findIndex((p) => p.estado === estadoActual)

  const mapaFechas = new Map<EstadoEnvio, string>()
  for (const item of historial) {
    if (!mapaFechas.has(item.estado)) {
      mapaFechas.set(item.estado, item.fecha)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
          Progreso del envío
        </h2>
        {esCancelado && (
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
            Cancelado
          </span>
        )}
      </div>

      {/* Versión Desktop / Tablet (horizontal responsive) */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-6 gap-2">
          {PASOS_PROGRESO.map((paso, idx) => {
            const fecha = mapaFechas.get(paso.estado)
            const completado =
              !esCancelado &&
              (idx < indiceActual || (idx === indiceActual && paso.estado === 'ENTREGADO'))
            const esActual = !esCancelado && idx === indiceActual && paso.estado !== 'ENTREGADO'

            return (
              <div key={paso.estado} className="relative flex flex-col items-center text-center">
                {idx > 0 && (
                  <div
                    className={`absolute top-4 right-1/2 -left-1/2 h-0.5 -z-10 ${
                      completado || esActual ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}

                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    completado
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : esActual
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-xs'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}
                >
                  {completado ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : esActual ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="mt-2 space-y-0.5">
                  <p
                    className={`text-xs font-semibold leading-tight ${
                      completado || esActual ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {paso.titulo}
                  </p>
                  {fecha ? (
                    <p className="text-[11px] font-mono text-gray-500">
                      {formatearHora(fecha)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-300">--:--</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Versión Mobile (vertical compacta) */}
      <div className="sm:hidden">
        <div className="relative pl-6 space-y-4 before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
          {PASOS_PROGRESO.map((paso, idx) => {
            const fecha = mapaFechas.get(paso.estado)
            const completado =
              !esCancelado &&
              (idx < indiceActual || (idx === indiceActual && paso.estado === 'ENTREGADO'))
            const esActual = !esCancelado && idx === indiceActual && paso.estado !== 'ENTREGADO'

            return (
              <div key={paso.estado} className="relative flex items-center justify-between gap-3">
                <span className="absolute -left-6 flex h-7 w-7 items-center justify-center rounded-full bg-white ring-2 ring-white">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      completado
                        ? 'bg-emerald-600 text-white'
                        : esActual
                        ? 'bg-blue-600 text-white ring-2 ring-blue-100'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}
                  >
                    {completado ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : esActual ? (
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                </span>

                <div className="flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      completado || esActual ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {paso.titulo}
                  </p>
                  <p className="text-xs text-gray-500">{paso.descripcion}</p>
                </div>

                <div className="text-right shrink-0">
                  {fecha ? (
                    <span className="text-xs font-mono font-medium text-gray-600">
                      {formatearHora(fecha)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">--:--</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
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

  const trackingRef = useRef<TrackingResponseDto | null>(tracking)
  useEffect(() => {
    trackingRef.current = tracking
  }, [tracking])

  if (prevCodigoUrl !== codigoUrl) {
    setPrevCodigoUrl(codigoUrl)
    setInputCodigo(codigoUrl)
    if (!codigoUrl) {
      setTracking(null)
      setError(null)
    }
  }

  const consultarTracking = useCallback(async (code: string, silente = false) => {
    const codeLimpio = code.trim().toUpperCase()
    if (!codeLimpio) {
      setTracking(null)
      setError(null)
      return
    }

    if (!silente) {
      setCargando(true)
      setError(null)
    }

    try {
      const data = await api<TrackingResponseDto>(`/seguimiento/${encodeURIComponent(codeLimpio)}`)
      setTracking(data)
      setError(null)
    } catch (err) {
      // Fallback a datos demo únicamente en desarrollo
      if (import.meta.env.DEV && DEMO_ENVIOS[codeLimpio]) {
        setTracking(DEMO_ENVIOS[codeLimpio])
        setError(null)
      } else if (err instanceof ErrorApi && err.status === 404) {
        setTracking(null)
        setError(NO_ENCONTRADO)
      } else if (!silente) {
        // Sin red, 429 o error del servidor: el código puede ser correcto, no hay que decir que no existe.
        setTracking(null)
        setError('No pudimos consultar el envío. Probá de nuevo en unos minutos.')
      }
      // En un refresco silencioso que falla se deja el último dato: es un error pasajero.
    } finally {
      if (!silente) {
        setCargando(false)
      }
    }
  }, [])

  // usePolling mantiene actualizados los datos cada 60 s según F-4 y AGENTS.md
  const refrescar = useCallback(async () => {
    if (codigoUrl) {
      await consultarTracking(codigoUrl, Boolean(trackingRef.current))
    }
  }, [codigoUrl, consultarTracking])

  usePolling(refrescar, 60_000)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const codeLimpio = inputCodigo.trim().toUpperCase()
    if (!codeLimpio) return

    if (codeLimpio === codigoUrl) {
      void consultarTracking(codeLimpio)
    } else {
      navigate(`/seguimiento/${encodeURIComponent(codeLimpio)}`)
    }
  }

  const handleCopiarEnlace = () => {
    if (!tracking?.trackingCode) return
    const url = `${window.location.origin}/seguimiento/${encodeURIComponent(tracking.trackingCode)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    })
  }

  const esCancelado = tracking?.estadoActual === 'CANCELADO'
  const salioHaciaDomicilio = Boolean(tracking?.horaSalida)
  const todaviaNoSalio =
    tracking !== null && !salioHaciaDomicilio && !esCancelado && tracking.estadoActual !== 'ENTREGADO'

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
                placeholder="Ej: K7M2X9QP4R"
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

          {/* Enlaces de prueba rápida únicamente visibles en modo desarrollo */}
          {import.meta.env.DEV && (
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-gray-500">
              <span>Ejemplos (dev):</span>
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
          )}
        </section>

        {/* Mensaje de código inexistente (Requisito F-4) */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-xs flex items-start gap-3">
            <div className="rounded-full bg-rose-200 p-1 text-rose-700 shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-base">{error}</p>
              {error === NO_ENCONTRADO && (
                <p className="text-sm text-rose-700 mt-1">
                  Por favor, comprobá que el código ingresado coincida exactamente con el de tu comprobante.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Detalle del Envío Encontrado */}
        {tracking && (
          <section className="space-y-6">
            <div className="rounded-2xl border bg-white p-6 shadow-xs space-y-6">
              {/* Encabezado del paquete y badge de estado */}
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

              {/* Datos de origen y destino enmascarados (Épica 2.5) */}
              {(tracking.comercio || tracking.destinatario || tracking.direccionDestino) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-gray-50 p-4 border border-gray-200 text-xs">
                  {tracking.comercio && (
                    <div>
                      <span className="text-gray-400 uppercase font-semibold block text-[10px] tracking-wider">
                        Comercio
                      </span>
                      <p className="font-semibold text-gray-800 mt-0.5">{tracking.comercio}</p>
                    </div>
                  )}
                  {tracking.destinatario && (
                    <div>
                      <span className="text-gray-400 uppercase font-semibold block text-[10px] tracking-wider">
                        Destinatario
                      </span>
                      <p className="font-semibold text-gray-800 mt-0.5">{tracking.destinatario}</p>
                    </div>
                  )}
                  {tracking.direccionDestino && (
                    <div>
                      <span className="text-gray-400 uppercase font-semibold block text-[10px] tracking-wider">
                        Destino
                      </span>
                      <p className="font-semibold text-gray-800 mt-0.5">{tracking.direccionDestino}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Botón para compartir enlace público */}
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-800 block">Enlace público de seguimiento</span>
                    Disponible para consultar en cualquier momento desde cualquier dispositivo.
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
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Copiar enlace</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Línea de progreso de 6 estados (F-4) */}
              <div className="pt-2">
                <LineaProgreso
                  estadoActual={tracking.estadoActual}
                  historial={tracking.historial ?? []}
                />
              </div>

              {/* Alerta de Envío Cancelado */}
              {esCancelado && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 flex items-start gap-3">
                  <div className="rounded-full bg-rose-200 p-1 text-rose-700 shrink-0">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-base">El envío fue cancelado</p>
                    <p className="text-sm text-rose-800 mt-1">
                      Este paquete no continuará su recorrido de entrega. Para coordinar una reprogramación, contactate con el comercio emisor.
                    </p>
                  </div>
                </div>
              )}

              {/* Mensaje cuando todavía no salió hacia domicilio */}
              {todaviaNoSalio && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 flex items-start gap-3">
                  <div className="rounded-full bg-amber-200 p-1 text-amber-700 shrink-0">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-base">
                      Tu envío todavía no salió hacia tu domicilio
                    </p>
                    <p className="text-sm text-amber-800 mt-1">
                      El paquete se encuentra en preparación. Apenas comience su recorrido hacia tu dirección verás aquí la hora de salida y el horario estimado de llegada.
                    </p>
                  </div>
                </div>
              )}

              {/* Hora de salida y franja estimada de entrega (SOLO cuando ya salió, Supuesto 7) */}
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

              {/* Historial de eventos con fecha y hora */}
              <div className="space-y-4 pt-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                  Historial de eventos
                </h2>

                {tracking.historial && tracking.historial.length > 0 ? (
                  <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {tracking.historial.map((item, idx) => (
                      <div
                        key={`${item.estado}-${item.fecha}-${idx}`}
                        className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                      >
                        <span className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-4 ring-white">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              item.estado === tracking.estadoActual ? 'bg-blue-600' : 'bg-gray-400'
                            }`}
                          />
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">
                            {ETIQUETA_ESTADO_ENVIO[item.estado] ?? item.estado}
                          </span>
                          {item.estado === tracking.estadoActual && (
                            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
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
