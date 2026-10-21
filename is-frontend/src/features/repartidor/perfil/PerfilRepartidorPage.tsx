import React, { useState } from 'react';

export function PerfilRepartidorPage() {
  // Estados para los campos obligatorios y opcionales
  const [nombre, setNombre] = useState('Juan');
  const [apellido, setApellido] = useState('Pérez');
  const [documento, setDocumento] = useState('40123456');
  const [telefono, setTelefono] = useState('2211234567');

  // Estado para vehículo
  const [tipoVehiculo, setTipoVehiculo] = useState('moto'); // auto, moto, camion
  const [modeloVehiculo, setModeloVehiculo] = useState('Honda Wave 110');
  const [colorVehiculo, setColorVehiculo] = useState('Rojo');

  // Mensajes de confirmación/solicitud
  const [mensaje, setMensaje] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim() || !documento.trim()) {
      alert('Nombre, Apellido y Documento son obligatorios.');
      return;
    }
    setMensaje('¡Datos guardados con éxito!');
    setTimeout(() => setMensaje(null), 3000);
  };

  const handleSolicitarCambioPIM = () => {
    alert('Solicitud de cambio de PIN/PIM enviada al operario.');
  };

  const handleSolicitarCambioDatos = () => {
    alert('Solicitud de cambio de datos personales enviada para revisión.');
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-xl font-bold mb-4 text-gray-800">Perfil del Repartidor</h1>

      {mensaje && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
          {mensaje}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-semibold text-gray-700 border-b pb-2">Datos Personales</h2>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full p-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Apellido <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full p-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Documento (DNI) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full p-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
          <input
            type="text"
            className="w-full p-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>

        <h2 className="font-semibold text-gray-700 border-b pb-2 pt-2">Vehículo</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Vehículo</label>
          <select
            className="w-full p-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={tipoVehiculo}
            onChange={(e) => setTipoVehiculo(e.target.value)}
          >
            <option value="moto">Moto</option>
            <option value="auto">Auto</option>
            <option value="camion">Camión</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Modelo</label>
          <input
            type="text"
            className="w-full p-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={modeloVehiculo}
            onChange={(e) => setModeloVehiculo(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
          <input
            type="text"
            className="w-full p-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={colorVehiculo}
            onChange={(e) => setColorVehiculo(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition"
        >
          Guardar Cambios
        </button>
      </form>

      {/* Solicitudes especiales */}
      <div className="mt-4 space-y-2">
        <button
          onClick={handleSolicitarCambioPIM}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold py-2 rounded-lg"
        >
          Solicitar Cambio de PIN
        </button>
        <button
          onClick={handleSolicitarCambioDatos}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold py-2 rounded-lg"
        >
          Solicitar Cambio de Datos Personales
        </button>
      </div>
    </div>
  );
}