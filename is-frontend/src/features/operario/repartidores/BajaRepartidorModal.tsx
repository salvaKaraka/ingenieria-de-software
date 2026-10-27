import { useState } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import { Boton, Modal } from '../../../shared/ui/index.ts'
import type { Repartidor } from './tipos.ts'

type Props = {
  abierto: boolean
  onCerrar: () => void
  onConfirmado: () => void
  repartidor: Repartidor | null
}

function BajaContenido({
  repartidor,
  onCerrar,
  onConfirmado,
}: {
  repartidor: Repartidor
  onCerrar: () => void
  onConfirmado: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmarBaja() {
    setEnviando(true)
    setError(null)

    try {
      await api(`/repartidores/${repartidor.id}`, { metodo: 'DELETE' })
      onConfirmado()
      onCerrar()
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.status === 409) {
          setError(
            err.mensajes[0] ||
              'El repartidor tiene un viaje en curso',
          )
        } else {
          setError(
            err.mensajes[0] || 'Ocurrió un error al dar de baja al repartidor.',
          )
        }
      } else {
        setError('Error de comunicación con el servidor.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-semibold">No se pudo procesar la baja:</p>
          <p>{error}</p>
        </div>
      )}

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseás dar de baja a{' '}
        <span className="font-semibold text-gray-900">
          {repartidor.nombre} {repartidor.apellido}
        </span>
        ?
      </p>

      <p className="text-xs text-gray-500">
        El repartidor pasará a estar inactivo, saldrá de la cola de asignación y
        se cerrarán todas sus sesiones abiertas. Esta acción no borra el
        historial de entregas.
      </p>

      <div className="mt-2 flex justify-end gap-2">
        <Boton
          variante="secundario"
          onClick={onCerrar}
          disabled={enviando}
        >
          Cancelar
        </Boton>
        <Boton
          variante="peligro"
          onClick={confirmarBaja}
          disabled={enviando}
        >
          {enviando ? 'Dando de baja...' : 'Confirmar baja'}
        </Boton>
      </div>
    </div>
  )
}

export function BajaRepartidorModal({
  abierto,
  onCerrar,
  onConfirmado,
  repartidor,
}: Props) {
  if (!repartidor) return null

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Dar de baja repartidor">
      {abierto && (
        <BajaContenido
          key={repartidor.id}
          repartidor={repartidor}
          onCerrar={onCerrar}
          onConfirmado={onConfirmado}
        />
      )}
    </Modal>
  )
}
