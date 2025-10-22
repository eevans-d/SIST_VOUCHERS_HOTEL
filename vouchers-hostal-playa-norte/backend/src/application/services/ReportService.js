/**
 * ReportService - Agregación y análisis de datos
 * Calcula métricas de ocupación, consumo, ingresos y vouchers
 */

export class ReportService {
  constructor({ stayRepository, orderRepository, voucherRepository, logger }) {
    this.stayRepository = stayRepository;
    this.orderRepository = orderRepository;
    this.voucherRepository = voucherRepository;
    this.logger = logger;
  }

  /**
   * Tasa de ocupación del hotel
   * Retorna: % de habitaciones ocupadas
   */
  async getOccupancyRate(hotelCode, dateRange = null) {
    try {
      const stays = await this.stayRepository.findByHotelCode(hotelCode);
      
      let activeStays = stays.filter(s => s.status === 'active');
      
      if (dateRange) {
        const { startDate, endDate } = dateRange;
        activeStays = activeStays.filter(s => {
          const stayStart = new Date(s.checkIn);
          const stayEnd = new Date(s.checkOut);
          const queryStart = new Date(startDate);
          const queryEnd = new Date(endDate);
          
          return !(stayEnd < queryStart || stayStart > queryEnd);
        });
      }
      
      // Asumir máximo de 100 habitaciones como parámetro configurable
      const maxRooms = parseInt(process.env.TOTAL_ROOMS || '50');
      const occupancyRate = (activeStays.length / maxRooms) * 100;
      
      this.logger.info(`Ocupación calculada: ${occupancyRate.toFixed(2)}%`, {
        hotelCode,
        activeStays: activeStays.length,
        maxRooms,
        dateRange
      });
      
      return {
        occupancyRate: parseFloat(occupancyRate.toFixed(2)),
        activeStays: activeStays.length,
        maxRooms,
        timestamp: new Date().toISOString(),
        dateRange: dateRange || 'current'
      };
    } catch (error) {
      this.logger.error('Error calculando ocupación', { error: error.message, hotelCode });
      throw new Error(`No se pudo calcular ocupación: ${error.message}`);
    }
  }

  /**
   * Estadísticas de vouchers generados y redenidos
   * Retorna: conteos, tasa de redención, ingresos por vouchers
   */
  async getVoucherStats(dateRange = null) {
    try {
      const vouchers = await this.voucherRepository.findByDateRange(
        dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        dateRange?.endDate || new Date().toISOString()
      );
      
      const stats = {
        totalGenerated: vouchers.length,
        byStatus: {
          pending: vouchers.filter(v => v.status === 'pending').length,
          active: vouchers.filter(v => v.status === 'active').length,
          redeemed: vouchers.filter(v => v.status === 'redeemed').length,
          expired: vouchers.filter(v => v.status === 'expired').length,
          cancelled: vouchers.filter(v => v.status === 'cancelled').length
        }
      };
      
      stats.redemptionRate = stats.totalGenerated > 0 
        ? ((stats.byStatus.redeemed / stats.totalGenerated) * 100).toFixed(2)
        : 0;
      
      stats.expirationRate = stats.totalGenerated > 0
        ? ((stats.byStatus.expired / stats.totalGenerated) * 100).toFixed(2)
        : 0;
      
      stats.conversionRate = stats.totalGenerated > 0
        ? (((stats.byStatus.redeemed + stats.byStatus.expired) / stats.totalGenerated) * 100).toFixed(2)
        : 0;
      
      this.logger.info(`Estadísticas de vouchers calculadas`, stats);
      
      return {
        period: dateRange || 'last_30_days',
        ...stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error calculando estadísticas de vouchers', { error: error.message });
      throw new Error(`No se pudieron calcular voucher stats: ${error.message}`);
    }
  }

  /**
   * Consumo de órdenes por estadía
   * Retorna: órdenes completadas, items consumidos, ingresos
   */
  async getOrderConsumption(dateRange = null, filters = {}) {
    try {
      const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = dateRange?.endDate || new Date().toISOString();
      
      const orders = await this.orderRepository.findByDateRange(startDate, endDate);
      
      let filteredOrders = orders;
      if (filters.status) {
        filteredOrders = filteredOrders.filter(o => o.status === filters.status);
      }
      if (filters.stayId) {
        filteredOrders = filteredOrders.filter(o => o.stayId === filters.stayId);
      }
      
      const consumption = {
        totalOrders: filteredOrders.length,
        completedOrders: filteredOrders.filter(o => o.status === 'completed').length,
        cancelledOrders: filteredOrders.filter(o => o.status === 'cancelled').length,
        totalRevenue: 0,
        totalDiscount: 0,
        totalItems: 0,
        averageOrderValue: 0,
        averageDiscount: 0
      };
      
      filteredOrders.forEach(order => {
        consumption.totalRevenue += order.finalTotal || order.total || 0;
        consumption.totalDiscount += order.discountAmount || 0;
        consumption.totalItems += order.items?.length || 0;
      });
      
      consumption.averageOrderValue = consumption.totalOrders > 0
        ? (consumption.totalRevenue / consumption.totalOrders).toFixed(2)
        : 0;
      
      consumption.averageDiscount = consumption.completedOrders > 0
        ? (consumption.totalDiscount / consumption.completedOrders).toFixed(2)
        : 0;
      
      this.logger.info(`Consumo calculado`, { orders: consumption.totalOrders, revenue: consumption.totalRevenue });
      
      return {
        period: dateRange || 'last_30_days',
        ...consumption,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error calculando consumo de órdenes', { error: error.message });
      throw new Error(`No se pudo calcular consumo: ${error.message}`);
    }
  }

  /**
   * Ingresos diarios
   * Retorna: desglose de ingresos por día
   */
  async getDailyRevenue(startDate, endDate) {
    try {
      const orders = await this.orderRepository.findByDateRange(startDate, endDate);
      
      const revenueByDay = {};
      
      orders.forEach(order => {
        const day = new Date(order.createdAt).toISOString().split('T')[0];
        if (!revenueByDay[day]) {
          revenueByDay[day] = {
            date: day,
            orders: 0,
            revenue: 0,
            discount: 0,
            netRevenue: 0
          };
        }
        
        revenueByDay[day].orders++;
        revenueByDay[day].revenue += order.total || 0;
        revenueByDay[day].discount += order.discountAmount || 0;
        revenueByDay[day].netRevenue += order.finalTotal || order.total || 0;
      });
      
      const dailyData = Object.values(revenueByDay)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      this.logger.info(`Ingresos diarios calculados`, { days: dailyData.length, totalRevenue: dailyData.reduce((sum, d) => sum + d.netRevenue, 0) });
      
      return {
        period: { startDate, endDate },
        days: dailyData,
        totalRevenue: dailyData.reduce((sum, d) => sum + d.netRevenue, 0),
        totalDiscount: dailyData.reduce((sum, d) => sum + d.discount, 0),
        totalOrders: dailyData.reduce((sum, d) => sum + d.orders, 0),
        averageRevenuePerDay: (dailyData.reduce((sum, d) => sum + d.netRevenue, 0) / dailyData.length).toFixed(2),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error calculando ingresos diarios', { error: error.message });
      throw new Error(`No se pudieron calcular ingresos: ${error.message}`);
    }
  }

  /**
   * Top productos más consumidos
   * Retorna: ranking de items por cantidad y revenue
   */
  async getTopProducts(limit = 10, dateRange = null) {
    try {
      const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = dateRange?.endDate || new Date().toISOString();
      
      const orders = await this.orderRepository.findByDateRange(startDate, endDate);
      
      const productStats = {};
      
      orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            const key = item.productCode || item.productName;
            if (!productStats[key]) {
              productStats[key] = {
                code: item.productCode,
                name: item.productName,
                quantity: 0,
                revenue: 0,
                avgPrice: 0,
                orders: 0
              };
            }
            
            productStats[key].quantity += item.quantity || 0;
            productStats[key].revenue += item.subtotal || 0;
            productStats[key].orders++;
          });
        }
      });
      
      const topProducts = Object.values(productStats)
        .map(p => ({
          ...p,
          avgPrice: (p.revenue / p.quantity).toFixed(2)
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, limit);
      
      this.logger.info(`Top ${topProducts.length} productos calculados`);
      
      return {
        period: dateRange || 'last_30_days',
        limit,
        products: topProducts,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error calculando top productos', { error: error.message });
      throw new Error(`No se pudieron calcular productos: ${error.message}`);
    }
  }

  /**
   * Horas pico de consumo
   * Retorna: distribución de órdenes por hora del día
   */
  async getPeakHours(dateRange = null) {
    try {
      const startDate = dateRange?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = dateRange?.endDate || new Date().toISOString();
      
      const orders = await this.orderRepository.findByDateRange(startDate, endDate);
      
      const hourStats = {};
      
      for (let hour = 0; hour < 24; hour++) {
        hourStats[hour] = { hour, orders: 0, revenue: 0 };
      }
      
      orders.forEach(order => {
        const hour = new Date(order.createdAt).getHours();
        hourStats[hour].orders++;
        hourStats[hour].revenue += order.finalTotal || order.total || 0;
      });
      
      const peakHours = Object.values(hourStats)
        .sort((a, b) => b.orders - a.orders);
      
      this.logger.info(`Peak hours calculadas`);
      
      return {
        period: dateRange || 'last_7_days',
        hourlyDistribution: peakHours,
        peakHour: peakHours[0]?.hour || 0,
        peakHourOrders: peakHours[0]?.orders || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error calculando horas pico', { error: error.message });
      throw new Error(`No se pudieron calcular horas pico: ${error.message}`);
    }
  }

  /**
   * Resumen general del hotel
   * Retorna: dashboard con todos los KPIs
   */
  async getOverallSummary(hotelCode) {
    try {
      const [occupancy, vouchers, consumption, peak] = await Promise.all([
        this.getOccupancyRate(hotelCode),
        this.getVoucherStats(),
        this.getOrderConsumption(),
        this.getPeakHours()
      ]);
      
      return {
        hotel: hotelCode,
        timestamp: new Date().toISOString(),
        occupancy,
        vouchers,
        consumption,
        peakHours: peak,
        kpis: {
          occupancyRate: occupancy.occupancyRate,
          voucherRedemptionRate: parseFloat(vouchers.redemptionRate),
          averageOrderValue: parseFloat(consumption.averageOrderValue),
          totalRevenue: consumption.totalRevenue,
          totalDiscount: consumption.totalDiscount
        }
      };
    } catch (error) {
      this.logger.error('Error calculando resumen general', { error: error.message, hotelCode });
      throw new Error(`No se pudo calcular resumen: ${error.message}`);
    }
  }
}
