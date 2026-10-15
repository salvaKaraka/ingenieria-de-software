import { useParams } from 'react-router'

// Pantalla pública del destinatario: estado del envío a partir del código de seguimiento.
export function SeguimientoPage() {
  const { codigo } = useParams()

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">Seguimiento de envío</h1>
      <p className="text-gray-500">Código: {codigo}</p>
    </main>
  )
}
