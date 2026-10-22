import { useEffect, useState } from 'react'
import { api } from '../../../shared/api'
import { Boton } from '../../../shared/ui/Boton'

interface Evento { id: number; estado: string; fecha: string }
interface DetalleEnvio {
  id: number
  codigoSeguimiento: string
  estado: string
  destinoDireccion: string
  tamano: string
  eventos: Evento[]
}

export function DetalleEnvioPage() {
  const id = window.location.pathname.split('/').filter(Boolean).pop()
  const navigate = (path: string) => window.location.assign(path)
  const [envio, setEnvio] = useState<DetalleEnvio | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargarDetalle = async () => {
    try {
      const data = await api<DetalleEnvio>(`/envios/${id}`)
      setEnvio(data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDetalle() }, [id])

  const cancelarEnvio = async () => {
    if (!confirm('¿Seguro que deseas cancelar este envío?')) return
    try {
      await api(`/envios/${id}/cancelar`, { metodo: 'POST' })
      cargarDetalle() // Recargamos para ver el nuevo estado
    } catch (err) {
      alert('Error al cancelar el envío')
    }
  }

  if (cargando) return <div>Cargando detalle...</div>
  if (!envio) return <div>Envío no encontrado.</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Boton variante="secundario" onClick={() => navigate('/operario/envios')} className="mb-4">
            ← Volver
          </Boton>
          <h1 className="text-2xl font-bold">Envío {envio.codigoSeguimiento}</h1>
          <p className="text-gray-500">Destino: {envio.destinoDireccion} | Tamaño: {envio.tamano}</p>
        </div>
        
        {envio.estado !== 'ENTREGADO' && envio.estado !== 'CANCELADO' && (
          <Boton variante="peligro" onClick={cancelarEnvio}>Cancelar Envío</Boton>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold mb-4">Línea de Tiempo</h3>
        <div className="space-y-4">
          {envio.eventos?.map((evento, idx) => (
            <div key={evento.id} className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <p className="font-semibold">{evento.estado}</p>
                <p className="text-xs text-gray-500">{new Date(evento.fecha).toLocaleString()}</p>
              </div>
              {idx !== envio.eventos.length - 1 && <div className="w-px h-8 bg-gray-200 ml-1.5 -mt-8"></div>}
            </div>
          ))}
          {(!envio.eventos || envio.eventos.length === 0) && <p className="text-gray-500 text-sm">No hay eventos registrados.</p>}
        </div>
      </div>
    </div>
  )
}
