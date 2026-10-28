import { useCallback, useState } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import { BotonGrande } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'

export type EstadoRepartidor =
  | 'FUERA_DE_JORNADA'
  | 'DISPONIBLE'
  | 'OCUPADO'
  | 'EN_PAUSA'
  | 'EMERGENCIA'
  | 'ESPERANDO_VALIDACION_CIERRE'

export interface PaqueteDevolver {
  id: number
  codigoSeguimiento: string
  destinoDireccion: string
  comercio: {
    nombre: string
    direccion: string
  }
  motivo: string
  estado: string
}

type Accion = 'iniciar' | 'pausar' | 'reanudar' | 'terminar'

const CONSULTA_CADA_MS = 10_000

// Qué ve el repartidor en cada estado y qué botón principal tiene.
const PANTALLA: Record<
  EstadoRepartidor,
  { titulo: string; detalle: string; accion?: { tipo: Accion; texto: string } }
> = {
  FUERA_DE_JORNADA: {
    titulo: 'Fuera de jornada',
    detalle: 'Iniciá la jornada para empezar a recibir viajes.',
    accion: { tipo: 'iniciar', texto: 'Iniciar jornada' },
  },
  DISPONIBLE: {
    titulo: 'Disponible',
    detalle: 'Estás en la cola. Te avisamos cuando haya un viaje.',
    accion: { tipo: 'pausar', texto: 'Pausar' },
  },
  EN_PAUSA: {
    titulo: 'En pausa',
    detalle: 'No recibís viajes hasta que reanudes.',
    accion: { tipo: 'reanudar', texto: 'Reanudar' },
  },
  OCUPADO: {
    titulo: 'En viaje',
    detalle: 'Terminá la entrega para recibir otro viaje.',
  },
  EMERGENCIA: {
    titulo: 'Emergencia',
    detalle: 'La central está al tanto.',
  },
  ESPERANDO_VALIDACION_CIERRE: {
    titulo: 'Esperando validación de cierre',
    detalle: 'Acercate a la base para rendir los paquetes y finalizar el turno.',
  },
}

export function PanelJornada() {
  const [estado, setEstado] = useState<EstadoRepartidor | null>(null)
  const [cierreSolicitado, setCierreSolicitado] = useState(false)
  const [paquetesADevolver, setPaquetesADevolver] = useState<PaqueteDevolver[]>([])
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmandoCierre, setConfirmandoCierre] = useState(false)

  const consultar = useCallback(async () => {
    const respuesta = await api<{
      estado: EstadoRepartidor
      cierreSolicitado?: boolean
      paquetesADevolver?: PaqueteDevolver[]
    }>('/repartidor/jornada')
    setEstado(respuesta.estado)
    if (respuesta.cierreSolicitado !== undefined) {
      setCierreSolicitado(respuesta.cierreSolicitado)
    }
    if (respuesta.paquetesADevolver) {
      setPaquetesADevolver(respuesta.paquetesADevolver)
    }
  }, [])

  usePolling(consultar, CONSULTA_CADA_MS)

  async function ejecutar(accion: Accion) {
    setEnviando(true)
    setAviso(null)
    setConfirmandoCierre(false)
    try {
      const respuesta = await api<{ estado: EstadoRepartidor }>(
        `/repartidor/jornada/${accion}`,
        { metodo: 'POST' },
      )
      setEstado(respuesta.estado)
    } catch (error) {
      // El 409 trae el motivo (por ejemplo, una oferta pendiente): se le muestra tal cual.
      setAviso(
        error instanceof ErrorApi && error.status === 409
          ? error.message
          : 'No se pudo. Probá de nuevo.',
      )
      void consultar().catch(() => undefined)
    } finally {
      setEnviando(false)
    }
  }

  async function ejecutarSolicitarCierre() {
    setEnviando(true)
    setAviso(null)
    setConfirmandoCierre(false)
    try {
      const respuesta = await api<{
        estado: EstadoRepartidor
        cierrePendiente?: boolean
        paquetesADevolver?: PaqueteDevolver[]
        mensaje?: string
      }>('/repartidor/jornada/solicitar-cierre', { metodo: 'POST' })

      setEstado(respuesta.estado)
      if (respuesta.cierrePendiente) {
        setCierreSolicitado(true)
      }
      if (respuesta.paquetesADevolver) {
        setPaquetesADevolver(respuesta.paquetesADevolver)
      }
      if (respuesta.mensaje) {
        setAviso(respuesta.mensaje)
      }
    } catch (error) {
      setAviso(
        error instanceof ErrorApi && error.status === 409
          ? error.message
          : 'No se pudo solicitar el cierre. Probá de nuevo.',
      )
      void consultar().catch(() => undefined)
    } finally {
      setEnviando(false)
    }
  }

  if (!estado) return <p className="text-center text-slate-400">Cargando jornada…</p>

  const { titulo, detalle, accion } = PANTALLA[estado]
  const puedeCerrar =
    (estado === 'DISPONIBLE' || estado === 'EN_PAUSA' || estado === 'OCUPADO') &&
    !cierreSolicitado

  return (
    <section className="space-y-4 rounded-2xl bg-slate-900 p-5" aria-live="polite">
      <div>
        <p className="text-sm uppercase text-slate-400">Tu jornada</p>
        <h2 className="text-3xl font-bold">{titulo}</h2>
        <p className="mt-1 text-slate-300">{detalle}</p>
      </div>

      {cierreSolicitado && estado === 'OCUPADO' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-amber-200">
          <p className="font-semibold">Cierre de jornada pendiente</p>
          <p className="text-sm mt-1">Finalizá tu viaje en curso para completar el cierre.</p>
        </div>
      )}

      {aviso && <p className="rounded-xl bg-slate-800 p-4 text-slate-200">{aviso}</p>}

      {estado === 'ESPERANDO_VALIDACION_CIERRE' && (
        <div className="space-y-3 rounded-xl border border-blue-500/30 bg-blue-950/20 p-4">
          <h3 className="text-lg font-semibold text-blue-200">
            Resumen de paquetes a devolver en la base
          </h3>
          {paquetesADevolver.length === 0 ? (
            <p className="text-sm text-slate-300">
              No tenés paquetes pendientes de devolución. El operario ya puede validar tu cierre.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-300">
                Debes entregar {paquetesADevolver.length}{' '}
                {paquetesADevolver.length === 1 ? 'paquete' : 'paquetes'} en la base:
              </p>
              {paquetesADevolver.map((paquete) => (
                <div
                  key={paquete.id}
                  className="rounded-lg bg-slate-800 p-3 text-sm space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-white">
                      {paquete.codigoSeguimiento}
                    </span>
                    <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                      {paquete.motivo}
                    </span>
                  </div>
                  <p className="text-slate-400">Destino: {paquete.destinoDireccion}</p>
                  <p className="text-slate-400">Comercio: {paquete.comercio.nombre}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmandoCierre ? (
        <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-950/20 p-4">
          <p className="text-center text-lg font-semibold text-red-200">
            ¿Confirmás solicitar el cierre de tu jornada?
          </p>
          {estado === 'OCUPADO' && (
            <p className="text-center text-sm text-amber-300">
              Tenés un viaje en curso. La solicitud llegará al operario cuando lo finalices.
            </p>
          )}
          <BotonGrande
            variante="peligro"
            onClick={() => void ejecutarSolicitarCierre()}
            disabled={enviando}
          >
            Sí, cerrar jornada
          </BotonGrande>
          <BotonGrande
            variante="secundario"
            onClick={() => setConfirmandoCierre(false)}
            disabled={enviando}
          >
            Cancelar
          </BotonGrande>
        </div>
      ) : (
        <div className="space-y-3">
          {accion && (
            <BotonGrande
              variante={accion.tipo === 'pausar' ? 'secundario' : 'primario'}
              onClick={() => void ejecutar(accion.tipo)}
              disabled={enviando}
            >
              {accion.texto}
            </BotonGrande>
          )}

          {puedeCerrar && (
            <BotonGrande
              variante="peligro"
              onClick={() => setConfirmandoCierre(true)}
              disabled={enviando}
            >
              Cerrar jornada
            </BotonGrande>
          )}
        </div>
      )}
    </section>
  )
}
