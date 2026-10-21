import { Link } from 'react-router';
import { OfertaActual } from '../ofertas/OfertaActual.tsx';
import { PanelJornada } from './PanelJornada.tsx';

// Pantalla principal del repartidor. Junta piezas de dos frentes distintos para que no se pisen:
// la jornada (C-4, PanelJornada) y la oferta vigente (D-4, OfertaActual).
export function InicioRepartidorPage() {
  return (
    <div className="p-4 space-y-4">
      <OfertaActual />
      <PanelJornada />

      <div className="pt-2 space-y-2">
        <Link
          to="/repartidor/perfil"
          className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl shadow-sm transition"
        >
          Ver / Editar Mi Perfil
        </Link>

        <Link
          to="/repartidor/historial"
          className="block w-full text-center bg-gray-800 hover:bg-gray-900 text-white font-medium py-2.5 px-4 rounded-xl shadow-sm transition"
        >
          Ver Historial de Envíos
        </Link>
        
        <Link
          to="/repartidor/verificacion"
          className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl shadow-sm transition mt-2"
        >
          Verificación de Entrega (Evidencias)
        </Link>
      </div>
    </div>
  );
}