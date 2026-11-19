import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ErrorApi } from '../../../shared/api'
import { Boton } from '../../../shared/ui/Boton'
import { Campo } from '../../../shared/ui/Campo'
import { Modal } from '../../../shared/ui/Modal'
import { Selector } from '../../../shared/ui/Selector'
import { Tabla } from '../../../shared/ui/Tabla'

interface Comercio {
  id: number
  nombre: string
  telefono: string
  email: string
  direccion: string
  requiereFoto: boolean
  requiereDni: boolean
  activo: boolean
}

interface ResumenDiarioComercio {
  comercioId: number
  comercioNombre: string
  fecha: string
  entregados: number
  devueltos: number
  cancelados: number
}

// Fecha de hoy en Argentina (AAAA-MM-DD) para el selector por defecto del resumen diario (HU 41).
function fechaHoyArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

type FormularioComercio = Omit<Comercio, 'id' | 'activo'>
type ErroresFormulario = Partial<Record<keyof FormularioComercio, string>>

const FORMULARIO_VACIO: FormularioComercio = {
  nombre: '',
  telefono: '',
  email: '',
  direccion: '',
  requiereFoto: false,
  requiereDni: false,
}

export function ComerciosPage() {
  const [comercios, setComercios] = useState<Comercio[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [comercioEditar, setComercioEditar] = useState<Comercio | null>(null)
  const [form, setForm] = useState<FormularioComercio>(FORMULARIO_VACIO)
  const [erroresFormulario, setErroresFormulario] = useState<ErroresFormulario>({})
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)
  const ultimaConsulta = useRef(0)

  // Estado del resumen diario por comercio (HU 41)
  const [comercioResumenId, setComercioResumenId] = useState('')
  const [fechaResumen, setFechaResumen] = useState(fechaHoyArgentina)
  const [resumen, setResumen] = useState<ResumenDiarioComercio | null>(null)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [errorResumen, setErrorResumen] = useState<string | null>(null)

  const cargarComercios = useCallback(async (query = '') => {
    // Mientras se escribe, las respuestas pueden llegar desordenadas: solo vale la última.
    const consulta = ++ultimaConsulta.current
    try {
      const url = query ? `/comercios?q=${encodeURIComponent(query)}` : '/comercios'
      const datos = await api<Comercio[]>(url)
      if (consulta !== ultimaConsulta.current) return
      setComercios(datos)
      setErrorCarga(false)
    } catch {
      if (consulta === ultimaConsulta.current) setErrorCarga(true)
    } finally {
      if (consulta === ultimaConsulta.current) setCargando(false)
    }
  }, [])

  useEffect(() => {
    // Espera a que se deje de escribir para no hacer un request por tecla.
    const espera = setTimeout(() => void cargarComercios(busqueda), 300)
    return () => clearTimeout(espera)
  }, [busqueda, cargarComercios])

  const abrirModalCrear = () => {
    setComercioEditar(null)
    setForm({ ...FORMULARIO_VACIO })
    setErroresFormulario({})
    setErrorGlobal(null)
    setMensajeExito(null)
    setModalAbierto(true)
  }

  const abrirModalEditar = (comercio: Comercio) => {
    setComercioEditar(comercio)
    setForm({
      nombre: comercio.nombre,
      telefono: comercio.telefono,
      email: comercio.email,
      direccion: comercio.direccion,
      requiereFoto: comercio.requiereFoto,
      requiereDni: comercio.requiereDni,
    })
    setErroresFormulario({})
    setErrorGlobal(null)
    setMensajeExito(null)
    setModalAbierto(true)
  }

  const guardarComercio = async (evento: FormEvent) => {
    evento.preventDefault()
    setErroresFormulario({})
    setErrorGlobal(null)
    setMensajeExito(null)

    try {
      if (comercioEditar) {
        await api(`/comercios/${comercioEditar.id}`, {
          metodo: 'PATCH',
          datos: form,
        })
        setMensajeExito('Comercio actualizado exitosamente')
      } else {
        await api('/comercios', {
          metodo: 'POST',
          datos: form,
        })
        setMensajeExito('Comercio registrado exitosamente')
      }
      setModalAbierto(false)
      await cargarComercios(busqueda)
    } catch (err) {
      if (err instanceof ErrorApi) {
        const errores: ErroresFormulario = {}
        const mensajesGenerales: string[] = []

        for (const mensaje of err.mensajes) {
          const mensajeNormalizado = mensaje.toLocaleLowerCase()
          const campo =
            mensajeNormalizado.includes('nombre') ? 'nombre' :
            mensajeNormalizado.includes('teléfono') || mensajeNormalizado.includes('telefono') ? 'telefono' :
            mensajeNormalizado.includes('email') || mensajeNormalizado.includes('correo') ? 'email' :
            mensajeNormalizado.includes('dirección') || mensajeNormalizado.includes('direccion') ? 'direccion' :
            undefined

          if (campo) {
            errores[campo] = errores[campo] ? `${errores[campo]} ${mensaje}` : mensaje
          } else {
            mensajesGenerales.push(mensaje)
          }
        }

        setErroresFormulario(errores)
        setErrorGlobal(mensajesGenerales.length > 0 ? mensajesGenerales.join(', ') : null)
      } else {
        setErrorGlobal('Ocurrió un error inesperado al guardar')
      }
    }
  }

  const darDeBaja = async (id: number) => {
    if (!confirm('¿Confirmás que querés dar de baja este comercio?')) return

    try {
      await api(`/comercios/${id}`, { metodo: 'DELETE' })
      await cargarComercios(busqueda)
    } catch (err) {
      // El 409 explica por qué no se puede (por ejemplo, que tiene envíos en curso).
      alert(err instanceof ErrorApi && err.status === 409 ? err.message : 'Error al dar de baja el comercio')
    }
  }

  const generarResumen = async (evento: FormEvent) => {
    evento.preventDefault()
    if (!comercioResumenId) {
      setErrorResumen('Seleccioná un comercio')
      return
    }
    if (!fechaResumen) {
      setErrorResumen('Seleccioná una fecha')
      return
    }

    setErrorResumen(null)
    setCargandoResumen(true)
    try {
      const datos = await api<ResumenDiarioComercio>(
        `/comercios/${comercioResumenId}/resumen?fecha=${encodeURIComponent(fechaResumen)}`,
      )
      setResumen(datos)
    } catch (err) {
      setResumen(null)
      setErrorResumen(
        err instanceof ErrorApi ? err.message : 'No se pudo generar el resumen diario',
      )
    } finally {
      setCargandoResumen(false)
    }
  }

  const columnasTabla = [
    { titulo: 'Nombre', celda: (comercio: Comercio) => <span className="font-bold text-slate-800">{comercio.nombre}</span> },
    { titulo: 'Dirección', celda: (comercio: Comercio) => <span className="text-slate-600">{comercio.direccion}</span> },
    {
      titulo: 'Contacto',
      celda: (comercio: Comercio) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800">{comercio.telefono}</span>
          <span className="text-sm text-blue-700">{comercio.email}</span>
        </div>
      ),
    },
    {
      titulo: 'Evidencia',
      celda: (comercio: Comercio) => (
        <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
          {comercio.requiereFoto && comercio.requiereDni && 'Foto + DNI'}
          {comercio.requiereFoto && !comercio.requiereDni && 'Foto'}
          {!comercio.requiereFoto && comercio.requiereDni && 'DNI'}
          {!comercio.requiereFoto && !comercio.requiereDni && 'Ninguna'}
        </span>
      ),
    },
    {
      titulo: 'Estado',
      celda: (comercio: Comercio) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-sm ${comercio.activo ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {comercio.activo ? '● Activo' : '● Inactivo'}
        </span>
      ),
    },
    {
      titulo: 'Acciones',
      celda: (comercio: Comercio) => (
        <div className="flex gap-2">
          <div className="transform transition hover:scale-105">
            <Boton variante="secundario" onClick={() => abrirModalEditar(comercio)}>
              Editar
            </Boton>
          </div>
          {comercio.activo && (
            <div className="transform transition hover:scale-105">
              <Boton variante="peligro" onClick={() => darDeBaja(comercio.id)}>
                Dar de Baja
              </Boton>
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen space-y-6 bg-slate-100 p-6">
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-800 via-blue-800 to-blue-700 p-8 shadow-lg md:flex-row">
        <div className="text-white">
          <h1 className="text-3xl font-extrabold tracking-tight">Comercios Adheridos</h1>
          <p className="mt-1 text-blue-100">Administrá las reglas de entrega y datos de contacto.</p>
        </div>
        <div className="rounded-lg shadow-xl transition hover:scale-105">
          <Boton onClick={abrirModalCrear} className="border-none bg-amber-400 font-bold text-slate-900 hover:bg-amber-300">
            + Nuevo Comercio
          </Boton>
        </div>
      </div>

      <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-full md:w-1/2">
          <Campo
            etiqueta=""
            placeholder="Buscar comercio por nombre..."
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            className="rounded-lg border-blue-200 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {mensajeExito && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {mensajeExito}
        </p>
      )}

      {errorCarga && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          No se pudieron cargar los comercios. Probá de nuevo en unos segundos.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <Tabla
          columnas={columnasTabla}
          filas={comercios}
          claveFila={(comercio) => comercio.id}
          mensajeVacio={cargando ? 'Cargando comercios...' : 'No se encontraron comercios.'}
        />
      </div>

      {/* HU 41: Resumen diario por comercio */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Resumen diario por comercio</h2>
          <p className="text-sm text-slate-600">
            Consultá la cantidad de envíos entregados, devueltos y cancelados en una fecha para rendir cuentas al comercio.
          </p>
        </div>

        <form onSubmit={generarResumen} className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
          <Selector
            etiqueta="Comercio"
            value={comercioResumenId}
            onChange={(evento) => {
              setComercioResumenId(evento.target.value)
              setErrorResumen(null)
            }}
            opciones={[
              { valor: '', etiqueta: 'Seleccionar comercio...' },
              ...comercios.map((comercio) => ({
                valor: String(comercio.id),
                etiqueta: comercio.nombre,
              })),
            ]}
          />

          <Campo
            etiqueta="Fecha"
            type="date"
            value={fechaResumen}
            onChange={(evento) => {
              setFechaResumen(evento.target.value)
              setErrorResumen(null)
            }}
          />

          <div>
            <Boton type="submit" disabled={cargandoResumen}>
              {cargandoResumen ? 'Generando...' : 'Generar resumen'}
            </Boton>
          </div>
        </form>

        {errorResumen && (
          <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {errorResumen}
          </p>
        )}

        {resumen && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Resumen de <span className="text-slate-900">{resumen.comercioNombre}</span> ({resumen.fecha})
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-600">Entregados</p>
                <p className="mt-1 text-3xl font-bold text-emerald-700">{resumen.entregados}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-600">Devueltos</p>
                <p className="mt-1 text-3xl font-bold text-amber-700">{resumen.devueltos}</p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-600">Cancelados</p>
                <p className="mt-1 text-3xl font-bold text-rose-700">{resumen.cancelados}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={comercioEditar ? 'Editar Comercio' : 'Nuevo Comercio'}
      >
        <form onSubmit={guardarComercio} className="space-y-5 p-2">
          {errorGlobal && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 shadow-sm">
              {errorGlobal}
            </div>
          )}

          <Campo
            etiqueta="Nombre Comercial *"
            value={form.nombre}
            error={erroresFormulario.nombre}
            onChange={(evento) => {
              setForm({ ...form, nombre: evento.target.value })
              setErroresFormulario({ ...erroresFormulario, nombre: undefined })
            }}
            required
          />
          <Campo
            etiqueta="Dirección de Origen *"
            value={form.direccion}
            error={erroresFormulario.direccion}
            onChange={(evento) => {
              setForm({ ...form, direccion: evento.target.value })
              setErroresFormulario({ ...erroresFormulario, direccion: undefined })
            }}
            required
          />
          <Campo
            etiqueta="Teléfono *"
            value={form.telefono}
            error={erroresFormulario.telefono}
            onChange={(evento) => {
              setForm({ ...form, telefono: evento.target.value })
              setErroresFormulario({ ...erroresFormulario, telefono: undefined })
            }}
            required
          />
          <Campo
            etiqueta="Email *"
            type="email"
            value={form.email}
            error={erroresFormulario.email}
            onChange={(evento) => {
              setForm({ ...form, email: evento.target.value })
              setErroresFormulario({ ...erroresFormulario, email: undefined })
            }}
            required
          />

          <div className="mt-4 space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <label className="block text-sm font-bold text-slate-800">
              Exigencias de Evidencia por Defecto:
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700 transition hover:text-blue-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={form.requiereFoto}
                onChange={(evento) => setForm({ ...form, requiereFoto: evento.target.checked })}
              />
              <span className="font-medium">Exigir Fotografía de Entrega</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700 transition hover:text-blue-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={form.requiereDni}
                onChange={(evento) => setForm({ ...form, requiereDni: evento.target.checked })}
              />
              <span className="font-medium">Exigir DNI / Identificación del Destinatario</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <div className="transform transition hover:scale-105">
              <Boton type="submit" className="bg-blue-700 font-bold text-white hover:bg-blue-800">
                Guardar Comercio
              </Boton>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}