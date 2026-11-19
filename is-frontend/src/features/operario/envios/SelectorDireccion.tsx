import { useEffect, useRef, useState } from 'react'
import { api, ErrorApi } from '../../../shared/api'
import { Boton, Campo, Mapa, type Coordenadas } from '../../../shared/ui/index.ts'

// Lo que devuelve GET /api/mapas/buscar.
type LugarEncontrado = Coordenadas & { exacta: boolean }

type Estado = 'sin-buscar' | 'buscando' | 'exacta' | 'aproximada' | 'no-encontrada' | 'sin-mapa' | 'a-mano'

const MENSAJES: Record<Estado, { texto: string; clases: string } | null> = {
  'sin-buscar': null,
  buscando: { texto: 'Buscando la dirección en el mapa…', clases: 'text-gray-600' },
  exacta: {
    texto: 'Revisá que el punto esté en la casa correcta. Si no, tocá el mapa donde va.',
    clases: 'text-gray-600',
  },
  aproximada: {
    texto: 'No encontramos la altura: el punto es aproximado. Tocá el mapa para marcar la casa.',
    clases: 'text-amber-700',
  },
  'no-encontrada': {
    texto: 'No encontramos la dirección en el mapa. Revisala o marcá el punto tocando el mapa.',
    clases: 'text-amber-700',
  },
  'sin-mapa': {
    texto: 'El mapa no está disponible ahora. Podés cargar el envío igual.',
    clases: 'text-amber-700',
  },
  'a-mano': { texto: 'Punto marcado en el mapa.', clases: 'text-green-700' },
}

type ResultadoBusqueda = { ubicacion: Coordenadas | null; estado: Estado }

async function buscarEnMapa(texto: string): Promise<ResultadoBusqueda> {
  try {
    const lugar = await api<LugarEncontrado>(`/mapas/buscar?direccion=${encodeURIComponent(texto)}`)
    return { ubicacion: { lat: lugar.lat, lon: lugar.lon }, estado: lugar.exacta ? 'exacta' : 'aproximada' }
  } catch (error) {
    return {
      ubicacion: null,
      estado: error instanceof ErrorApi && error.status === 404 ? 'no-encontrada' : 'sin-mapa',
    }
  }
}

type Props = {
  etiqueta: string
  placeholder?: string
  direccion: string
  alCambiarDireccion: (direccion: string) => void
  ubicacion: Coordenadas | null
  alCambiarUbicacion: (ubicacion: Coordenadas | null) => void
  required?: boolean
  // Buscar sola la dirección que llega escrita si todavía no tiene punto (la del comercio al
  // elegirlo). Al editar un envío no: abrir y cerrar sin tocar nada no tiene que cambiarlo.
  buscarAlMontar?: boolean
}

// Campo de dirección con mapa (HU 70): el operario escribe la dirección, ve dónde cae y, si
// el punto no es el correcto, lo corrige tocando el mapa. El punto es opcional: si el mapa no
// encuentra la dirección, el envío se carga igual.
export function SelectorDireccion({
  etiqueta,
  placeholder,
  direccion,
  alCambiarDireccion,
  ubicacion,
  alCambiarUbicacion,
  required,
  buscarAlMontar: buscarAlMontarProp = true,
}: Props) {
  // Una dirección que llega ya escrita (la del comercio al elegirlo) se busca sola al montar.
  const buscarAlMontar = buscarAlMontarProp && !ubicacion && direccion.trim() !== ''
  const [estado, setEstado] = useState<Estado>(ubicacion ? 'a-mano' : buscarAlMontar ? 'buscando' : 'sin-buscar')
  // La última dirección buscada: salir del campo sin cambiarla no vuelve a consultar el mapa.
  const ultimaBuscada = useRef<string | null>(ubicacion ? direccion.trim() : null)

  function mostrar(resultado: ResultadoBusqueda) {
    alCambiarUbicacion(resultado.ubicacion)
    setEstado(resultado.estado)
  }

  function buscar() {
    const texto = direccion.trim()
    if (!texto || texto === ultimaBuscada.current) return
    ultimaBuscada.current = texto
    setEstado('buscando')
    void buscarEnMapa(texto).then(mostrar)
  }

  useEffect(() => {
    if (!buscarAlMontar) return
    ultimaBuscada.current = direccion.trim()
    void buscarEnMapa(direccion.trim()).then(mostrar)
    // Solo al montar: después se busca al salir del campo o con el botón.
  }, []) // oxlint-disable-line react-hooks/exhaustive-deps

  function cambiarDireccion(nueva: string) {
    alCambiarDireccion(nueva)
    // El punto era de la dirección anterior: se vuelve a buscar al salir del campo.
    if (ubicacion) alCambiarUbicacion(null)
    ultimaBuscada.current = null
    setEstado('sin-buscar')
  }

  function elegirEnMapa(punto: Coordenadas) {
    alCambiarUbicacion(punto)
    setEstado('a-mano')
  }

  const mensaje = MENSAJES[estado]

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Campo
            etiqueta={etiqueta}
            placeholder={placeholder}
            value={direccion}
            onChange={(evento) => cambiarDireccion(evento.target.value)}
            onBlur={buscar}
            required={required}
          />
        </div>
        <Boton variante="secundario" onClick={buscar} disabled={!direccion.trim() || estado === 'buscando'}>
          Buscar en el mapa
        </Boton>
      </div>
      <Mapa
        puntos={ubicacion ? [{ ...ubicacion, etiqueta: direccion }] : []}
        alElegir={elegirEnMapa}
        alto={240}
      />
      {mensaje && <p className={`text-sm ${mensaje.clases}`}>{mensaje.texto}</p>}
    </div>
  )
}
