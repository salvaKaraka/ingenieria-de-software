import { useState } from 'react'
import { OfertaActual } from '../ofertas/OfertaActual.tsx'
import { ViajeActual } from '../viaje/ViajeActual.tsx'
import { PanelJornada } from './PanelJornada.tsx'

// Pantalla principal del repartidor: todo en una sola pantalla, para no tener que navegar en la calle.
// Junta piezas de frentes distintos para que no se pisen: la oferta vigente (D-4),
// el viaje activo (E-3) y la jornada (C-4).
export function InicioRepartidorPage() {
  // Aceptar una oferta o entregar cambia lo que muestran las tres piezas: en vez de esperar
  // al próximo polling, se vuelven a montar (cambia la key) y consultan al instante.
  const [vuelta, setVuelta] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)

  function refrescar(nuevoAviso: string | null = null) {
    setAviso(nuevoAviso)
    setVuelta((v) => v + 1)
  }

  return (
    <>
      {aviso && <p className="rounded-xl bg-green-800 p-4 text-center font-semibold">{aviso}</p>}
      <OfertaActual key={`oferta-${vuelta}`} alAceptar={() => refrescar()} />
      <ViajeActual
        key={`viaje-${vuelta}`}
        alEntregar={() => refrescar('¡Entrega registrada! Ya estás de nuevo en la cola.')}
      />
      <PanelJornada key={`jornada-${vuelta}`} />
    </>
  )
}
