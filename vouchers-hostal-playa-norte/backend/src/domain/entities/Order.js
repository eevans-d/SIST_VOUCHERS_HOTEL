import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Esquema para item de orden
const OrderItemSchema = z.object({
  id: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  productCode: z.string(),
  productName: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  subtotal: z.number().min(0),
});

// Esquema principal de Order
export const OrderSchema = z.object({
  id: z.string().uuid().optional(),
  stayId: z.string().uuid(),
  status: z.enum(['open', 'completed', 'cancelled']),
  items: z.array(OrderItemSchema).optional(),
  total: z.number().min(0),
  discountAmount: z.number().min(0),
  finalTotal: z.number().min(0),
  vouchersUsed: z.array(z.string()).optional(),
  notes: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

/**
 * Entidad Order - Órdenes de consumo en cafetería
 * State Machine: open → completed/cancelled
 */
export class Order {
  constructor(props) {
    this.id = props.id || uuidv4();
    this.stayId = props.stayId;
    this.status = props.status || 'open';
    this.items = props.items || [];
    this.total = props.total || 0;
    this.discountAmount = props.discountAmount || 0;
    this.finalTotal = props.finalTotal || 0;
    this.vouchersUsed = props.vouchersUsed || [];
    this.notes = props.notes || '';
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  /**
   * Factory method: Crear nueva orden
   */
  static create({ stayId, items = [] }) {
    const order = new Order({
      id: uuidv4(),
      stayId,
      status: 'open',
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Agregar items iniciales si hay
    items.forEach(item => {
      const subtotal = item.quantity * item.unitPrice;
      order.items.push({
        id: item.id || uuidv4(),
        orderId: order.id,
        productCode: item.productCode,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal,
      });
    });

    // Recalcular totales
    order.recalculateTotals();
    return order;
  }

  /**
   * Agregar item a la orden
   */
  addItem({ productCode, productName, quantity, unitPrice }) {
    if (this.status !== 'open') {
      throw new Error('No se pueden agregar items a una orden no abierta');
    }

    const subtotal = quantity * unitPrice;
    const newItem = {
      id: uuidv4(),
      orderId: this.id,
      productCode,
      productName,
      quantity,
      unitPrice,
      subtotal,
    };

    OrderItemSchema.parse(newItem);
    this.items.push(newItem);
    this.recalculateTotals();
    this.updatedAt = new Date();
  }

  /**
   * Remover item de la orden
   */
  removeItem(itemId) {
    if (this.status !== 'open') {
      throw new Error('No se pueden remover items de una orden no abierta');
    }

    this.items = this.items.filter(i => i.id !== itemId);
    this.recalculateTotals();
    this.updatedAt = new Date();
  }

  /**
   * Aumentar cantidad de item
   */
  increaseItemQuantity(itemId, amount = 1) {
    if (this.status !== 'open') {
      throw new Error('No se puede modificar una orden no abierta');
    }

    const item = this.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item no encontrado');

    item.quantity += amount;
    item.subtotal = item.quantity * item.unitPrice;
    this.recalculateTotals();
    this.updatedAt = new Date();
  }

  /**
   * Disminuir cantidad de item
   */
  decreaseItemQuantity(itemId, amount = 1) {
    if (this.status !== 'open') {
      throw new Error('No se puede modificar una orden no abierta');
    }

    const item = this.items.find(i => i.id === itemId);
    if (!item) throw new Error('Item no encontrado');

    if (item.quantity - amount < 1) {
      this.removeItem(itemId);
    } else {
      item.quantity -= amount;
      item.subtotal = item.quantity * item.unitPrice;
    }

    this.recalculateTotals();
    this.updatedAt = new Date();
  }

  /**
   * Aplicar vouchers como descuento
   */
  applyVouchers(voucherIds, discountPerVoucher) {
    if (this.status !== 'open') {
      throw new Error('No se pueden aplicar vouchers a una orden no abierta');
    }

    this.vouchersUsed = voucherIds;
    this.discountAmount = voucherIds.length * discountPerVoucher;
    this.recalculateTotals();
    this.updatedAt = new Date();
  }

  /**
   * Recalcular totales automáticamente
   */
  recalculateTotals() {
    this.total = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.finalTotal = Math.max(0, this.total - this.discountAmount);
  }

  /**
   * Completar orden
   */
  complete() {
    if (this.status !== 'open') {
      throw new Error(`No se puede completar orden con estado: ${this.status}`);
    }
    if (this.items.length === 0) {
      throw new Error('No se puede completar una orden sin items');
    }

    this.status = 'completed';
    this.updatedAt = new Date();
  }

  /**
   * Cancelar orden
   */
  cancel(reason = '') {
    if (!['open', 'completed'].includes(this.status)) {
      throw new Error(`No se puede cancelar orden con estado: ${this.status}`);
    }

    this.status = 'cancelled';
    this.notes = reason;
    this.updatedAt = new Date();
  }

  /**
   * Obtener resumen de la orden
   */
  getSummary() {
    return {
      orderId: this.id,
      itemCount: this.items.length,
      quantity: this.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: this.total,
      discount: this.discountAmount,
      finalTotal: this.finalTotal,
      vouchersUsed: this.vouchersUsed.length,
      status: this.status,
    };
  }

  /**
   * Serializar para BD
   */
  toJSON() {
    return {
      id: this.id,
      stayId: this.stayId,
      status: this.status,
      items: this.items,
      total: this.total,
      discountAmount: this.discountAmount,
      finalTotal: this.finalTotal,
      vouchersUsed: this.vouchersUsed,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Crear desde BD
   */
  static fromDatabase(data) {
    return new Order({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
  }
}
