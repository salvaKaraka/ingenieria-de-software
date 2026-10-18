import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'peligro'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-blue-600 text-white hover:bg-blue-700',
  secundario: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
  peligro: 'bg-red-600 text-white hover:bg-red-700',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }

// Botón estándar del panel del operario.
export function Boton({ variante = 'primario', className = '', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
      {...props}
    />
  )
}
