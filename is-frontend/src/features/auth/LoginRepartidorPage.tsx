import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { mensajeDeErrorDeLogin, rutaPrevia } from './mensajeDeError.ts'
import { RUTA_INICIO, useSesion } from './sesion.ts'

const LARGO_PIN = 4
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar'] as const

// Ingreso del repartidor con PIN (A-4): teclado numérico grande, pensado para usar en la calle.
// Al completar los 4 dígitos ingresa solo, sin tocar un botón extra.
export function LoginRepartidorPage() {
  const { usuario, loginRepartidor } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario?.rol === 'REPARTIDOR') return <Navigate to={RUTA_INICIO.REPARTIDOR} replace />

  async function ingresar(pinCompleto: string) {
    setEnviando(true)
    try {
      await loginRepartidor(pinCompleto)
      navegar(rutaPrevia(ubicacion.state) ?? RUTA_INICIO.REPARTIDOR, { replace: true })
    } catch (e) {
      setError(mensajeDeErrorDeLogin(e))
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  function tocar(tecla: (typeof TECLAS)[number]) {
    if (enviando) return
    setError(null)
    if (tecla === 'borrar') {
      setPin((actual) => actual.slice(0, -1))
      return
    }
    const nuevo = pin + tecla
    setPin(nuevo)
    if (nuevo.length === LARGO_PIN) void ingresar(nuevo)
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-950 p-6 text-white">
      <h1 className="text-2xl font-bold">Ingresá tu PIN</h1>

      {/* El PIN nunca se muestra: solo un punto por dígito ingresado (RNF-02) */}
      <div className="flex gap-4" aria-label={`${pin.length} de ${LARGO_PIN} dígitos ingresados`}>
        {Array.from({ length: LARGO_PIN }, (_, i) => (
          <span
            key={i}
            className={`h-5 w-5 rounded-full border-2 border-white ${i < pin.length ? 'bg-white' : ''}`}
          />
        ))}
      </div>

      <p role="alert" className="min-h-7 text-center text-lg text-red-400">
        {enviando ? 'Ingresando…' : error}
      </p>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {TECLAS.map((tecla, i) =>
          tecla === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => tocar(tecla)}
              disabled={enviando}
              aria-label={tecla === 'borrar' ? 'Borrar último dígito' : tecla}
              className="h-20 rounded-2xl bg-slate-800 text-3xl font-bold active:bg-slate-600 disabled:opacity-50"
            >
              {tecla === 'borrar' ? '⌫' : tecla}
            </button>
          ),
        )}
      </div>
    </main>
  )
}
