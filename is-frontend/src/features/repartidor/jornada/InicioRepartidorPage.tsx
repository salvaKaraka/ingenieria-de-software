import { useLocation } from 'react-router'
import { OfertaActual } from '../ofertas/OfertaActual.tsx'
import { PanelJornada } from './PanelJornada.tsx'

// Pantalla principal del repartidor. Junta piezas de dos frentes distintos para que no se pisen:
// la jornada (C-4, PanelJornada) y la oferta vigente (D-4, OfertaActual).
export function InicioRepartidorPage() {
  // La pantalla del viaje (E-3) deja acá la confirmación de la entrega al volver.
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso

  return (
    <>
      {aviso && <p className="rounded-xl bg-green-800 p-4 text-center font-semibold">{aviso}</p>}
      <OfertaActual />
      <PanelJornada />
    </>
  )
}
