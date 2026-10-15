import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'peligro'

// Alto contraste sobre el fondo oscuro de la app del repartidor (RNF-10).
const ESTILOS: Record<Variante, string> = {
  primario: 'bg-yellow-400 text-black active:bg-yellow-300',
  secundario: 'bg-white text-black active:bg-gray-200',
  peligro: 'bg-red-600 text-white active:bg-red-500',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }

// Botón de la app del repartidor: ancho completo y grande, para usar en la calle.
export function BotonGrande({ variante = 'primario', className = '', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={`min-h-16 w-full rounded-2xl px-6 text-xl font-bold disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
      {...props}
    />
  )
}
