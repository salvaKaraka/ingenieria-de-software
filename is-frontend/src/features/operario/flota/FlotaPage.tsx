import React, { useState, useEffect } from 'react';

export function FlotaPage() {
  const [flota, setFlota] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulación de carga de flota ordenada por FIFO y tipo de vehículo (C-3)
    // Luego puedes reemplazarlo por un fetch a 'http://localhost:3000/api/repartidores/flota'
    setTimeout(() => {
      setFlota([
        { id: 1, nombre: 'Carlos Gómez', vehiculo: 'MOTO', estado: 'DISPONIBLE', enColaDesde: '10:15 AM' },
        { id: 3, nombre: 'Marcos Silva', vehiculo: 'MOTO', estado: 'DISPONIBLE', enColaDesde: '10:20 AM' },
        { id: 2, nombre: 'Lucía Pérez', vehiculo: 'AUTO', estado: 'OCUPADO', enColaDesde: null },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Monitoreo de Flota y Cola FIFO</h1>
          <p className="text-sm text-gray-500">Repartidores disponibles ordenados por orden de llegada para asignación.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando estado de la flota...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
              <tr>
                <th className="p-4">Orden / ID</th>
                <th className="p-4">Repartidor</th>
                <th className="p-4">Vehículo</th>
                <th className="p-4">Estado Operativo</th>
                <th className="p-4">En Cola Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {flota.map((rep, index) => (
                <tr key={rep.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-600">
                    {rep.estado === 'DISPONIBLE' ? `#${index + 1} (En Cola)` : `-`}
                  </td>
                  <td className="p-4 font-semibold text-gray-800">{rep.nombre}</td>
                  <td className="p-4 text-gray-600 font-medium">{rep.vehiculo}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      rep.estado === 'DISPONIBLE' ? 'bg-green-100 text-green-700' :
                      rep.estado === 'OCUPADO' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {rep.estado}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-xs font-mono">
                    {rep.enColaDesde || 'No disponible'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}