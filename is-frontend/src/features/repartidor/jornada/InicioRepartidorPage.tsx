import { OfertaActual } from '../ofertas/OfertaActual.tsx'
import { PanelJornada } from './PanelJornada.tsx'

// Pantalla principal del repartidor. Junta piezas de dos frentes distintos para que no se pisen:
// la jornada (C-4, PanelJornada) y la oferta vigente (D-4, OfertaActual).
export function InicioRepartidorPage() {
  return (
    <>
      <OfertaActual />
      <PanelJornada />
    </>
  )
}
