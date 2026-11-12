import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../../shared/api'
import { ETIQUETA_ESTADO_ENVIO, type EstadoEnvio } from '../../../shared/tipos'
import { Boton } from '../../../shared/ui/Boton'
import { EtiquetaEstado } from '../../../shared/ui/EtiquetaEstado'
import { Campo } from '../../../shared/ui/Campo'
import { Tabla } from '../../../shared/ui/Tabla'
import { usePolling } from '../../../shared/usePolling'
import { AVISO_EXCEPCION, esAsignacionPorExcepcion } from './excepcion.ts'

interface ComercioOpcion {
  id: number
  nombre: string
}

interface EnvioResumen {
  id: number
  codigoSeguimiento: string
  estado: EstadoEnvio
  destinoDireccion: string
  comercio: { nombre: string }
  repartidor: { nombre: string; apellido: string } | null
  eventos?: { id: number; detalle: string | null }[]
}

interface RespuestaPaginada {
  datos: EnvioResumen[]
  total: number
  pagina: number
  limite: number
  totalPaginas: number
}

interface FiltrosEnvios {
  codigo: string
  comercioId: string
  estado: EstadoEnvio | ''
  fecha: string
}

type Pestana = 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADO'

const FILTROS_VACIOS: FiltrosEnvios = {
  codigo: '',
  comercioId: '',
  estado: '',
  fecha: '',
}

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'PENDIENTE', etiqueta: 'Pendientes de asignar' },
  { id: 'EN_CURSO', etiqueta: 'En curso' },
  { id: 'FINALIZADO', etiqueta: 'Finalizados' },
]

export function EnviosPage() {
  const navigate = useNavigate()
  const [envios, setEnvios] = useState<EnvioResumen[]>([])
  const [comercios, setComercios] = useState<ComercioOpcion[]>([])
  const [filtros, setFiltros] = useState<FiltrosEnvios>(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosEnvios | null>(null)
  const [pestanaActiva, setPestanaActiva] = useState<Pestana>('PENDIENTE')
  const [cargando, setCargando] = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
  const [error, setError] = useState(false)
  const [errorComercios, setErrorComercios] = useState(false)

  useEffect(() => {
    api<ComercioOpcion[]>('/comercios')
      .then(setComercios)
      .catch(() => setErrorComercios(true))
  }, [])

  const cargarEnvios = useCallback(async () => {
    try {
      const filtros: Record<Pestana, string> = {
        PENDIENTE: 'PENDIENTE',
        EN_CURSO: 'ASIGNADO,EN_CAMINO_A_RETIRAR,RETIRADO,EN_DOMICILIO',
        FINALIZADO: 'ENTREGADO,CANCELADO',
      }
      const parametros = new URLSearchParams()
      if (filtrosAplicados) {
        if (filtrosAplicados.codigo.trim()) {
          parametros.set('q', filtrosAplicados.codigo.trim())
        }
        if (filtrosAplicados.comercioId) {
          parametros.set('comercioId', filtrosAplicados.comercioId)
        }
        if (filtrosAplicados.estado) {
          parametros.set('estado', filtrosAplicados.estado)
        }
        if (filtrosAplicados.fecha) {
          parametros.set('desde', filtrosAplicados.fecha)
          parametros.set('hasta', filtrosAplicados.fecha)
        }
      } else {
        parametros.set('estado', filtros[pestanaActiva])
      }

      const respuesta = await api<RespuestaPaginada>(`/envios?${parametros.toString()}`)

      setEnvios(Array.isArray(respuesta?.datos) ? respuesta.datos : [])
      setUltimaActualizacion(new Date())
      setError(false)
    } catch {
      // Se deja la última lista: un corte de red no debería vaciar el panel.
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [filtrosAplicados, pestanaActiva])

  usePolling(cargarEnvios, 15_000)

  const buscar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setCargando(true)
    setFiltrosAplicados({ ...filtros })
  }

  const limpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS)
    setFiltrosAplicados(null)
    setCargando(true)
  }

  const cambiarPestana = (pestana: Pestana) => {
    setCargando(true)
    setEnvios([])
    setFiltros(FILTROS_VACIOS)
    setFiltrosAplicados(null)
    setPestanaActiva(pestana)
  }

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
        <div className="space-y-1">
          {/* Mismos nombres que ve el repartidor en sus botones y el destinatario en el seguimiento. */}
          <EtiquetaEstado estado={envio.estado} />
          {esAsignacionPorExcepcion(envio.estado, envio.eventos ?? []) && (
            <span className="block rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              ⚠️ {AVISO_EXCEPCION}
            </span>
          )}
        </div>
      ),
    },
    {
      titulo: 'Repartidor asignado',
      celda: (envio: EnvioResumen) => (
        <span className="text-slate-600">
          {envio.repartidor
            ? `${envio.repartidor.nombre} ${envio.repartidor.apellido}`
            : 'Sin asignar'}
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

      <form
        onSubmit={buscar}
        className="grid grid-cols-1 items-end gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5"
      >
        <Campo
          etiqueta="Código de seguimiento"
          placeholder="Ej.: ABC123"
          value={filtros.codigo}
          onChange={(evento) => setFiltros({ ...filtros, codigo: evento.target.value })}
        />
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Comercio
          <select
            value={filtros.comercioId}
            onChange={(evento) => setFiltros({ ...filtros, comercioId: evento.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2"
            disabled={errorComercios}
          >
            <option value="">Todos los comercios</option>
            {comercios.map((comercio) => (
              <option key={comercio.id} value={comercio.id}>
                {comercio.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Estado
          <select
            value={filtros.estado}
            onChange={(evento) =>
              setFiltros({ ...filtros, estado: evento.target.value as EstadoEnvio | '' })
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ETIQUETA_ESTADO_ENVIO).map(([estado, etiqueta]) => (
              <option key={estado} value={estado}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <Campo
          etiqueta="Fecha de creación"
          type="date"
          value={filtros.fecha}
          onChange={(evento) => setFiltros({ ...filtros, fecha: evento.target.value })}
        />
        <div className="flex gap-2">
          <Boton type="submit" className="flex-1">
            Buscar
          </Boton>
          <Boton type="button" variante="secundario" onClick={limpiarFiltros}>
            Limpiar
          </Boton>
        </div>
        {errorComercios && (
          <p role="alert" className="text-sm text-red-700 md:col-span-2 xl:col-span-5">
            No se pudieron cargar los comercios para filtrar.
          </p>
        )}
      </form>

      <div className="inline-flex w-full flex-col rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm md:w-auto md:flex-row">
        {PESTANAS.map((pestana) => (
          <button
            key={pestana.id}
            type="button"
            onClick={() => cambiarPestana(pestana.id)}
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

      {error && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          No se pudo actualizar el panel. Se reintenta en 15 s.
        </p>
      )}

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
            mensajeVacio={
              filtrosAplicados
                ? 'No se encontraron envíos con esos filtros'
                : 'No hay envíos en esta categoría.'
            }
          />
        )}
      </div>
    </div>
  )
}
