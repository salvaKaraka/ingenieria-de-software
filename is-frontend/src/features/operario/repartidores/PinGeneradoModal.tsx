import { useState } from 'react'
import { Boton, Modal } from '../../../shared/ui/index.ts'

type Props = {
  abierto: boolean
  onCerrar: () => void
  pin: string | null
  nombreRepartidor: string
}

export function PinGeneradoModal({
  abierto,
  onCerrar,
  pin,
  nombreRepartidor,
}: Props) {
  const [copiado, setCopiado] = useState(false)

  if (!pin) return null

  async function copiarPin() {
    if (!pin) return
    try {
      await navigator.clipboard.writeText(pin)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Si el navegador bloquea el portapapeles, el usuario aún puede leerlo en pantalla
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="PIN de acceso asignado">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700">
          Se generó un nuevo PIN de acceso para{' '}
          <span className="font-semibold text-gray-900">
            {nombreRepartidor}
          </span>
          :
        </p>

        <div className="flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50/50 p-6">
          <span className="font-mono text-4xl font-bold tracking-widest text-blue-700">
            {pin}
          </span>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">⚠️ Atención importante</p>
          <p>
            Anotalo y entregáselo al repartidor; no se vuelve a mostrar al
            cerrar esta ventana.
          </p>
        </div>

        <div className="mt-2 flex justify-between gap-2">
          <Boton variante="secundario" onClick={copiarPin}>
            {copiado ? '✓ ¡Copiado!' : 'Copiar PIN'}
          </Boton>
          <Boton onClick={onCerrar}>Entendido / Cerrar</Boton>
        </div>
      </div>
    </Modal>
  )
}
