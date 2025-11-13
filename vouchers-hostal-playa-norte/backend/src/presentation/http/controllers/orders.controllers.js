/**
 * @file orders.controllers.js
 * @description Controladores desacoplados para rutas de órdenes.
 */

export function handleCreateOrder(createOrder, logger) {
  return async function (req, res, next) {
    try {
      const { stayId, items } = req.body;
      if (!stayId) {
        return res.status(400).json({ error: 'stayId requerido' });
      }
      const result = await createOrder.execute({ stayId, items: items || [] });
      logger?.info('Orden creada', { stayId, itemsCount: (items || []).length });
      res.status(201).json(result);
    } catch (error) { next(error); }
  };
}

export function handleListOrders(orderRepository) {
  return function (req, res, next) {
    try {
      const { stayId, status, limit = 50, offset = 0 } = req.query;
      let orders;
      if (stayId) { orders = orderRepository.findByStayId(stayId, limit, offset); }
      else if (status) { orders = orderRepository.findByStatus(status, limit, offset); }
      else { orders = orderRepository.findByStatus('open', limit, offset); }
      res.json({ data: orders, pagination: { limit: parseInt(limit), offset: parseInt(offset) } });
    } catch (error) { next(error); }
  };
}

export function handleGetOrder(orderRepository) {
  return function (req, res, next) {
    try {
      const { id } = req.params;
      const order = orderRepository.findById(id);
      if (!order) { return res.status(404).json({ error: 'Orden no encontrada' }); }
      res.json(order);
    } catch (error) { next(error); }
  };
}

export function handleAddItem(orderRepository) {
  return function (req, res, next) {
    try {
      const { id } = req.params;
      const { productCode, productName, quantity, unitPrice } = req.body;
      if (!productCode || !quantity || !unitPrice) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
      }
      const order = orderRepository.findById(id);
      if (!order) { return res.status(404).json({ error: 'Orden no encontrada' }); }
      order.addItem({ productCode, productName: productName || productCode, quantity, unitPrice });
      orderRepository.update(order);
      const summary = order.getSummary();
      res.json({ message: 'Item agregado', order: summary, total: summary.total, items: order.items });
    } catch (error) { next(error); }
  };
}

export function handleRemoveItem(orderRepository) {
  return function (req, res, next) {
    try {
      const { id, itemId } = req.params;
      const order = orderRepository.findById(id);
      if (!order) { return res.status(404).json({ error: 'Orden no encontrada' }); }
      order.removeItem(itemId);
      orderRepository.update(order);
      res.json({ message: 'Item removido', order: order.getSummary() });
    } catch (error) { next(error); }
  };
}

export function handleComplete(completeOrder) {
  return async function (req, res, next) {
    try {
      const { id } = req.params;
      const { voucherCodes } = req.body;
      const result = await completeOrder.execute({ orderId: id, voucherCodes: voucherCodes || [] });
      res.json(result);
    } catch (error) { next(error); }
  };
}

export function handleCancel(completeOrder) {
  return async function (req, res, next) {
    try {
      const { id } = req.params; const { reason } = req.body;
      const result = await completeOrder.cancel({ orderId: id, reason: reason || '' });
      res.json(result);
    } catch (error) { next(error); }
  };
}

export function handleStatsConsumption(orderRepository) {
  return function (req, res, next) {
    try {
      const stats = orderRepository.getStats();
      const averageOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
      res.json({ totalOrders: stats.totalOrders, completedOrders: stats.completedOrders, totalRevenue: stats.totalRevenue, averageOrderValue });
    } catch (error) { next(error); }
  };
}
