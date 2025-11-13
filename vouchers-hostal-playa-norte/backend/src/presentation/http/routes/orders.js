import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  handleCreateOrder,
  handleListOrders,
  handleGetOrder,
  handleAddItem,
  handleRemoveItem,
  handleComplete,
  handleCancel,
  handleStatsConsumption
} from '../controllers/orders.controllers.js';

/**
 * Rutas HTTP para Órdenes
 * 8 endpoints con RBAC completo
 */
const ROLES_CAFE = ['admin', 'staff', 'cafemanager'];
const ROLES_ADMIN_STAFF = ['admin', 'staff'];

function attachCoreOrderRoutes(router, { createOrder, orderRepository, logger }) {
  router.post('/', authenticate, authorize(ROLES_CAFE), handleCreateOrder(createOrder, logger));
  router.get('/', authenticate, authorize(ROLES_CAFE), handleListOrders(orderRepository));
  router.get('/:id', authenticate, authorize(ROLES_CAFE), handleGetOrder(orderRepository));
}

function attachItemOrderRoutes(router, { orderRepository }) {
  router.post('/:id/items', authenticate, authorize(ROLES_CAFE), handleAddItem(orderRepository));
  router.delete('/:id/items/:itemId', authenticate, authorize(ROLES_CAFE), handleRemoveItem(orderRepository));
}

function attachCompletionRoutes(router, { completeOrder }) {
  router.post('/:id/complete', authenticate, authorize(ROLES_CAFE), handleComplete(completeOrder));
  router.post('/:id/cancel', authenticate, authorize(ROLES_CAFE), handleCancel(completeOrder));
}

function attachStatsRoutes(router, { orderRepository }) {
  router.get('/stats/consumption', authenticate, authorize(ROLES_ADMIN_STAFF), handleStatsConsumption(orderRepository));
}

export function createOrdersRoutes({ createOrder, completeOrder, orderRepository, logger }) {
  const router = express.Router();
  attachCoreOrderRoutes(router, { createOrder, orderRepository, logger });
  attachItemOrderRoutes(router, { orderRepository });
  attachCompletionRoutes(router, { completeOrder });
  attachStatsRoutes(router, { orderRepository });
  return router;
}
