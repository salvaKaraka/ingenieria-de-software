import { useCallback, useMemo, useState } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import { ETIQUETA_VEHICULO } from '../../../shared/tipos.ts'
import { Boton, Campo, Tabla, type Columna } from '../../../shared/ui/index.ts'
import { usePolling } from '../../../shared/usePolling.ts'
import { AprobarCierreModal } from './AprobarCierreModal.tsx'
import { BajaRepartidorModal } from './BajaRepartidorModal.tsx'
import { FormularioRepartidorModal } from './FormularioRepartidorModal.tsx'
import { PinGeneradoModal } from './PinGeneradoModal.tsx'
import {
  COLOR_ESTADO_REPARTIDOR,
  ETIQUETA_ESTADO_REPARTIDOR,
  type Repartidor,
} from './tipos.ts'

export function RepartidoresPage() {
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Modales
  const [modalFormularioAbierto, setModalFormularioAbierto] = useState(false)
  const [modalBajaAbierto, setModalBajaAbierto] = useState(false)
  const [repartidorParaCierre, setRepartidorParaCierre] = useState<Repartidor | null>(null)
  const [repartidorSeleccionado, setRepartidorSeleccionado] =
    useState<Repartidor | null>(null)

  // PIN generado de visualización única (al alta o reseteo)
  const [pinGenerado, setPinGenerado] = useState<{
    pin: string
    nombre: string
  } | null>(null)

  const cargar = useCallback(async () => {
    try {
      const datos = await api<Repartidor[]>('/repartidores')
      setRepartidores(datos)
      setErrorCarga(null)
    } catch (err) {
      if (err instanceof ErrorApi) {
        setErrorCarga(err.mensajes[0] || 'Error al cargar repartidores.')
      } else {
        setErrorCarga('No se pudo conectar con el servidor.')
      }
    } finally {
      setCargando(false)
    }
  }, [])

  // Polling de 15 segundos para el panel del operario (AGENTS.md)
  usePolling(cargar, 15_000)

  function abrirNuevo() {
    setRepartidorSeleccionado(null)
    setModalFormularioAbierto(true)
  }

  function abrirEdicion(repartidor: Repartidor) {
    setRepartidorSeleccionado(repartidor)
    setModalFormularioAbierto(true)
  }

  function abrirBaja(repartidor: Repartidor) {
    setRepartidorSeleccionado(repartidor)
    setModalBajaAbierto(true)
  }

  async function handleResetearPin(repartidor: Repartidor) {
    const confirmado = window.confirm(
      `¿Confirmás el reseteo de PIN para ${repartidor.nombre} ${repartidor.apellido}? Se revocarán todas sus sesiones activas.`,
    )
    if (!confirmado) return

    try {
      const res = await api<{ pin: string }>(
        `/repartidores/${repartidor.id}/resetear-pin`,
        { metodo: 'POST' },
      )
      setPinGenerado({
        pin: res.pin,
        nombre: `${repartidor.nombre} ${repartidor.apellido}`,
      })
    } catch (err) {
      if (err instanceof ErrorApi) {
        alert(err.mensajes[0] || 'Error al resetear el PIN.')
      } else {
        alert('Ocurrió un error inesperado al resetear el PIN.')
      }
    }
  }

  function handleGuardado(pinNuevo?: string) {
    cargar()
    if (pinNuevo) {
      setPinGenerado({
        pin: pinNuevo,
        nombre: repartidorSeleccionado
          ? `${repartidorSeleccionado.nombre} ${repartidorSeleccionado.apellido}`
          : 'el nuevo repartidor',
      })
    }
  }

  const repartidoresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return repartidores

    return repartidores.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        r.apellido.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.telefono.toLowerCase().includes(q) ||
        r.direccion.toLowerCase().includes(q) ||
        ETIQUETA_VEHICULO[r.vehiculo].toLowerCase().includes(q) ||
        ETIQUETA_ESTADO_REPARTIDOR[r.estado].toLowerCase().includes(q),
    )
  }, [repartidores, busqueda])

  const columnas: Columna<Repartidor>[] = [
    {
      titulo: 'Repartidor',
      celda: (r) => (
        <div>
          <p className="font-semibold text-gray-900">
            {r.nombre} {r.apellido}
          </p>
          <p className="text-xs text-gray-500">{r.email}</p>
        </div>
      ),
    },
    {
      titulo: 'Teléfono',
      celda: (r) => <span className="text-gray-700">{r.telefono}</span>,
    },
    {
      titulo: 'Dirección',
      celda: (r) => (
        <span className="text-xs text-gray-600 truncate block max-w-xs">
          {r.direccion}
        </span>
      ),
    },
    {
      titulo: 'Vehículo',
      celda: (r) => (
        <span className="inline-block rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">
          {ETIQUETA_VEHICULO[r.vehiculo]}
        </span>
      ),
    },
    {
      titulo: 'Estado',
      celda: (r) => (
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_ESTADO_REPARTIDOR[r.estado]}`}
        >
          {ETIQUETA_ESTADO_REPARTIDOR[r.estado]}
        </span>
      ),
    },
    {
      titulo: 'Activo',
      celda: (r) => (
        <span
          className={`text-xs font-semibold ${
            r.activo ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          {r.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      titulo: 'Acciones',
      celda: (r) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => abrirEdicion(r)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            Editar
          </button>
          {r.activo && (
            <>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => handleResetearPin(r)}
                className="text-xs font-medium text-amber-600 hover:text-amber-800 hover:underline"
              >
                Resetear PIN
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => abrirBaja(r)}
                className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline"
              >
                Dar de baja
              </button>
              {r.estado !== 'FUERA_DE_JORNADA' && (
                <>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setRepartidorParaCierre(r)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Aprobar cierre
                  </button>
                </>
              )}
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestión de Repartidores
          </h1>
          <p className="text-sm text-gray-600">
            Administración de choferes, vehículos y credenciales de acceso.
          </p>
        </div>
        <Boton onClick={abrirNuevo}>+ Nuevo repartidor</Boton>
      </div>

      {errorCarga && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorCarga}
        </div>
      )}

      {/* Buscador */}
      <div className="w-full sm:max-w-xs">
        <Campo
          etiqueta="Buscar"
          type="search"
          placeholder="Filtrar por nombre, teléfono, email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla con estados */}
      {cargando && repartidores.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Cargando repartidores...
        </div>
      ) : (
        <Tabla
          columnas={columnas}
          filas={repartidoresFiltrados}
          claveFila={(r) => r.id}
          mensajeVacio={
            busqueda
              ? 'No se encontraron repartidores con ese criterio de búsqueda.'
              : 'No hay repartidores registrados en el sistema.'
          }
        />
      )}

      {/* Modal de Formulario (Alta / Edición) */}
      <FormularioRepartidorModal
        abierto={modalFormularioAbierto}
        onCerrar={() => setModalFormularioAbierto(false)}
        onGuardado={handleGuardado}
        repartidorAEditar={repartidorSeleccionado}
      />

      {/* Modal de Confirmación de Baja */}
      <BajaRepartidorModal
        abierto={modalBajaAbierto}
        onCerrar={() => setModalBajaAbierto(false)}
        onConfirmado={cargar}
        repartidor={repartidorSeleccionado}
      />

      {/* Modal de PIN de un solo uso */}
      <PinGeneradoModal
        abierto={Boolean(pinGenerado)}
        onCerrar={() => setPinGenerado(null)}
        pin={pinGenerado?.pin ?? null}
        nombreRepartidor={pinGenerado?.nombre ?? 'Repartidor'}
      />

      {/* Modal de Aprobación de Cierre de Turno */}
      <AprobarCierreModal
        abierto={repartidorParaCierre !== null}
        onCerrar={() => setRepartidorParaCierre(null)}
        onAprobado={cargar}
        repartidor={repartidorParaCierre}
      />
    </div>
  )
}
