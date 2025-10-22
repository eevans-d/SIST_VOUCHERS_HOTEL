/**
 * @file reports.js
 * @description Rutas HTTP para reportes y analytics
 * Endpoints para ocupación, consumo, ingresos, estadísticas
 */

import { Router } from 'express';

export function createReportsRoutes({
  reportService,
  authenticate,
  authorize,
  logger
}) {
  const router = Router();

  /**
   * GET /api/reports/occupancy/:hotelCode
   * Obtiene tasa de ocupación
   * RBAC: admin, staff
   */
  router.get('/occupancy/:hotelCode', 
    authenticate, 
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const { hotelCode } = req.params;
        const { startDate, endDate } = req.query;
        
        const dateRange = (startDate && endDate) ? { startDate, endDate } : null;
        const occupancy = await reportService.getOccupancyRate(hotelCode, dateRange);
        
        logger.info(`Reporte de ocupación solicitado`, { hotelCode, user: req.user.id });
        
        return res.json({
          success: true,
          data: occupancy,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error en reporte ocupación`, { error: error.message, hotelCode: req.params.hotelCode });
        next(error);
      }
    }
  );

  /**
   * GET /api/reports/vouchers/stats
   * Estadísticas de vouchers
   * RBAC: admin, staff
   */
  router.get('/vouchers/stats',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = req.query;
        
        const dateRange = (startDate && endDate) ? { startDate, endDate } : null;
        const voucherStats = await reportService.getVoucherStats(dateRange);
        
        logger.info(`Estadísticas de vouchers solicitadas`, { user: req.user.id });
        
        return res.json({
          success: true,
          data: voucherStats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error en estadísticas de vouchers`, { error: error.message });
        next(error);
      }
    }
  );

  /**
   * GET /api/reports/orders/consumption
   * Consumo de órdenes
   * RBAC: admin, staff, cafemanager
   */
  router.get('/orders/consumption',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { startDate, endDate, status, stayId } = req.query;
        
        const dateRange = (startDate && endDate) ? { startDate, endDate } : null;
        const filters = {};
        if (status) filters.status = status;
        if (stayId) filters.stayId = stayId;
        
        const consumption = await reportService.getOrderConsumption(dateRange, filters);
        
        logger.info(`Consumo de órdenes solicitado`, { filters, user: req.user.id });
        
        return res.json({
          success: true,
          data: consumption,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error en consumo de órdenes`, { error: error.message });
        next(error);
      }
    }
  );

  /**
   * GET /api/reports/revenue/daily
   * Ingresos diarios
   * RBAC: admin, staff
   */
  router.get('/revenue/daily',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
          return res.status(400).json({
            success: false,
            error: 'Se requieren startDate y endDate',
            example: '?startDate=2025-01-01&endDate=2025-01-31'
          });
        }
        
        const dailyRevenue = await reportService.getDailyRevenue(startDate, endDate);
        
        logger.info(`Ingresos diarios solicitados`, { startDate, endDate, user: req.user.id });
        
        return res.json({
          success: true,
          data: dailyRevenue,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error en ingresos diarios`, { error: error.message });
        next(error);
      }
    }
  );

  /**
   * GET /api/reports/products/top
   * Top productos consumidos
   * RBAC: admin, staff, cafemanager
   */
  router.get('/products/top',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { limit = 10, startDate, endDate } = req.query;
        
        const dateRange = (startDate && endDate) ? { startDate, endDate } : null;
        const topProducts = await reportService.getTopProducts(parseInt(limit), dateRange);
        
        logger.info(`Top productos solicitados`, { limit, user: req.user.id });
        
        return res.json({
          success: true,
          data: topProducts,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error en top productos`, { error: error.message });
        next(error);
      }
    }
  );

  /**
   * GET /api/reports/hours/peak
   * Horas pico de consumo
   * RBAC: admin, staff, cafemanager
   */
  router.get('/hours/peak',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = req.query;
        
        const dateRange = (startDate && endDate) ? { startDate, endDate } : null;
        const peakHours = await reportService.getPeakHours(dateRange);
        
        logger.info(`Horas pico solicitadas`, { user: req.user.id });
        
        return res.json({
          success: true,
          data: peakHours,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error en horas pico`, { error: error.message });
        next(error);
      }
    }
  );

  /**
   * GET /api/reports/dashboard/:hotelCode
   * Resumen general del hotel
   * RBAC: admin, staff
   */
  router.get('/dashboard/:hotelCode',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const { hotelCode } = req.params;
        
        const summary = await reportService.getOverallSummary(hotelCode);
        
        logger.info(`Dashboard solicitado`, { hotelCode, user: req.user.id });
        
        return res.json({
          success: true,
          data: summary,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error en dashboard`, { error: error.message, hotelCode: req.params.hotelCode });
        next(error);
      }
    }
  );

  return router;
}

export default createReportsRoutes;
