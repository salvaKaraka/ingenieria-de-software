import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import { BotonGrande } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'

type EstadoRepartidor = 'FUERA_DE_JORNADA' | 'DISPONIBLE' | 'OCUPADO' | 'EN_PAUSA' | 'EMERGENCIA'
type Accion = 'iniciar' | 'pausar' | 'reanudar' | 'terminar'

const CONSULTA_CADA_MS = 10_000

// Qué ve el repartidor en cada estado y qué botón principal tiene.
const PANTALLA: Record<EstadoRepartidor, { titulo: string; detalle: string; accion?: { tipo: Accion; texto: string } }> = {
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
  OCUPADO: { titulo: 'En viaje', detalle: 'Terminá la entrega para recibir otro viaje.' },
  EMERGENCIA: { titulo: 'Emergencia', detalle: 'La central está al tanto.' },
}

export function PanelJornada() {
  const navegar = useNavigate()
  const [estado, setEstado] = useState<EstadoRepartidor | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmandoTerminar, setConfirmandoTerminar] = useState(false)

  const consultar = useCallback(async () => {
    const respuesta = await api<{ estado: EstadoRepartidor }>('/repartidor/jornada')
    setEstado(respuesta.estado)
  }, [])

  usePolling(consultar, CONSULTA_CADA_MS)

  async function ejecutar(accion: Accion) {
    setEnviando(true)
    setAviso(null)
    setConfirmandoTerminar(false)
    try {
      const respuesta = await api<{ estado: EstadoRepartidor }>(`/repartidor/jornada/${accion}`, { metodo: 'POST' })
      setEstado(respuesta.estado)
    } catch (error) {
      // El 409 trae el motivo (por ejemplo, una oferta pendiente): se le muestra tal cual.
      setAviso(error instanceof ErrorApi && error.status === 409 ? error.message : 'No se pudo. Probá de nuevo.')
      void consultar().catch(() => undefined)
    } finally {
      setEnviando(false)
    }
  }

  if (!estado) return <p className="text-center text-slate-400">Cargando jornada…</p>

  const { titulo, detalle, accion } = PANTALLA[estado]
  const puedeTerminar = estado === 'DISPONIBLE' || estado === 'EN_PAUSA'

  return (
    <section className="space-y-4 rounded-2xl bg-slate-900 p-5" aria-live="polite">
      <div>
        <p className="text-sm uppercase text-slate-400">Tu jornada</p>
        <h2 className="text-3xl font-bold">{titulo}</h2>
        <p className="mt-1 text-slate-300">{detalle}</p>
      </div>

      {aviso && <p className="rounded-xl bg-slate-800 p-4">{aviso}</p>}

      {confirmandoTerminar ? (
        <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-950/20 p-4">
          <p className="text-center text-lg font-semibold text-red-200">¿Confirmás terminar la jornada?</p>
          <BotonGrande
            variante="peligro"
            onClick={() => void ejecutar('terminar')}
            disabled={enviando}
          >
            Sí, terminar jornada
          </BotonGrande>
          <BotonGrande
            variante="secundario"
            onClick={() => setConfirmandoTerminar(false)}
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

          {estado === 'OCUPADO' && (
            <BotonGrande onClick={() => navegar('/repartidor/viaje')}>Ver mi viaje</BotonGrande>
          )}

          {puedeTerminar && (
            <BotonGrande
              variante="peligro"
              onClick={() => setConfirmandoTerminar(true)}
              disabled={enviando}
            >
              Terminar jornada
            </BotonGrande>
          )}
        </div>
      )}
    </section>
  )
}
