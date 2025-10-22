import React, { useEffect } from 'react';
import { useOrders } from '@/store';
import api from '@/services/api';
import toast from 'react-hot-toast';

const MENU_ITEMS = [
  { code: 'CAFE', name: 'Café', price: 3.5 },
  { code: 'JUGO', name: 'Jugo Natural', price: 4.0 },
  { code: 'SAND', name: 'Sandwich', price: 8.5 },
  { code: 'PAST', name: 'Pastel', price: 5.0 },
  { code: 'AGUA', name: 'Agua', price: 2.0 },
];

export default function OrdersPage() {
  const { orders, current, loading, setOrders, setCurrent, setLoading } = useOrders();
  const [stayId, setStayId] = React.useState('');
  const [items, setItems] = React.useState([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
    } catch (error) {
      toast.error('Error cargando órdenes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!stayId) {
      toast.error('Ingresa el ID de la estadía');
      return;
    }
    try {
      const { data } = await api.post('/orders', { stayId, items: [] });
      setCurrent(data);
      toast.success('Orden creada');
      setStayId('');
      setItems([]);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creando orden');
    }
  };

  const handleAddItem = async (menuItem) => {
    if (!current?.id) {
      toast.error('Crea una orden primero');
      return;
    }
    try {
      await api.post(`/orders/${current.id}/items`, {
        productCode: menuItem.code,
        quantity: 1,
        unitPrice: menuItem.price,
      });
      toast.success(`${menuItem.name} agregado`);
      const { data } = await api.get(`/orders/${current.id}`);
      setCurrent(data);
    } catch (error) {
      toast.error('Error agregando item');
    }
  };

  const handleCompleteOrder = async () => {
    if (!current?.id) return;
    try {
      const { data } = await api.post(`/orders/${current.id}/complete`);
      toast.success('Orden completada');
      setCurrent(data);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error completando orden');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">🍽️ Gestión de Órdenes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Crear Orden */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Nueva Orden</h2>
          <form onSubmit={handleCreateOrder} className="space-y-4">
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
              Crear Orden
            </button>
          </form>
        </div>

        {/* Menú */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Menú</h2>
          <div className="space-y-2">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.code}
                onClick={() => handleAddItem(item)}
                className="w-full flex justify-between items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-left"
              >
                <span className="font-bold">{item.name}</span>
                <span className="text-green-600 font-bold">${item.price}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Detalles Orden */}
        {current && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Orden #{current.id?.slice(0, 8)}</h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600">Total: <span className="text-2xl font-bold text-green-600">${current.total || 0}</span></p>
                <p className="text-gray-600">Estado: <span className="font-bold">{current.status}</span></p>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-bold mb-2">Items:</h3>
                {current.items?.map((item) => (
                  <div key={item.id} className="flex justify-between py-1">
                    <span>{item.productCode}</span>
                    <span className="font-bold">${item.price}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleCompleteOrder}
                disabled={current.status === 'completed'}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-bold py-2 rounded-lg transition"
              >
                {current.status === 'completed' ? 'Completada' : 'Completar Orden'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Órdenes */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Todas las Órdenes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Estadía</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-sm">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-2">{o.stayId.slice(0, 8)}</td>
                  <td className="px-4 py-2 font-bold">${o.total}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        o.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setCurrent(o)}
                      className="text-blue-500 hover:text-blue-700 font-bold"
                    >
                      Ver
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
