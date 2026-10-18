import { useEffect, type ReactNode } from 'react'

type Props = {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
}

// Ventana modal. Se cierra con Escape o haciendo clic afuera.
export function Modal({ abierto, onCerrar, titulo, children }: Props) {
  useEffect(() => {
    if (!abierto) return
    const alApretarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alApretarTecla)
    return () => window.removeEventListener('keydown', alApretarTecla)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-md rounded-xl bg-white p-6 text-gray-900 shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
