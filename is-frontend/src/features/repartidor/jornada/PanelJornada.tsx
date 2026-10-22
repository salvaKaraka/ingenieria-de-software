import { useCallback, useState } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import { BotonGrande } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'

type EstadoRepartidor = 'FUERA_DE_JORNADA' | 'DISPONIBLE' | 'OCUPADO' | 'EN_PAUSA' | 'EMERGENCIA'
type Accion = 'iniciar' | 'pausar' | 'reanudar'

const CONSULTA_CADA_MS = 10_000

// Qué ve el repartidor en cada estado y qué botón tiene (si tiene alguno).
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

// C-4 (versión mínima): estado de la jornada en grande y el botón para iniciar, pausar o reanudar.
// Falta "Terminar jornada", que queda para C-3/C-4.
export function PanelJornada() {
  const [estado, setEstado] = useState<EstadoRepartidor | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const consultar = useCallback(async () => {
    const respuesta = await api<{ estado: EstadoRepartidor }>('/repartidor/jornada')
    setEstado(respuesta.estado)
  }, [])

  usePolling(consultar, CONSULTA_CADA_MS)

  async function ejecutar(accion: Accion) {
    setEnviando(true)
    setAviso(null)
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

  return (
    <section className="space-y-4 rounded-2xl bg-slate-900 p-5" aria-live="polite">
      <div>
        <p className="text-sm uppercase text-slate-400">Tu jornada</p>
        <h2 className="text-3xl font-bold">{titulo}</h2>
        <p className="mt-1 text-slate-300">{detalle}</p>
      </div>

      {aviso && <p className="rounded-xl bg-slate-800 p-4">{aviso}</p>}

      {accion && (
        <BotonGrande
          variante={accion.tipo === 'pausar' ? 'secundario' : 'primario'}
          onClick={() => void ejecutar(accion.tipo)}
          disabled={enviando}
        >
          {accion.texto}
        </BotonGrande>
      )}
    </section>
  )
}
