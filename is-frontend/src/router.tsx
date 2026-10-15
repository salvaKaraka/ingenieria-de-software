import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { LoginOperarioPage } from './features/auth/LoginOperarioPage.tsx'
import { LoginRepartidorPage } from './features/auth/LoginRepartidorPage.tsx'
import { UiDemoPage } from './features/dev/UiDemoPage.tsx'
import { InicioPage } from './features/inicio/InicioPage.tsx'
import { NoEncontradoPage } from './features/inicio/NoEncontradoPage.tsx'
import { ComerciosPage } from './features/operario/comercios/ComerciosPage.tsx'
import { DetalleEnvioPage } from './features/operario/envios/DetalleEnvioPage.tsx'
import { EnviosPage } from './features/operario/envios/EnviosPage.tsx'
import { NuevoEnvioPage } from './features/operario/envios/NuevoEnvioPage.tsx'
import { ExcepcionesPage } from './features/operario/excepciones/ExcepcionesPage.tsx'
import { FlotaPage } from './features/operario/flota/FlotaPage.tsx'
import { RepartidoresPage } from './features/operario/repartidores/RepartidoresPage.tsx'
import { InicioRepartidorPage } from './features/repartidor/jornada/InicioRepartidorPage.tsx'
import { ViajePage } from './features/repartidor/viaje/ViajePage.tsx'
import { BuscarSeguimientoPage } from './features/seguimiento/BuscarSeguimientoPage.tsx'
import { SeguimientoPage } from './features/seguimiento/SeguimientoPage.tsx'
import { OperarioLayout } from './shared/layouts/OperarioLayout.tsx'
import { RepartidorLayout } from './shared/layouts/RepartidorLayout.tsx'

// Todas las rutas de la app. Cada página vive en src/features/<area>/ y la completa la tarea indicada en su archivo.
// Para no generar conflictos, si tu tarea necesita una ruta nueva avisá en el grupo antes de agregarla acá.
const rutas: RouteObject[] = [
  { path: '/', element: <InicioPage /> },

  // Panel del operario
  { path: '/operario/login', element: <LoginOperarioPage /> },
  {
    path: '/operario',
    element: <OperarioLayout />,
    children: [
      { index: true, element: <Navigate to="envios" replace /> },
      { path: 'envios', element: <EnviosPage /> },
      { path: 'envios/nuevo', element: <NuevoEnvioPage /> },
      { path: 'envios/:id', element: <DetalleEnvioPage /> },
      { path: 'comercios', element: <ComerciosPage /> },
      { path: 'repartidores', element: <RepartidoresPage /> },
      { path: 'flota', element: <FlotaPage /> },
      { path: 'excepciones', element: <ExcepcionesPage /> },
    ],
  },

  // Web móvil del repartidor
  { path: '/repartidor/login', element: <LoginRepartidorPage /> },
  {
    path: '/repartidor',
    element: <RepartidorLayout />,
    children: [
      { index: true, element: <InicioRepartidorPage /> },
      { path: 'viaje', element: <ViajePage /> },
    ],
  },

  // Seguimiento público del destinatario
  { path: '/seguimiento', element: <BuscarSeguimientoPage /> },
  { path: '/seguimiento/:codigo', element: <SeguimientoPage /> },

  // Catálogo de componentes, solo en desarrollo
  ...(import.meta.env.DEV ? [{ path: '/dev/ui', element: <UiDemoPage /> }] : []),

  { path: '*', element: <NoEncontradoPage /> },
]

export const router = createBrowserRouter(rutas)
