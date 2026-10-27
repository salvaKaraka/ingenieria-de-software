import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import {
  ETIQUETA_ESTADO_ENVIO,
  ETIQUETA_VEHICULO,
  type EstadoEnvio,
  type TamanioPaquete,
  type TipoVehiculo,
} from '../../../shared/tipos.ts'
import { Boton, EtiquetaEstado, Modal } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'
import { describirEvidencia } from './evidencia.ts'

// Lo que devuelve GET /api/envios/:id (B-4). Solo los campos que usa esta pantalla.
// Entrada del historial (A-6): un cambio de estado o algo que pasó con una oferta.
interface EntradaHistorial {
  clave: string
  fecha: string
  tipo: string
  estadoNuevo: EstadoEnvio | null
  detalle: string | null
  actorTipo: 'OPERARIO' | 'REPARTIDOR' | 'SISTEMA'
  actorNombre: string | null
  repartidorNombre: string | null
}

interface DetalleEnvio {
  id: number
  codigoSeguimiento: string
  estado: EstadoEnvio
  origenDireccion: string
  destinoDireccion: string
  destinatarioNombre: string | null
  destinatarioApellido: string | null
  tamanio: TamanioPaquete
  vehiculoRequerido: TipoVehiculo
  requiereFoto: boolean
  requiereDni: boolean
  observaciones: string | null
  comercio: { nombre: string }
  repartidor: { nombre: string; apellido: string } | null
  historial: EntradaHistorial[]
}

const ACTOR: Record<EntradaHistorial['actorTipo'], string> = {
  OPERARIO: 'Operario',
  REPARTIDOR: 'Repartidor',
  SISTEMA: 'Sistema',
}

function describirEntrada(entrada: EntradaHistorial): string {
  if (entrada.tipo === 'CREADO') return 'Envío registrado'
  if (entrada.tipo === 'OFERTA_ENVIADA') return `Oferta enviada a ${entrada.repartidorNombre}`
  if (entrada.tipo === 'OFERTA_RECHAZADA') return 'Oferta rechazada'
  if (entrada.tipo === 'OFERTA_VENCIDA') return `Oferta vencida por inactividad (${entrada.repartidorNombre})`
  if (entrada.estadoNuevo) return ETIQUETA_ESTADO_ENVIO[entrada.estadoNuevo]
  return entrada.detalle ?? entrada.tipo
}

function responsable(entrada: EntradaHistorial): string {
  return [ACTOR[entrada.actorTipo], entrada.actorNombre].filter(Boolean).join(' ')
}

export function DetalleEnvioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [envio, setEnvio] = useState<DetalleEnvio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [errorCancelacion, setErrorCancelacion] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setEnvio(await api<DetalleEnvio>(`/envios/${id}`))
      setError(null)
    } catch (err) {
      setError(err instanceof ErrorApi && err.status === 404 ? 'El envío no existe.' : 'No se pudo cargar el envío.')
    }
  }, [id])

  // El estado lo cambian el repartidor y el motor: se refresca como el resto del panel.
  usePolling(cargar, 15_000)

  const cancelar = async () => {
    setCancelando(true)
    setErrorCancelacion(null)
    try {
      await api(`/envios/${id}/cancelar`, { metodo: 'POST' })
      setConfirmandoCancelacion(false)
      await cargar()
    } catch (err) {
      setErrorCancelacion(err instanceof ErrorApi ? err.message : 'No se pudo cancelar el envío.')
    } finally {
      setCancelando(false)
    }
  }

  const copiarLink = async () => {
    if (!envio) return
    await navigator.clipboard.writeText(`${window.location.origin}/seguimiento/${envio.codigoSeguimiento}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (!envio) {
    return <p className="text-gray-500">{error ?? 'Cargando detalle...'}</p>
  }

  const destinatario = [envio.destinatarioNombre, envio.destinatarioApellido].filter(Boolean).join(' ')
  const sePuedeCancelar = envio.estado !== 'ENTREGADO' && envio.estado !== 'CANCELADO'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Boton variante="secundario" onClick={() => navigate('/operario/envios')}>
        ← Volver
      </Boton>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">{envio.codigoSeguimiento}</h1>
          <EtiquetaEstado estado={envio.estado} />
        </div>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={copiarLink}>
            {copiado ? '¡Link copiado!' : 'Copiar link de seguimiento'}
          </Boton>
          {sePuedeCancelar && (
            <Boton variante="peligro" onClick={() => setConfirmandoCancelacion(true)}>
              Cancelar envío
            </Boton>
          )}
        </div>
      </div>

      {error && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{error} Se muestra el último dato.</p>}

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Comercio</dt>
          <dd className="font-medium">{envio.comercio.nombre}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Repartidor</dt>
          <dd className="font-medium">
            {envio.repartidor ? `${envio.repartidor.nombre} ${envio.repartidor.apellido}` : 'Sin asignar'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Origen</dt>
          <dd className="font-medium">{envio.origenDireccion}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Destino</dt>
          <dd className="font-medium">{envio.destinoDireccion}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Destinatario</dt>
          <dd className="font-medium">{destinatario || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Tamaño</dt>
          <dd className="font-medium">{envio.tamanio}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Vehículo requerido</dt>
          <dd className="font-medium">{ETIQUETA_VEHICULO[envio.vehiculoRequerido]}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Evidencia al entregar</dt>
          <dd className="font-medium">{describirEvidencia(envio)}</dd>
        </div>
        {envio.observaciones && (
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Observaciones</dt>
            <dd className="font-medium">{envio.observaciones}</dd>
          </div>
        )}
      </dl>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Historial</h2>
        {envio.historial.length === 0 ? (
          <p className="text-sm text-gray-500">No hay eventos registrados.</p>
        ) : (
          <ol className="space-y-4 border-l-2 border-gray-200 pl-4">
            {envio.historial.map((entrada) => (
              <li key={entrada.clave}>
                <p className="font-medium">{describirEntrada(entrada)}</p>
                {/* Por ejemplo, la evidencia que se pidió al entregar (E-4). */}
                {entrada.estadoNuevo && entrada.detalle && (
                  <p className="text-sm text-gray-600">{entrada.detalle}</p>
                )}
                <p className="text-xs text-gray-500">
                  {new Date(entrada.fecha).toLocaleString('es-AR')} · {responsable(entrada)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Modal
        abierto={confirmandoCancelacion}
        onCerrar={() => setConfirmandoCancelacion(false)}
        titulo="¿Cancelar este envío?"
      >
        <p className="mb-4 text-sm text-gray-600">
          No se puede deshacer. Si ya tenía repartidor, queda libre para otro viaje.
        </p>
        {errorCancelacion && <p className="mb-4 text-sm text-red-600">{errorCancelacion}</p>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setConfirmandoCancelacion(false)}>
            Volver
          </Boton>
          <Boton variante="peligro" onClick={cancelar} disabled={cancelando}>
            {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
          </Boton>
        </div>
      </Modal>
    </div>
  )
}
