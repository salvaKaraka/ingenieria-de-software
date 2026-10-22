import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Boton, Campo } from '../../shared/ui/index.ts'
import { mensajeDeErrorDeLogin, rutaPrevia } from './mensajeDeError.ts'
import { RUTA_INICIO, useSesion } from './sesion.ts'

// Ingreso del operario con usuario y contraseña (A-4).
export function LoginOperarioPage() {
  const { usuario, loginOperario } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario?.rol === 'OPERARIO') return <Navigate to={RUTA_INICIO.OPERARIO} replace />

  async function ingresar(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await loginOperario(nombreUsuario, password)
      navegar(rutaPrevia(ubicacion.state) ?? RUTA_INICIO.OPERARIO, { replace: true })
    } catch (e) {
      setError(mensajeDeErrorDeLogin(e))
      setPassword('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <form onSubmit={ingresar} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold">Panel del operario</h1>
        <Campo
          etiqueta="Usuario"
          autoComplete="username"
          value={nombreUsuario}
          onChange={(e) => setNombreUsuario(e.target.value)}
          required
        />
        {/* type="password" muestra •••• (RNF-02) */}
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Boton type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Boton>
      </form>
    </main>
  )
}
