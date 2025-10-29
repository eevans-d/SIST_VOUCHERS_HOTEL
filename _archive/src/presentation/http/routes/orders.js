const express = require('express');

/**
 * Crea router de órdenes
 * 
 * Endpoints:
 * GET    /api/orders              - Listar órdenes
 * GET    /api/orders/:id          - Obtener orden
 * POST   /api/orders              - Crear orden
 * POST   /api/orders/:id/items    - Agregar item
 * DELETE /api/orders/:id/items/:itemId - Eliminar item
 * POST   /api/orders/:id/complete - Completar orden
 * POST   /api/orders/:id/cancel   - Cancelar orden
 * GET    /api/orders/stats/consumption - Estadísticas
 * 
 * @param {Object} services - Servicios inyectados
 * @param {OrderRepository} services.orderRepository
 * @param {StayRepository} services.stayRepository
 * @param {CreateOrder} services.createOrder
 * @param {CompleteOrder} services.completeOrder
 * @param {Logger} services.logger
 * @returns {express.Router} Router configurado
 */
function createOrdersRoutes(services) {
  const router = express.Router();

  const {
    orderRepository,
    stayRepository,
    createOrder,
    completeOrder,
    logger,
  } = services;

  /**
   * GET /api/orders
   * Listar órdenes con filtros
   * 
   * Query params:
   * - stayId: Filtrar por estadía
   * - status: open|completed|cancelled
   * - page: número de página
   * - limit: items por página
   */
  router.get('/api/orders', (req, res) => {
    try {
      // RBAC: Solo admin y staff pueden listar todas
      if (!['admin', 'staff'].includes(req.user?.role)) {
        // Los guests solo ven sus propias órdenes
        if (req.user?.role === 'guest' && !req.query.stayId) {
          return res.status(403).json({
            error: 'Se requiere filtrar por stayId para guests',
          });
        }
      }

      const { stayId, status, page = 1, limit = 20 } = req.query;
      const finalLimit = Math.min(parseInt(limit) || 20, 100);
      const offset = (parseInt(page) - 1) * finalLimit;

      let orders;
      let total = 0;

      if (stayId) {
        orders = orderRepository.findByStayId(stayId);
        total = orders.length;

        if (status) {
          orders = orders.filter((o) => o.status === status);
        }

        orders = orders.slice(offset, offset + finalLimit);
      } else if (status) {
        const result = orderRepository.findByStatus(status, finalLimit, offset);
        orders = result.orders;
        total = result.total;
      } else {
        // Obtener todas
        const result = orderRepository.findByStatus('open', 999999, 0);
        total = result.orders.length;
        orders = result.orders.slice(offset, offset + finalLimit);
      }

      res.json({
        orders: orders.map((o) => o.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: finalLimit,
          total,
          pages: Math.ceil(total / finalLimit),
        },
      });
    } catch (error) {
      logger.error('Error listando órdenes', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * GET /api/orders/:id
   * Obtener una orden específica
   */
  router.get('/api/orders/:id', (req, res) => {
    try {
      const { id } = req.params;
      const order = orderRepository.findById(id);

      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      // RBAC: Guests solo ven sus propias órdenes
      if (req.user?.role === 'guest') {
        const stay = stayRepository.findById(order.stayId);
        if (stay?.userId !== req.user.id) {
          return res.status(403).json({ error: 'No autorizado' });
        }
      }

      res.json(order.toJSON());
    } catch (error) {
      logger.error('Error obteniendo orden', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * POST /api/orders
   * Crear nueva orden
   * 
   * Body:
   * {
   *   stayId: string,
   *   items?: [{productCode, productName, quantity, unitPrice}],
   *   notes?: string
   * }
   */
  router.post('/api/orders', (req, res) => {
    try {
      // RBAC: Solo admin, staff y cafe_manager
      if (!['admin', 'staff', 'cafe_manager'].includes(req.user?.role)) {
        return res.status(403).json({
          error: 'No autorizado para crear órdenes',
        });
      }

      const { stayId, items, notes } = req.body;

      const result = createOrder.execute({
        stayId,
        items,
        notes,
        createdBy: req.user.email,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json(result.data.toJSON());
    } catch (error) {
      logger.error('Error creando orden', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * POST /api/orders/:id/items
   * Agregar item a una orden
   * 
   * Body:
   * {
   *   productCode: string,
   *   productName: string,
   *   quantity: number,
   *   unitPrice: number
   * }
   */
  router.post('/api/orders/:id/items', (req, res) => {
    try {
      // RBAC
      if (!['admin', 'staff', 'cafe_manager'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const { id } = req.params;
      const { productCode, productName, quantity, unitPrice } = req.body;

      const order = orderRepository.findById(id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      order.addItem({
        productCode,
        productName,
        quantity,
        unitPrice,
      });

      orderRepository.update(order);

      res.json(order.toJSON());
    } catch (error) {
      logger.error('Error agregando item', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/orders/:id/items/:itemId
   * Eliminar item de una orden
   */
  router.delete('/api/orders/:id/items/:itemId', (req, res) => {
    try {
      // RBAC
      if (!['admin', 'staff', 'cafe_manager'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const { id, itemId } = req.params;

      const order = orderRepository.findById(id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      order.removeItem(itemId);
      orderRepository.update(order);

      res.json(order.toJSON());
    } catch (error) {
      logger.error('Error eliminando item', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/orders/:id/complete
   * Completar una orden
   * 
   * Body:
   * {
   *   voucherCodes?: string[]
   * }
   */
  router.post('/api/orders/:id/complete', (req, res) => {
    try {
      // RBAC
      if (!['admin', 'staff', 'cafe_manager'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const { id } = req.params;
      const { voucherCodes } = req.body;

      const result = completeOrder.execute({
        orderId: id,
        voucherCodes,
        completedBy: req.user.email,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result.data.toJSON());
    } catch (error) {
      logger.error('Error completando orden', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * POST /api/orders/:id/cancel
   * Cancelar una orden
   * 
   * Body:
   * {
   *   reason?: string
   * }
   */
  router.post('/api/orders/:id/cancel', (req, res) => {
    try {
      // RBAC
      if (!['admin', 'staff', 'cafe_manager'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const result = completeOrder.cancel({
        orderId: id,
        reason,
        cancelledBy: req.user.email,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result.data.toJSON());
    } catch (error) {
      logger.error('Error cancelando orden', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  /**
   * GET /api/orders/stats/consumption
   * Estadísticas de consumo
   * 
   * Query params:
   * - startDate: ISO string
   * - endDate: ISO string
   */
  router.get('/api/orders/stats/consumption', (req, res) => {
    try {
      // RBAC: Solo admin y staff
      if (!['admin', 'staff'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const { startDate, endDate } = req.query;

      const stats = orderRepository.getStats();

      let consumptionByStay = [];
      if (startDate && endDate) {
        consumptionByStay = orderRepository.getConsumptionByStay(
          new Date(startDate),
          new Date(endDate)
        );
      }

      res.json({
        stats,
        consumptionByStay,
        period: { startDate, endDate },
      });
    } catch (error) {
      logger.error('Error obteniendo estadísticas', { error: error.message });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}

module.exports = createOrdersRoutes;
