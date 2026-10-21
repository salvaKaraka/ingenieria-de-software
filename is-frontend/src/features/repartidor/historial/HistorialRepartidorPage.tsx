import React, { useState } from 'react';

interface EnviosCompletados {
  id: string;
  codigo: string;
  direccion: string;
  fecha: string;
  estado: string;
}

export const HistorialRepartidorPage: React.FC = () => {
  // Datos simulados de envíos pasados (luego se conectarán con la API)
  const [historial] = useState<EnviosCompletados[]>([
    { id: '1', codigo: 'ENV-1001', direccion: 'Calle 7 N° 1234', fecha: '2026-06-01 14:30', estado: 'Entregado' },
    { id: '2', codigo: 'ENV-1002', direccion: 'Av. 13 N° 500', fecha: '2026-06-01 16:15', estado: 'Entregado' },
    { id: '3', codigo: 'ENV-1003', direccion: 'Diagonal 74 N° 800', fecha: '2026-06-02 11:00', estado: 'Entregado' },
  ]);

  return (
    <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-xl font-bold mb-4 text-gray-800">Historial de Envíos</h1>

      <div className="space-y-3">
        {historial.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No hay envíos registrados en el historial.</p>
        ) : (
          historial.map((envio) => (
            <div key={envio.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-blue-600">{envio.codigo}</span>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                  {envio.estado}
                </span>
              </div>
              <p className="text-sm text-gray-700">📍 {envio.direccion}</p>
              <p className="text-xs text-gray-400">🕒 {envio.fecha}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};