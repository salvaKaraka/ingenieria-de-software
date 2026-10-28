import { useState, type FormEvent } from 'react'
import { api, ErrorApi } from '../../../shared/api.ts'
import type { TipoVehiculo } from '../../../shared/tipos.ts'
import { Boton, Campo, Modal, Selector } from '../../../shared/ui/index.ts'
import type { Repartidor, RepartidorConPin } from './tipos.ts'

const OPCIONES_VEHICULO = [
  { valor: 'MOTO', etiqueta: 'Moto' },
  { valor: 'AUTO', etiqueta: 'Auto' },
  { valor: 'CAMION', etiqueta: 'Camión' },
]

type Props = {
  abierto: boolean
  onCerrar: () => void
  onGuardado: (pinGenerado?: string) => void
  repartidorAEditar?: Repartidor | null
}

function FormularioContenido({
  repartidorAEditar,
  onCerrar,
  onGuardado,
}: Omit<Props, 'abierto'>) {
  const esEdicion = Boolean(repartidorAEditar)

  const [nombre, setNombre] = useState(repartidorAEditar?.nombre ?? '')
  const [apellido, setApellido] = useState(repartidorAEditar?.apellido ?? '')
  // Al editar arranca vacío: la API solo manda el DNI enmascarado. Vacío = no se cambia.
  const [dni, setDni] = useState('')
  const [telefono, setTelefono] = useState(repartidorAEditar?.telefono ?? '')
  const [email, setEmail] = useState(repartidorAEditar?.email ?? '')
  const [direccion, setDireccion] = useState(repartidorAEditar?.direccion ?? '')
  const [vehiculo, setVehiculo] = useState<TipoVehiculo>(
    repartidorAEditar?.vehiculo ?? 'MOTO',
  )

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErrorGeneral(null)

    // Solo dígitos: "12.345.678" y "12345678" son el mismo DNI.
    const dniNormalizado = dni.replace(/\D/g, '')
    const datos = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      ...(dniNormalizado && { dni: dniNormalizado }),
      telefono: telefono.trim(),
      email: email.trim(),
      direccion: direccion.trim(),
      vehiculo,
    }

    try {
      if (esEdicion && repartidorAEditar) {
        await api<Repartidor>(`/repartidores/${repartidorAEditar.id}`, {
          metodo: 'PATCH',
          datos,
        })
        onGuardado()
      } else {
        const respuesta = await api<RepartidorConPin>('/repartidores', {
          metodo: 'POST',
          datos,
        })
        onGuardado(respuesta.pin)
      }
      onCerrar()
    } catch (err) {
      if (err instanceof ErrorApi) {
        setErrorGeneral(err.mensajes.join('. ') || `Error ${err.status}`)
      } else {
        setErrorGeneral('Ocurrió un error inesperado al guardar.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errorGeneral && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorGeneral}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Nombre"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Martín"
        />
        <Campo
          etiqueta="Apellido"
          required
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          placeholder="Ej: Pérez"
        />
      </div>

      <Campo
        etiqueta={esEdicion ? 'DNI (completalo solo para corregirlo)' : 'DNI'}
        required={!esEdicion}
        inputMode="numeric"
        value={dni}
        onChange={(e) => setDni(e.target.value)}
        placeholder={esEdicion ? `Actual: ${repartidorAEditar?.dni ?? 'sin cargar'}` : 'Ej: 30.123.456'}
      />

      <Campo
        etiqueta="Teléfono"
        type="tel"
        required
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Ej: 11 4455-6677"
      />

      <Campo
        etiqueta="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Ej: martin.perez@email.com"
      />

      <Campo
        etiqueta="Dirección"
        required
        value={direccion}
        onChange={(e) => setDireccion(e.target.value)}
        placeholder="Ej: Av. Corrientes 1234"
      />

      <Selector
        etiqueta="Vehículo"
        opciones={OPCIONES_VEHICULO}
        value={vehiculo}
        onChange={(e) => setVehiculo(e.target.value as TipoVehiculo)}
      />

      <div className="mt-2 flex justify-end gap-2">
        <Boton
          type="button"
          variante="secundario"
          onClick={onCerrar}
          disabled={enviando}
        >
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enviando}>
          {enviando
            ? 'Guardando...'
            : esEdicion
              ? 'Guardar cambios'
              : 'Crear repartidor'}
        </Boton>
      </div>
    </form>
  )
}

export function FormularioRepartidorModal({
  abierto,
  onCerrar,
  onGuardado,
  repartidorAEditar,
}: Props) {
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={repartidorAEditar ? 'Editar repartidor' : 'Nuevo repartidor'}
    >
      {abierto && (
        <FormularioContenido
          key={repartidorAEditar ? String(repartidorAEditar.id) : 'nuevo'}
          repartidorAEditar={repartidorAEditar}
          onCerrar={onCerrar}
          onGuardado={onGuardado}
        />
      )}
    </Modal>
  )
}
