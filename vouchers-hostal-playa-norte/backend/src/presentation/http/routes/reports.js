/**
 * @file reports.js
 * @description Rutas HTTP para reportes y analytics
 * Endpoints para ocupación, consumo, ingresos, estadísticas
 */

import { Router } from 'express';
import { 
  occupancyController,
  voucherStatsController,
  orderConsumptionController,
  dailyRevenueController,
  topProductsController,
  peakHoursController,
  dashboardController
} from '../controllers/reports.controllers.js';

const ROLES_ADMIN_STAFF = ['admin', 'staff'];
const ROLES_CAFE = ['admin', 'staff', 'cafemanager'];

function attachOccupancyRoutes(router, { reportService, authenticate, authorize, logger }) {
  router.get('/occupancy/:hotelCode', authenticate, authorize(ROLES_ADMIN_STAFF), (req, res, next) => occupancyController({ req, res, next, reportService, logger }));
}

function attachVoucherRoutes(router, { reportService, authenticate, authorize, logger }) {
  router.get('/vouchers/stats', authenticate, authorize(ROLES_ADMIN_STAFF), (req, res, next) => voucherStatsController({ req, res, next, reportService, logger }));
}

function attachOrderAnalytics(router, { reportService, authenticate, authorize, logger }) {
  router.get('/orders/consumption', authenticate, authorize(ROLES_CAFE), (req, res, next) => orderConsumptionController({ req, res, next, reportService, logger }));
  router.get('/revenue/daily', authenticate, authorize(ROLES_ADMIN_STAFF), (req, res, next) => dailyRevenueController({ req, res, next, reportService, logger }));
  router.get('/products/top', authenticate, authorize(ROLES_CAFE), (req, res, next) => topProductsController({ req, res, next, reportService, logger }));
  router.get('/hours/peak', authenticate, authorize(ROLES_CAFE), (req, res, next) => peakHoursController({ req, res, next, reportService, logger }));
}

function attachDashboardRoutes(router, { reportService, authenticate, authorize, logger }) {
  router.get('/dashboard/:hotelCode', authenticate, authorize(ROLES_ADMIN_STAFF), (req, res, next) => dashboardController({ req, res, next, reportService, logger }));
}

export function createReportsRoutes({ reportService, authenticate, authorize, logger }) {
  const router = Router();
  const deps = { reportService, authenticate, authorize, logger };
  attachOccupancyRoutes(router, deps);
  attachVoucherRoutes(router, deps);
  attachOrderAnalytics(router, deps);
  attachDashboardRoutes(router, deps);
  return router;
}

export default createReportsRoutes;
