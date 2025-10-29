const { z } = require('zod');

/**
 * Schema de validación para Item de Orden
 */
const OrderItemSchema = z.object({
  id: z.string().uuid().optional(),
  orderId: z.string().uuid(),
  productCode: z.string().min(2).max(20),
  productName: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  subtotal: z.number().positive(),
});

/**
 * Schema de validación para Orden
 */
const OrderSchema = z.object({
  id: z.string().uuid().optional(),
  stayId: z.string().uuid(),
  status: z.enum(['open', 'completed', 'cancelled']).default('open'),
  items: z.array(OrderItemSchema).default([]),
  total: z.number().default(0),
  vouchersUsed: z.array(z.string().uuid()).default([]),
  discountAmount: z.number().default(0),
  finalTotal: z.number(),
  notes: z.string().max(500).optional().nullable(),
  createdAt: z.date(),
  completedAt: z.date().optional().nullable(),
  updatedAt: z.date(),
});

/**
 * Entidad Order - Representa una orden de consumo en cafetería
 * 
 * Estados:
 * - open: Orden abierta, se pueden agregar items
 * - completed: Orden cerrada y pagada/canjeada
 * - cancelled: Orden cancelada
 * 
 * @class Order
 * @example
 * const order = Order.create({stayId: '123'});
 * order.addItem({productCode: 'CAFE', productName: 'Café', quantity: 2, unitPrice: 3.50});
 * order.complete();
 */
class Order {
  /**
   * @param {Object} data - Datos de la orden
   * @param {string} data.id - UUID único
   * @param {string} data.stayId - ID de la estadía
   * @param {'open'|'completed'|'cancelled'} data.status - Estado
   * @param {Array} data.items - Items de la orden
   * @param {number} data.total - Total de items
   * @param {string[]} data.vouchersUsed - IDs de vouchers utilizados
   * @param {number} data.discountAmount - Descuento aplicado
   * @param {number} data.finalTotal - Total final a pagar
   * @param {string} [data.notes] - Notas
   * @param {Date} data.createdAt - Fecha de creación
   * @param {Date} [data.completedAt] - Fecha de completación
   * @param {Date} data.updatedAt - Fecha de actualización
   */
  constructor(data) {
    const validated = OrderSchema.parse(data);
    Object.assign(this, validated);
  }

  /**
   * Factory para crear nueva orden
   * 
   * @static
   * @param {string} stayId - ID de la estadía
   * @returns {Order} Nueva instancia
   */
  static create({ stayId }) {
    return new Order({
      stayId,
      status: 'open',
      items: [],
      total: 0,
      vouchersUsed: [],
      discountAmount: 0,
      finalTotal: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Agrega un item a la orden
   * 
   * @param {Object} item - Datos del item
   * @param {string} item.productCode - Código único del producto
   * @param {string} item.productName - Nombre del producto
   * @param {number} item.quantity - Cantidad
   * @param {number} item.unitPrice - Precio unitario
   * @returns {Order} this para encadenamiento
   * @throws {Error} Si la orden ya está cerrada
   */
  addItem({ productCode, productName, quantity, unitPrice }) {
    if (this.status !== 'open') {
      throw new Error(`No se pueden agregar items a una orden ${this.status}`);
    }

    const subtotal = quantity * unitPrice;

    const newItem = {
      id: require('uuid').v4(),
      orderId: this.id,
      productCode,
      productName,
      quantity,
      unitPrice,
      subtotal,
    };

    this.items.push(newItem);
    this._recalculateTotal();

    return this;
  }

  /**
   * Aumenta cantidad de un item existente
   * 
   * @param {string} itemId - ID del item
   * @param {number} quantityToAdd - Cantidad a agregar
   * @returns {Order} this
   */
  increaseItemQuantity(itemId, quantityToAdd) {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Item ${itemId} no encontrado`);
    }

    item.quantity += quantityToAdd;
    item.subtotal = item.quantity * item.unitPrice;
    this._recalculateTotal();

    return this;
  }

  /**
   * Reduce cantidad de un item
   * 
   * @param {string} itemId - ID del item
   * @param {number} quantityToRemove - Cantidad a restar
   * @returns {Order} this
   */
  decreaseItemQuantity(itemId, quantityToRemove) {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Item ${itemId} no encontrado`);
    }

    item.quantity = Math.max(0, item.quantity - quantityToRemove);

    if (item.quantity === 0) {
      this.items = this.items.filter((i) => i.id !== itemId);
    } else {
      item.subtotal = item.quantity * item.unitPrice;
    }

    this._recalculateTotal();
    return this;
  }

  /**
   * Elimina un item de la orden
   * 
   * @param {string} itemId - ID del item a eliminar
   * @returns {Order} this
   */
  removeItem(itemId) {
    this.items = this.items.filter((i) => i.id !== itemId);
    this._recalculateTotal();
    return this;
  }

  /**
   * Aplica voucher(s) a la orden
   * Asume que el descuento es igual al valor del voucher
   * 
   * @param {string|string[]} voucherIds - ID o IDs de vouchers
   * @param {number} discountPerVoucher - Monto de descuento por voucher
   * @returns {Order} this
   */
  applyVouchers(voucherIds, discountPerVoucher = 0) {
    const ids = Array.isArray(voucherIds) ? voucherIds : [voucherIds];

    for (const id of ids) {
      if (!this.vouchersUsed.includes(id)) {
        this.vouchersUsed.push(id);
      }
    }

    this.discountAmount = this.vouchersUsed.length * discountPerVoucher;
    this._recalculateTotal();

    return this;
  }

  /**
   * Recalcula totales
   * 
   * @private
   */
  _recalculateTotal() {
    this.total = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.finalTotal = Math.max(0, this.total - this.discountAmount);
    this.updatedAt = new Date();
  }

  /**
   * Obtiene resumen de la orden
   * 
   * @returns {Object} Resumen: {itemCount, total, discount, finalTotal}
   */
  getSummary() {
    return {
      itemCount: this.items.length,
      itemsQuantity: this.items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: this.total,
      discount: this.discountAmount,
      finalTotal: this.finalTotal,
      vouchersCount: this.vouchersUsed.length,
    };
  }

  /**
   * Completa la orden
   * 
   * @returns {Order} this
   * @throws {Error} Si no hay items
   */
  complete() {
    if (this.items.length === 0) {
      throw new Error('No se puede completar una orden sin items');
    }

    this.status = 'completed';
    this.completedAt = new Date();
    this.updatedAt = new Date();

    return this;
  }

  /**
   * Cancela la orden
   * 
   * @returns {Order} this
   */
  cancel() {
    this.status = 'cancelled';
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Serializa a JSON
   * 
   * @returns {Object} Objeto serializado
   */
  toJSON() {
    return {
      id: this.id,
      stayId: this.stayId,
      status: this.status,
      items: this.items,
      summary: this.getSummary(),
      vouchersUsed: this.vouchersUsed,
      notes: this.notes,
      createdAt: this.createdAt.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Obtiene schema de validación
   * 
   * @static
   * @returns {z.ZodSchema} Schema
   */
  static getSchema() {
    return OrderSchema;
  }
}

module.exports = Order;
