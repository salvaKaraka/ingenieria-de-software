import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import { BotonGrande } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'

type Oferta = {
  id: number
  segundosRestantes: number
  envio: {
    id: number
    comercio: string
    origenDireccion: string
    destinoDireccion: string
    tamanio: 'CHICO' | 'MEDIANO' | 'GRANDE'
    observaciones: string | null
  }
}

const TAMANIO = { CHICO: 'Chico', MEDIANO: 'Mediano', GRANDE: 'Grande' }
const CONSULTA_CADA_MS = 10_000

function formatearTiempo(segundos: number) {
  const minutos = Math.floor(segundos / 60)
  return `${minutos}:${String(segundos % 60).padStart(2, '0')}`
}

// D-4: oferta de viaje vigente, con cuenta regresiva y botones Aceptar / Rechazar.
// Mientras no haya oferta no muestra nada.
export function OfertaActual() {
  const navegar = useNavigate()
  const [oferta, setOferta] = useState<Oferta | null>(null)
  // Momento (reloj local) en que vence: se calcula con los segundos que manda el servidor,
  // así la cuenta no depende de que la hora del celular esté bien.
  const [venceEn, setVenceEn] = useState(0)
  const [ahora, setAhora] = useState(() => Date.now())
  const [respondiendo, setRespondiendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const consultar = useCallback(async () => {
    const respuesta = await api<{ oferta: Oferta | null }>('/repartidor/ofertas/actual')
    setOferta(respuesta.oferta)
    if (respuesta.oferta) {
      setVenceEn(Date.now() + respuesta.oferta.segundosRestantes * 1000)
      setAviso(null)
    }
  }, [])

  usePolling(consultar, CONSULTA_CADA_MS)

  // Reloj de la cuenta regresiva: solo corre mientras hay una oferta en pantalla.
  useEffect(() => {
    if (!oferta) return
    const intervalo = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(intervalo)
  }, [oferta])

  async function responder(accion: 'aceptar' | 'rechazar') {
    if (!oferta) return
    setRespondiendo(true)
    try {
      await api(`/repartidor/ofertas/${oferta.id}/${accion}`, { metodo: 'POST' })
      setOferta(null)
      if (accion === 'aceptar') navegar('/repartidor/viaje')
    } catch (error) {
      setOferta(null)
      setAviso(error instanceof ErrorApi && error.status === 409 ? 'La oferta ya no está disponible.' : 'No se pudo responder. Probá de nuevo.')
      void consultar().catch(() => undefined)
    } finally {
      setRespondiendo(false)
    }
  }

  if (!oferta) {
    return aviso ? <p className="rounded-xl bg-slate-800 p-4 text-center">{aviso}</p> : null
  }

  const restantes = Math.max(0, Math.ceil((venceEn - ahora) / 1000))
  if (restantes === 0) {
    return <p className="rounded-xl bg-slate-800 p-4 text-center">La oferta venció.</p>
  }

  return (
    <section className="space-y-5 rounded-2xl border-4 border-yellow-400 bg-slate-900 p-5" aria-live="assertive">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold">Nuevo viaje</h2>
        <p className={`font-mono text-3xl font-bold ${restantes <= 60 ? 'text-red-400' : 'text-yellow-400'}`}>
          {formatearTiempo(restantes)}
        </p>
      </div>

      <dl className="space-y-3">
        <div>
          <dt className="text-sm uppercase text-slate-400">Retirar en</dt>
          <dd className="text-xl font-semibold">
            {oferta.envio.comercio} · {oferta.envio.origenDireccion}
          </dd>
        </div>
        <div>
          <dt className="text-sm uppercase text-slate-400">Entregar en</dt>
          <dd className="text-xl font-semibold">{oferta.envio.destinoDireccion}</dd>
        </div>
        <div>
          <dt className="text-sm uppercase text-slate-400">Paquete</dt>
          <dd className="text-xl">{TAMANIO[oferta.envio.tamanio]}</dd>
        </div>
        {oferta.envio.observaciones && (
          <div>
            <dt className="text-sm uppercase text-slate-400">Observaciones</dt>
            <dd>{oferta.envio.observaciones}</dd>
          </div>
        )}
      </dl>

      <div className="space-y-3">
        <BotonGrande onClick={() => void responder('aceptar')} disabled={respondiendo}>
          Aceptar
        </BotonGrande>
        <BotonGrande variante="secundario" onClick={() => void responder('rechazar')} disabled={respondiendo}>
          Rechazar
        </BotonGrande>
      </div>
    </section>
  )
}
