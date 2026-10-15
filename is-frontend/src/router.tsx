import { createBrowserRouter } from 'react-router'
import { InicioPage } from './features/inicio/InicioPage.tsx'
import { OperarioPage } from './features/operario/OperarioPage.tsx'
import { RepartidorPage } from './features/repartidor/RepartidorPage.tsx'
import { SeguimientoPage } from './features/seguimiento/SeguimientoPage.tsx'

// Una sola app con tres áreas. Cada área vive en src/features/<area>/ con sus propias páginas y componentes.
export const router = createBrowserRouter([
  { path: '/', element: <InicioPage /> },
  { path: '/operario/*', element: <OperarioPage /> },     // panel web del operario
  { path: '/repartidor/*', element: <RepartidorPage /> }, // web móvil del repartidor
  { path: '/seguimiento/:codigo', element: <SeguimientoPage /> }, // pantalla pública del destinatario
])
