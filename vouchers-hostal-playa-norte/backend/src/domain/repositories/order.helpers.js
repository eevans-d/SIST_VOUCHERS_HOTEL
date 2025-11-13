/**
 * Helpers para OrderRepository: operaciones pesadas de insert/update para reducir tamaño de métodos.
 */

/**
 * Inserta registro de orden en tabla orders.
 */
export function insertOrder(db, data) {
  const query = `
    INSERT INTO orders (
      id, stayId, status, total, discountAmount,
      finalTotal, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.prepare(query).run(
    data.id, data.stayId, data.status, data.total, data.discountAmount,
    data.finalTotal, data.notes, data.createdAt, data.updatedAt
  );
}

/**
 * Inserta todos los items de una orden.
 */
export function insertOrderItems(db, orderId, items) {
  const itemQuery = `
    INSERT INTO order_items (
      id, orderId, productCode, productName,
      quantity, unitPrice, subtotal
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const stmt = db.prepare(itemQuery);
  for (const item of items) {
    stmt.run(item.id, orderId, item.productCode, item.productName, item.quantity, item.unitPrice, item.subtotal);
  }
}

/**
 * Inserta relaciones order_vouchers.
 */
export function insertOrderVouchers(db, orderId, voucherIds) {
  const voucherQuery = 'INSERT INTO order_vouchers (orderId, voucherId) VALUES (?, ?)';
  const stmt = db.prepare(voucherQuery);
  for (const voucherId of voucherIds) {
    stmt.run(orderId, voucherId);
  }
}

/**
 * Actualiza registro de orden en tabla orders.
 */
export function updateOrder(db, data) {
  const query = `
    UPDATE orders 
    SET stayId = ?, status = ?, total = ?, 
        discountAmount = ?, finalTotal = ?, 
        notes = ?, updatedAt = ?
    WHERE id = ?
  `;
  db.prepare(query).run(
    data.stayId, data.status, data.total, data.discountAmount,
    data.finalTotal, data.notes, data.updatedAt, data.id
  );
}

/**
 * Limpia y reinserta items de orden.
 */
export function replaceOrderItems(db, orderId, items) {
  db.prepare('DELETE FROM order_items WHERE orderId = ?').run(orderId);
  insertOrderItems(db, orderId, items);
}

/**
 * Limpia y reinserta vouchers de orden.
 */
export function replaceOrderVouchers(db, orderId, voucherIds) {
  db.prepare('DELETE FROM order_vouchers WHERE orderId = ?').run(orderId);
  insertOrderVouchers(db, orderId, voucherIds);
}
