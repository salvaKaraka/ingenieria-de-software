import { useId, type SelectHTMLAttributes } from 'react'

export type Opcion = { valor: string; etiqueta: string }

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string
  opciones: Opcion[]
  error?: string
}

// Select con etiqueta y mensaje de error.
export function Selector({ etiqueta, opciones, error, className = '', ...props }: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {etiqueta}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-white px-3 py-2 ${error ? 'border-red-500' : 'border-gray-300'} ${className}`}
        {...props}
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
