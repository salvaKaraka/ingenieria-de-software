import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import { Boton } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'

// Pestaña Depósito (HU 37-40): los paquetes que volvieron a la base y su devolución al
// comercio. El reingreso de cada paquete se registra al aprobar el cierre del repartidor.

type PaqueteEnCustodia = {
  envioId: number
  codigoSeguimiento: string
  destinoOriginal: string
  tamanio: string
  horasEnCustodia: number
  // HU 40: lleva 24 horas o más en custodia.
  alerta: boolean
}

type GrupoCustodia = {
  comercio: { id: number; nombre: string; direccion: string }
  paquetes: PaqueteEnCustodia[]
}

type EstadoOrden = 'SIN_REPARTIDOR' | 'OFRECIDA' | 'EN_CAMINO' | 'DEVUELTA'

type Orden = {
  ordenId: number
  estado: EstadoOrden
  comercio: { nombre: string; direccion: string }
  repartidor: string | null
  creadaEn: string
  confirmadaEn: string | null
  paquetes: { envioId: number; codigoSeguimiento: string }[]
}

type Resumen = { custodia: GrupoCustodia[]; ordenes: Orden[] }

const CONSULTA_CADA_MS = 15_000

const TAMANIO: Record<string, string> = { CHICO: 'Chico', MEDIANO: 'Mediano', GRANDE: 'Grande' }

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`
}

export function DepositoPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setResumen(await api<Resumen>('/envios/deposito/resumen'))
      setError(null)
    } catch {
      setError('No se pudo cargar el depósito. Se reintenta solo.')
    }
  }, [])

  usePolling(cargar, CONSULTA_CADA_MS)

  const paquetes = resumen?.custodia.flatMap((grupo) => grupo.paquetes) ?? []
  const demorados = resumen?.custodia.flatMap((grupo) =>
    grupo.paquetes.filter((p) => p.alerta).map((p) => ({ ...p, comercio: grupo.comercio.nombre })),
  ) ?? []
  const ordenesAbiertas = resumen?.ordenes.filter((o) => o.estado !== 'DEVUELTA') ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Depósito</h1>
        <p className="text-sm text-gray-600">
          Paquetes que volvieron a la base y su devolución a cada comercio. Los paquetes entran al depósito
          cuando el repartidor los rinde al cerrar su jornada.
        </p>
      </div>

      {resumen && (
        <div className="flex flex-wrap gap-3 text-sm">
          <Contador valor={paquetes.length} texto="en custodia" />
          <Contador valor={demorados.length} texto="con 24 h o más" alerta={demorados.length > 0} />
          <Contador valor={ordenesAbiertas.length} texto="órdenes en curso" />
        </div>
      )}

      {mensaje && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{mensaje}</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!resumen && !error && <p className="text-gray-500">Cargando…</p>}

      {/* HU 40 */}
      {demorados.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">Devoluciones pendientes ({demorados.length})</h2>
          <p className="mb-2 text-sm text-amber-800">
            Llevan 24 horas o más en el depósito sin orden de devolución.
          </p>
          <ul className="space-y-1 text-sm text-amber-900">
            {demorados.map((p) => (
              <li key={p.envioId}>
                <span className="font-mono font-semibold">{p.codigoSeguimiento}</span> · {p.comercio} ·{' '}
                {p.horasEnCustodia} h en custodia
              </li>
            ))}
          </ul>
        </section>
      )}

      {resumen && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">En custodia</h2>
          {resumen.custodia.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              No hay paquetes en custodia.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {resumen.custodia.map((grupo) => (
                <TarjetaComercio
                  key={grupo.comercio.id}
                  grupo={grupo}
                  alCrear={(texto) => {
                    setMensaje(texto)
                    void cargar()
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {resumen && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Órdenes de devolución</h2>
          {resumen.ordenes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              No hay órdenes de devolución abiertas ni entregadas hoy.
            </p>
          ) : (
            <ul className="space-y-3">
              {resumen.ordenes.map((orden) => (
                <TarjetaOrden key={orden.ordenId} orden={orden} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function Contador({ valor, texto, alerta = false }: { valor: number; texto: string; alerta?: boolean }) {
  return (
    <span
      className={`rounded-lg border px-3 py-2 ${alerta ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-700'}`}
    >
      <strong className="text-base">{valor}</strong> {texto}
    </span>
  )
}

// HU 38: los paquetes de un comercio, todos marcados. El operario destilda los que no quiere
// mandar y crea la orden con un solo botón.
function TarjetaComercio({ grupo, alCrear }: { grupo: GrupoCustodia; alCrear: (mensaje: string) => void }) {
  // Se guardan los destildados: un paquete que llega mientras la pantalla está abierta entra marcado.
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set())
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seleccionados = grupo.paquetes.filter((p) => !excluidos.has(p.envioId)).map((p) => p.envioId)

  function alternar(envioId: number) {
    setExcluidos((previos) => {
      const siguientes = new Set(previos)
      if (siguientes.has(envioId)) siguientes.delete(envioId)
      else siguientes.add(envioId)
      return siguientes
    })
  }

  async function crearOrden() {
    setCreando(true)
    setError(null)
    try {
      const respuesta = await api<{ ofrecida: boolean }>('/envios/deposito/ordenes-devolucion', {
        metodo: 'POST',
        datos: { comercioId: grupo.comercio.id, envioIds: seleccionados },
      })
      setExcluidos(new Set())
      alCrear(
        `Orden de devolución a ${grupo.comercio.nombre} creada con ${plural(seleccionados.length, 'paquete', 'paquetes')}. ` +
          (respuesta.ofrecida
            ? 'Ya se le ofreció a un repartidor.'
            : 'No hay repartidores disponibles: aparece en Excepciones para asignarla a mano.'),
      )
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear la orden de devolución.')
    } finally {
      setCreando(false)
    }
  }

  return (
    <article className="flex flex-col rounded-lg border border-gray-200 bg-white">
      <header className="border-b border-gray-100 px-4 py-3">
        <h3 className="font-semibold">{grupo.comercio.nombre}</h3>
        <p className="text-xs text-gray-500">Devolver en {grupo.comercio.direccion}</p>
      </header>
      <ul className="flex-1 divide-y divide-gray-100">
        {grupo.paquetes.map((p) => (
          <li key={p.envioId}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={!excluidos.has(p.envioId)}
                onChange={() => alternar(p.envioId)}
                className="size-4"
              />
              <span className="font-mono font-semibold">{p.codigoSeguimiento}</span>
              <span className="flex-1 truncate text-gray-500">
                {TAMANIO[p.tamanio] ?? p.tamanio} · iba a {p.destinoOriginal}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${p.alerta ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
              >
                {p.horasEnCustodia} h
              </span>
            </label>
          </li>
        ))}
      </ul>
      <footer className="space-y-2 border-t border-gray-100 px-4 py-3">
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Boton onClick={() => void crearOrden()} disabled={creando || seleccionados.length === 0} className="w-full">
          {creando ? 'Creando…' : `Crear orden de devolución (${seleccionados.length})`}
        </Boton>
      </footer>
    </article>
  )
}

const ESTADO_ORDEN: Record<EstadoOrden, { texto: (orden: Orden) => string; clases: string }> = {
  SIN_REPARTIDOR: { texto: () => 'Sin repartidor disponible', clases: 'bg-red-100 text-red-800' },
  OFRECIDA: { texto: (o) => `Ofrecida a ${o.repartidor}`, clases: 'bg-sky-100 text-sky-800' },
  EN_CAMINO: { texto: (o) => `En camino con ${o.repartidor}`, clases: 'bg-teal-100 text-teal-800' },
  DEVUELTA: {
    texto: (o) => `Devuelta a las ${o.confirmadaEn ? hora(o.confirmadaEn) : '—'} por ${o.repartidor}`,
    clases: 'bg-emerald-100 text-emerald-800',
  },
}

function TarjetaOrden({ orden }: { orden: Orden }) {
  const estado = ESTADO_ORDEN[orden.estado]
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            Orden #{orden.ordenId} · {orden.comercio.nombre}
          </p>
          <p className="text-xs text-gray-500">
            Creada a las {hora(orden.creadaEn)} · {plural(orden.paquetes.length, 'paquete', 'paquetes')}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estado.clases}`}>{estado.texto(orden)}</span>
      </div>
      <p className="mt-2 flex flex-wrap gap-2 text-sm">
        {orden.paquetes.map((p) => (
          <Link
            key={p.envioId}
            to={`/operario/envios/${p.envioId}`}
            className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-800 hover:bg-gray-200"
          >
            {p.codigoSeguimiento}
          </Link>
        ))}
      </p>
      {orden.estado === 'SIN_REPARTIDOR' && (
        <p className="mt-2 text-sm text-red-700">
          El sistema la sigue ofreciendo sola. Para asignarla a mano, andá a{' '}
          <Link to="/operario/excepciones" className="font-semibold underline">
            Excepciones
          </Link>
          .
        </p>
      )}
    </li>
  )
}
