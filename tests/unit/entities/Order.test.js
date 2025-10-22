const Order = require('../../../src/domain/entities/Order');

describe('Order Entity', () => {
  let order;

  beforeEach(() => {
    order = Order.create({
      stayId: '123e4567-e89b-12d3-a456-426614174000',
    });
  });

  describe('creation', () => {
    test('should create a new order', () => {
      expect(order).toBeDefined();
      expect(order.stayId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(order.status).toBe('open');
      expect(order.items).toEqual([]);
      expect(order.finalTotal).toBe(0);
    });
  });

  describe('items management', () => {
    test('should add item to order', () => {
      order.addItem({
        productCode: 'CAFE',
        productName: 'Café',
        quantity: 2,
        unitPrice: 3.5,
      });

      expect(order.items).toHaveLength(1);
      expect(order.items[0].productCode).toBe('CAFE');
      expect(order.items[0].subtotal).toBe(7);
      expect(order.finalTotal).toBe(7);
    });

    test('should add multiple items', () => {
      order.addItem({ productCode: 'CAFE', productName: 'Café', quantity: 1, unitPrice: 3 });
      order.addItem({ productCode: 'PAN', productName: 'Pan', quantity: 2, unitPrice: 2 });

      expect(order.items).toHaveLength(2);
      expect(order.finalTotal).toBe(7);
    });

    test('should remove item', () => {
      order.addItem({ productCode: 'CAFE', productName: 'Café', quantity: 2, unitPrice: 3 });
      const itemId = order.items[0].id;

      order.removeItem(itemId);

      expect(order.items).toHaveLength(0);
      expect(order.finalTotal).toBe(0);
    });

    test('should not add items to completed order', () => {
      order.addItem({ productCode: 'CAFE', productName: 'Café', quantity: 1, unitPrice: 3 });
      order.complete();

      expect(() => {
        order.addItem({ productCode: 'PAN', productName: 'Pan', quantity: 1, unitPrice: 2 });
      }).toThrow(/No se pueden agregar items/);
    });
  });

  describe('vouchers', () => {
    test('should apply voucher discount', () => {
      order.addItem({ productCode: 'CAFE', productName: 'Café', quantity: 1, unitPrice: 10 });

      order.applyVouchers('voucher-1', 5);

      expect(order.discountAmount).toBe(5);
      expect(order.finalTotal).toBe(5);
    });

    test('should apply multiple vouchers', () => {
      order.addItem({ productCode: 'CAFE', productName: 'Café', quantity: 1, unitPrice: 20 });

      order.applyVouchers(['voucher-1', 'voucher-2'], 5);

      expect(order.vouchersUsed).toHaveLength(2);
      expect(order.discountAmount).toBe(10);
      expect(order.finalTotal).toBe(10);
    });
  });

  describe('summary', () => {
    test('should return order summary', () => {
      order.addItem({ productCode: 'CAFE', productName: 'Café', quantity: 2, unitPrice: 3 });
      order.addItem({ productCode: 'PAN', productName: 'Pan', quantity: 1, unitPrice: 5 });

      const summary = order.getSummary();

      expect(summary.itemCount).toBe(2);
      expect(summary.itemsQuantity).toBe(3);
      expect(summary.subtotal).toBe(11);
      expect(summary.finalTotal).toBe(11);
    });
  });

  describe('state transitions', () => {
    test('should complete order with items', () => {
      order.addItem({ productCode: 'CAFE', productName: 'Café', quantity: 1, unitPrice: 3 });
      order.complete();

      expect(order.status).toBe('completed');
      expect(order.completedAt).toBeDefined();
    });

    test('should not complete order without items', () => {
      expect(() => order.complete()).toThrow(/No se puede completar una orden sin items/);
    });

    test('should cancel order', () => {
      order.cancel();

      expect(order.status).toBe('cancelled');
    });
  });

  describe('serialization', () => {
    test('should serialize to JSON', () => {
      order.addItem({ productCode: 'CAFE', productName: 'Café', quantity: 1, unitPrice: 3 });

      const json = order.toJSON();

      expect(json.id).toBe(order.id);
      expect(json.stayId).toBe(order.stayId);
      expect(json.status).toBe('open');
      expect(json.items).toHaveLength(1);
      expect(json.summary).toBeDefined();
    });
  });
});
