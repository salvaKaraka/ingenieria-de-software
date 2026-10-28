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

type Rendicion = {
  viajesTomados: number
  paquetesEntregados: number
  paquetesPendientes: number
}

function AprobarCierreContenido({
  repartidor,
  onCerrar,
  onAprobado,
}: {
  repartidor: Repartidor
  onCerrar: () => void
  onAprobado: () => void
}) {
  const [rendicion, setRendicion] = useState<Rendicion | null>(null)
  const [paquetesDevueltos, setPaquetesDevueltos] = useState<number>(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargarRendicion() {
      try {
        const datos = await api<Rendicion>(`/repartidores/${repartidor.id}/rendicion`)
        if (activo) {
          setRendicion(datos)
        }
      } catch (err) {
        if (activo) {
          setError(
            err instanceof ErrorApi
              ? err.mensajes[0] || 'Error al obtener la rendición'
              : 'Error de conexión',
          )
        }
      } finally {
        if (activo) setCargando(false)
      }
    }
    void cargarRendicion()
    return () => {
      activo = false
    }
  }, [repartidor.id])

  async function handleAprobarCierre() {
    setEnviando(true)
    setError(null)

    try {
      await api(`/repartidores/${repartidor.id}/aprobar-cierre`, {
        metodo: 'POST',
        datos: {
          paquetesDevueltos: Number(paquetesDevueltos) || 0,
        },
      })
      onAprobado()
      onCerrar()
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(err.mensajes[0] || 'No se pudo aprobar el cierre.')
      } else {
        setError('Ocurrió un error inesperado al aprobar el cierre.')
      }
    } finally {
      setEnviando(false)
    }
  }

  const faltantes =
    rendicion !== null
      ? rendicion.viajesTomados -
        (rendicion.paquetesEntregados + (Number(paquetesDevueltos) || 0))
      : 0

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Revisá los paquetes de la jornada antes de aprobar el cierre de turno de{' '}
        <strong className="text-gray-900">
          {repartidor.nombre} {repartidor.apellido}
        </strong>
        .
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium"
        >
          {error}
        </div>
      )}

      {cargando ? (
        <p className="py-4 text-center text-sm text-gray-500">Cargando rendición…</p>
      ) : rendicion ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Viajes tomados:</span>
            <span className="font-semibold text-gray-900">{rendicion.viajesTomados}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Paquetes entregados:</span>
            <span className="font-semibold text-green-700">{rendicion.paquetesEntregados}</span>
          </div>

          <div className="pt-2">
            <Campo
              etiqueta="Paquetes devueltos a depósito:"
              type="number"
              min="0"
              value={paquetesDevueltos}
              onChange={(e) => setPaquetesDevueltos(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>

          <div className="flex justify-between border-t border-gray-200 pt-3">
            <span className="font-medium text-gray-700">Paquetes pendientes de rendir:</span>
            <span
              className={`font-bold ${faltantes === 0 ? 'text-green-700' : 'text-amber-700'}`}
            >
              {faltantes}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton
          onClick={() => void handleAprobarCierre()}
          disabled={enviando || cargando}
        >
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
      <AprobarCierreContenido
        repartidor={repartidor}
        onCerrar={onCerrar}
        onAprobado={onAprobado}
      />
    </Modal>
  )
}
