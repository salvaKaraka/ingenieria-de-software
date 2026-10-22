import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, ErrorApi } from '../../../shared/api'
import { Boton } from '../../../shared/ui/Boton'
import { Campo } from '../../../shared/ui/Campo'

interface Comercio {
  id: number
  nombre: string
  direccion: string
  activo: boolean
}

interface FormularioEnvio {
  comercioId: string
  destinoDireccion: string
  destinatarioNombre: string
  destinatarioApellido: string
  destinatarioTelefono: string
  destinatarioDni: string
  tamanio: 'CHICO' | 'MEDIANO' | 'GRANDE'
  observaciones: string
}

const FORMULARIO_VACIO: FormularioEnvio = {
  comercioId: '',
  destinoDireccion: '',
  destinatarioNombre: '',
  destinatarioApellido: '',
  destinatarioTelefono: '',
  destinatarioDni: '',
  tamanio: 'CHICO',
  observaciones: '',
}

export function NuevoEnvioPage() {
  const navigate = useNavigate()
  const [comercios, setComercios] = useState<Comercio[]>([])
  const [cargandoComercios, setCargandoComercios] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState<FormularioEnvio>(FORMULARIO_VACIO)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)
  const [codigoExito, setCodigoExito] = useState<string | null>(null)

  useEffect(() => {
    const cargarComercios = async () => {
      try {
        setCargandoComercios(true)
        const datos = await api<Comercio[]>('/comercios')
        setComercios(Array.isArray(datos) ? datos.filter((comercio) => comercio.activo) : [])
      } catch (error) {
        console.error('Error al cargar comercios:', error)
        setErrorGlobal('No se pudieron cargar los comercios adheridos.')
      } finally {
        setCargandoComercios(false)
      }
    }

    cargarComercios()
  }, [])

  const guardarEnvio = async (evento: FormEvent) => {
    evento.preventDefault()
    setGuardando(true)
    setErrorGlobal(null)

    if (!form.comercioId) {
      setErrorGlobal('Debés seleccionar un comercio de origen.')
      setGuardando(false)
      return
    }

    try {
      const respuesta = await api<{ codigoSeguimiento: string }>('/envios', {
        metodo: 'POST',
        datos: {
          comercioId: Number(form.comercioId),
          destinoDireccion: form.destinoDireccion,
          destinatarioNombre: form.destinatarioNombre,
          destinatarioApellido: form.destinatarioApellido,
          destinatarioTelefono: form.destinatarioTelefono,
          destinatarioDni: form.destinatarioDni || undefined,
          tamanio: form.tamanio,
          observaciones: form.observaciones || undefined,
        },
      })

      setCodigoExito(respuesta.codigoSeguimiento)
    } catch (error) {
      setErrorGlobal(
        error instanceof ErrorApi
          ? error.mensajes.join(', ')
          : 'Ocurrió un error inesperado al registrar el envío.',
      )
    } finally {
      setGuardando(false)
    }
  }

  if (codigoExito) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-lg border border-green-200 bg-white p-6 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-slate-800">Pedido guardado</h1>
          <p className="mb-5 text-slate-600">El pedido se registró correctamente.</p>
          <div className="mb-5 rounded-md bg-green-50 p-4">
            <p className="mb-1 text-sm text-slate-600">Código de seguimiento</p>
            <p className="font-mono text-2xl font-bold text-green-700">{codigoExito}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Boton
              onClick={() => {
                setForm(FORMULARIO_VACIO)
                setCodigoExito(null)
              }}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Cargar otro pedido
            </Boton>
            <Boton variante="secundario" onClick={() => navigate('/operario/envios')}>
              Volver a pedidos
            </Boton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 rounded-xl bg-slate-50 p-4 sm:p-6">
      <div className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">Nuevo pedido</h1>
          <p className="mt-1 text-sm text-blue-800">Completá los datos para registrar el pedido.</p>
        </div>
        <Boton variante="secundario" onClick={() => navigate('/operario/envios')}>
          Volver
        </Boton>
      </div>

      <form onSubmit={guardarEnvio} className="space-y-5">
        {errorGlobal && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorGlobal}
          </div>
        )}

        <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <section>
            <h2 className="mb-4 rounded-md border-l-4 border-blue-400 bg-blue-50 px-3 py-2 text-base font-semibold text-blue-900">
              Comercio
            </h2>
            <label className="block text-sm font-medium text-slate-700">
              ¿De qué comercio sale el pedido? *
            </label>
            <select
              value={form.comercioId}
              onChange={(evento) => setForm({ ...form, comercioId: evento.target.value })}
              required
              disabled={cargandoComercios}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">
                {cargandoComercios ? 'Cargando comercios...' : 'Seleccioná un comercio...'}
              </option>
              {comercios.map((comercio) => (
                <option key={comercio.id} value={comercio.id}>
                  {comercio.nombre} ({comercio.direccion})
                </option>
              ))}
            </select>
          </section>

          <section>
            <h2 className="mb-4 rounded-md border-l-4 border-blue-400 bg-blue-50 px-3 py-2 text-base font-semibold text-blue-900">
              Datos de entrega
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Campo
                  etiqueta="Dirección *"
                  placeholder="Calle, número, piso o departamento"
                  value={form.destinoDireccion}
                  onChange={(evento) => setForm({ ...form, destinoDireccion: evento.target.value })}
                  required
                />
              </div>
              <Campo
                etiqueta="Nombre *"
                placeholder="Nombre del destinatario"
                value={form.destinatarioNombre}
                onChange={(evento) => setForm({ ...form, destinatarioNombre: evento.target.value })}
                required
              />
              <Campo
                etiqueta="Apellido *"
                placeholder="Apellido del destinatario"
                value={form.destinatarioApellido}
                onChange={(evento) => setForm({ ...form, destinatarioApellido: evento.target.value })}
                required
              />
              <Campo
                etiqueta="Teléfono *"
                placeholder="Número de contacto"
                value={form.destinatarioTelefono}
                onChange={(evento) => setForm({ ...form, destinatarioTelefono: evento.target.value })}
                required
              />
              <Campo
                etiqueta="DNI (opcional)"
                placeholder="Documento del destinatario"
                value={form.destinatarioDni}
                onChange={(evento) => setForm({ ...form, destinatarioDni: evento.target.value })}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-4 rounded-md border-l-4 border-blue-400 bg-blue-50 px-3 py-2 text-base font-semibold text-blue-900">
              Datos del paquete
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Tamaño *
                </label>
                <select
                  value={form.tamanio}
                  onChange={(evento) =>
                    setForm({
                      ...form,
                      tamanio: evento.target.value as FormularioEnvio['tamanio'],
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="CHICO">Chico (Moto)</option>
                  <option value="MEDIANO">Mediano (Auto)</option>
                  <option value="GRANDE">Grande (Camión)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <Campo
                  etiqueta="Observaciones (opcional)"
                  placeholder="Algún dato útil para la entrega"
                  value={form.observaciones}
                  onChange={(evento) => setForm({ ...form, observaciones: evento.target.value })}
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
            <Boton variante="secundario" type="button" onClick={() => navigate('/operario/envios')}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando} className="bg-blue-600 text-white hover:bg-blue-700">
              {guardando ? 'Guardando...' : 'Guardar pedido'}
            </Boton>
          </div>
        </div>
      </form>
    </div>
  )
}
