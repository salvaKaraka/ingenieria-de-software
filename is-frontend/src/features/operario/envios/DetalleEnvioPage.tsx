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
import { AVISO_EXCEPCION, esAsignacionPorExcepcion } from './excepcion.ts'

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
  // La novedad es lo que le llega al repartidor en la app: se aclara para no leerla como un
  // segundo cambio de datos, que ya figura en su propia entrada.
  if (entrada.tipo === 'NOVEDAD') return `Aviso al repartidor: «${entrada.detalle ?? 'Novedad registrada'}»`
  if (entrada.tipo === 'NOTA') return entrada.detalle ?? 'Modificación de datos'
  if (entrada.estadoNuevo) return ETIQUETA_ESTADO_ENVIO[entrada.estadoNuevo]
  return entrada.detalle ?? entrada.tipo
}

function responsable(entrada: EntradaHistorial): string {
  return [ACTOR[entrada.actorTipo], entrada.actorNombre].filter(Boolean).join(' ')
}

// Antes de que el repartidor retire el paquete (HU 31).
const ESTADOS_MODIFICABLES: EstadoEnvio[] = ['PENDIENTE', 'ASIGNADO', 'EN_CAMINO_A_RETIRAR']

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
  const [errorModificacion, setErrorModificacion] = useState<string | null>(null)
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
    // Con el paquete ya retirado el botón sigue visible, pero explica por qué no se puede
    // (HU 31, escenario 4) en lugar de esconderse sin más.
    if (!ESTADOS_MODIFICABLES.includes(envio.estado)) {
      setErrorModificacion('No se puede modificar: el paquete ya fue retirado')
      return
    }
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
    if (!envio) return
    // DNI y observaciones vacíos se borran (null). Los demás son obligatorios: si quedan
    // vacíos se mandan igual y el backend explica qué falta.
    const nuevos = {
      destinoDireccion: formEdicion.destinoDireccion.trim(),
      destinatarioNombre: formEdicion.destinatarioNombre.trim(),
      destinatarioApellido: formEdicion.destinatarioApellido.trim(),
      destinatarioDni: formEdicion.destinatarioDni.replace(/\D/g, '') || null,
      destinatarioTelefono: formEdicion.destinatarioTelefono.trim(),
      tamanio: formEdicion.tamanio,
      observaciones: formEdicion.observaciones.trim() || null,
    }
    const actuales = {
      destinoDireccion: envio.destinoDireccion,
      destinatarioNombre: envio.destinatarioNombre ?? '',
      destinatarioApellido: envio.destinatarioApellido ?? '',
      destinatarioDni: envio.destinatarioDni,
      destinatarioTelefono: envio.destinatarioTelefono ?? '',
      tamanio: envio.tamanio,
      observaciones: envio.observaciones,
    }
    // Solo lo que cambió: un envío viejo con un dato vacío se puede editar sin completarlo.
    const cambios = Object.fromEntries(
      Object.entries(nuevos).filter(([campo, valor]) => valor !== actuales[campo as keyof typeof actuales]),
    )
    if (Object.keys(cambios).length === 0) {
      setEditando(false)
      return
    }

    setGuardandoEdicion(true)
    setErrorEdicion(null)
    try {
      await api(`/envios/${id}`, { metodo: 'PATCH', datos: cambios })
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
          {sePuedeCancelar && (
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

      {errorModificacion && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600" role="alert">
          {errorModificacion}
        </p>
      )}

      {error && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{error} Se muestra el último dato.</p>}

      {esAsignacionPorExcepcion(envio.estado, envio.historial) && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-bold">{AVISO_EXCEPCION}</p>
            <p className="text-xs text-amber-700">
              El repartidor asignado alcanzó el límite de 2 viajes consecutivos, pero se le ofreció el viaje por ser el único disponible para este vehículo.
            </p>
          </div>
        </div>
      )}

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
              etiqueta={envio.requiereDni ? 'DNI destinatario * (el comercio lo exige)' : 'DNI destinatario (opcional)'}
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
            etiqueta="Observaciones (opcional)"
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
