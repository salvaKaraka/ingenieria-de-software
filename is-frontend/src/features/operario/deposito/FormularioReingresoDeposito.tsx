import { useState, type FormEvent } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import { Boton, Campo } from '../../../shared/ui/index.ts'

// HU 37: el operario registra con el código de seguimiento cada paquete que el repartidor
// entrega en la base mientras rinde su jornada (lo usa "Aprobar cierre").
export function FormularioReingresoDeposito({
  repartidorId,
  alReingresar,
}: {
  repartidorId: number
  alReingresar: () => void
}) {
  const [codigo, setCodigo] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const confirmarReingreso = async (evento: FormEvent) => {
    evento.preventDefault()
    if (!codigo.trim()) return

    setConfirmando(true)
    setError(null)
    setExito(null)

    try {
      await api('/envios/deposito/reingreso', {
        metodo: 'POST',
        datos: {
          repartidorId,
          codigoSeguimiento: codigo.trim(),
        },
      })
      setExito(`Paquete ${codigo.trim().toUpperCase()} registrado En custodia.`)
      setCodigo('')
      alReingresar()
    } catch (err) {
      // Muestra los mensajes exactos de HU37 Escenario 2 y Escenario 3:
      // - "El paquete no pertenece a la jornada de este repartidor"
      // - "El código no corresponde a ningún envío"
      setError(
        err instanceof ErrorApi ? err.message : 'No se pudo registrar el reingreso.',
      )
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <form
      onSubmit={confirmarReingreso}
      className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3"
    >
      <p className="text-xs font-semibold text-blue-900">
        Registrar reingreso de paquete al depósito (En custodia)
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Campo
            etiqueta="Código de seguimiento"
            placeholder="Ej.: ABC1234567"
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value)
              setError(null)
            }}
          />
        </div>
        <Boton type="submit" disabled={confirmando || !codigo.trim()}>
          {confirmando ? 'Confirmando…' : 'Confirmar reingreso'}
        </Boton>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
      {exito && (
        <p role="status" className="text-xs font-semibold text-emerald-700">
          {exito}
        </p>
      )}
    </form>
  )
}
