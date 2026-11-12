import { useCallback, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
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
  // Novedad del operario sobre este viaje (HU 31), p. ej. que cambió la dirección de entrega.
  aviso: string | null
}

const CONSULTA_CADA_MS = 10_000

// Foto de la entrega (HU 18): la cámara del celular da archivos de varios MB y la foto viaja
// dentro del JSON, así que se achica acá antes de mandarla (queda en el orden de 100–300 kb).
const LADO_MAXIMO_FOTO_PX = 1280
const CALIDADES_JPEG = [0.7, 0.5, 0.3]
// El mismo tope que valida el backend (LARGO_MAXIMO_FOTO en avanzar-viaje.dto.ts).
const LARGO_MAXIMO_FOTO = 900_000
const ERROR_FOTO = 'No se pudo usar esa foto. Sacala de nuevo.'

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const imagen = new Image()
    imagen.onload = () => {
      URL.revokeObjectURL(url)
      resolve(imagen)
    }
    // Pasa cuando el archivo no es una imagen o el navegador no la sabe leer.
    imagen.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(ERROR_FOTO))
    }
    imagen.src = url
  })
}

// Devuelve la foto como data URI JPEG, con el lado mayor de hasta LADO_MAXIMO_FOTO_PX.
async function comprimirFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error(ERROR_FOTO)
  const imagen = await cargarImagen(archivo)
  const escala = Math.min(1, LADO_MAXIMO_FOTO_PX / Math.max(imagen.naturalWidth, imagen.naturalHeight))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala))
  lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala))
  const contexto = lienzo.getContext('2d')
  if (!contexto) throw new Error(ERROR_FOTO)
  // JPEG no tiene transparencia: sin fondo, un PNG transparente quedaría negro.
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, lienzo.width, lienzo.height)
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)

  for (const calidad of CALIDADES_JPEG) {
    const foto = lienzo.toDataURL('image/jpeg', calidad)
    if (foto.startsWith('data:image/jpeg;base64,') && foto.length <= LARGO_MAXIMO_FOTO) return foto
  }
  throw new Error(ERROR_FOTO)
}

// Texto del botón según el estado ACTUAL: describe lo que el repartidor acaba de hacer
// (o va a hacer), que es justo lo que pasa el envío al estado siguiente.
const PASO: Record<EstadoViaje, { numero: number; accion: string }> = {
  ASIGNADO: { numero: 1, accion: 'Voy al comercio' },
  EN_CAMINO_A_RETIRAR: { numero: 2, accion: 'Paquete retirado' },
  RETIRADO: { numero: 3, accion: 'Llegué al domicilio' },
  EN_DOMICILIO: { numero: 4, accion: 'Entregado' },
}

function Dato({ titulo, grande = false, children }: { titulo: string; grande?: boolean; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm uppercase text-slate-400">{titulo}</dt>
      <dd className={grande ? 'text-2xl font-bold' : 'text-lg font-semibold'}>{children}</dd>
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

function describirEvidencia(viaje: Viaje): string {
  const pedidos = [
    viaje.requiereDni && 'pedir el DNI de quien recibe',
    viaje.requiereFoto && 'sacar una foto de la entrega',
  ].filter(Boolean)
  return pedidos.length > 0 ? `Al entregar: ${pedidos.join(' y ')}.` : 'El comercio no exige evidencia.'
}

// E-4 / HU 18: lo que el comercio exige para entregar. El DNI lo compara el backend contra el del
// destinatario (al celular nunca llega ese dato); la foto se saca acá, en el domicilio, y se
// manda junto con la confirmación de la entrega.
function EvidenciaEntrega({
  viaje,
  dni,
  alCambiarDni,
  foto,
  alCambiarFoto,
}: {
  viaje: Viaje
  dni: string
  alCambiarDni: (dni: string) => void
  foto: string
  alCambiarFoto: (foto: string) => void
}) {
  const [errorFoto, setErrorFoto] = useState<string | null>(null)

  if (!viaje.requiereDni && !viaje.requiereFoto) {
    return <p className="text-center text-lg text-slate-300">El comercio no exige evidencia.</p>
  }

  async function manejarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const campo = evento.target
    const archivo = campo.files?.[0]
    // Se vacía el campo para que elegir otra vez el mismo archivo vuelva a disparar el cambio.
    campo.value = ''
    if (!archivo) return
    setErrorFoto(null)
    try {
      alCambiarFoto(await comprimirFoto(archivo))
    } catch {
      setErrorFoto(ERROR_FOTO)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-yellow-400/40 bg-yellow-950/30 p-4">
      {viaje.requiereDni && (
        <label className="block space-y-2">
          <span className="block text-lg font-semibold text-yellow-200">DNI de quien recibe</span>
          <input
            value={dni}
            // Solo dígitos: si tipea los puntos, se descartan (así se compara igual que en el alta).
            onChange={(evento) => alCambiarDni(evento.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            placeholder="Sin puntos"
            className="min-h-14 w-full rounded-xl bg-white px-4 text-2xl font-bold tracking-wider text-black"
          />
        </label>
      )}
      {viaje.requiereFoto && (
        <div className="space-y-3">
          <p className="text-lg font-semibold text-yellow-200">
            📷 Foto del paquete entregado (obligatoria)
          </p>
          {foto ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border-2 border-yellow-400 bg-black">
                <img
                  src={foto}
                  alt="Vista previa de la entrega"
                  className="max-h-64 w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-slate-800 px-4 text-lg font-semibold text-white hover:bg-slate-700 active:scale-95">
                  Cambiar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(evento) => void manejarArchivo(evento)}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => alCambiarFoto('')}
                  className="min-h-12 rounded-xl bg-red-900/60 px-4 text-lg font-semibold text-red-200 hover:bg-red-800 active:scale-95"
                >
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-yellow-400/60 bg-slate-800 px-4 text-lg font-bold text-yellow-200 hover:bg-slate-700 active:scale-95">
              <span>📷 Tomar o subir foto</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(evento) => void manejarArchivo(evento)}
                className="sr-only"
              />
            </label>
          )}
          {errorFoto && (
            <p className="text-lg font-semibold text-red-300" role="alert">
              {errorFoto}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// E-3: viaje activo, en la pantalla principal del repartidor. Arriba va lo de la etapa actual
// (adónde ir ahora) y un único botón con la próxima acción, con confirmación: 2 toques (RNF-10).
// El resto de los datos del viaje queda en un desplegable para no saturar la pantalla.
export function ViajeActual({ alEntregar }: { alEntregar: () => void }) {
  // undefined = todavía cargando; null = no hay viaje activo.
  const [viaje, setViaje] = useState<Viaje | null | undefined>(undefined)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [dni, setDni] = useState('')
  const [foto, setFoto] = useState('')
  const envioDeLaEvidencia = useRef<number | null>(null)

  const consultar = useCallback(async () => {
    const respuesta = await api<{ viaje: Viaje | null }>('/repartidor/viajes/actual')
    // La evidencia cargada es de un envío en particular: si el viaje cambió (por ejemplo, lo
    // cancelaron y llegó otro), no puede quedar la foto o el DNI del anterior.
    const envioId = respuesta.viaje?.envioId ?? null
    if (envioId !== envioDeLaEvidencia.current) {
      envioDeLaEvidencia.current = envioId
      setDni('')
      setFoto('')
    }
    setViaje(respuesta.viaje)
  }, [])

  // El operario puede cancelar el envío mientras tanto: se refresca como el resto de la app.
  usePolling(consultar, CONSULTA_CADA_MS)

  async function avanzar() {
    setEnviando(true)
    setAviso(null)
    // La evidencia es solo del paso que entrega: el backend rechaza una foto en los anteriores.
    const entregando = viaje?.estado === 'EN_DOMICILIO'

    try {
      const respuesta = await api<{ estado: EstadoEnvio }>('/repartidor/viajes/actual/avanzar', {
        metodo: 'POST',
        datos: entregando ? { dni: dni || undefined, foto: foto || undefined } : {},
      })
      setConfirmando(false)
      if (respuesta.estado === 'ENTREGADO') {
        setDni('')
        setFoto('')
        alEntregar()
        return
      }
      await consultar()
    } catch (error) {
      setConfirmando(false)
      // El 409 explica qué pasó (por ejemplo, que el operario canceló el envío) y el 400, qué
      // falta o está mal en la evidencia (por ejemplo, que el DNI no coincide o falta foto).
      setAviso(
        error instanceof ErrorApi && (error.status === 409 || error.status === 400)
          ? error.message
          : 'No se pudo. Probá de nuevo.',
      )
      void consultar().catch(() => undefined)
    } finally {
      setEnviando(false)
    }
  }

  if (viaje === undefined) return null

  if (viaje === null) {
    return (
      <section className="space-y-3 rounded-2xl bg-slate-900 p-5">
        {aviso && <p className="rounded-xl bg-slate-800 p-4">{aviso}</p>}
        <p className="text-center text-lg text-slate-300">No tenés viajes asignados en este momento.</p>
      </section>
    )
  }

  const { numero, accion } = PASO[viaje.estado]
  const enRetiro = viaje.estado === 'ASIGNADO' || viaje.estado === 'EN_CAMINO_A_RETIRAR'
  const destinatario = [viaje.destinatario.nombre, viaje.destinatario.apellido].filter(Boolean).join(' ') || '—'
  const entregando = viaje.estado === 'EN_DOMICILIO'
  const faltaEvidencia = entregando && ((viaje.requiereDni && dni.length < 7) || (viaje.requiereFoto && !foto))

  return (
    <section className="space-y-5 rounded-2xl border-4 border-yellow-400 bg-slate-900 p-5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">{enRetiro ? 'Retirá el paquete' : 'Entregá el paquete'}</h2>
        <p className="shrink-0 text-base text-slate-400">Paso {numero} de 4</p>
      </div>

      {viaje.aviso && (
        <p className="rounded-xl bg-yellow-400 p-4 text-lg font-bold text-slate-900" role="alert">
          ⚠️ {viaje.aviso}
        </p>
      )}

      <dl className="space-y-3">
        {enRetiro ? (
          <>
            <Dato titulo="Retirar en" grande>
              {viaje.origenDireccion}
            </Dato>
            <Dato titulo="Comercio">{viaje.comercio.nombre}</Dato>
            <Dato titulo="Después, entregar en">{viaje.destinoDireccion}</Dato>
          </>
        ) : (
          <>
            <Dato titulo="Entregar en" grande>
              {viaje.destinoDireccion}
            </Dato>
            <Dato titulo="Destinatario">{destinatario}</Dato>
          </>
        )}
        {viaje.observaciones && <Dato titulo="Observaciones">{viaje.observaciones}</Dato>}
      </dl>

      {entregando ? (
        <EvidenciaEntrega
          viaje={viaje}
          dni={dni}
          alCambiarDni={setDni}
          foto={foto}
          alCambiarFoto={setFoto}
        />
      ) : (
        <p className="rounded-xl border border-yellow-400/40 bg-yellow-950/30 p-4 font-semibold text-yellow-200">
          {describirEvidencia(viaje)}
        </p>
      )}

      {/* Todo el viaje de una, por si necesita llamar o mirar la otra punta del recorrido. */}
      <details className="rounded-xl bg-slate-800 p-4">
        <summary className="min-h-12 cursor-pointer content-center text-lg font-semibold">
          Ver todos los datos del viaje
        </summary>
        <dl className="mt-3 space-y-3">
          <Dato titulo="Retiro">
            {viaje.comercio.nombre} · {viaje.origenDireccion}
          </Dato>
          <Dato titulo="Teléfono del comercio">
            <Telefono numero={viaje.comercio.telefono} />
          </Dato>
          <Dato titulo="Entrega">{viaje.destinoDireccion}</Dato>
          <Dato titulo="Destinatario">{destinatario}</Dato>
          {viaje.destinatario.telefono && (
            <Dato titulo="Teléfono del destinatario">
              <Telefono numero={viaje.destinatario.telefono} />
            </Dato>
          )}
          <Dato titulo="Observaciones">{viaje.observaciones ?? 'Sin observaciones'}</Dato>
          <Dato titulo="Evidencia">{describirEvidencia(viaje)}</Dato>
          <Dato titulo="Código de seguimiento">
            <span className="font-mono">{viaje.codigoSeguimiento}</span>
          </Dato>
        </dl>
      </details>

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
        <>
          {faltaEvidencia && (
            <p className="text-center text-lg text-slate-300">
              {viaje.requiereFoto && !foto
                ? 'Este comercio exige una foto de la entrega'
                : 'Completá lo de arriba para confirmar la entrega.'}
            </p>
          )}
          <BotonGrande onClick={() => setConfirmando(true)} disabled={enviando || faltaEvidencia}>
            {accion}
          </BotonGrande>
        </>
      )}
    </section>
  )
}
