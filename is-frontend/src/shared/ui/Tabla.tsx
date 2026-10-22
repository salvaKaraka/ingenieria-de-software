import type { ReactNode } from 'react'

export type Columna<T> = {
  titulo: string
  celda: (fila: T) => ReactNode
}

type Props<T> = {
  columnas: Columna<T>[]
  filas: T[]
  claveFila: (fila: T) => string | number
  mensajeVacio?: string
  onClickFila?: (fila: T) => void
}

// Tabla genérica: se le pasan las columnas y cómo dibujar cada celda.
export function Tabla<T>({ columnas, filas, claveFila, mensajeVacio = 'No hay datos.', onClickFila }: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {columnas.map((columna) => (
              <th key={columna.titulo} className="px-4 py-3 font-medium">
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-6 text-center text-gray-500">
                {mensajeVacio}
              </td>
            </tr>
          ) : (
            filas.map((fila) => (
              <tr
                key={claveFila(fila)}
                onClick={onClickFila ? () => onClickFila(fila) : undefined}
                className={`border-t border-gray-100 ${onClickFila ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              >
                {columnas.map((columna) => (
                  <td key={columna.titulo} className="px-4 py-3">
                    {columna.celda(fila)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
