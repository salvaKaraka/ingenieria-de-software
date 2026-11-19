import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import {
  ETIQUETA_ESTADO_ENVIO,
  ETIQUETA_VEHICULO,
  type EstadoEnvio,
  type TamanioPaquete,
  type TipoVehiculo,
} from '../../../shared/tipos.ts'
import { Boton, Campo, EtiquetaEstado, Modal, Selector, type Coordenadas } from '../../../shared/ui/index.ts'
import { SelectorDireccion } from './SelectorDireccion'
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
  destinoLat: number | null
  destinoLon: number | null
  destinatarioNombre: string | null
  destinatarioApellido: string | null
  destinatarioDni: string | null
  destinatarioTelefono: string | null
  tamanio: TamanioPaquete
  vehiculoRequerido: TipoVehiculo
  requiereFoto: boolean
  requiereDni: boolean
  reintentoPendiente: boolean
  // Orden de devolución en la que viaja de vuelta al comercio (HU 38).
  ordenDevolucion: {
    id: number
    confirmadaEn: string | null
    paquetes: { envioId: number; codigoSeguimiento: string }[]
  } | null
  fotoUrl?: string | null
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

// Textos que el backend guarda pensando en otro lector (el repartidor o el destinatario).
// En el historial del operario se reemplazan por una descripción propia.
const DETALLE_REINTENTO = 'Tu envío fue reprogramado'
const AVISO_CANCELACION = 'El envío fue cancelado. No lo retires.'

function describirEntrada(entrada: EntradaHistorial): string {
  if (entrada.tipo === 'CREADO') return 'Envío registrado'
  if (entrada.tipo === 'OFERTA_ENVIADA') return `Oferta enviada a ${entrada.repartidorNombre}`
  if (entrada.tipo === 'OFERTA_RECHAZADA') return 'Oferta rechazada'
  if (entrada.tipo === 'OFERTA_VENCIDA') return `Oferta vencida por inactividad (${entrada.repartidorNombre})`
  // HU 24: el operario pidió reintentar la entrega (o el sistema la asignó cuando el repartidor quedó libre).
  if (entrada.tipo === 'REASIGNACION' && entrada.detalle === DETALLE_REINTENTO) {
    return entrada.estadoNuevo === 'RETIRADO'
      ? 'Reintento de entrega asignado al repartidor'
      : 'Reintento de entrega en espera'
  }
  // Modificaciones del operario (HU 31): el detalle dice qué pasó. Van antes que estadoNuevo
  // porque la reasignación por cambio de tamaño también lo trae (vuelve a PENDIENTE).
  if (entrada.tipo === 'REASIGNACION') return entrada.detalle ?? 'Envío reasignado'
  // HU 23: la novedad la reporta el repartidor desde el domicilio. Las otras NOVEDAD son avisos
  // que el operario le mandó al repartidor (HU 31).
  if (entrada.tipo === 'NOVEDAD') {
    return entrada.actorTipo === 'REPARTIDOR'
      ? `Novedad reportada: «${entrada.detalle ?? 'sin detalle'}»`
      : `Aviso al repartidor: «${entrada.detalle ?? 'Novedad registrada'}»`
  }
  if (entrada.tipo === 'NOTA') return entrada.detalle ?? 'Modificación de datos'
  if (entrada.estadoNuevo) return ETIQUETA_ESTADO_ENVIO[entrada.estadoNuevo]
  return entrada.detalle ?? entrada.tipo
}

// Segunda línea de la entrada: la evidencia de la entrega (E-4), el aviso que recibió el
// repartidor al cancelar, etc. No se repite si ya es el título.
function detalleEntrada(entrada: EntradaHistorial): string | null {
  if (!entrada.estadoNuevo || !entrada.detalle) return null
  if (entrada.tipo === 'REASIGNACION' || entrada.tipo === 'NOVEDAD') return null
  if (entrada.detalle === AVISO_CANCELACION) return `Se avisó al repartidor: «${AVISO_CANCELACION}»`
  if (entrada.detalle === ETIQUETA_ESTADO_ENVIO[entrada.estadoNuevo]) return null
  return entrada.detalle
}

// La foto se usa como src de un <img>: solo se muestra si es una imagen embebida (lo único que
// acepta el backend), nunca una URL externa que haga pedidos a otro sitio desde el panel.
const FOTO_DATA_URI = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/

function responsable(entrada: EntradaHistorial): string {
  return [ACTOR[entrada.actorTipo], entrada.actorNombre].filter(Boolean).join(' ')
}

// Antes de que el repartidor retire el paquete (HU 31).
const ESTADOS_MODIFICABLES: EstadoEnvio[] = ['PENDIENTE', 'ASIGNADO', 'EN_CAMINO_A_RETIRAR']
// Incluye RETIRADO y EN_DOMICILIO a propósito: el backend responde que ya fue retirado (HU 30).
const ESTADOS_CON_ACCION_CANCELAR: EstadoEnvio[] = [
  'PENDIENTE',
  'ASIGNADO',
  'EN_CAMINO_A_RETIRAR',
  'PARADO',
  'RETIRADO',
  'EN_DOMICILIO',
]

export function DetalleEnvioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [envio, setEnvio] = useState<DetalleEnvio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [errorCancelacion, setErrorCancelacion] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [confirmandoReintento, setConfirmandoReintento] = useState(false)
  const [confirmandoDevolucion, setConfirmandoDevolucion] = useState(false)
  const [procesandoNovedad, setProcesandoNovedad] = useState(false)
  const [errorNovedad, setErrorNovedad] = useState<string | null>(null)
  const [direccionReintento, setDireccionReintento] = useState('')
  const [ubicacionReintento, setUbicacionReintento] = useState<Coordenadas | null>(null)

  const [editando, setEditando] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)
  const [errorModificacion, setErrorModificacion] = useState<string | null>(null)
  const [formEdicion, setFormEdicion] = useState<{
    destinoDireccion: string
    destinoUbicacion: Coordenadas | null
    destinatarioNombre: string
    destinatarioApellido: string
    destinatarioDni: string
    destinatarioTelefono: string
    tamanio: TamanioPaquete
    observaciones: string
  }>({
    destinoDireccion: '',
    destinoUbicacion: null,
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

  const abrirReintento = () => {
    if (!envio) return
    setDireccionReintento(envio.destinoDireccion)
    setUbicacionReintento(
      envio.destinoLat !== null && envio.destinoLon !== null
        ? { lat: envio.destinoLat, lon: envio.destinoLon }
        : null,
    )
    setErrorNovedad(null)
    setConfirmandoReintento(true)
  }

  const reintentarEntrega = async (e: FormEvent) => {
    e.preventDefault()
    if (!envio) return
    setProcesandoNovedad(true)
    setErrorNovedad(null)
    try {
      await api(`/envios/${id}/reintentar`, {
        metodo: 'POST',
        datos: {
          destinoDireccion: direccionReintento.trim(),
          destinoLat: ubicacionReintento?.lat ?? null,
          destinoLon: ubicacionReintento?.lon ?? null,
        },
      })
      setConfirmandoReintento(false)
      await cargar()
    } catch (err) {
      setErrorNovedad(err instanceof ErrorApi ? err.message : 'No se pudo reintentar la entrega.')
    } finally {
      setProcesandoNovedad(false)
    }
  }

  const marcarDevolucion = async () => {
    if (!envio) return
    setProcesandoNovedad(true)
    setErrorNovedad(null)
    try {
      await api(`/envios/${id}/devolver`, { metodo: 'POST' })
      setConfirmandoDevolucion(false)
      await cargar()
    } catch (err) {
      setErrorNovedad(err instanceof ErrorApi ? err.message : 'No se pudo marcar la devolución.')
    } finally {
      setProcesandoNovedad(false)
    }
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
      destinoUbicacion:
        envio.destinoLat !== null && envio.destinoLon !== null ? { lat: envio.destinoLat, lon: envio.destinoLon } : null,
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
      destinoLat: formEdicion.destinoUbicacion?.lat ?? null,
      destinoLon: formEdicion.destinoUbicacion?.lon ?? null,
      destinatarioNombre: formEdicion.destinatarioNombre.trim(),
      destinatarioApellido: formEdicion.destinatarioApellido.trim(),
      destinatarioDni: formEdicion.destinatarioDni.replace(/\D/g, '') || null,
      destinatarioTelefono: formEdicion.destinatarioTelefono.trim(),
      tamanio: formEdicion.tamanio,
      observaciones: formEdicion.observaciones.trim() || null,
    }
    const actuales = {
      destinoDireccion: envio.destinoDireccion,
      destinoLat: envio.destinoLat,
      destinoLon: envio.destinoLon,
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
    // El punto viaja completo: el backend rechaza una latitud sin su longitud.
    if ('destinoLat' in cambios || 'destinoLon' in cambios) {
      cambios.destinoLat = nuevos.destinoLat
      cambios.destinoLon = nuevos.destinoLon
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
  const sePuedeCancelar = ESTADOS_CON_ACCION_CANCELAR.includes(envio.estado)
  const fotoEntrega = envio.fotoUrl && FOTO_DATA_URI.test(envio.fotoUrl) ? envio.fotoUrl : null

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
          {envio.estado === 'CON_NOVEDAD' && envio.reintentoPendiente && (
            <p className="w-full rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="status">
              Reintento en espera: se asignará al mismo repartidor cuando termine su viaje.
            </p>
          )}
          {envio.estado === 'CON_NOVEDAD' && !envio.reintentoPendiente && (
            <>
              <Boton variante="primario" onClick={abrirReintento}>
                Reintentar entrega
              </Boton>
              <Boton variante="peligro" onClick={() => setConfirmandoDevolucion(true)}>
                Devolver al comercio
              </Boton>
            </>
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
        {fotoEntrega && (
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Foto de evidencia de entrega</dt>
            <dd className="mt-2">
              <img
                src={fotoEntrega}
                alt="Foto de evidencia de entrega"
                className="max-h-72 rounded-lg border border-gray-300 object-contain shadow-sm"
              />
            </dd>
          </div>
        )}
      </dl>

      {envio.ordenDevolucion && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          {envio.ordenDevolucion.confirmadaEn ? 'Volvió' : 'Vuelve'} al comercio en la{' '}
          <Link to="/operario/deposito" className="font-semibold underline">
            orden de devolución #{envio.ordenDevolucion.id}
          </Link>
          {envio.ordenDevolucion.paquetes.length > 1 && (
            <>
              {' '}junto con{' '}
              {envio.ordenDevolucion.paquetes
                .filter((p) => p.envioId !== envio.id)
                .map((p, i) => (
                  <span key={p.envioId}>
                    {i > 0 && ', '}
                    <Link to={`/operario/envios/${p.envioId}`} className="font-mono font-semibold underline">
                      {p.codigoSeguimiento}
                    </Link>
                  </span>
                ))}
            </>
          )}
          .
        </p>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Historial</h2>
        {envio.historial.length === 0 ? (
          <p className="text-sm text-gray-500">No hay eventos registrados.</p>
        ) : (
          <ol className="space-y-4 border-l-2 border-gray-200 pl-4">
            {envio.historial.map((entrada) => (
              <li key={entrada.clave}>
                <p className="font-medium">{describirEntrada(entrada)}</p>
                {detalleEntrada(entrada) && <p className="text-sm text-gray-600">{detalleEntrada(entrada)}</p>}
                {/* La foto es del envío (se guarda una sola vez): se muestra en el paso de la entrega. */}
                {entrada.estadoNuevo === 'ENTREGADO' && fotoEntrega && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-500">Foto adjunta:</p>
                    <img
                      src={fotoEntrega}
                      alt="Foto de evidencia en entrega"
                      className="mt-1 max-h-48 rounded-lg border border-gray-300 object-contain shadow-sm"
                    />
                  </div>
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
      <Modal abierto={editando} onCerrar={() => setEditando(false)} titulo="Modificar datos del envío" ancho="max-w-xl">
        <form onSubmit={guardarEdicion} className="space-y-4">
          <SelectorDireccion
            etiqueta="Dirección de destino"
            direccion={formEdicion.destinoDireccion}
            alCambiarDireccion={(destinoDireccion) => setFormEdicion((prev) => ({ ...prev, destinoDireccion }))}
            ubicacion={formEdicion.destinoUbicacion}
            alCambiarUbicacion={(destinoUbicacion) => setFormEdicion((prev) => ({ ...prev, destinoUbicacion }))}
            buscarAlMontar={false}
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

      <Modal
        abierto={confirmandoReintento}
        onCerrar={() => setConfirmandoReintento(false)}
        titulo="Reintentar entrega"
        ancho="max-w-xl"
      >
        <form onSubmit={reintentarEntrega} className="space-y-4">
          <SelectorDireccion
            etiqueta="Dirección corregida"
            direccion={direccionReintento}
            alCambiarDireccion={setDireccionReintento}
            ubicacion={ubicacionReintento}
            alCambiarUbicacion={setUbicacionReintento}
            buscarAlMontar={false}
            required
          />
          {errorNovedad && (
            <p className="text-sm text-red-600" role="alert">{errorNovedad}</p>
          )}
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setConfirmandoReintento(false)}>
              Volver
            </Boton>
            <Boton variante="primario" disabled={procesandoNovedad}>
              {procesandoNovedad ? 'Reintentando...' : 'Reintentar entrega'}
            </Boton>
          </div>
        </form>
      </Modal>

      <Modal
        abierto={confirmandoDevolucion}
        onCerrar={() => setConfirmandoDevolucion(false)}
        titulo="¿Devolver al comercio?"
      >
        <p className="mb-4 text-sm text-gray-600">
          El envío quedará marcado para devolución y se agregará a los paquetes que el repartidor debe rendir.
        </p>
        {errorNovedad && (
          <p className="mb-4 text-sm text-red-600" role="alert">{errorNovedad}</p>
        )}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setConfirmandoDevolucion(false)}>
            Volver
          </Boton>
          <Boton variante="peligro" onClick={marcarDevolucion} disabled={procesandoNovedad}>
            {procesandoNovedad ? 'Marcando...' : 'Devolver al comercio'}
          </Boton>
        </div>
      </Modal>

      {/* Modal de cancelación */}
      <Modal
        abierto={confirmandoCancelacion}
        onCerrar={() => setConfirmandoCancelacion(false)}
        titulo="¿Cancelar este envío?"
      >
        <p className="mb-4 text-sm text-gray-600">
          Solo se puede cancelar antes del retiro. Si el paquete ya fue retirado, corresponde gestionarlo como devolución.
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
