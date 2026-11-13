import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordenadas, PuntoMapa } from './Mapa.tsx'

// Centro de La Plata: donde arranca el mapa si todavía no hay ningún punto.
const CENTRO_INICIAL: L.LatLngTuple = [-34.9214, -57.9545]
const ZOOM_CIUDAD = 13
const ZOOM_CASA = 16

const COLORES: Record<NonNullable<PuntoMapa['color']>, string> = {
  azul: '#2563eb',
  verde: '#16a34a',
}

// Marcador dibujado con HTML: el ícono de imagen que trae Leaflet se rompe al empaquetarlo con Vite.
function icono(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

type Props = {
  puntos: PuntoMapa[]
  alElegir?: (coordenadas: Coordenadas) => void
  alto: number
}

// Implementación con Leaflet. No se importa directo: se usa a través de <Mapa>, que la carga
// solo en las pantallas que la necesitan.
export function MapaLeaflet({ puntos, alElegir, alto }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capa = useRef<L.LayerGroup | null>(null)
  // En un ref para no tener que recrear el mapa cada vez que cambia la función.
  const alElegirRef = useRef(alElegir)
  useEffect(() => {
    alElegirRef.current = alElegir
  })
  // El último punto que marcó el operario con un toque: el mapa no se recentra en ese caso,
  // así no "salta" mientras ajusta el punto.
  const elegidoAMano = useRef<string | null>(null)

  // Crear el mapa una sola vez (el polling del repartidor vuelve a renderizar cada 10 s).
  useEffect(() => {
    if (!contenedor.current) return
    const nuevo = L.map(contenedor.current).setView(CENTRO_INICIAL, ZOOM_CIUDAD)
    // Mapa de OpenStreetMap: gratis, pero su licencia pide mostrar la atribución.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(nuevo)
    nuevo.on('click', (evento: L.LeafletMouseEvent) => {
      if (!alElegirRef.current) return
      const elegido = { lat: evento.latlng.lat, lon: evento.latlng.lng }
      elegidoAMano.current = clave([elegido])
      alElegirRef.current(elegido)
    })
    capa.current = L.layerGroup().addTo(nuevo)
    mapa.current = nuevo
    return () => {
      nuevo.remove()
      mapa.current = null
    }
  }, [])

  // Los puntos llegan como array nuevo en cada render: se compara por su contenido.
  const puntosClave = clave(puntos)
  const puedeElegir = alElegir !== undefined

  useEffect(() => {
    const actual = mapa.current
    if (!actual || !capa.current) return
    capa.current.clearLayers()

    for (const punto of puntos) {
      const marcador = L.marker([punto.lat, punto.lon], {
        icon: icono(COLORES[punto.color ?? 'azul']),
        draggable: puedeElegir,
        title: punto.etiqueta,
      })
      if (punto.etiqueta) marcador.bindTooltip(punto.etiqueta)
      marcador.on('dragend', () => {
        const { lat, lng } = marcador.getLatLng()
        const elegido = { lat, lon: lng }
        elegidoAMano.current = clave([elegido])
        alElegirRef.current?.(elegido)
      })
      capa.current.addLayer(marcador)
    }

    if (puntosClave === elegidoAMano.current) return
    if (puntos.length === 1) actual.setView([puntos[0].lat, puntos[0].lon], ZOOM_CASA)
    else if (puntos.length > 1)
      actual.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lon])), { padding: [30, 30] })
    // Depende de puntosClave y no de `puntos`: es la misma información sin el array nuevo de cada render.
  }, [puntosClave, puedeElegir]) // oxlint-disable-line react-hooks/exhaustive-deps

  return (
    // isolate: las capas de Leaflet usan z-index altos y si no se taparían los modales.
    <div
      ref={contenedor}
      style={{ height: alto }}
      className={`isolate w-full rounded-lg border border-gray-300 ${puedeElegir ? 'cursor-crosshair' : ''}`}
    />
  )
}

function clave(puntos: Coordenadas[]) {
  return puntos.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join(';')
}
