import { useEffect, useState } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import { Boton, Campo, Modal } from '../../../shared/ui/index.ts'
import type { Repartidor } from './tipos.ts'

type Props = {
  abierto: boolean
  onCerrar: () => void
  onAprobado: () => void
  repartidor: Repartidor | null
}

type PaqueteADevolver = {
  id: number
  codigoSeguimiento: string
  comercio: { nombre: string }
  motivo: string
}

// G-1: los paquetes a devolver los calcula el sistema; el operario indica cuántos recibió
// en la base y el backend valida que coincidan.
function AprobarCierreContenido({
  repartidor,
  onCerrar,
  onAprobado,
}: {
  repartidor: Repartidor
  onCerrar: () => void
  onAprobado: () => void
}) {
  const [paquetes, setPaquetes] = useState<PaqueteADevolver[] | null>(null)
  const [paquetesDevueltos, setPaquetesDevueltos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    api<{ paquetesADevolver: PaqueteADevolver[] }>(`/repartidores/${repartidor.id}/rendicion`)
      .then((datos) => {
        if (activo) setPaquetes(datos.paquetesADevolver)
      })
      .catch((err: unknown) => {
        if (activo) setError(err instanceof ErrorApi ? err.message : 'Error de conexión')
      })
    return () => {
      activo = false
    }
  }, [repartidor.id])

  async function aprobar() {
    setEnviando(true)
    setError(null)
    try {
      await api(`/repartidores/${repartidor.id}/aprobar-cierre`, {
        metodo: 'POST',
        datos: { paquetesDevueltos },
      })
      onAprobado()
      onCerrar()
    } catch (err) {
      // El 400 dice cuántos paquetes faltan rendir; el 409, que ya no estaba esperando el cierre.
      setError(err instanceof ErrorApi ? err.message : 'Ocurrió un error inesperado al aprobar el cierre.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Revisá lo que tiene que devolver{' '}
        <strong className="text-gray-900">
          {repartidor.nombre} {repartidor.apellido}
        </strong>{' '}
        antes de cerrar su turno.
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {paquetes === null ? (
        !error && <p className="py-4 text-center text-sm text-gray-500">Cargando rendición…</p>
      ) : paquetes.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          No tiene paquetes para devolver.
        </p>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="font-medium text-gray-700">Paquetes a devolver en la base ({paquetes.length}):</p>
          <ul className="space-y-1">
            {paquetes.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="font-mono font-semibold">{p.codigoSeguimiento}</span>
                <span className="text-gray-600">
                  {p.comercio.nombre} · {p.motivo}
                </span>
              </li>
            ))}
          </ul>
          <Campo
            etiqueta="Paquetes recibidos en la base"
            type="number"
            min="0"
            value={paquetesDevueltos}
            onChange={(e) => setPaquetesDevueltos(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton onClick={() => void aprobar()} disabled={enviando || paquetes === null}>
          {enviando ? 'Aprobando…' : 'Aprobar cierre'}
        </Boton>
      </div>
    </div>
  )
}

export function AprobarCierreModal({ abierto, onCerrar, onAprobado, repartidor }: Props) {
  if (!abierto || !repartidor) return null

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Aprobar cierre de turno">
      <AprobarCierreContenido repartidor={repartidor} onCerrar={onCerrar} onAprobado={onAprobado} />
    </Modal>
  )
}
