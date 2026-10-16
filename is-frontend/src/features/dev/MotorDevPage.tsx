import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api } from '../../shared/api.ts'
import type { EstadoEnvio, TamanioPaquete, TipoVehiculo } from '../../shared/tipos.ts'
import { Boton } from '../../shared/ui/index.ts'
import { usePolling } from '../../shared/usePolling.ts'

// Herramienta de desarrollo para probar el motor de asignación de punta a punta (/dev/motor).
// Reemplaza temporalmente al alta de envíos (B-5) y a la jornada (C-4). Se borra cuando existan.

type Repartidor = {
  id: number
  nombre: string
  apellido: string
  vehiculo: TipoVehiculo
  estado: string
  enColaDesde: string | null
  viajesConsecutivos: number
}

type Oferta = { id: number; repartidorId: number; estado: string; expiraEn: string }

type Envio = {
  id: number
  estado: EstadoEnvio
  tamanio: TamanioPaquete
  destinoDireccion: string
  repartidorId: number | null
  ofertas: Oferta[]
}

type PinAnotado = { id: number; nombre: string; pin: string }
type Suceso = { hora: string; texto: string }

const VEHICULOS: { valor: TipoVehiculo; nombre: string; icono: string }[] = [
  { valor: 'MOTO', nombre: 'Moto', icono: '🛵' },
  { valor: 'AUTO', nombre: 'Auto', icono: '🚗' },
  { valor: 'CAMION', nombre: 'Camión', icono: '🚚' },
]
const ICONO = { MOTO: '🛵', AUTO: '🚗', CAMION: '🚚' }

const TAMANIOS: { valor: TamanioPaquete; nombre: string; quien: string }[] = [
  { valor: 'CHICO', nombre: 'Chico', quien: 'moto, auto o camión' },
  { valor: 'MEDIANO', nombre: 'Mediano', quien: 'auto o camión' },
  { valor: 'GRANDE', nombre: 'Grande', quien: 'solo camión' },
]
const NOMBRE_TAMANIO = { CHICO: 'Chico', MEDIANO: 'Mediano', GRANDE: 'Grande' }

const CLAVE_PINS = 'dev-motor-pins'

function leerPins(): PinAnotado[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PINS) ?? '[]') as PinAnotado[]
  } catch {
    return []
  }
}

function guardarPins(pins: PinAnotado[]) {
  try {
    localStorage.setItem(CLAVE_PINS, JSON.stringify(pins))
  } catch {
    // Sin localStorage (ej: ventana privada estricta): los PINs solo quedan en pantalla.
  }
}

const horaActual = () => new Date().toLocaleTimeString('es-AR')

function cuentaRegresiva(expiraEn: string, ahora: number) {
  const segundos = Math.max(0, Math.ceil((new Date(expiraEn).getTime() - ahora) / 1000))
  return segundos === 0 ? 'vencida' : `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

export function MotorDevPage() {
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [pins, setPins] = useState<PinAnotado[]>(leerPins)
  const [sucesos, setSucesos] = useState<Suceso[]>([])
  const [sinConexion, setSinConexion] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())

  const anotar = (texto: string) => setSucesos((previos) => [{ hora: horaActual(), texto }, ...previos].slice(0, 12))

  const actualizar = useCallback(async () => {
    try {
      const estado = await api<{ repartidores: Repartidor[]; envios: Envio[] }>('/dev/estado')
      setRepartidores(estado.repartidores)
      setEnvios(estado.envios)
      setSinConexion(false)
    } catch {
      setSinConexion(true)
    }
  }, [])

  usePolling(actualizar, 2000)

  // Reloj para las cuentas regresivas de las ofertas.
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(intervalo)
  }, [])

  async function ejecutar(accion: () => Promise<string>) {
    try {
      anotar(await accion())
    } catch (error) {
      anotar(`Error: ${error instanceof Error ? error.message : 'desconocido'}`)
    }
    await actualizar()
  }

  const nombreDe = (id: number) => {
    const r = repartidores.find((repartidor) => repartidor.id === id)
    return r ? `${ICONO[r.vehiculo]} ${r.nombre} ${r.apellido}` : `#${id}`
  }

  const sumarRepartidor = (vehiculo: TipoVehiculo) =>
    ejecutar(async () => {
      const r = await api<PinAnotado & { ofertasCreadas: number }>('/dev/repartidores', { metodo: 'POST', datos: { vehiculo } })
      const nuevos = [{ id: r.id, nombre: r.nombre, pin: r.pin }, ...pins]
      setPins(nuevos)
      guardarPins(nuevos)
      return `Llegó ${r.nombre} (PIN ${r.pin}) y entró a la cola.${r.ofertasCreadas ? ` Recibió ${r.ofertasCreadas} oferta(s) de envíos que esperaban.` : ''}`
    })

  const cargarEnvio = (tamanio: TamanioPaquete) =>
    ejecutar(async () => {
      const r = await api<{ envioId: number; ofrecidoA: number | null }>('/dev/envios', { metodo: 'POST', datos: { tamanio } })
      return r.ofrecidoA
        ? `Envío #${r.envioId} (${NOMBRE_TAMANIO[tamanio].toLowerCase()}): el motor se lo ofreció a ${nombreDe(r.ofrecidoA)}.`
        : `Envío #${r.envioId} (${NOMBRE_TAMANIO[tamanio].toLowerCase()}): no hay ningún repartidor que pueda llevarlo, queda esperando.`
    })

  const volverALaCola = (repartidor: Repartidor) =>
    ejecutar(async () => {
      const r = await api<{ ofertasCreadas: number }>(`/dev/repartidores/${repartidor.id}/disponible`, { metodo: 'POST' })
      return `${repartidor.nombre} ${repartidor.apellido} volvió al final de la cola.${r.ofertasCreadas ? ` Se crearon ${r.ofertasCreadas} oferta(s).` : ''}`
    })

  const vencerOfertas = () =>
    ejecutar(async () => {
      const r = await api<{ adelantadas: number }>('/dev/ofertas/vencer', { metodo: 'POST' })
      return r.adelantadas === 0
        ? 'No había ofertas esperando respuesta.'
        : `${r.adelantadas} oferta(s) vencidas. En menos de 10 s el sistema pasa a esos repartidores a "en pausa" y ofrece los envíos al siguiente.`
    })

  // ---- Agrupar lo que devuelve la API en situaciones fáciles de leer ----
  const ofertaPendienteDe = new Map<number, { envio: Envio; oferta: Oferta }>()
  for (const envio of envios) {
    for (const oferta of envio.ofertas) {
      if (oferta.estado === 'PENDIENTE') ofertaPendienteDe.set(oferta.repartidorId, { envio, oferta })
    }
  }
  const enCola = repartidores.filter((r) => r.estado === 'DISPONIBLE' && r.enColaDesde)
  const conOferta = repartidores.filter((r) => ofertaPendienteDe.has(r.id))
  const enViaje = repartidores.filter((r) => r.estado === 'OCUPADO')
  const afuera = repartidores.filter((r) => !enCola.includes(r) && !conOferta.includes(r) && !enViaje.includes(r))

  const esperando = envios.filter((e) => e.estado === 'PENDIENTE' && !e.ofertas.some((o) => o.estado === 'PENDIENTE'))
  const ofrecidos = envios.filter((e) => e.estado === 'PENDIENTE' && e.ofertas.some((o) => o.estado === 'PENDIENTE'))
  const asignados = envios.filter((e) => e.estado !== 'PENDIENTE')

  const historial = (envio: Envio) =>
    envio.ofertas
      .filter((o) => o.estado === 'RECHAZADA' || o.estado === 'VENCIDA')
      .map((o) => `${o.estado === 'RECHAZADA' ? 'rechazado' : 'no respondió'}: ${nombreDe(o.repartidorId)}`)
      .join(' · ')

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-gray-900">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Probador del motor de asignación</h1>
        <p className="text-gray-600">
          Simulá la operación: sumá repartidores, cargá envíos y mirá a quién le ofrece cada viaje el sistema. Solo existe en
          desarrollo.
        </p>
        {sinConexion && (
          <p className="rounded-lg bg-red-50 p-3 text-red-800">No hay conexión con la API. ¿Está corriendo el backend?</p>
        )}
      </header>

      <ol className="grid gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-950 md:grid-cols-4">
        <li><strong>1.</strong> Sumá uno o más repartidores. Entran solos a la cola.</li>
        <li><strong>2.</strong> Cargá un envío. El sistema se lo ofrece al primero de la cola que pueda llevarlo.</li>
        <li><strong>3.</strong> Entrá como ese repartidor en una <strong>ventana privada</strong> o en el celular (<code>/repartidor/login</code>, con su PIN) y aceptá o rechazá.</li>
        <li><strong>4.</strong> Mirá cómo cambia todo acá. Para no esperar los 5 minutos, usá "Simular que pasaron 5 minutos".</li>
      </ol>

      <section className="grid gap-4 md:grid-cols-3">
        <Tarjeta titulo="Sumar un repartidor" ayuda="Entra directo a la cola, como si hubiera iniciado la jornada.">
          <div className="flex flex-wrap gap-2">
            {VEHICULOS.map((v) => (
              <Boton key={v.valor} variante="secundario" onClick={() => void sumarRepartidor(v.valor)}>
                {v.icono} {v.nombre}
              </Boton>
            ))}
          </div>
        </Tarjeta>
        <Tarjeta titulo="Cargar un envío" ayuda="El tamaño define el vehículo mínimo. Se prefiere el más chico que sirva.">
          <div className="flex flex-wrap gap-2">
            {TAMANIOS.map((t) => (
              <Boton key={t.valor} onClick={() => void cargarEnvio(t.valor)} title={`Lo lleva: ${t.quien}`}>
                📦 {t.nombre}
              </Boton>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Chico: moto, auto o camión · Mediano: auto o camión · Grande: camión</p>
        </Tarjeta>
        <Tarjeta titulo="Ofertas sin respuesta" ayuda="Las ofertas vencen a los 5 minutos. Esto las vence ya.">
          <Boton variante="peligro" onClick={() => void vencerOfertas()}>
            ⏩ Simular que pasaron 5 minutos
          </Boton>
        </Tarjeta>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Repartidores</h2>

          <Grupo titulo="En la cola, esperando un viaje" vacio="Nadie en la cola. Sumá un repartidor.">
            {VEHICULOS.map((v) => {
              const cola = enCola.filter((r) => r.vehiculo === v.valor)
              if (cola.length === 0) return null
              return (
                <div key={v.valor} className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-gray-500">Cola de {v.nombre.toLowerCase()}</p>
                  {cola.map((r, i) => (
                    <Fila key={r.id}>
                      <span>
                        <strong>{i + 1}.</strong> {nombreDe(r.id)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {r.viajesConsecutivos > 0 && `${r.viajesConsecutivos} viaje(s) seguido(s)`}
                      </span>
                    </Fila>
                  ))}
                </div>
              )
            })}
          </Grupo>

          <Grupo titulo="Con una oferta, esperando que responda" vacio="Ninguno.">
            {conOferta.map((r) => {
              const { envio, oferta } = ofertaPendienteDe.get(r.id)!
              return (
                <Fila key={r.id} resaltada>
                  <span>
                    {nombreDe(r.id)} → envío #{envio.id}
                  </span>
                  <span className="font-mono font-semibold text-amber-700">⏱ {cuentaRegresiva(oferta.expiraEn, ahora)}</span>
                </Fila>
              )
            })}
          </Grupo>

          <Grupo titulo="En viaje" vacio="Ninguno.">
            {enViaje.map((r) => (
              <Fila key={r.id}>
                <span>{nombreDe(r.id)}</span>
                <span className="text-xs text-gray-500">
                  llevando el envío #{envios.find((e) => e.repartidorId === r.id && e.estado !== 'ENTREGADO')?.id ?? '?'}
                </span>
              </Fila>
            ))}
          </Grupo>

          <Grupo titulo="Fuera de la cola" vacio="Ninguno.">
            {afuera.map((r) => (
              <Fila key={r.id}>
                <span>
                  {nombreDe(r.id)}{' '}
                  <span className="text-xs text-gray-500">
                    ({r.estado === 'EN_PAUSA' ? 'en pausa: no respondió una oferta' : r.estado.toLowerCase().replaceAll('_', ' ')})
                  </span>
                </span>
                <Boton variante="secundario" onClick={() => void volverALaCola(r)}>
                  Volver a la cola
                </Boton>
              </Fila>
            ))}
          </Grupo>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">Envíos</h2>

          <Grupo titulo="Esperando repartidor" vacio="Ninguno.">
            {esperando.map((e) => (
              <Fila key={e.id}>
                <span>
                  📦 #{e.id} · {NOMBRE_TAMANIO[e.tamanio]} → {e.destinoDireccion}
                </span>
                <span className="text-xs text-gray-500">{historial(e) || 'nadie disponible que pueda llevarlo'}</span>
              </Fila>
            ))}
          </Grupo>

          <Grupo titulo="Ofrecidos, esperando respuesta" vacio="Ninguno.">
            {ofrecidos.map((e) => {
              const oferta = e.ofertas.find((o) => o.estado === 'PENDIENTE')!
              return (
                <Fila key={e.id} resaltada>
                  <span>
                    📦 #{e.id} · {NOMBRE_TAMANIO[e.tamanio]} → ofrecido a {nombreDe(oferta.repartidorId)}
                    {historial(e) && <span className="block text-xs text-gray-500">antes: {historial(e)}</span>}
                  </span>
                  <span className="font-mono font-semibold text-amber-700">⏱ {cuentaRegresiva(oferta.expiraEn, ahora)}</span>
                </Fila>
              )
            })}
          </Grupo>

          <Grupo titulo="Asignados" vacio="Ninguno todavía.">
            {asignados.map((e) => (
              <Fila key={e.id}>
                <span>
                  📦 #{e.id} · {NOMBRE_TAMANIO[e.tamanio]} → {e.repartidorId ? nombreDe(e.repartidorId) : '—'}
                </span>
                <span className="text-xs text-gray-500">{e.estado.toLowerCase().replaceAll('_', ' ')}</span>
              </Fila>
            ))}
          </Grupo>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Qué pasó" ayuda="Lo último primero.">
          {sucesos.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía nada. Empezá sumando un repartidor.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {sucesos.map((s, i) => (
                <li key={i}>
                  <span className="font-mono text-xs text-gray-400">{s.hora}</span> {s.texto}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="PINs de tus repartidores de prueba" ayuda="Para entrar en /repartidor/login. Quedan guardados en este navegador.">
          {pins.length === 0 ? (
            <p className="text-sm text-gray-500">
              Los repartidores que sumes aparecen acá con su PIN. El de <code>npm run dev:usuarios</code> tiene el PIN 1234.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {pins.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.nombre}</span>
                  <span className="font-mono font-semibold">{p.pin}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </main>
  )
}

function Tarjeta({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold">{titulo}</h3>
      {ayuda && <p className="text-sm text-gray-500">{ayuda}</p>}
      {children}
    </div>
  )
}

function Grupo({ titulo, vacio, children }: { titulo: string; vacio: string; children: ReactNode[] }) {
  const hayAlgo = children.some(Boolean)
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700">{titulo}</h3>
      {hayAlgo ? children : <p className="text-sm text-gray-400">{vacio}</p>}
    </div>
  )
}

function Fila({ children, resaltada = false }: { children: ReactNode; resaltada?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${resaltada ? 'bg-amber-50' : 'bg-gray-50'}`}
    >
      {children}
    </div>
  )
}
