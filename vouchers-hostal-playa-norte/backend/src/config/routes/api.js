/**
 * @file routes/api.js
 * @description Configuración de rutas API
 */

import { createAuthRoutes } from '../../presentation/http/routes/auth.js';
import { createStaysRoutes } from '../../presentation/http/routes/stays.js';
import createVouchersRoutes from '../../presentation/http/routes/vouchers.js';
import { createOrdersRoutes } from '../../presentation/http/routes/orders.js';
import { createReportsRoutes } from '../../presentation/http/routes/reports.js';
import {
  authenticate,
  authorize
} from '../../presentation/http/middleware/auth.middleware.js';
import { logger } from '../logger.setup.js';

export function setupApiRoutes(app, services) {
  app.use(
    '/api/auth',
    createAuthRoutes({
      loginUser: services.loginUser,
      registerUser: services.registerUser,
      jwtService: services.jwtService,
      userRepository: services.userRepository
    })
  );

  app.use(
    '/api/stays',
    createStaysRoutes({
      createStay: services.createStay,
      stayRepository: services.stayRepository,
      userRepository: services.userRepository
    })
  );

  app.use(
    '/api/vouchers',
    createVouchersRoutes({
      generateVoucher: services.generateVoucher,
      validateVoucher: services.validateVoucher,
      redeemVoucher: services.redeemVoucher,
      voucherRepository: services.voucherRepository
    })
  );

  app.use(
    createOrdersRoutes({
      orderRepository: services.orderRepository,
      stayRepository: services.stayRepository,
      createOrder: services.createOrder,
      completeOrder: services.completeOrder,
      logger
    })
  );

  app.use(
    '/api/reports',
    createReportsRoutes({
      reportService: services.reportService,
      authenticate,
      authorize,
      logger
    })
  );
}
