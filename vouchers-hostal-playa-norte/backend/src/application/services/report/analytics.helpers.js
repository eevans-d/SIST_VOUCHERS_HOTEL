/**
 * Helpers de agregación para ReportService
 * Cada función encapsula lógica de cálculo para reducir tamaño y complejidad del servicio principal.
 */

export function computeVoucherStats(vouchers) {
  const stats = {
    totalGenerated: vouchers.length,
    byStatus: {
      pending: 0,
      active: 0,
      redeemed: 0,
      expired: 0,
      cancelled: 0
    }
  };
  for (const v of vouchers) {
    if (stats.byStatus[v.status] !== undefined) stats.byStatus[v.status]++;
  }
  stats.redemptionRate = stats.totalGenerated > 0 ? ((stats.byStatus.redeemed / stats.totalGenerated) * 100).toFixed(2) : 0;
  stats.expirationRate = stats.totalGenerated > 0 ? ((stats.byStatus.expired / stats.totalGenerated) * 100).toFixed(2) : 0;
  stats.conversionRate = stats.totalGenerated > 0 ? (((stats.byStatus.redeemed + stats.byStatus.expired) / stats.totalGenerated) * 100).toFixed(2) : 0;
  return stats;
}

export function computeOrderConsumption(orders) {
  const acc = {
    totalOrders: orders.length,
    completedOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    totalDiscount: 0,
    totalItems: 0,
    averageOrderValue: 0,
    averageDiscount: 0
  };
  for (const o of orders) {
    if (o.status === 'completed') acc.completedOrders++;
    if (o.status === 'cancelled') acc.cancelledOrders++;
    acc.totalRevenue += o.finalTotal || o.total || 0;
    acc.totalDiscount += o.discountAmount || 0;
    acc.totalItems += (o.items?.length || 0);
  }
  acc.averageOrderValue = acc.totalOrders > 0 ? (acc.totalRevenue / acc.totalOrders).toFixed(2) : 0;
  acc.averageDiscount = acc.completedOrders > 0 ? (acc.totalDiscount / acc.completedOrders).toFixed(2) : 0;
  return acc;
}

export function computeDailyRevenue(orders) {
  const byDay = new Map();
  for (const o of orders) {
    const day = new Date(o.createdAt).toISOString().split('T')[0];
    if (!byDay.has(day)) {
      byDay.set(day, { date: day, orders: 0, revenue: 0, discount: 0, netRevenue: 0 });
    }
    const ref = byDay.get(day);
    ref.orders++;
    ref.revenue += o.total || 0;
    ref.discount += o.discountAmount || 0;
    ref.netRevenue += o.finalTotal || o.total || 0;
  }
  return Array.from(byDay.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function computeTopProducts(orders) {
  const stats = new Map();
  for (const o of orders) {
    if (!Array.isArray(o.items)) continue;
    for (const item of o.items) {
      const key = item.productCode || item.productName;
      if (!stats.has(key)) {
        stats.set(key, { code: item.productCode, name: item.productName, quantity: 0, revenue: 0, orders: 0 });
      }
      const ref = stats.get(key);
      ref.quantity += item.quantity || 0;
      ref.revenue += item.subtotal || 0;
      ref.orders++;
    }
  }
  return Array.from(stats.values()).map(p => ({ ...p, avgPrice: (p.revenue / (p.quantity || 1)).toFixed(2) }));
}

export function computePeakHours(orders) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }));
  for (const o of orders) {
    const h = new Date(o.createdAt).getHours();
    hours[h].orders++;
    hours[h].revenue += o.finalTotal || o.total || 0;
  }
  return hours.sort((a, b) => b.orders - a.orders);
}
