import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import { ETIQUETA_VEHICULO, type TipoVehiculo } from '../../../shared/tipos.ts'
import { Boton, Modal, Selector, Tabla, type Columna } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'
import { ETIQUETA_ESTADO_REPARTIDOR, type EstadoRepartidor } from '../repartidores/tipos.ts'

// Panel de excepciones · HU 12 y HU 22: envíos que el motor no pudo resolver solo.
// Hoy entran los que quedaron sin repartidor tras un vencimiento de oferta; cuando exista
// el estado "Parado" (HU 20/21) el backend los suma a la misma lista.

type Excepcion = {
  envioId: number
  codigoSeguimiento: string
  comercio: string
  origenDireccion: string
  destinoDireccion: string
  vehiculoRequerido: TipoVehiculo
  aviso: string
  minutosEspera: number
}

type RepartidorAsignable = {
  id: number
  nombre: string
  apellido: string
  vehiculo: TipoVehiculo
  estado: EstadoRepartidor
  viajesConsecutivos: number
}

const CONSULTA_CADA_MS = 15_000

function espera(minutos: number): string {
  if (minutos < 1) return 'Recién'
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

export function ExcepcionesPage() {
  const [excepciones, setExcepciones] = useState<Excepcion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [asignando, setAsignando] = useState<Excepcion | null>(null)
  const [cancelando, setCancelando] = useState<Excepcion | null>(null)

  const cargar = useCallback(async () => {
    try {
      const respuesta = await api<{ excepciones: Excepcion[] }>('/excepciones')
      setExcepciones(respuesta.excepciones)
      setError(null)
    } catch {
      setError('No se pudo cargar el panel. Se reintenta solo.')
    }
  }, [])

  // El motor sigue reintentando los envíos: el panel se refresca como el resto del operario.
  usePolling(cargar, CONSULTA_CADA_MS)

  function terminar(texto: string) {
    setAsignando(null)
    setCancelando(null)
    setMensaje(texto)
    void cargar()
  }

  const columnas: Columna<Excepcion>[] = [
    { titulo: 'Espera', celda: (e) => <span className="font-semibold">{espera(e.minutosEspera)}</span> },
    {
      titulo: 'Motivo',
      celda: (e) => (
        <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          ⚠️ {e.aviso}
        </span>
      ),
    },
    {
      titulo: 'Envío',
      celda: (e) => (
        <Link to={`/operario/envios/${e.envioId}`} className="text-blue-600 underline">
          {e.codigoSeguimiento}
        </Link>
      ),
    },
    { titulo: 'Comercio', celda: (e) => e.comercio },
    {
      titulo: 'Recorrido',
      celda: (e) => (
        <span className="text-gray-700">
          {e.origenDireccion} → {e.destinoDireccion}
        </span>
      ),
    },
    { titulo: 'Vehículo mínimo', celda: (e) => ETIQUETA_VEHICULO[e.vehiculoRequerido] },
    {
      titulo: 'Acciones',
      celda: (e) => (
        <div className="flex gap-2">
          <Boton onClick={() => setAsignando(e)}>Asignar</Boton>
          <Boton variante="peligro" onClick={() => setCancelando(e)}>
            Cancelar envío
          </Boton>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Excepciones</h1>
        <p className="text-sm text-gray-600">
          Envíos que el sistema no pudo asignar solo. Los que esperan hace más tiempo aparecen primero.
        </p>
      </div>

      {mensaje && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{mensaje}</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {excepciones === null && !error && <p className="text-gray-500">Cargando…</p>}

      {excepciones && (
        <Tabla
          columnas={columnas}
          filas={excepciones}
          claveFila={(e) => e.envioId}
          mensajeVacio="No hay envíos que requieran atención"
        />
      )}

      {asignando && (
        <AsignarModal
          excepcion={asignando}
          onCerrar={() => setAsignando(null)}
          onAsignado={(nombre) => terminar(`Oferta enviada a ${nombre}. Tiene 5 minutos para responder.`)}
        />
      )}

      {cancelando && (
        <CancelarModal
          excepcion={cancelando}
          onCerrar={() => setCancelando(null)}
          onCancelado={() => terminar(`Envío ${cancelando.codigoSeguimiento} cancelado.`)}
        />
      )}
    </div>
  )
}

// HU 22, escenarios 1 y 5: el operario elige a quién. No se respeta la cola ni los 2 viajes seguidos.
function AsignarModal({
  excepcion,
  onCerrar,
  onAsignado,
}: {
  excepcion: Excepcion
  onCerrar: () => void
  onAsignado: (nombre: string) => void
}) {
  const [repartidores, setRepartidores] = useState<RepartidorAsignable[] | null>(null)
  const [elegido, setElegido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [reintentando, setReintentando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const lista = await api<RepartidorAsignable[]>(`/excepciones/${excepcion.envioId}/repartidores`)
      setRepartidores(lista)
      setErrorCarga(null)
    } catch (err) {
      // Sin esto el modal quedaba en "Cargando repartidores…" para siempre.
      setErrorCarga(err instanceof ErrorApi ? err.message : 'No se pudieron cargar los repartidores.')
    }
  }, [excepcion.envioId])

  async function reintentar() {
    setReintentando(true)
    await cargar()
    setReintentando(false)
  }

  // Se actualiza mientras el modal está abierto: los repartidores cambian de estado.
  usePolling(cargar, CONSULTA_CADA_MS)

  async function confirmar() {
    const repartidor = repartidores?.find((r) => String(r.id) === elegido)
    if (!repartidor) {
      setError('Elegí un repartidor')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await api(`/excepciones/${excepcion.envioId}/asignar`, {
        metodo: 'POST',
        datos: { repartidorId: repartidor.id },
      })
      onAsignado(`${repartidor.nombre} ${repartidor.apellido}`)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo asignar. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const opciones = [
    { valor: '', etiqueta: 'Elegí un repartidor…' },
    ...(repartidores ?? []).map((r) => ({
      valor: String(r.id),
      etiqueta: `${r.apellido}, ${r.nombre} · ${ETIQUETA_VEHICULO[r.vehiculo]} · ${ETIQUETA_ESTADO_REPARTIDOR[r.estado]} · ${r.viajesConsecutivos} viajes seguidos`,
    })),
  ]

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Asignar envío ${excepcion.codigoSeguimiento}`}>
      <div className="space-y-4">
        {repartidores === null && !errorCarga && <p className="text-sm text-gray-500">Cargando repartidores…</p>}
        {/* Si ya había una lista cargada se sigue mostrando: el error solo tapa la carga inicial. */}
        {repartidores === null && errorCarga && (
          <div className="space-y-2 rounded-lg bg-red-50 p-3">
            <p className="text-sm text-red-800">{errorCarga}</p>
            <Boton variante="secundario" onClick={reintentar} disabled={reintentando}>
              {reintentando ? 'Reintentando…' : 'Reintentar'}
            </Boton>
          </div>
        )}
        {repartidores?.length === 0 && (
          <p className="text-sm text-gray-600">
            No hay repartidores en jornada con un vehículo que pueda llevar este envío.
          </p>
        )}
        {repartidores && repartidores.length > 0 && (
          <Selector
            etiqueta="Repartidor"
            opciones={opciones}
            value={elegido}
            onChange={(evento) => setElegido(evento.target.value)}
          />
        )}
        <p className="text-xs text-gray-500">
          La oferta le llega directo, sin respetar el orden de la cola ni el límite de viajes seguidos.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Volver
          </Boton>
          <Boton onClick={confirmar} disabled={enviando || !elegido}>
            {enviando ? 'Enviando…' : 'Confirmar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

// HU 22, escenario 2. Usa el mismo endpoint de cancelación que el detalle del envío (B-4).
function CancelarModal({
  excepcion,
  onCerrar,
  onCancelado,
}: {
  excepcion: Excepcion
  onCerrar: () => void
  onCancelado: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setEnviando(true)
    setError(null)
    try {
      await api(`/envios/${excepcion.envioId}/cancelar`, { metodo: 'POST' })
      onCancelado()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cancelar el envío.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Cancelar envío">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          ¿Seguro que querés cancelar el envío <strong>{excepcion.codigoSeguimiento}</strong> de {excepcion.comercio}?
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Volver
          </Boton>
          <Boton variante="peligro" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Cancelando…' : 'Sí, cancelar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
