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
  const [nuevoPin, setNuevoPin] = useState('')
  const [guardandoPin, setGuardandoPin] = useState(false)
  const [mensajePin, setMensajePin] = useState<string | null>(null)
  const [errorPin, setErrorPin] = useState<string | null>(null)

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

  async function cambiarPin(e: FormEvent) {
    e.preventDefault()
    setMensajePin(null)
    setErrorPin(null)

    if (!pinActual) {
      setErrorPin('El PIN actual es obligatorio')
      return
    }

    if (!/^\d{4,6}$/.test(nuevoPin)) {
      setErrorPin('El nuevo PIN debe ser estrictamente numérico y tener entre 4 y 6 dígitos')
      return
    }

    setGuardandoPin(true)
    try {
      const respuesta = await api<{ mensaje: string }>('/repartidor/perfil/cambiar-pin', {
        metodo: 'POST',
        datos: { pinActual, nuevoPin },
      })
      setMensajePin(respuesta.mensaje || 'PIN modificado con éxito')
      setPinActual('')
      setNuevoPin('')
    } catch (error) {
      if (error instanceof ErrorApi) {
        // En el Escenario 4, si el backend responde con error de PIN erróneo:
        setErrorPin(error.message || 'El PIN actual ingresado es incorrecto')
      } else {
        setErrorPin('El PIN actual ingresado es incorrecto')
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

      {/* Sección de Cambio de PIN (Escenarios 2 y 4) */}
      <section className="space-y-5 rounded-2xl bg-slate-900 p-5">
        <div>
          <h2 className="text-2xl font-bold">Cambiar PIN</h2>
          <p className="mt-1 text-sm text-slate-400">
            Ingresá tu PIN actual y elegí un nuevo PIN de 4 a 6 dígitos numéricos.
          </p>
        </div>

        {mensajePin && (
          <p role="status" className="rounded-xl bg-green-800 p-4 text-center font-semibold text-white">
            {mensajePin}
          </p>
        )}

        {errorPin && (
          <p role="alert" className="rounded-xl border border-red-500/50 bg-red-950/40 p-4 text-center font-semibold text-red-200">
            {errorPin}
          </p>
        )}

        <form onSubmit={(e) => void cambiarPin(e)} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pinActual" className="text-sm font-medium text-slate-300">
              PIN actual
            </label>
            <input
              id="pinActual"
              name="pinActual"
              type="password"
              inputMode="numeric"
              required
              value={pinActual}
              onChange={(e) => setPinActual(e.target.value)}
              disabled={guardandoPin || viajeBloqueante}
              autoComplete="current-password"
              className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-lg tracking-widest text-white focus:border-yellow-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nuevoPin" className="text-sm font-medium text-slate-300">
              Nuevo PIN (4 a 6 dígitos)
            </label>
            <input
              id="nuevoPin"
              name="nuevoPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={nuevoPin}
              onChange={(e) => setNuevoPin(e.target.value)}
              disabled={guardandoPin || viajeBloqueante}
              autoComplete="new-password"
              className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-lg tracking-widest text-white focus:border-yellow-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          <BotonGrande
            type="submit"
            variante="secundario"
            disabled={guardandoPin || viajeBloqueante}
          >
            {guardandoPin ? 'Modificando PIN…' : 'Cambiar PIN'}
          </BotonGrande>
        </form>
      </section>
    </div>
  )
}
