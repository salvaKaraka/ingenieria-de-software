import { useState } from 'react'
import { Boton, BotonGrande, Campo, EtiquetaEstado, Modal, Selector, Tabla } from '../../shared/ui/index.ts'
import { ETIQUETA_ESTADO_ENVIO, type EstadoEnvio } from '../../shared/tipos.ts'

const ESTADOS = Object.keys(ETIQUETA_ESTADO_ENVIO) as EstadoEnvio[]

type FilaEjemplo = { id: number; destino: string; estado: EstadoEnvio }
const FILAS: FilaEjemplo[] = [
  { id: 1, destino: 'Calle 7 1234', estado: 'PENDIENTE' },
  { id: 2, destino: 'Av. 44 567', estado: 'EN_DOMICILIO' },
]

// Catálogo de componentes de shared/ui. Solo existe en desarrollo (/dev/ui).
// Antes de crear un componente nuevo, mirá si ya está acá.
export function UiDemoPage() {
  const [modalAbierto, setModalAbierto] = useState(false)

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-6">
      <h1 className="text-2xl font-bold">Componentes (shared/ui)</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">Boton</h2>
        <div className="flex flex-wrap gap-2">
          <Boton>Primario</Boton>
          <Boton variante="secundario">Secundario</Boton>
          <Boton variante="peligro">Peligro</Boton>
          <Boton disabled>Deshabilitado</Boton>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Campo y Selector</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre del comercio" placeholder="Kiosco Don Pepe" />
          <Campo etiqueta="Email" defaultValue="mal-email" error="El email no es válido" />
          <Selector
            etiqueta="Tamaño"
            opciones={[
              { valor: 'CHICO', etiqueta: 'Chico (moto)' },
              { valor: 'MEDIANO', etiqueta: 'Mediano (auto)' },
              { valor: 'GRANDE', etiqueta: 'Grande (camión)' },
            ]}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">EtiquetaEstado</h2>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((estado) => (
            <EtiquetaEstado key={estado} estado={estado} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Tabla</h2>
        <Tabla
          filas={FILAS}
          claveFila={(fila) => fila.id}
          columnas={[
            { titulo: '#', celda: (fila) => fila.id },
            { titulo: 'Destino', celda: (fila) => fila.destino },
            { titulo: 'Estado', celda: (fila) => <EtiquetaEstado estado={fila.estado} /> },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Modal</h2>
        <Boton onClick={() => setModalAbierto(true)}>Abrir modal</Boton>
        <Modal abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} titulo="PIN generado">
          <p className="mb-4">
            El PIN es <strong className="font-mono text-2xl">4821</strong>. Anotalo y entregáselo al repartidor: no se
            vuelve a mostrar.
          </p>
          <Boton onClick={() => setModalAbierto(false)}>Listo</Boton>
        </Modal>
      </section>

      <section className="space-y-3 rounded-xl bg-slate-950 p-4 text-white">
        <h2 className="font-semibold">BotonGrande (app del repartidor)</h2>
        <BotonGrande>Iniciar jornada</BotonGrande>
        <BotonGrande variante="secundario">Llegué al comercio</BotonGrande>
        <BotonGrande variante="peligro">Auxilio</BotonGrande>
      </section>
    </main>
  )
}
