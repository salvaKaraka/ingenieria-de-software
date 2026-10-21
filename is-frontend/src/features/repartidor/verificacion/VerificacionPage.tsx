import React, { useState } from 'react';

export function VerificacionPage() {
  const [codigoEnvio, setCodigoEnvio] = useState('ENV-1001');
  const [tipoEvidencia, setTipoEvidencia] = useState<'foto_paquete' | 'dni_cliente'>('foto_paquete');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo) {
      alert('Por favor adjunta o captura una evidencia de entrega.');
      return;
    }
    // Aquí se enviaría a la API del backend
    setEnviado(true);
    setTimeout(() => {
      setEnviado(false);
      setArchivo(null);
      setComentario('');
    }, 4000);
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-xl font-bold mb-4 text-gray-800">Verificación de Entrega</h1>

      {enviado && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
          ¡Evidencia cargada y entrega verificada con éxito!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Código de Envío</label>
          <input
            type="text"
            className="w-full p-2 border rounded-lg text-sm bg-gray-100 text-gray-900 outline-none"
            value={codigoEnvio}
            onChange={(e) => setCodigoEnvio(e.target.value)}
            placeholder="Ej: ENV-1001"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Evidencia</label>
          <select
            className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 font-medium"
            value={tipoEvidencia}
            onChange={(e) => setTipoEvidencia(e.target.value as any)}
          >
            <option value="foto_paquete" className="text-gray-900 bg-white">Foto del Paquete Entregado</option>
            <option value="dni_cliente" className="text-gray-900 bg-white">Foto del DNI / Comprobante</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Adjuntar Imagen o Captura</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border rounded-lg p-1"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setArchivo(e.target.files[0]);
              }
            }}
          />
          <p className="text-[10px] text-gray-500 mt-1">
            * Si estás en el celular, se abrirá la cámara automáticamente para la captura.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Comentarios adicionales (opcional)</label>
          <textarea
            className="w-full p-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
            rows={3}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Ej: Entregado en recepción con autorización."
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-sm"
        >
          Confirmar y Enviar Evidencia
        </button>
      </form>
    </div>
  );
}