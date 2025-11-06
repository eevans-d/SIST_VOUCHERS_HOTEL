import express from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

/**
 * Rutas HTTP para Órdenes
 * 8 endpoints con RBAC completo
 */
export function createOrdersRoutes({
  createOrder,
  completeOrder,
  orderRepository,
  logger
}) {
  const router = express.Router();

  /**
   * POST /api/orders
   * Crear nueva orden
   * RBAC: Admin, Staff, CafeManager
   */
  router.post(
    '/',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { stayId, items } = req.body;

        if (!stayId) {
          return res.status(400).json({ error: 'stayId requerido' });
        }

        const result = await createOrder.execute({
          stayId,
          items: items || []
        });

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/orders
   * Listar órdenes con filtros
   * RBAC: Admin, Staff, CafeManager
   */
  router.get(
    '/',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { stayId, status, limit = 50, offset = 0 } = req.query;

        let orders;
        if (stayId) {
          orders = orderRepository.findByStayId(stayId, limit, offset);
        } else if (status) {
          orders = orderRepository.findByStatus(status, limit, offset);
        } else {
          orders = orderRepository.findByStatus('open', limit, offset);
        }

        res.json({
          data: orders,
          pagination: { limit: parseInt(limit), offset: parseInt(offset) }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/orders/:id
   * Obtener orden específica
   * RBAC: Admin, Staff, CafeManager
   */
  router.get(
    '/:id',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const order = orderRepository.findById(id);

        if (!order) {
          return res.status(404).json({ error: 'Orden no encontrada' });
        }

        res.json(order);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/orders/:id/items
   * Agregar item a orden
   * RBAC: Admin, Staff, CafeManager
   */
  router.post(
    '/:id/items',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { productCode, productName, quantity, unitPrice } = req.body;

        // Compat E2E: permitir productName omitido y usar productCode como nombre
        if (!productCode || !quantity || !unitPrice) {
          return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        const order = orderRepository.findById(id);
        if (!order) {
          return res.status(404).json({ error: 'Orden no encontrada' });
        }

        order.addItem({
          productCode,
          productName: productName || productCode,
          quantity,
          unitPrice
        });
        orderRepository.update(order);

        const summary = order.getSummary();
        // Compat E2E: exponer totales en nivel raíz
        res.json({ message: 'Item agregado', order: summary, total: summary.total, items: order.items });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /api/orders/:id/items/:itemId
   * Remover item de orden
   * RBAC: Admin, Staff, CafeManager
   */
  router.delete(
    '/:id/items/:itemId',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { id, itemId } = req.params;

        const order = orderRepository.findById(id);
        if (!order) {
          return res.status(404).json({ error: 'Orden no encontrada' });
        }

        order.removeItem(itemId);
        orderRepository.update(order);

        res.json({
          message: 'Item removido',
          order: order.getSummary()
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/orders/:id/complete
   * Completar orden (aplicar vouchers)
   * RBAC: Admin, Staff, CafeManager
   */
  router.post(
    '/:id/complete',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { voucherCodes } = req.body;

        const result = await completeOrder.execute({
          orderId: id,
          voucherCodes: voucherCodes || []
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/orders/:id/cancel
   * Cancelar orden
   * RBAC: Admin, Staff, CafeManager
   */
  router.post(
    '/:id/cancel',
    authenticate,
    authorize(['admin', 'staff', 'cafemanager']),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await completeOrder.cancel({
          orderId: id,
          reason: reason || ''
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/orders/stats/consumption
   * Estadísticas de consumo por huésped
   * RBAC: Admin, Staff
   */
  router.get(
    '/stats/consumption',
    authenticate,
    authorize(['admin', 'staff']),
    async (req, res, next) => {
      try {
        const stats = orderRepository.getStats();
        const averageOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
        // Compat E2E: campos planos esperados por el spec
        res.json({
          totalOrders: stats.totalOrders,
          completedOrders: stats.completedOrders,
          totalRevenue: stats.totalRevenue,
          averageOrderValue
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
