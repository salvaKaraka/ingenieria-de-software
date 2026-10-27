import { useCallback, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import type { EstadoEnvio } from '../../../shared/tipos.ts'
import { BotonGrande } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'

// Lo que devuelve GET /api/repartidor/viajes/actual (E-2).
type EstadoViaje = 'ASIGNADO' | 'EN_CAMINO_A_RETIRAR' | 'RETIRADO' | 'EN_DOMICILIO'

type Viaje = {
  envioId: number
  codigoSeguimiento: string
  estado: EstadoViaje
  siguienteEstado: EstadoEnvio | null
  comercio: { nombre: string; telefono: string }
  origenDireccion: string
  destinoDireccion: string
  destinatario: { nombre: string | null; apellido: string | null; telefono: string | null }
  observaciones: string | null
  requiereFoto: boolean
  requiereDni: boolean
}

const CONSULTA_CADA_MS = 10_000

// Texto del botón según el estado ACTUAL: describe lo que el repartidor acaba de hacer
// (o va a hacer), que es justo lo que pasa el envío al estado siguiente.
const PASO: Record<EstadoViaje, { numero: number; accion: string }> = {
  ASIGNADO: { numero: 1, accion: 'Voy al comercio' },
  EN_CAMINO_A_RETIRAR: { numero: 2, accion: 'Paquete retirado' },
  RETIRADO: { numero: 3, accion: 'Llegué al domicilio' },
  EN_DOMICILIO: { numero: 4, accion: 'Entregado' },
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm uppercase text-slate-400">{titulo}</dt>
      <dd className="text-xl font-semibold">{children}</dd>
    </div>
  )
}

function Telefono({ numero }: { numero: string }) {
  return (
    <a href={`tel:${numero}`} className="text-yellow-400 underline">
      {numero}
    </a>
  )
}

// E-3: viaje activo. Muestra solo lo que sirve en la etapa actual (retiro o entrega)
// y un único botón con la próxima acción, con confirmación: 2 toques (RNF-10).
export function ViajePage() {
  const navegar = useNavigate()
  // undefined = todavía cargando; null = no hay viaje activo.
  const [viaje, setViaje] = useState<Viaje | null | undefined>(undefined)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const consultar = useCallback(async () => {
    const respuesta = await api<{ viaje: Viaje | null }>('/repartidor/viajes/actual')
    setViaje(respuesta.viaje)
  }, [])

  // El operario puede cancelar el envío mientras tanto: se refresca como el resto de la app.
  usePolling(consultar, CONSULTA_CADA_MS)

  async function avanzar() {
    setEnviando(true)
    setAviso(null)
    try {
      const respuesta = await api<{ estado: EstadoEnvio }>('/repartidor/viajes/actual/avanzar', { metodo: 'POST' })
      setConfirmando(false)
      if (respuesta.estado === 'ENTREGADO') {
        navegar('/repartidor', { replace: true, state: { aviso: '¡Entrega registrada! Ya estás de nuevo en la cola.' } })
        return
      }
      await consultar()
    } catch (error) {
      setConfirmando(false)
      // El 409 explica qué pasó (por ejemplo, que el operario canceló el envío).
      setAviso(error instanceof ErrorApi && error.status === 409 ? error.message : 'No se pudo. Probá de nuevo.')
      void consultar().catch(() => undefined)
    } finally {
      setEnviando(false)
    }
  }

  if (viaje === undefined) return <p className="text-center text-slate-400">Cargando viaje…</p>

  if (viaje === null) {
    return (
      <section className="space-y-4 rounded-2xl bg-slate-900 p-5">
        {aviso && <p className="rounded-xl bg-slate-800 p-4">{aviso}</p>}
        <h2 className="text-2xl font-bold">No tenés un viaje activo</h2>
        <p className="text-slate-300">Si estabas en un viaje, puede que lo hayan cancelado desde la central.</p>
        <BotonGrande onClick={() => navegar('/repartidor')}>Volver al inicio</BotonGrande>
      </section>
    )
  }

  const { numero, accion } = PASO[viaje.estado]
  const enRetiro = viaje.estado === 'ASIGNADO' || viaje.estado === 'EN_CAMINO_A_RETIRAR'
  const destinatario = [viaje.destinatario.nombre, viaje.destinatario.apellido].filter(Boolean).join(' ')
  const evidencia = [viaje.requiereDni && 'pedí el DNI', viaje.requiereFoto && 'sacá una foto'].filter(Boolean)

  return (
    <section className="space-y-5 rounded-2xl bg-slate-900 p-5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">{enRetiro ? 'Retiro' : 'Entrega'}</h2>
        <p className="text-base text-slate-400">Paso {numero} de 4</p>
      </div>

      <dl className="space-y-3">
        {enRetiro ? (
          <>
            <Dato titulo="Comercio">{viaje.comercio.nombre}</Dato>
            <Dato titulo="Retirar en">{viaje.origenDireccion}</Dato>
            <Dato titulo="Teléfono del comercio">
              <Telefono numero={viaje.comercio.telefono} />
            </Dato>
          </>
        ) : (
          <>
            <Dato titulo="Entregar en">{viaje.destinoDireccion}</Dato>
            {destinatario && <Dato titulo="Destinatario">{destinatario}</Dato>}
            {viaje.destinatario.telefono && (
              <Dato titulo="Teléfono del destinatario">
                <Telefono numero={viaje.destinatario.telefono} />
              </Dato>
            )}
          </>
        )}
        {viaje.observaciones && (
          <div>
            <dt className="text-sm uppercase text-slate-400">Observaciones</dt>
            <dd>{viaje.observaciones}</dd>
          </div>
        )}
        <div>
          <dt className="text-sm uppercase text-slate-400">Código</dt>
          <dd className="font-mono">{viaje.codigoSeguimiento}</dd>
        </div>
      </dl>

      {!enRetiro && evidencia.length > 0 && (
        <p className="rounded-xl border border-yellow-400/40 bg-yellow-950/30 p-4 font-semibold text-yellow-200">
          Al entregar: {evidencia.join(' y ')}.
        </p>
      )}

      {aviso && <p className="rounded-xl bg-slate-800 p-4">{aviso}</p>}

      {confirmando ? (
        <div className="space-y-3 rounded-xl border border-yellow-400/40 p-4">
          <p className="text-center text-lg font-semibold">¿Confirmás «{accion}»?</p>
          <BotonGrande onClick={() => void avanzar()} disabled={enviando}>
            Sí, confirmar
          </BotonGrande>
          <BotonGrande variante="secundario" onClick={() => setConfirmando(false)} disabled={enviando}>
            Volver
          </BotonGrande>
        </div>
      ) : (
        <BotonGrande onClick={() => setConfirmando(true)} disabled={enviando}>
          {accion}
        </BotonGrande>
      )}
    </section>
  )
}
