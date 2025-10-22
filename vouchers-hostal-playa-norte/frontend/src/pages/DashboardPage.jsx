import React, { useEffect } from 'react';
import { useReports } from '@/store';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { reports, loading, setReports, setLoading } = useReports();
  const [hotelCode] = React.useState('H001');

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/reports/dashboard/${hotelCode}`);
        setReports(data);
      } catch (error) {
        toast.error('Error cargando reportes');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  const occupancy = reports.occupancy || {};
  const vouchers = reports.vouchers || {};
  const consumption = reports.consumption || {};

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">📊 Dashboard</h1>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Ocupación"
          value={`${occupancy.occupancyRate?.toFixed(1) || 0}%`}
          icon="🏨"
          color="bg-blue-500"
        />
        <KPICard
          title="Vouchers Redimidos"
          value={`${vouchers.redemptionRate?.toFixed(1) || 0}%`}
          icon="🎫"
          color="bg-green-500"
        />
        <KPICard
          title="Ingresos Totales"
          value={`$${consumption.totalRevenue || 0}`}
          icon="💰"
          color="bg-purple-500"
        />
        <KPICard
          title="Órdenes Completadas"
          value={consumption.completedOrders || 0}
          icon="✅"
          color="bg-orange-500"
        />
      </div>

      {/* Gráficos y tablas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Horas Pico">
          <p className="text-2xl font-bold">{reports.peakHours?.peakHour || 'N/A'}:00</p>
          <p className="text-gray-600">{reports.peakHours?.peakHourOrders || 0} órdenes</p>
        </ChartCard>

        <ChartCard title="Top Productos">
          {(reports.products || []).slice(0, 5).map((p, i) => (
            <div key={i} className="flex justify-between py-2 border-b">
              <span>{p.name}</span>
              <span className="font-bold">{p.quantity} unidades</span>
            </div>
          ))}
        </ChartCard>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, color }) {
  return (
    <div className={`${color} rounded-lg shadow-lg p-6 text-white`}>
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm opacity-90">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4 text-gray-800">{title}</h3>
      {children}
    </div>
  );
}
