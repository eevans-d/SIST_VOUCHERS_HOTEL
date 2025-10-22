const Order = require('../entities/Order');

/**
 * OrderRepository - Gestiona persistencia de órdenes
 * 
 * Responsabilidades:
 * - CRUD de órdenes
 * - Consultas por estado, stay, fecha
 * - Estadísticas de consumo
 * 
 * @class OrderRepository
 */
class OrderRepository {
  /**
   * @param {Database} database - Instancia de better-sqlite3
   */
  constructor(database) {
    this.db = database;
  }

  /**
   * Obtiene una orden por ID
   * 
   * @param {string} id - UUID de la orden
   * @returns {Order|null} Orden encontrada o null
   */
  findById(id) {
    const sql = `
      SELECT id, stayId, status, total, discountAmount, finalTotal,
             notes, createdAt, completedAt, updatedAt
      FROM orders
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(id);

    if (!row) {
      return null;
    }

    // Obtener items
    const itemsSql = `
      SELECT id, orderId, productCode, productName, quantity, unitPrice, subtotal
      FROM order_items
      WHERE orderId = ?
      ORDER BY createdAt ASC
    `;
    const items = this.db.prepare(itemsSql).all(id);

    // Obtener vouchers
    const vouchersSql = `
      SELECT voucherId FROM order_vouchers WHERE orderId = ?
    `;
    const vouchersUsed = this.db.prepare(vouchersSql).all(id).map((r) => r.voucherId);

    return this._hydrateOrder({ ...row, items, vouchersUsed });
  }

  /**
   * Obtiene todas las órdenes de una estadía
   * 
   * @param {string} stayId - ID de la estadía
   * @returns {Order[]} Array de órdenes
   */
  findByStayId(stayId) {
    const sql = `
      SELECT id, stayId, status, total, discountAmount, finalTotal,
             notes, createdAt, completedAt, updatedAt
      FROM orders
      WHERE stayId = ?
      ORDER BY createdAt DESC
    `;

    const rows = this.db.prepare(sql).all(stayId);

    return rows.map((row) => {
      const itemsSql = `
        SELECT id, orderId, productCode, productName, quantity, unitPrice, subtotal
        FROM order_items
        WHERE orderId = ?
      `;
      const items = this.db.prepare(itemsSql).all(row.id);

      const vouchersSql = `
        SELECT voucherId FROM order_vouchers WHERE orderId = ?
      `;
      const vouchersUsed = this.db.prepare(vouchersSql).all(row.id).map((r) => r.voucherId);

      return this._hydrateOrder({ ...row, items, vouchersUsed });
    });
  }

  /**
   * Obtiene órdenes por estado
   * 
   * @param {string} status - Estado (open, completed, cancelled)
   * @param {number} [limit=100] - Límite
   * @param {number} [offset=0] - Offset para paginación
   * @returns {Object} {orders: Order[], total: number}
   */
  findByStatus(status, limit = 100, offset = 0) {
    const sqlCount = `SELECT COUNT(*) as total FROM orders WHERE status = ?`;
    const countResult = this.db.prepare(sqlCount).get(status);

    const sql = `
      SELECT id, stayId, status, total, discountAmount, finalTotal,
             notes, createdAt, completedAt, updatedAt
      FROM orders
      WHERE status = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(sql).all(status, limit, offset);

    const orders = rows.map((row) => {
      const itemsSql = `
        SELECT id, orderId, productCode, productName, quantity, unitPrice, subtotal
        FROM order_items
        WHERE orderId = ?
      `;
      const items = this.db.prepare(itemsSql).all(row.id);

      const vouchersSql = `
        SELECT voucherId FROM order_vouchers WHERE orderId = ?
      `;
      const vouchersUsed = this.db.prepare(vouchersSql).all(row.id).map((r) => r.voucherId);

      return this._hydrateOrder({ ...row, items, vouchersUsed });
    });

    return {
      orders,
      total: countResult.total,
    };
  }

  /**
   * Obtiene órdenes en rango de fechas
   * 
   * @param {Date} startDate - Fecha inicio
   * @param {Date} endDate - Fecha fin
   * @returns {Order[]} Array de órdenes
   */
  findByDateRange(startDate, endDate) {
    const sql = `
      SELECT id, stayId, status, total, discountAmount, finalTotal,
             notes, createdAt, completedAt, updatedAt
      FROM orders
      WHERE createdAt >= ? AND createdAt <= ?
      ORDER BY createdAt DESC
    `;

    const rows = this.db.prepare(sql).all(
      startDate.toISOString(),
      endDate.toISOString()
    );

    return rows.map((row) => {
      const itemsSql = `
        SELECT id, orderId, productCode, productName, quantity, unitPrice, subtotal
        FROM order_items
        WHERE orderId = ?
      `;
      const items = this.db.prepare(itemsSql).all(row.id);

      const vouchersSql = `
        SELECT voucherId FROM order_vouchers WHERE orderId = ?
      `;
      const vouchersUsed = this.db.prepare(vouchersSql).all(row.id).map((r) => r.voucherId);

      return this._hydrateOrder({ ...row, items, vouchersUsed });
    });
  }

  /**
   * Crea y persiste una nueva orden
   * 
   * @param {Order} order - Instancia de Order
   * @returns {Order} Order con ID asignado
   */
  save(order) {
    const sql = `
      INSERT INTO orders (id, stayId, status, total, discountAmount, 
                         finalTotal, notes, createdAt, completedAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.prepare(sql).run(
      order.id,
      order.stayId,
      order.status,
      order.total,
      order.discountAmount,
      order.finalTotal,
      order.notes || null,
      order.createdAt.toISOString(),
      order.completedAt?.toISOString() || null,
      order.updatedAt.toISOString()
    );

    // Guardar items
    const itemsSql = `
      INSERT INTO order_items (id, orderId, productCode, productName, 
                               quantity, unitPrice, subtotal, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const item of order.items) {
      this.db.prepare(itemsSql).run(
        item.id,
        order.id,
        item.productCode,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.subtotal,
        new Date().toISOString()
      );
    }

    // Guardar relación vouchers
    const voucherSql = `
      INSERT INTO order_vouchers (orderId, voucherId, createdAt)
      VALUES (?, ?, ?)
    `;

    for (const voucherId of order.vouchersUsed) {
      this.db.prepare(voucherSql).run(
        order.id,
        voucherId,
        new Date().toISOString()
      );
    }

    return order;
  }

  /**
   * Actualiza una orden existente
   * 
   * @param {Order} order - Order a actualizar
   * @returns {Order} Order actualizado
   */
  update(order) {
    const sql = `
      UPDATE orders
      SET stayId = ?, status = ?, total = ?, discountAmount = ?,
          finalTotal = ?, notes = ?, completedAt = ?, updatedAt = ?
      WHERE id = ?
    `;

    this.db.prepare(sql).run(
      order.stayId,
      order.status,
      order.total,
      order.discountAmount,
      order.finalTotal,
      order.notes || null,
      order.completedAt?.toISOString() || null,
      order.updatedAt.toISOString(),
      order.id
    );

    // Actualizar items - eliminar anteriores y crear nuevos
    this.db.prepare('DELETE FROM order_items WHERE orderId = ?').run(order.id);

    const itemsSql = `
      INSERT INTO order_items (id, orderId, productCode, productName,
                               quantity, unitPrice, subtotal, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const item of order.items) {
      this.db.prepare(itemsSql).run(
        item.id,
        order.id,
        item.productCode,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.subtotal,
        new Date().toISOString()
      );
    }

    return order;
  }

  /**
   * Obtiene estadísticas de consumo
   * 
   * @returns {Object} Estadísticas
   */
  getStats() {
    const sqlOrders = `
      SELECT
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openOrders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedOrders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledOrders,
        SUM(finalTotal) as totalRevenue
      FROM orders
    `;

    const orderStats = this.db.prepare(sqlOrders).get();

    // Top productos
    const sqlTopProducts = `
      SELECT productCode, productName, SUM(quantity) as totalQuantity,
             SUM(subtotal) as totalRevenue
      FROM order_items
      GROUP BY productCode
      ORDER BY totalRevenue DESC
      LIMIT 10
    `;

    const topProducts = this.db.prepare(sqlTopProducts).all();

    return {
      orders: {
        total: orderStats.totalOrders || 0,
        open: orderStats.openOrders || 0,
        completed: orderStats.completedOrders || 0,
        cancelled: orderStats.cancelledOrders || 0,
      },
      revenue: orderStats.totalRevenue || 0,
      topProducts,
    };
  }

  /**
   * Obtiene consumo por huésped (en rango de fechas)
   * 
   * @param {Date} startDate - Fecha inicio
   * @param {Date} endDate - Fecha fin
   * @returns {Array} Consumo por estancia
   */
  getConsumptionByStay(startDate, endDate) {
    const sql = `
      SELECT 
        o.stayId,
        COUNT(o.id) as orderCount,
        SUM(o.finalTotal) as totalSpent,
        SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) as completedOrders
      FROM orders o
      WHERE o.createdAt >= ? AND o.createdAt <= ?
      GROUP BY o.stayId
      ORDER BY totalSpent DESC
    `;

    return this.db.prepare(sql).all(
      startDate.toISOString(),
      endDate.toISOString()
    );
  }

  /**
   * Helper: Convierte fila de BD a instancia Order
   * 
   * @private
   * @param {Object} row - Fila con relaciones
   * @returns {Order} Instancia de Order
   */
  _hydrateOrder(row) {
    return new Order({
      id: row.id,
      stayId: row.stayId,
      status: row.status,
      items: row.items || [],
      total: row.total,
      vouchersUsed: row.vouchersUsed || [],
      discountAmount: row.discountAmount,
      finalTotal: row.finalTotal,
      notes: row.notes,
      createdAt: new Date(row.createdAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      updatedAt: new Date(row.updatedAt),
    });
  }
}

module.exports = OrderRepository;
