import React, { useEffect } from 'react';
import QRCode from 'qrcode.react';
import { useVouchers } from '@/store';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function VouchersPage() {
  const { vouchers, current, loading, setVouchers, setCurrent, setLoading } = useVouchers();
  const [stayId, setStayId] = React.useState('');
  const [validationCode, setValidationCode] = React.useState('');

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/vouchers');
      setVouchers(data);
    } catch (error) {
      toast.error('Error cargando vouchers');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!stayId) {
      toast.error('Ingresa el ID de la estadía');
      return;
    }
    try {
      const { data } = await api.post('/vouchers', { stayId });
      toast.success('Voucher generado');
      setCurrent(data);
      setStayId('');
      fetchVouchers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error generando voucher');
    }
  };

  const handleValidate = async () => {
    if (!validationCode) {
      toast.error('Ingresa el código del voucher');
      return;
    }
    try {
      const { data } = await api.post(`/vouchers/${validationCode}/validate`);
      toast.success('Voucher validado correctamente');
      setCurrent(data);
      setValidationCode('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Voucher inválido');
    }
  };

  const handleRedeem = async () => {
    if (!current?.code) {
      toast.error('Selecciona un voucher');
      return;
    }
    try {
      const { data } = await api.post(`/vouchers/${current.code}/redeem`);
      toast.success('Voucher redimido');
      setCurrent(data);
      fetchVouchers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error redimiendo voucher');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">🎫 Gestión de Vouchers</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Generar Voucher */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Generar Voucher</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <input
              type="text"
              value={stayId}
              onChange={(e) => setStayId(e.target.value)}
              placeholder="ID de Estadía"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition"
            >
              Generar
            </button>
          </form>
        </div>

        {/* Validar Voucher */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Validar Voucher</h2>
          <div className="space-y-4">
            <input
              type="text"
              value={validationCode}
              onChange={(e) => setValidationCode(e.target.value)}
              placeholder="Código del Voucher"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleValidate}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition"
            >
              Validar
            </button>
          </div>
        </div>

        {/* QR Display */}
        {current && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Código QR</h2>
            <div className="flex flex-col items-center space-y-4">
              <QRCode value={`VOC|${current.id}|${current.code}|${current.stayId}`} size={200} />
              <p className="text-center font-mono text-sm">{current.code}</p>
              <button
                onClick={handleRedeem}
                disabled={current.status === 'redeemed'}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-bold py-2 rounded-lg transition"
              >
                {current.status === 'redeemed' ? 'Ya Redimido' : 'Redimir'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Vouchers */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Todos los Vouchers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Fecha Expiración</th>
                <th className="px-4 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{v.code}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        v.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : v.status === 'redeemed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{new Date(v.expiryDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setCurrent(v)}
                      className="text-blue-500 hover:text-blue-700 font-bold"
                    >
                      Ver QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
