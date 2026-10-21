import { useParams } from 'react-router'
import { EnConstruccion } from '../../shared/ui/index.ts'

// Tarea F-4 de TAREAS.md: línea de progreso del envío con la hora de cada paso. Pública y responsive (RNF-11).
export function SeguimientoPage() {
  const { codigo } = useParams()

  return (
    <main className="mx-auto max-w-md space-y-2 p-6">
      <EnConstruccion tarea="F-4" titulo="Seguimiento de envío" />
      <p className="text-gray-500">Código: {codigo}</p>
    </main>
  )
}
