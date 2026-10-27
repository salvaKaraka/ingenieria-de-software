import { useCallback, useState } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import type { EstadoEnvio } from '../../../shared/tipos.ts'
import { BotonGrande, Modal } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'

interface DestinatarioViaje {
  nombre: string | null
  apellido: string | null
  telefono: string | null
}

interface ViajeActivo {
  envioId: number
  codigoSeguimiento: string
  estado: EstadoEnvio
  siguienteEstado: EstadoEnvio | null
  comercio: { nombre: string; telefono: string }
  origenDireccion: string
  destinoDireccion: string
  destinatario: DestinatarioViaje
  observaciones: string | null
  requiereFoto: boolean
  requiereDni: boolean
  aviso: string | null
}

const ACCIONES_SIGUIENTE: Record<EstadoEnvio, string> = {
  PENDIENTE: 'Aceptar',
  ASIGNADO: 'Llegué al comercio',
  EN_CAMINO_A_RETIRAR: 'Paquete retirado',
  RETIRADO: 'Llegué al domicilio',
  EN_DOMICILIO: 'Entregado',
  ENTREGADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

export function ViajePage() {
  const [viaje, setViaje] = useState<ViajeActivo | null>(null)
  const [cargado, setCargado] = useState(false)
  const [avanzando, setAvanzando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const data = await api<{ viaje: ViajeActivo | null }>('/repartidor/viajes/actual')
      setViaje(data.viaje)
      setError(null)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el viaje activo.')
    } finally {
      setCargado(true)
    }
  }, [])

  // Polling cada 10 segundos según RNF-10 / AGENTS.md
  usePolling(cargar, 10_000)

  const avanzar = async () => {
    setAvanzando(true)
    setError(null)
    try {
      await api('/repartidor/viajes/actual/avanzar', { metodo: 'POST' })
      setConfirmando(false)
      await cargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo avanzar el viaje.')
    } finally {
      setAvanzando(false)
    }
  }

  if (!cargado) {
    return <p className="p-4 text-lg text-gray-600">Cargando viaje activo...</p>
  }

  if (!viaje) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Viaje actual</h1>
        <p className="mt-4 text-lg text-gray-600">No tenés ningún viaje activo en este momento.</p>
      </div>
    )
  }

  const nombreDestinatario = [viaje.destinatario.nombre, viaje.destinatario.apellido].filter(Boolean).join(' ')
  const proximaAccion = viaje.estado in ACCIONES_SIGUIENTE ? ACCIONES_SIGUIENTE[viaje.estado] : 'Avanzar'

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <span className="font-mono text-xl font-bold text-gray-900">{viaje.codigoSeguimiento}</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
            {viaje.estado.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Aviso de modificación de dirección (Escenario 3) */}
        {viaje.aviso && (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-amber-900 shadow">
            <p className="text-lg font-bold">⚠️ {viaje.aviso}</p>
          </div>
        )}

        <div className="space-y-3 text-lg">
          <div>
            <span className="block text-sm font-semibold uppercase text-gray-500">Origen (Comercio)</span>
            <p className="font-bold text-gray-900">{viaje.comercio.nombre}</p>
            <p className="text-gray-700">{viaje.origenDireccion}</p>
          </div>

          <div className="border-t pt-2">
            <span className="block text-sm font-semibold uppercase text-gray-500">Destino (Entrega)</span>
            <p className="font-bold text-xl text-blue-900">{viaje.destinoDireccion}</p>
            {nombreDestinatario && <p className="text-gray-800">Destinatario: {nombreDestinatario}</p>}
            {viaje.destinatario.telefono && <p className="text-gray-600">Tel: {viaje.destinatario.telefono}</p>}
          </div>

          {viaje.observaciones && (
            <div className="border-t pt-2">
              <span className="block text-sm font-semibold uppercase text-gray-500">Observaciones</span>
              <p className="rounded bg-gray-50 p-2 text-base text-gray-700">{viaje.observaciones}</p>
            </div>
          )}
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-base font-semibold text-red-600">{error}</p>}

        {viaje.siguienteEstado && (
          <div className="pt-2">
            <BotonGrande onClick={() => setConfirmando(true)} disabled={avanzando}>
              {proximaAccion}
            </BotonGrande>
          </div>
        )}
      </div>

      {/* Modal de confirmación (RNF-10: max 2 toques) */}
      <Modal abierto={confirmando} onCerrar={() => setConfirmando(false)} titulo={`¿Confirmar "${proximaAccion}"?`}>
        <div className="space-y-4 pt-2">
          <p className="text-base text-gray-700">Se registrará el avance del viaje en el sistema central.</p>
          <div className="flex gap-3">
            <BotonGrande variante="secundario" onClick={() => setConfirmando(false)} disabled={avanzando}>
              Volver
            </BotonGrande>
            <BotonGrande onClick={avanzar} disabled={avanzando}>
              {avanzando ? 'Guardando...' : 'Sí, confirmar'}
            </BotonGrande>
          </div>
        </div>
      </Modal>
    </div>
  )
}
