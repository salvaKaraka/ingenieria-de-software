import { Link } from 'react-router'

export function NoEncontradoPage() {
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <Link className="text-blue-600 underline" to="/">
        Volver al inicio
      </Link>
    </main>
  )
}
