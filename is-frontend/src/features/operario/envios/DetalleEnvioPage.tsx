import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import {
  ETIQUETA_ESTADO_ENVIO,
  ETIQUETA_VEHICULO,
  type EstadoEnvio,
  type TamanioPaquete,
  type TipoVehiculo,
} from '../../../shared/tipos.ts'
import { Boton, Campo, EtiquetaEstado, Modal, Selector } from '../../../shared/ui/index.ts'
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
  destinatarioDni: string | null
  destinatarioTelefono: string | null
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
  // Modificaciones del operario (HU 31): el detalle dice qué pasó. Van antes que estadoNuevo
  // porque la reasignación por cambio de tamaño también lo trae (vuelve a PENDIENTE).
  if (entrada.tipo === 'REASIGNACION') return entrada.detalle ?? 'Envío reasignado'
  if (entrada.tipo === 'NOVEDAD') return entrada.detalle ?? 'Novedad registrada'
  if (entrada.tipo === 'NOTA') return entrada.detalle ?? 'Modificación de datos'
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

  const [editando, setEditando] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)
  const [formEdicion, setFormEdicion] = useState<{
    destinoDireccion: string
    destinatarioNombre: string
    destinatarioApellido: string
    destinatarioDni: string
    destinatarioTelefono: string
    tamanio: TamanioPaquete
    observaciones: string
  }>({
    destinoDireccion: '',
    destinatarioNombre: '',
    destinatarioApellido: '',
    destinatarioDni: '',
    destinatarioTelefono: '',
    tamanio: 'CHICO',
    observaciones: '',
  })

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

  const abrirModalEdicion = () => {
    if (!envio) return
    setFormEdicion({
      destinoDireccion: envio.destinoDireccion,
      destinatarioNombre: envio.destinatarioNombre ?? '',
      destinatarioApellido: envio.destinatarioApellido ?? '',
      destinatarioDni: envio.destinatarioDni ?? '',
      destinatarioTelefono: envio.destinatarioTelefono ?? '',
      tamanio: envio.tamanio,
      observaciones: envio.observaciones ?? '',
    })
    setErrorEdicion(null)
    setEditando(true)
  }

  const guardarEdicion = async (e: FormEvent) => {
    e.preventDefault()
    setGuardandoEdicion(true)
    setErrorEdicion(null)
    try {
      await api(`/envios/${id}`, {
        metodo: 'PATCH',
        datos: {
          destinoDireccion: formEdicion.destinoDireccion.trim(),
          destinatarioNombre: formEdicion.destinatarioNombre.trim() || undefined,
          destinatarioApellido: formEdicion.destinatarioApellido.trim() || undefined,
          destinatarioDni: formEdicion.destinatarioDni.replace(/\D/g, '') || undefined,
          destinatarioTelefono: formEdicion.destinatarioTelefono.trim() || undefined,
          tamanio: formEdicion.tamanio,
          observaciones: formEdicion.observaciones.trim() || undefined,
        },
      })
      setEditando(false)
      await cargar()
    } catch (err) {
      setErrorEdicion(err instanceof ErrorApi ? err.message : 'No se pudo modificar el envío.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  if (!envio) {
    return <p className="text-gray-500">{error ?? 'Cargando detalle...'}</p>
  }

  const destinatario = [envio.destinatarioNombre, envio.destinatarioApellido].filter(Boolean).join(' ')
  const sePuedeCancelar = envio.estado !== 'ENTREGADO' && envio.estado !== 'CANCELADO'
  const sePuedeModificar =
    envio.estado === 'PENDIENTE' || envio.estado === 'ASIGNADO' || envio.estado === 'EN_CAMINO_A_RETIRAR'

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
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={copiarLink}>
            {copiado ? '¡Link copiado!' : 'Copiar link de seguimiento'}
          </Boton>
          {sePuedeModificar && (
            <Boton variante="secundario" onClick={abrirModalEdicion}>
              Modificar datos
            </Boton>
          )}
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

      {/* Modal de edición */}
      <Modal abierto={editando} onCerrar={() => setEditando(false)} titulo="Modificar datos del envío">
        <form onSubmit={guardarEdicion} className="space-y-4">
          <Campo
            etiqueta="Dirección de destino"
            value={formEdicion.destinoDireccion}
            onChange={(e) => setFormEdicion((prev) => ({ ...prev, destinoDireccion: e.target.value }))}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre destinatario"
              value={formEdicion.destinatarioNombre}
              onChange={(e) => setFormEdicion((prev) => ({ ...prev, destinatarioNombre: e.target.value }))}
            />
            <Campo
              etiqueta="Apellido destinatario"
              value={formEdicion.destinatarioApellido}
              onChange={(e) => setFormEdicion((prev) => ({ ...prev, destinatarioApellido: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="DNI destinatario"
              value={formEdicion.destinatarioDni}
              onChange={(e) => setFormEdicion((prev) => ({ ...prev, destinatarioDni: e.target.value }))}
            />
            <Campo
              etiqueta="Teléfono destinatario"
              value={formEdicion.destinatarioTelefono}
              onChange={(e) => setFormEdicion((prev) => ({ ...prev, destinatarioTelefono: e.target.value }))}
            />
          </div>
          <Selector
            etiqueta="Tamaño del paquete"
            value={formEdicion.tamanio}
            onChange={(e) => setFormEdicion((prev) => ({ ...prev, tamanio: e.target.value as TamanioPaquete }))}
            opciones={[
              { valor: 'CHICO', etiqueta: 'Chico (Moto)' },
              { valor: 'MEDIANO', etiqueta: 'Mediano (Auto)' },
              { valor: 'GRANDE', etiqueta: 'Grande (Camión)' },
            ]}
          />
          <Campo
            etiqueta="Observaciones"
            value={formEdicion.observaciones}
            onChange={(e) => setFormEdicion((prev) => ({ ...prev, observaciones: e.target.value }))}
          />
          {errorEdicion && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{errorEdicion}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" disabled={guardandoEdicion}>
              {guardandoEdicion ? 'Guardando...' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </Modal>

      {/* Modal de cancelación */}
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
