import React, { useState, useEffect } from 'react';

export function RepartidoresPage() {
  const [repartidores, setRepartidores] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [nuevoPin, setNuevoPin] = useState<string | null>(null);
  
  // Campos del formulario de alta
  const [nombre, setNombre] = useState('');
  const [vehiculo, setVehiculo] = useState('MOTO');

  useEffect(() => {
    // Listado inicial simulado (conectará directamente con /api/repartidores de tu backend)
    setRepartidores([
      { id: 1, nombre: 'Carlos Gómez', vehiculo: 'MOTO', estado: 'DISPONIBLE', activo: true },
      { id: 2, nombre: 'Lucía Pérez', vehiculo: 'AUTO', estado: 'FUERA_DE_JORNADA', activo: true },
    ]);
  }, []);

  const handleCrear = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulación del PIN generado por única vez exigido en C-1 / C-2
    const pinGenerado = '8492'; 
    setNuevoPin(pinGenerado);
    setModalOpen(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Repartidores (Operario)</h1>
      </div>

      {/* Formulario de Alta */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Registrar Nuevo Repartidor</h2>
        <form onSubmit={handleCrear} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre y Apellido</label>
            <input 
              type="text" 
              value={nombre} 
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              placeholder="Ej. Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Vehículo</label>
            <select 
              value={vehiculo} 
              onChange={(e) => setVehiculo(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 text-sm bg-white"
            >
              <option value="MOTO">Moto</option>
              <option value="AUTO">Auto</option>
              <option value="CAMION">Camión</option>
            </select>
          </div>
          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
          >
            Dar de Alta
          </button>
        </form>
      </div>

      {/* Listado de Repartidores */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-4">ID</th>
              <th className="p-4">Nombre</th>
              <th className="p-4">Vehículo</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {repartidores.map((rep) => (
              <tr key={rep.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-600">#{rep.id}</td>
                <td className="p-4 font-semibold text-gray-800">{rep.nombre}</td>
                <td className="p-4 text-gray-600">{rep.vehiculo}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    rep.estado === 'DISPONIBLE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {rep.estado}
                  </span>
                </td>
                <td className="p-4 text-center space-x-2">
                  <button className="text-blue-600 hover:underline text-xs font-medium">Resetear PIN</button>
                  <button className="text-red-600 hover:underline text-xs font-medium">Baja Lógica</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de PIN Único (C-2) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full space-y-4 text-center">
            <h3 className="text-lg font-bold text-gray-800">¡Repartidor Registrado!</h3>
            <p className="text-sm text-gray-600">
              Este es el PIN de acceso generado. Anótalo ahora, <b>no se volverá a mostrar</b>:
            </p>
            <div className="bg-gray-100 p-4 rounded-xl text-3xl font-mono font-bold tracking-widest text-blue-600">
              {nuevoPin}
            </div>
            <button 
              onClick={() => setModalOpen(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-xl transition"
            >
              Entendido y Guardado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}