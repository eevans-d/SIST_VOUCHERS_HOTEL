import { describe, it, expect, beforeEach } from '@jest/globals';
import { Order } from '../../../src/domain/entities/Order.js';

describe('Order Entity', () => {
  let order;

  beforeEach(() => {
    order = Order.create({
      stayId: 'stay-123',
      items: [],
    });
  });

  describe('Creation', () => {
    it('should create an order with valid data', () => {
      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.stayId).toBe('stay-123');
      expect(order.status).toBe('open');
      expect(order.items).toEqual([]);
    });

    it('should create order with initial items', () => {
      const items = [
        {
          productCode: 'CAFE',
          productName: 'Café Americano',
          quantity: 2,
          unitPrice: 3.5,
        },
      ];

      const newOrder = Order.create({ stayId: 'stay-123', items });
      expect(newOrder.items.length).toBe(1);
      expect(newOrder.total).toBe(7);
    });
  });

  describe('Item Management', () => {
    it('should add item to order', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café Americano',
        quantity: 2,
        unitPrice: 3.5,
      });

      expect(order.items.length).toBe(1);
      expect(order.items[0].subtotal).toBe(7);
      expect(order.total).toBe(7);
    });

    it('should remove item from order', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café Americano',
        quantity: 2,
        unitPrice: 3.5,
      });

      const itemId = order.items[0].id;
      order.removeItem(itemId);

      expect(order.items.length).toBe(0);
      expect(order.total).toBe(0);
    });

    it('should increase item quantity', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 2,
        unitPrice: 3.5,
      });

      const itemId = order.items[0].id;
      order.increaseItemQuantity(itemId, 1);

      expect(order.items[0].quantity).toBe(3);
      expect(order.items[0].subtotal).toBe(10.5);
      expect(order.total).toBe(10.5);
    });

    it('should decrease item quantity', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 3,
        unitPrice: 3.5,
      });

      const itemId = order.items[0].id;
      order.decreaseItemQuantity(itemId, 1);

      expect(order.items[0].quantity).toBe(2);
      expect(order.total).toBe(7);
    });

    it('should remove item when quantity reaches 0', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 1,
        unitPrice: 3.5,
      });

      const itemId = order.items[0].id;
      order.decreaseItemQuantity(itemId, 1);

      expect(order.items.length).toBe(0);
    });
  });

  describe('Discounts and Totals', () => {
    it('should apply voucher discounts', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 3,
        unitPrice: 5,
      });

      order.applyVouchers(['v-1', 'v-2'], 2.5);

      expect(order.vouchersUsed.length).toBe(2);
      expect(order.discountAmount).toBe(5);
      expect(order.finalTotal).toBe(10);
    });

    it('should recalculate totals on item changes', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 2,
        unitPrice: 3.5,
      });

      expect(order.total).toBe(7);

      order.addItem({
        productCode: 'JUICE',
        productName: 'Jugo',
        quantity: 1,
        unitPrice: 4,
      });

      expect(order.total).toBe(11);
    });
  });

  describe('Order Completion', () => {
    it('should complete order', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 1,
        unitPrice: 3.5,
      });

      order.complete();
      expect(order.status).toBe('completed');
    });

    it('should throw error completing order without items', () => {
      expect(() => order.complete()).toThrow('No se puede completar una orden sin items');
    });

    it('should throw error completing non-open order', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 1,
        unitPrice: 3.5,
      });

      order.complete();

      expect(() => order.complete()).toThrow();
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel open order', () => {
      order.cancel('Test cancel');
      expect(order.status).toBe('cancelled');
      expect(order.notes).toBe('Test cancel');
    });

    it('should cancel completed order', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 1,
        unitPrice: 3.5,
      });

      order.complete();
      order.cancel('Late cancellation');

      expect(order.status).toBe('cancelled');
    });
  });

  describe('Summary', () => {
    it('should return order summary', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 2,
        unitPrice: 3.5,
      });

      order.applyVouchers(['v-1'], 2);

      const summary = order.getSummary();

      expect(summary.orderId).toBe(order.id);
      expect(summary.itemCount).toBe(1);
      expect(summary.quantity).toBe(2);
      expect(summary.subtotal).toBe(7);
      expect(summary.discount).toBe(2);
      expect(summary.finalTotal).toBe(5);
      expect(summary.status).toBe('open');
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 1,
        unitPrice: 3.5,
      });

      const json = order.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('stayId');
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('items');
      expect(json).toHaveProperty('total');
    });

    it('should deserialize from database', () => {
      const data = {
        id: 'o-1',
        stayId: 'stay-123',
        status: 'open',
        items: [],
        total: 0,
        discountAmount: 0,
        finalTotal: 0,
        vouchersUsed: [],
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const restored = Order.fromDatabase(data);
      expect(restored.id).toBe('o-1');
      expect(restored.stayId).toBe('stay-123');
      expect(restored.status).toBe('open');
    });
  });
});
