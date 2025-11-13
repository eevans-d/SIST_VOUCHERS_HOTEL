import { Order } from '../entities/Order.js';
import { insertOrder, insertOrderItems, insertOrderVouchers, updateOrder, replaceOrderItems, replaceOrderVouchers } from './order.helpers.js';

/**
 * OrderRepository - Capa de persistencia para Órdenes
 * Gestiona operaciones de BD de órdenes y sus items
 */
export class OrderRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Buscar orden por ID
   */
  findById(orderId) {
    const query = 'SELECT * FROM orders WHERE id = ?';
    const orderData = this.db.prepare(query).get(orderId);
    if (!orderData) return null;

    // Cargar items
    const items = this.getOrderItems(orderId);
    orderData.items = items;

    return Order.fromDatabase(orderData);
  }

  /**
   * Buscar órdenes por stay
   */
  findByStayId(stayId, limit = 100, offset = 0) {
    const query = `
      SELECT * FROM orders 
      WHERE stayId = ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    const orders = this.db.prepare(query).all(stayId, limit, offset);

    return orders.map((data) => {
      const items = this.getOrderItems(data.id);
      data.items = items;
      return Order.fromDatabase(data);
    });
  }

  /**
   * Buscar órdenes por estado
   */
  findByStatus(status, limit = 100, offset = 0) {
    const query = `
      SELECT * FROM orders 
      WHERE status = ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    const orders = this.db.prepare(query).all(status, limit, offset);

    return orders.map((data) => {
      const items = this.getOrderItems(data.id);
      data.items = items;
      return Order.fromDatabase(data);
    });
  }

  /**
   * Buscar órdenes por rango de fechas
   */
  findByDateRange(startDate, endDate, limit = 100, offset = 0) {
    const query = `
      SELECT * FROM orders 
      WHERE createdAt >= ? AND createdAt <= ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    const orders = this.db
      .prepare(query)
      .all(startDate, endDate, limit, offset);

    return orders.map((data) => {
      const items = this.getOrderItems(data.id);
      data.items = items;
      return Order.fromDatabase(data);
    });
  }

  /**
   * Obtener items de una orden
   */
  getOrderItems(orderId) {
    const query = 'SELECT * FROM order_items WHERE orderId = ?';
    return this.db.prepare(query).all(orderId);
  }

  /**
   * Obtener vouchers usados en una orden
   */
  getOrderVouchers(orderId) {
    const query = 'SELECT voucherId FROM order_vouchers WHERE orderId = ?';
    const rows = this.db.prepare(query).all(orderId);
    return rows.map((r) => r.voucherId);
  }

  /**
   * Guardar orden (crear o actualizar)
   */
  save(order) {
    return this.db.transaction(() => {
      const data = order.toJSON();
      const existing = this.findById(data.id);
      if (existing) return this.update(order);
      insertOrder(this.db, data);
      insertOrderItems(this.db, data.id, data.items);
      insertOrderVouchers(this.db, data.id, data.vouchersUsed);
      return data.id;
    })();
  }

  /**
   * Actualizar orden
   */
  update(order) {
    return this.db.transaction(() => {
      const data = order.toJSON();
      updateOrder(this.db, data);
      replaceOrderItems(this.db, data.id, data.items);
      replaceOrderVouchers(this.db, data.id, data.vouchersUsed);
      return data.id;
    })();
  }

  /**
   * Obtener estadísticas de órdenes
   */
  getStats() {
    const query = `
      SELECT 
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openOrders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedOrders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledOrders,
        COALESCE(SUM(finalTotal), 0) as totalRevenue
      FROM orders
    `;

    return this.db.prepare(query).get();
  }

  /**
   * Consumo por estadía
   */
  getConsumptionByStay(stayId) {
    const query = `
      SELECT 
        stayId,
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedOrders,
        COALESCE(SUM(finalTotal), 0) as totalSpent,
        COALESCE(SUM(discountAmount), 0) as totalDiscount
      FROM orders
      WHERE stayId = ?
      GROUP BY stayId
    `;

    return this.db.prepare(query).get(stayId);
  }

  /**
   * Top productos vendidos
   */
  getTopProducts(limit = 10) {
    const query = `
      SELECT 
        productCode,
        productName,
        COUNT(*) as quantity,
        SUM(subtotal) as totalSales
      FROM order_items
      GROUP BY productCode
      ORDER BY quantity DESC
      LIMIT ?
    `;

    return this.db.prepare(query).all(limit);
  }

  /**
   * Eliminar orden
   */
  delete(orderId) {
    return this.db.transaction(() => {
      this.db.prepare('DELETE FROM order_items WHERE orderId = ?').run(orderId);
      this.db
        .prepare('DELETE FROM order_vouchers WHERE orderId = ?')
        .run(orderId);
      this.db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    })();
  }
}
