import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, ErrorApi } from '../../../shared/api.ts'
import { BotonGrande } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'

type TipoVehiculo = 'MOTO' | 'AUTO' | 'CAMION'

type PerfilRepartidor = {
  id: number
  nombre: string
  apellido: string
  dni: string | null
  telefono: string
  email: string
  direccion: string
  vehiculo: TipoVehiculo
  estado: string
}

type ViajeActualRespuesta = {
  viaje: {
    estado: string
  } | null
}

const NOMBRES_VEHICULO: Record<TipoVehiculo, string> = {
  MOTO: 'Moto',
  AUTO: 'Auto',
  CAMION: 'Camión',
}

const ESTADOS_BLOQUEANTES = ['EN_CAMINO_A_RETIRAR', 'RETIRADO', 'EN_DOMICILIO']
const CONSULTA_CADA_MS = 10_000

export function PerfilRepartidorPage() {
  const [perfil, setPerfil] = useState<PerfilRepartidor | null>(null)
  const [inicializado, setInicializado] = useState(false)
  const [viajeBloqueante, setViajeBloqueante] = useState(false)

  // Campos de contacto
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [guardandoContacto, setGuardandoContacto] = useState(false)
  const [mensajeContacto, setMensajeContacto] = useState<string | null>(null)
  const [errorContacto, setErrorContacto] = useState<string | null>(null)

  // Advertencia de vehículo no editable (Escenario 3)
  const [avisoVehiculo, setAvisoVehiculo] = useState<string | null>(null)

  // Campos de PIN
  const [pinActual, setPinActual] = useState('')
  const [guardandoPin, setGuardandoPin] = useState(false)
  const [errorPin, setErrorPin] = useState<string | null>(null)
  // El PIN nuevo solo vive en memoria mientras se muestra: al confirmar se descarta y no hay forma de volver a verlo.
  const [pinGenerado, setPinGenerado] = useState<string | null>(null)

  const consultar = useCallback(async () => {
    try {
      const datosPerfil = await api<PerfilRepartidor>('/repartidor/perfil')
      setPerfil(datosPerfil)
      if (!inicializado) {
        setTelefono(datosPerfil.telefono)
        setEmail(datosPerfil.email)
        setInicializado(true)
      }

      // Verificamos si tiene un viaje en curso
      try {
        const respuestaViaje = await api<ViajeActualRespuesta>('/repartidor/viajes/actual')
        if (respuestaViaje.viaje && ESTADOS_BLOQUEANTES.includes(respuestaViaje.viaje.estado)) {
          setViajeBloqueante(true)
        } else {
          setViajeBloqueante(false)
        }
      } catch {
        // Si no responde el viaje actual, no bloqueamos la interfaz preventiva
      }
    } catch (e) {
      if (!inicializado) {
        setErrorContacto(e instanceof ErrorApi ? e.message : 'Error al cargar el perfil')
      }
    }
  }, [inicializado])

  usePolling(consultar, CONSULTA_CADA_MS)

  function desplegarAvisoVehiculo() {
    setAvisoVehiculo('El cambio de movilidad debe ser solicitado y autorizado por el operario central')
  }

  async function guardarContacto(e: FormEvent) {
    e.preventDefault()
    setMensajeContacto(null)
    setErrorContacto(null)
    setGuardandoContacto(true)

    try {
      const actualizado = await api<PerfilRepartidor>('/repartidor/perfil', {
        metodo: 'PATCH',
        datos: { telefono: telefono.trim(), email: email.trim() },
      })
      setPerfil(actualizado)
      setTelefono(actualizado.telefono)
      setEmail(actualizado.email)
      setMensajeContacto('Perfil actualizado correctamente')
    } catch (error) {
      if (error instanceof ErrorApi) {
        setErrorContacto(error.message)
      } else {
        setErrorContacto('Error al actualizar el perfil')
      }
    } finally {
      setGuardandoContacto(false)
    }
  }

  async function generarPinNuevo(e: FormEvent) {
    e.preventDefault()
    setErrorPin(null)

    if (!/^\d{4}$/.test(pinActual)) {
      setErrorPin('Ingresá tu PIN actual de 4 dígitos')
      return
    }

    setGuardandoPin(true)
    try {
      // El repartidor no elige el PIN: el sistema genera uno y lo devuelve esta única vez.
      const respuesta = await api<{ pin: string }>('/repartidor/perfil/cambiar-pin', {
        metodo: 'POST',
        datos: { pinActual },
      })
      setPinGenerado(respuesta.pin)
      setPinActual('')
    } catch (error) {
      if (error instanceof ErrorApi && error.status === 429) {
        setErrorPin('Demasiados intentos. Esperá un minuto y volvé a probar.')
      } else if (error instanceof ErrorApi) {
        setErrorPin(error.message)
      } else {
        setErrorPin('No se pudo generar el PIN nuevo. Revisá tu conexión y volvé a probar.')
      }
    } finally {
      setGuardandoPin(false)
    }
  }

  if (!perfil) {
    return <p className="text-center text-slate-400">Cargando perfil…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-slate-400">Tu cuenta</p>
          <h1 className="text-3xl font-bold">Mi perfil</h1>
        </div>
        <Link to="/repartidor" className="text-base text-yellow-400 underline">
          ← Volver
        </Link>
      </div>

      {viajeBloqueante && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 text-base font-medium text-amber-200"
        >
          Tenés un viaje en tránsito. No podés modificar tus datos ni tu PIN hasta entregarlo.
        </div>
      )}

      {/* Formulario de Datos Personales y Vehículo */}
      <section className="space-y-5 rounded-2xl bg-slate-900 p-5">
        <div>
          <h2 className="text-2xl font-bold">Datos de contacto</h2>
          <p className="mt-1 text-sm text-slate-400">
            {perfil.nombre} {perfil.apellido} • DNI {perfil.dni ?? '•••••'}
          </p>
        </div>

        {mensajeContacto && (
          <p role="status" className="rounded-xl bg-green-800 p-4 text-center font-semibold text-white">
            {mensajeContacto}
          </p>
        )}

        {errorContacto && (
          <p role="alert" className="rounded-xl border border-red-500/50 bg-red-950/40 p-4 text-center font-semibold text-red-200">
            {errorContacto}
          </p>
        )}

        <form onSubmit={(e) => void guardarContacto(e)} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="telefono" className="text-sm font-medium text-slate-300">
              Teléfono de contacto
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={guardandoContacto || viajeBloqueante}
              className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-lg text-white focus:border-yellow-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-300">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={guardandoContacto || viajeBloqueante}
              className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-lg text-white focus:border-yellow-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Campo de Vehículo: Solo lectura y advertencia (Escenario 3) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="vehiculo" className="text-sm font-medium text-slate-300">
              Tipo de vehículo
            </label>
            <div
              className="relative cursor-not-allowed"
              onClick={desplegarAvisoVehiculo}
              title="El cambio de movilidad debe ser solicitado y autorizado por el operario central"
            >
              <input
                id="vehiculo"
                name="vehiculo"
                type="text"
                readOnly
                disabled
                value={NOMBRES_VEHICULO[perfil.vehiculo] ?? perfil.vehiculo}
                onClick={desplegarAvisoVehiculo}
                onFocus={desplegarAvisoVehiculo}
                onKeyDown={desplegarAvisoVehiculo}
                className="min-h-12 w-full cursor-not-allowed rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-lg text-slate-400 focus:outline-none"
              />
            </div>
            {avisoVehiculo && (
              <p
                role="alert"
                className="mt-1 rounded-xl border border-amber-500/30 bg-amber-950/40 p-3 text-sm font-medium text-amber-300"
              >
                {avisoVehiculo}
              </p>
            )}
          </div>

          <BotonGrande
            type="submit"
            variante="primario"
            disabled={guardandoContacto || viajeBloqueante}
          >
            {guardandoContacto ? 'Guardando…' : 'Guardar cambios'}
          </BotonGrande>
        </form>
      </section>

      {/* Cambio de PIN: el repartidor confirma el actual y el sistema le genera uno nuevo */}
      <section className="space-y-5 rounded-2xl bg-slate-900 p-5">
        <h2 className="text-2xl font-bold">Cambiar PIN</h2>

        {pinGenerado ? (
          <div className="space-y-5">
            <p role="status" className="text-lg font-semibold text-white">
              Tu PIN nuevo es:
            </p>
            <p className="rounded-2xl border-2 border-yellow-400 bg-slate-950 py-6 text-center font-mono text-6xl font-bold tracking-[0.3em] text-yellow-400">
              {pinGenerado}
            </p>
            <p
              role="alert"
              className="rounded-xl border border-amber-500/30 bg-amber-950/40 p-4 text-lg font-medium text-amber-200"
            >
              Anotalo ahora: no se va a volver a mostrar. Tu PIN anterior ya no sirve para ingresar.
            </p>
            <BotonGrande variante="primario" onClick={() => setPinGenerado(null)}>
              Ya lo anoté
            </BotonGrande>
          </div>
        ) : (
          <>
            <p className="text-lg text-slate-300">
              Ingresá tu PIN actual y el sistema te va a dar un PIN nuevo de 4 dígitos.
            </p>

            {errorPin && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/50 bg-red-950/40 p-4 text-center text-lg font-semibold text-red-200"
              >
                {errorPin}
              </p>
            )}

            <form onSubmit={(e) => void generarPinNuevo(e)} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pinActual" className="text-lg font-medium text-slate-300">
                  PIN actual
                </label>
                <input
                  id="pinActual"
                  name="pinActual"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  required
                  value={pinActual}
                  onChange={(e) => setPinActual(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  disabled={guardandoPin || viajeBloqueante}
                  autoComplete="off"
                  className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-lg tracking-widest text-white focus:border-yellow-400 focus:outline-none disabled:opacity-50"
                />
              </div>

              <BotonGrande type="submit" variante="secundario" disabled={guardandoPin || viajeBloqueante}>
                {guardandoPin ? 'Generando PIN…' : 'Generar PIN nuevo'}
              </BotonGrande>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
