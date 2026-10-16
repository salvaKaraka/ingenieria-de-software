import { useEffect } from 'react'

// Ejecuta `consultar` apenas se monta el componente y después cada `cadaMs` milisegundos,
// mientras esté en pantalla. Es la forma de mantener datos actualizados en toda la app
// (10 s en la app del repartidor, 15 s en el panel del operario).
// `consultar` tiene que ser estable: envolvela en useCallback.
//
//   const cargar = useCallback(async () => setEnvios(await api<Envio[]>('/envios')), [])
//   usePolling(cargar, 15_000)
export function usePolling(consultar: () => Promise<unknown>, cadaMs: number) {
  useEffect(() => {
    const ejecutar = () => {
      // Los errores (ej: sin señal) se ignoran: se reintenta en la próxima vuelta.
      consultar().catch(() => undefined)
    }
    ejecutar()
    const intervalo = setInterval(ejecutar, cadaMs)
    return () => clearInterval(intervalo)
  }, [consultar, cadaMs])
}
