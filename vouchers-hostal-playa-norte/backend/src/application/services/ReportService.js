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

      let activeStays = stays.filter((s) => s.status === 'active');

      if (dateRange) {
        const { startDate, endDate } = dateRange;
        activeStays = activeStays.filter((s) => {
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
      this.logger.error('Error calculando ocupación', {
        error: error.message,
        hotelCode
      });
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
      const { computeVoucherStats } = await import('./report/analytics.helpers.js');
      const stats = computeVoucherStats(vouchers);
      this.logger.info('Estadísticas de vouchers calculadas', stats);
      return { period: dateRange || 'last_30_days', ...stats, timestamp: new Date().toISOString() };
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
      let filtered = orders;
      if (filters.status) filtered = filtered.filter(o => o.status === filters.status);
      if (filters.stayId) filtered = filtered.filter(o => o.stayId === filters.stayId);
      const { computeOrderConsumption } = await import('./report/analytics.helpers.js');
      const consumption = computeOrderConsumption(filtered);
      this.logger.info('Consumo calculado', { orders: consumption.totalOrders, revenue: consumption.totalRevenue });
      return { period: dateRange || 'last_30_days', ...consumption, timestamp: new Date().toISOString() };
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
      const { computeDailyRevenue } = await import('./report/analytics.helpers.js');
      const dailyData = computeDailyRevenue(orders);
      const totalRevenue = dailyData.reduce((sum, d) => sum + d.netRevenue, 0);
      const totalDiscount = dailyData.reduce((sum, d) => sum + d.discount, 0);
      const totalOrders = dailyData.reduce((sum, d) => sum + d.orders, 0);
      this.logger.info('Ingresos diarios calculados', { days: dailyData.length, totalRevenue });
      return {
        period: { startDate, endDate },
        days: dailyData,
        totalRevenue,
        totalDiscount,
        totalOrders,
        averageRevenuePerDay: (totalRevenue / (dailyData.length || 1)).toFixed(2),
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
      const { computeTopProducts } = await import('./report/analytics.helpers.js');
      const enriched = computeTopProducts(orders)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, limit);
      this.logger.info(`Top ${enriched.length} productos calculados`);
      return { period: dateRange || 'last_30_days', limit, products: enriched, timestamp: new Date().toISOString() };
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
      const { computePeakHours } = await import('./report/analytics.helpers.js');
      const peaks = computePeakHours(orders);
      this.logger.info('Peak hours calculadas');
      return {
        period: dateRange || 'last_7_days',
        hourlyDistribution: peaks,
        peakHour: peaks[0]?.hour || 0,
        peakHourOrders: peaks[0]?.orders || 0,
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
      this.logger.error('Error calculando resumen general', {
        error: error.message,
        hotelCode
      });
      throw new Error(`No se pudo calcular resumen: ${error.message}`);
    }
  }
}
