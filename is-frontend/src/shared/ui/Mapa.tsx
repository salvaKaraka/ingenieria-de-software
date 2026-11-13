import { lazy, Suspense } from 'react'

export interface Coordenadas {
  lat: number
  lon: number
}

export interface PuntoMapa extends Coordenadas {
  etiqueta: string
  color?: 'azul' | 'verde'
}

type Props = {
  puntos: PuntoMapa[]
  // Si viene, el usuario puede tocar el mapa o arrastrar el marcador para elegir el punto.
  alElegir?: (coordenadas: Coordenadas) => void
  alto?: number
}

// Leaflet pesa unos 40 kb: se descarga recién cuando una pantalla muestra un mapa, así la
// página pública de seguimiento y el resto de la app no lo cargan.
const MapaLeaflet = lazy(() => import('./MapaLeaflet.tsx').then((m) => ({ default: m.MapaLeaflet })))

// Mapa reutilizable (HU 70): muestra puntos y, opcionalmente, deja elegir uno.
export function Mapa({ puntos, alElegir, alto = 260 }: Props) {
  return (
    <Suspense fallback={<div style={{ height: alto }} className="w-full animate-pulse rounded-lg bg-gray-200" />}>
      <MapaLeaflet puntos={puntos} alElegir={alElegir} alto={alto} />
    </Suspense>
  )
}
