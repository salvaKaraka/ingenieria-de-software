import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../shared/api.ts'
import { ETIQUETA_VEHICULO, type EstadoEnvio, type TipoVehiculo } from '../../shared/tipos.ts'
import { Boton, EtiquetaEstado, Tabla } from '../../shared/ui/index.ts'
import { usePolling } from '../../shared/usePolling.ts'

type Repartidor = {
  id: number
  nombre: string
  apellido: string
  vehiculo: TipoVehiculo
  estado: string
  enColaDesde: string | null
  viajesConsecutivos: number
}

type Envio = {
  id: number
  codigoSeguimiento: string
  estado: EstadoEnvio
  vehiculoRequerido: TipoVehiculo
  repartidorId: number | null
  ofertas: { id: number; repartidorId: number; estado: string; expiraEn: string }[]
}

const VEHICULOS: TipoVehiculo[] = ['MOTO', 'AUTO', 'CAMION']
const hora = (fecha: string) => new Date(fecha).toLocaleTimeString('es-AR')

// Herramienta de desarrollo para probar el motor de asignación de punta a punta (/dev/motor).
// Reemplaza temporalmente al alta de envíos (B-5) y a la jornada (C-4). Se borra cuando existan.
export function MotorDevPage() {
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [mensaje, setMensaje] = useState<string | null>(null)

  const actualizar = useCallback(async () => {
    try {
      const estado = await api<{ repartidores: Repartidor[]; envios: Envio[] }>('/dev/estado')
      setRepartidores(estado.repartidores)
      setEnvios(estado.envios)
    } catch {
      setMensaje('No se pudo conectar con la API. ¿Está levantado el backend?')
    }
  }, [])

  usePolling(actualizar, 2000)

  async function ejecutar(accion: () => Promise<string>) {
    try {
      setMensaje(await accion())
      await actualizar()
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'Error')
    }
  }

  const crearEnvio = (vehiculo: TipoVehiculo) =>
    ejecutar(async () => {
      const r = await api<{ envioId: number; ofrecidoA: number | null }>('/dev/envios', { metodo: 'POST', datos: { vehiculo } })
      return r.ofrecidoA ? `Envío #${r.envioId} ofrecido al repartidor #${r.ofrecidoA}` : `Envío #${r.envioId} creado, sin repartidor disponible`
    })

  const crearRepartidor = (vehiculo: TipoVehiculo) =>
    ejecutar(async () => {
      const r = await api<{ id: number; pin: string }>('/dev/repartidores', { metodo: 'POST', datos: { vehiculo } })
      return `Repartidor #${r.id} creado. PIN: ${r.pin} (anotalo, no se vuelve a mostrar)`
    })

  const ponerDisponible = (id: number) =>
    ejecutar(async () => {
      const r = await api<{ ofertasCreadas: number }>(`/dev/repartidores/${id}/disponible`, { metodo: 'POST' })
      return `Repartidor #${id} en la cola. Ofertas nuevas: ${r.ofertasCreadas}`
    })

  const vencerOfertas = () =>
    ejecutar(async () => {
      const r = await api<{ adelantadas: number }>('/dev/ofertas/vencer', { metodo: 'POST' })
      return `${r.adelantadas} oferta(s) vencidas: el job las procesa en menos de 10 segundos`
    })

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Probador del motor de asignación</h1>
        <p className="text-sm text-gray-500">
          Solo en desarrollo. Para ver las ofertas, entrá como repartidor en otra ventana privada o en el celular:{' '}
          <Link className="text-blue-600 underline" to="/repartidor/login">
            /repartidor/login
          </Link>
        </p>
      </header>

      {mensaje && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{mensaje}</p>}

      <section className="flex flex-wrap gap-6">
        <div className="space-y-2">
          <h2 className="font-semibold">Crear envío</h2>
          <div className="flex gap-2">
            {VEHICULOS.map((vehiculo) => (
              <Boton key={vehiculo} onClick={() => void crearEnvio(vehiculo)}>
                {ETIQUETA_VEHICULO[vehiculo]}
              </Boton>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">Crear repartidor</h2>
          <div className="flex gap-2">
            {VEHICULOS.map((vehiculo) => (
              <Boton key={vehiculo} variante="secundario" onClick={() => void crearRepartidor(vehiculo)}>
                {ETIQUETA_VEHICULO[vehiculo]}
              </Boton>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">Ofertas</h2>
          <Boton variante="peligro" onClick={() => void vencerOfertas()}>
            Vencer pendientes ahora
          </Boton>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Repartidores (en orden de cola)</h2>
        <Tabla
          filas={repartidores}
          claveFila={(r) => r.id}
          mensajeVacio="No hay repartidores. Corré npm run dev:usuarios o creá uno arriba."
          columnas={[
            { titulo: '#', celda: (r) => r.id },
            { titulo: 'Nombre', celda: (r) => `${r.nombre} ${r.apellido}` },
            { titulo: 'Vehículo', celda: (r) => ETIQUETA_VEHICULO[r.vehiculo] },
            { titulo: 'Estado', celda: (r) => r.estado },
            { titulo: 'En cola desde', celda: (r) => (r.enColaDesde ? hora(r.enColaDesde) : '—') },
            { titulo: 'Consecutivos', celda: (r) => r.viajesConsecutivos },
            {
              titulo: '',
              celda: (r) =>
                r.estado === 'DISPONIBLE' && r.enColaDesde ? null : (
                  <Boton variante="secundario" onClick={() => void ponerDisponible(r.id)}>
                    Poner en la cola
                  </Boton>
                ),
            },
          ]}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Últimos envíos</h2>
        <Tabla
          filas={envios}
          claveFila={(e) => e.id}
          mensajeVacio="Todavía no hay envíos."
          columnas={[
            { titulo: '#', celda: (e) => e.id },
            { titulo: 'Vehículo', celda: (e) => ETIQUETA_VEHICULO[e.vehiculoRequerido] },
            { titulo: 'Estado', celda: (e) => <EtiquetaEstado estado={e.estado} /> },
            { titulo: 'Repartidor', celda: (e) => (e.repartidorId ? `#${e.repartidorId}` : '—') },
            {
              titulo: 'Ofertas',
              celda: (e) =>
                e.ofertas.length === 0
                  ? '—'
                  : e.ofertas.map((o) => `#${o.repartidorId} ${o.estado.toLowerCase()}${o.estado === 'PENDIENTE' ? ` (vence ${hora(o.expiraEn)})` : ''}`).join(' · '),
            },
          ]}
        />
      </section>
    </main>
  )
}
