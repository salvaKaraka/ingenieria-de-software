import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../../shared/api'
import { Boton } from '../../../shared/ui/Boton'
import { Tabla } from '../../../shared/ui/Tabla'

interface EnvioResumen {
  id: number
  codigoSeguimiento: string
  estado: string
  destinoDireccion: string
  comercio: { nombre: string }
}

interface RespuestaPaginada {
  datos: EnvioResumen[]
  total: number
  pagina: number
  limite: number
  totalPaginas: number
}

type Pestana = 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADO'

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'PENDIENTE', etiqueta: 'Pendientes de asignar' },
  { id: 'EN_CURSO', etiqueta: 'En curso' },
  { id: 'FINALIZADO', etiqueta: 'Finalizados' },
]

function obtenerEstiloEstado(estado: string) {
  switch (estado.toUpperCase()) {
    case 'PENDIENTE':
      return 'border-amber-200 bg-amber-100 text-amber-800'
    case 'ASIGNADO':
    case 'EN_CAMINO_A_RETIRAR':
    case 'RETIRADO':
    case 'EN_DOMICILIO':
      return 'border-blue-200 bg-blue-100 text-blue-800'
    case 'ENTREGADO':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800'
    case 'CANCELADO':
      return 'border-rose-200 bg-rose-100 text-rose-800'
    default:
      return 'border-slate-200 bg-slate-100 text-slate-800'
  }
}

function formatearEstado(estado: string) {
  return estado.replace(/_/g, ' ').replace(/\b\w/g, (letra) => letra.toUpperCase())
}

export function EnviosPage() {
  const navigate = useNavigate()
  const [envios, setEnvios] = useState<EnvioResumen[]>([])
  const [pestanaActiva, setPestanaActiva] = useState<Pestana>('PENDIENTE')
  const [cargando, setCargando] = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)

  const cargarEnvios = useCallback(async () => {
    try {
      setCargando(true)
      const filtros: Record<Pestana, string> = {
        PENDIENTE: 'PENDIENTE',
        EN_CURSO: 'ASIGNADO,EN_CAMINO_A_RETIRAR,RETIRADO,EN_DOMICILIO',
        FINALIZADO: 'ENTREGADO,CANCELADO',
      }
      const respuesta = await api<RespuestaPaginada>(`/envios?estado=${filtros[pestanaActiva]}`)

      setEnvios(Array.isArray(respuesta?.datos) ? respuesta.datos : [])
      setUltimaActualizacion(new Date())
    } catch (error) {
      console.error('Error al cargar envíos:', error)
      setEnvios([])
    } finally {
      setCargando(false)
    }
  }, [pestanaActiva])

  useEffect(() => {
    cargarEnvios()
    const intervalo = setInterval(cargarEnvios, 15000)
    return () => clearInterval(intervalo)
  }, [cargarEnvios])

  const columnasTabla = [
    {
      titulo: 'Código / Tracking',
      celda: (envio: EnvioResumen) => (
        <span className="font-mono font-bold text-slate-800">
          #{envio.codigoSeguimiento}
        </span>
      ),
    },
    {
      titulo: 'Comercio origen',
      celda: (envio: EnvioResumen) => (
        <span className="font-medium text-slate-800">{envio.comercio?.nombre}</span>
      ),
    },
    {
      titulo: 'Destino',
      celda: (envio: EnvioResumen) => (
        <span className="text-slate-600">{envio.destinoDireccion}</span>
      ),
    },
    {
      titulo: 'Estado actual',
      celda: (envio: EnvioResumen) => (
        <span
          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold ${obtenerEstiloEstado(envio.estado)}`}
        >
          {formatearEstado(envio.estado)}
        </span>
      ),
    },
    {
      titulo: 'Acciones',
      celda: (envio: EnvioResumen) => (
        <div className="transition hover:scale-105">
          <Boton
            variante="secundario"
            onClick={() => navigate(`/operario/envios/${envio.id}`)}
          >
            Ver detalle →
          </Boton>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen space-y-6 bg-slate-100 p-6">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-linear-to-r from-slate-800 via-blue-800 to-blue-700 p-8 shadow-lg md:flex-row md:items-center">
        <div className="text-white">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">Panel de envíos</h1>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-300">Monitoreo activo</span>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            Última actualización: {ultimaActualizacion?.toLocaleTimeString() ?? 'pendiente'} · Auto-refresh cada 15 s
          </p>
        </div>

        <div className="rounded-lg shadow-xl transition hover:scale-105">
          <Boton
            onClick={() => navigate('/operario/envios/nuevo')}
            className="rounded-xl border-none bg-amber-400 px-6 py-3 font-bold text-slate-900 shadow-lg hover:bg-amber-300"
          >
            + Registrar nuevo envío
          </Boton>
        </div>
      </div>

      <div className="inline-flex w-full flex-col rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm md:w-auto md:flex-row">
        {PESTANAS.map((pestana) => (
          <button
            key={pestana.id}
            type="button"
            onClick={() => setPestanaActiva(pestana.id)}
            className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
              pestanaActiva === pestana.id
                ? 'border border-blue-100/50 bg-blue-50 text-blue-700 shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            {pestana.etiqueta}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {cargando ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="font-medium">Sincronizando envíos...</p>
          </div>
        ) : (
          <Tabla
            columnas={columnasTabla}
            filas={envios}
            claveFila={(envio) => envio.id}
            mensajeVacio="No hay envíos en esta categoría."
          />
        )}
      </div>
    </div>
  )
}
