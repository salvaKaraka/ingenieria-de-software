import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../../shared/api'
import type { EstadoEnvio } from '../../../shared/tipos'
import { Boton } from '../../../shared/ui/Boton'
import { usePolling } from '../../../shared/usePolling'

interface ComercioInfo {
  id: number
  nombre: string
  telefono?: string
  direccion?: string
}

interface RepartidorInfo {
  id: number
  nombre: string
  apellido: string
  telefono?: string
  vehiculo?: string
}

interface NovedadInfo {
  tipo: string
  detalle: string | null
  creadoEn: string
}

export interface EnvioPanelItem {
  id: number
  codigoSeguimiento: string
  estado: EstadoEnvio
  origenDireccion: string
  destinoDireccion: string
  destinatarioNombre: string | null
  destinatarioApellido: string | null
  destinatarioTelefono: string | null
  destinatarioDni?: string | null
  tamanio: string
  vehiculoRequerido: string
  observaciones?: string | null
  creadoEn: string
  actualizadoEn?: string
  comercio: ComercioInfo
  repartidor: RepartidorInfo | null
  conNovedad: boolean
  novedad: NovedadInfo | null
}

interface TotalesPanel {
  total: number
  PENDIENTE: number
  ASIGNADO: number
  EN_CAMINO_A_RETIRAR: number
  RETIRADO: number
  EN_DOMICILIO: number
}

interface PanelEnviosRespuesta {
  totales: TotalesPanel
  grupos: {
    PENDIENTE: EnvioPanelItem[]
    ASIGNADO: EnvioPanelItem[]
    EN_CAMINO_A_RETIRAR: EnvioPanelItem[]
    RETIRADO: EnvioPanelItem[]
    EN_DOMICILIO: EnvioPanelItem[]
  }
  envios: EnvioPanelItem[]
}

const TOTALES_INICIALES: TotalesPanel = {
  total: 0,
  PENDIENTE: 0,
  ASIGNADO: 0,
  EN_CAMINO_A_RETIRAR: 0,
  RETIRADO: 0,
  EN_DOMICILIO: 0,
}

type EstadoPanel = 'PENDIENTE' | 'ASIGNADO' | 'EN_CAMINO_A_RETIRAR' | 'RETIRADO' | 'EN_DOMICILIO'

interface ColumnaDef {
  estado: EstadoPanel
  titulo: string
  bordeColor: string
  badgeColor: string
}

const COLUMNAS: ColumnaDef[] = [
  {
    estado: 'PENDIENTE',
    titulo: 'Pendiente',
    bordeColor: 'border-t-4 border-amber-400',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    estado: 'ASIGNADO',
    titulo: 'Asignado',
    bordeColor: 'border-t-4 border-sky-400',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  {
    estado: 'EN_CAMINO_A_RETIRAR',
    titulo: 'En camino a retirar',
    bordeColor: 'border-t-4 border-indigo-400',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  {
    estado: 'RETIRADO',
    titulo: 'Paquete retirado',
    bordeColor: 'border-t-4 border-violet-400',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-300',
  },
  {
    estado: 'EN_DOMICILIO',
    titulo: 'En domicilio de entrega',
    bordeColor: 'border-t-4 border-blue-400',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
  },
]

export function PanelEnviosPage() {
  const navigate = useNavigate()
  const [datosPanel, setDatosPanel] = useState<PanelEnviosRespuesta>({
    totales: TOTALES_INICIALES,
    grupos: {
      PENDIENTE: [],
      ASIGNADO: [],
      EN_CAMINO_A_RETIRAR: [],
      RETIRADO: [],
      EN_DOMICILIO: [],
    },
    envios: [],
  })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)

  const cargarPanel = useCallback(async () => {
    try {
      const data = await api<PanelEnviosRespuesta>('/envios/panel')
      setDatosPanel(data)
      setUltimaActualizacion(new Date())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [])

  // Auto-actualización periódica en segundo plano cada 10 s (RNF / Escenario 2)
  usePolling(cargarPanel, 10_000)

  const totalActivos = datosPanel.totales?.total ?? 0

  return (
    <div className="min-h-screen space-y-6 bg-slate-100 p-6">
      {/* Cabecera del Panel */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-linear-to-r from-slate-800 via-blue-900 to-indigo-900 p-8 shadow-lg md:flex-row md:items-center">
        <div className="text-white">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">Panel de envíos del día</h1>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-300">Monitoreo activo</span>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            Total activos: <strong className="text-white">{totalActivos}</strong> · Última actualización:{' '}
            {ultimaActualizacion?.toLocaleTimeString() ?? 'pendiente'} · Auto-refresh cada 10 s
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Boton
            variante="secundario"
            onClick={() => navigate('/operario/envios')}
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
          >
            🔍 Buscador general
          </Boton>
          <Boton
            onClick={() => navigate('/operario/envios/nuevo')}
            className="border-none bg-amber-400 font-bold text-slate-900 hover:bg-amber-300"
          >
            + Registrar nuevo envío
          </Boton>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudo sincronizar el panel con el servidor. Se reintentará automáticamente en el próximo ciclo.
        </div>
      )}

      {/* Estado de carga inicial */}
      {cargando && totalActivos === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="font-medium">Cargando panel de envíos...</p>
        </div>
      )}

      {/* Escenario 5: Panel sin envíos activos */}
      {!cargando && totalActivos === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
            📦
          </div>
          <h2 className="text-xl font-bold text-slate-800">No hay envíos pendientes ni en curso</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            En este momento no hay pedidos activos en ninguna etapa operativa. Los envíos entregados y cancelados
            se encuentran disponibles en el buscador general.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Boton onClick={() => navigate('/operario/envios/nuevo')}>+ Registrar nuevo envío</Boton>
            <Boton variante="secundario" onClick={() => navigate('/operario/envios')}>
              Ir al buscador general
            </Boton>
          </div>
        </div>
      )}

      {/* Agrupaciones y columnas operativas */}
      {totalActivos > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNAS.map((col) => {
            const lista = datosPanel.grupos[col.estado] ?? []
            const cantidad = datosPanel.totales[col.estado] ?? lista.length

            return (
              <section
                key={col.estado}
                aria-label={`Columna ${col.titulo}`}
                className={`flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 shadow-sm ${col.bordeColor}`}
              >
                {/* Cabecera de Columna */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 rounded-t-xl">
                  <h2 className="text-sm font-bold text-slate-800">{col.titulo}</h2>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${col.badgeColor}`}
                  >
                    {cantidad}
                  </span>
                </div>

                {/* Lista de Tarjetas */}
                <div className="flex flex-1 flex-col gap-3 p-3">
                  {lista.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/50 text-xs text-slate-400">
                      Sin envíos en este estado
                    </div>
                  ) : (
                    lista.map((envio) => {
                      const tieneNovedad = envio.conNovedad || Boolean(envio.novedad)

                      return (
                        <article
                          key={envio.id}
                          className={`flex flex-col rounded-xl p-4 transition-all duration-200 ${
                            tieneNovedad
                              ? 'border-2 border-amber-500 bg-amber-50/90 shadow-md ring-2 ring-amber-300/50'
                              : 'border border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-md'
                          }`}
                        >
                          {/* Indicador de Novedad / Destacado */}
                          {tieneNovedad && (
                            <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100/80 px-2 py-1 text-xs font-bold text-amber-900">
                              <span>⚠️</span>
                              <span className="uppercase tracking-wider">Con novedad</span>
                            </div>
                          )}

                          {/* Encabezado de la tarjeta */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <span className="font-mono text-sm font-extrabold text-slate-900">
                              #{envio.codigoSeguimiento}
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              {envio.tamanio}
                            </span>
                          </div>

                          {/* Detalle de Novedad si existe */}
                          {tieneNovedad && envio.novedad?.detalle && (
                            <p className="mt-2 rounded bg-amber-200/50 p-1.5 text-xs font-medium text-amber-950">
                              {envio.novedad.detalle}
                            </p>
                          )}

                          {/* Información del Envío */}
                          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                            <div>
                              <span className="font-medium text-slate-400">Comercio:</span>{' '}
                              <span className="font-semibold text-slate-700">{envio.comercio?.nombre}</span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-400">Destino:</span>{' '}
                              <span className="text-slate-700">{envio.destinoDireccion}</span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-400">Destinatario:</span>{' '}
                              <span className="text-slate-700">
                                {envio.destinatarioNombre} {envio.destinatarioApellido}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-400">Repartidor:</span>{' '}
                              <span
                                className={`font-medium ${
                                  envio.repartidor ? 'text-blue-700' : 'italic text-slate-400'
                                }`}
                              >
                                {envio.repartidor
                                  ? `${envio.repartidor.nombre} ${envio.repartidor.apellido}`
                                  : 'Sin asignar'}
                              </span>
                            </div>
                          </div>

                          {/* Acción rápida para ver detalle */}
                          <div className="mt-4 pt-2">
                            <Boton
                              variante="secundario"
                              onClick={() => navigate(`/operario/envios/${envio.id}`)}
                              className="w-full text-xs font-semibold"
                            >
                              Ver detalle →
                            </Boton>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
