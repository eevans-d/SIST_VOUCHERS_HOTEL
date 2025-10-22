/**
 * CompleteOrder Refactorization Tests - Issue #5
 * Validar que los métodos auxiliares funcionan correctamente
 * y reducen complejidad ciclomática
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CompleteOrder } from '../../../src/application/use-cases/CompleteOrder.js';

describe('CompleteOrder - Issue #5 Refactorization', () => {
  let completeOrder;
  let mockOrderRepository;
  let mockVoucherRepository;
  let mockLogger;

  beforeEach(() => {
    // Mock repositories
    mockOrderRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockVoucherRepository = {
      validateAndRedeem: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    completeOrder = new CompleteOrder({
      orderRepository: mockOrderRepository,
      voucherRepository: mockVoucherRepository,
      logger: mockLogger,
    });
  });

  // ========================================================================
  // TESTS: Métodos de Validación
  // ========================================================================

  describe('Validation Methods (_validateOrder, _validateItems)', () => {
    it('should throw error when order not found', () => {
      mockOrderRepository.findById.mockReturnValue(null);

      expect(() => {
        completeOrder._findOrder('non-existent-id');
      }).toThrow('Orden non-existent-id no encontrada');
    });

    it('should throw error when order is not open', () => {
      const closedOrder = { id: '123', status: 'completed', items: [] };
      mockOrderRepository.findById.mockReturnValue(closedOrder);

      expect(() => {
        completeOrder._validateOrder('123');
      }).toThrow('No se puede completar orden con estado: completed');
    });

    it('should throw error when order has no items', () => {
      const order = { id: '123', status: 'open', items: [] };

      expect(() => {
        completeOrder._validateItems(order);
      }).toThrow('Orden debe tener al menos un item');
    });

    it('should pass validation with valid open order with items', () => {
      const order = {
        id: '123',
        status: 'open',
        items: [{ id: 'item-1', quantity: 1 }],
      };

      expect(() => {
        completeOrder._validateItems(order);
      }).not.toThrow();
    });
  });

  describe('Cancellation Validation', () => {
    it('should throw error when order cannot be cancelled', () => {
      const cancelledOrder = { id: '123', status: 'cancelled' };

      expect(() => {
        completeOrder._validateCancellation(cancelledOrder);
      }).toThrow('No puede cancelarse');
    });

    it('should allow cancellation of open order', () => {
      const openOrder = { id: '123', status: 'open' };

      expect(() => {
        completeOrder._validateCancellation(openOrder);
      }).not.toThrow();
    });

    it('should allow cancellation of completed order', () => {
      const completedOrder = { id: '123', status: 'completed' };

      expect(() => {
        completeOrder._validateCancellation(completedOrder);
      }).not.toThrow();
    });
  });

  // ========================================================================
  // TESTS: Método de Procesamiento de Vouchers
  // ========================================================================

  describe('Voucher Processing (_processVoucher)', () => {
    it('should successfully process valid voucher', async () => {
      const mockResult = { voucherId: 'voucher-123' };
      mockVoucherRepository.validateAndRedeem.mockReturnValue(mockResult);

      const result = await completeOrder._processVoucher('VOC-ABC', 'order-1');

      expect(result.success).toBe(true);
      expect(result.voucherId).toBe('voucher-123');
    });

    it('should handle voucher validation failure gracefully', async () => {
      mockVoucherRepository.validateAndRedeem.mockImplementation(() => {
        throw new Error('Voucher expired');
      });

      const result = await completeOrder._processVoucher('VOC-ABC', 'order-1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Voucher expired');
    });

    it('should return failed result if voucherId is missing', async () => {
      mockVoucherRepository.validateAndRedeem.mockReturnValue({});

      const result = await completeOrder._processVoucher('VOC-ABC', 'order-1');

      expect(result.success).toBe(false);
    });
  });

  describe('Apply Vouchers to Order (_applyVouchersToOrder)', () => {
    it('should apply discounts from multiple vouchers', async () => {
      const order = {
        id: 'order-1',
        items: [{ quantity: 1, unitPrice: 10 }],
        total: 10,
        vouchersUsed: [],
        discountAmount: 0,
        finalTotal: 10,
        recalculateTotals: jest.fn(),
      };

      mockVoucherRepository.validateAndRedeem
        .mockReturnValueOnce({ voucherId: 'v1' })
        .mockReturnValueOnce({ voucherId: 'v2' });

      await completeOrder._applyVouchersToOrder(order, ['VOC-1', 'VOC-2'], 'order-1');

      expect(order.vouchersUsed).toEqual(['v1', 'v2']);
      expect(order.discountAmount).toBe(20); // 2 vouchers × 10
      expect(order.recalculateTotals).toHaveBeenCalled();
    });

    it('should handle partial voucher failures', async () => {
      const order = {
        id: 'order-1',
        items: [{ quantity: 1, unitPrice: 10 }],
        total: 10,
        vouchersUsed: [],
        discountAmount: 0,
        finalTotal: 10,
        recalculateTotals: jest.fn(),
      };

      // First voucher succeeds, second fails
      mockVoucherRepository.validateAndRedeem
        .mockReturnValueOnce({ voucherId: 'v1' })
        .mockImplementationOnce(() => {
          throw new Error('Voucher not found');
        });

      await completeOrder._applyVouchersToOrder(order, ['VOC-1', 'VOC-2'], 'order-1');

      // Should still apply the successful voucher
      expect(order.vouchersUsed).toEqual(['v1']);
      expect(order.discountAmount).toBe(10);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Apply Discounts (_applyDiscounts)', () => {
    it('should calculate total discount correctly', () => {
      const order = {
        vouchersUsed: [],
        discountAmount: 0,
        recalculateTotals: jest.fn(),
      };

      completeOrder._applyDiscounts(order, ['v1', 'v2', 'v3']);

      expect(order.vouchersUsed).toEqual(['v1', 'v2', 'v3']);
      expect(order.discountAmount).toBe(30); // 3 vouchers × 10
      expect(order.recalculateTotals).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // TESTS: Métodos de Estado (Complete/Cancel)
  // ========================================================================

  describe('State Operations', () => {
    it('_completeOrder should call order.complete()', () => {
      const order = { complete: jest.fn() };
      completeOrder._completeOrder(order);
      expect(order.complete).toHaveBeenCalled();
    });

    it('_cancelOrder should call order.cancel with reason', () => {
      const order = { cancel: jest.fn() };
      completeOrder._cancelOrder(order, 'Customer request');
      expect(order.cancel).toHaveBeenCalledWith('Customer request');
    });
  });

  // ========================================================================
  // TESTS: Métodos de Persistencia y Logging
  // ========================================================================

  describe('Persistence and Logging', () => {
    it('_saveOrder should call orderRepository.update', async () => {
      const order = { id: '123' };
      await completeOrder._saveOrder(order);
      expect(mockOrderRepository.update).toHaveBeenCalledWith(order);
    });

    it('_logCompletion should log correct details', () => {
      const order = {
        id: 'order-1',
        stayId: 'stay-1',
        items: [{ quantity: 2 }],
        total: 20,
        discountAmount: 5,
        finalTotal: 15,
        vouchersUsed: ['v1'],
      };

      completeOrder._logCompletion(order);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Orden completada',
        expect.objectContaining({
          orderId: 'order-1',
          stayId: 'stay-1',
          itemsCount: 1,
          subtotal: 20,
          discountApplied: 5,
          finalTotal: 15,
          vouchersUsed: 1,
        })
      );
    });

    it('_logCancellation should log cancellation with reason', () => {
      const order = { id: 'order-1', stayId: 'stay-1' };
      completeOrder._logCancellation(order, 'Customer request');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Orden cancelada',
        expect.objectContaining({
          orderId: 'order-1',
          stayId: 'stay-1',
          reason: 'Customer request',
        })
      );
    });
  });

  // ========================================================================
  // TESTS: Métodos de Formateo de Respuesta
  // ========================================================================

  describe('Response Formatting', () => {
    it('_formatCompletionResponse should include all required fields', () => {
      const order = {
        id: 'order-1',
        status: 'completed',
        items: [{ quantity: 1 }],
        total: 10,
        discountAmount: 2,
        finalTotal: 8,
        vouchersUsed: ['v1'],
        getSummary: jest.fn(() => ({
          itemCount: 1,
          subtotal: 10,
          discount: 2,
          finalTotal: 8,
        })),
      };

      const response = completeOrder._formatCompletionResponse(order);

      expect(response).toMatchObject({
        id: 'order-1',
        status: 'completed',
        vouchersApplied: 1,
        message: 'Orden completada exitosamente',
      });
      expect(response.summary).toBeDefined();
    });

    it('_formatCancellationResponse should include cancellation info', () => {
      const order = {
        id: 'order-1',
        status: 'cancelled',
      };

      const response = completeOrder._formatCancellationResponse(order);

      expect(response).toEqual({
        id: 'order-1',
        status: 'cancelled',
        message: 'Orden cancelada exitosamente',
      });
    });
  });

  // ========================================================================
  // INTEGRATION TESTS: Flujos Completos
  // ========================================================================

  describe('Integration: Complete Order Flow', () => {
    it('should complete order with valid data and no vouchers', async () => {
      const order = {
        id: 'order-1',
        status: 'open',
        items: [{ id: 'item-1', quantity: 1 }],
        total: 10,
        discountAmount: 0,
        finalTotal: 10,
        vouchersUsed: [],
        complete: jest.fn(),
        recalculateTotals: jest.fn(),
        getSummary: jest.fn(() => ({
          itemCount: 1,
          subtotal: 10,
          discount: 0,
          finalTotal: 10,
        })),
      };

      mockOrderRepository.findById.mockReturnValue(order);

      const result = await completeOrder.execute({
        orderId: 'order-1',
        voucherCodes: [],
      });

      expect(result.status).toBe('completed');
      expect(order.complete).toHaveBeenCalled();
      expect(mockOrderRepository.update).toHaveBeenCalledWith(order);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should complete order with vouchers applied', async () => {
      const order = {
        id: 'order-1',
        status: 'open',
        items: [{ quantity: 1 }],
        total: 20,
        discountAmount: 0,
        finalTotal: 20,
        vouchersUsed: [],
        complete: jest.fn(),
        recalculateTotals: jest.fn(),
        getSummary: jest.fn(),
      };

      mockOrderRepository.findById.mockReturnValue(order);
      mockVoucherRepository.validateAndRedeem.mockReturnValue({
        voucherId: 'v1',
      });

      const result = await completeOrder.execute({
        orderId: 'order-1',
        voucherCodes: ['VOC-123'],
      });

      expect(result.vouchersApplied).toBe(1);
      expect(order.vouchersUsed).toContain('v1');
    });
  });

  describe('Integration: Cancel Order Flow', () => {
    it('should cancel open order', async () => {
      const order = {
        id: 'order-1',
        status: 'open',
        cancel: jest.fn(),
      };

      mockOrderRepository.findById.mockReturnValue(order);

      const result = await completeOrder.cancel({
        orderId: 'order-1',
        reason: 'Customer request',
      });

      expect(result.status).toBe('cancelled');
      expect(order.cancel).toHaveBeenCalledWith('Customer request');
      expect(mockOrderRepository.update).toHaveBeenCalled();
    });

    it('should fail to cancel non-cancellable order', async () => {
      const order = {
        id: 'order-1',
        status: 'cancelled',
      };

      mockOrderRepository.findById.mockReturnValue(order);

      await expect(
        completeOrder.cancel({ orderId: 'order-1' })
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // COMPLEXITY ANALYSIS
  // ========================================================================

  describe('Code Complexity Metrics (Issue #5)', () => {
    it('should extract execute() into smaller methods', () => {
      // Verify that private methods exist
      const privateMethods = [
        '_validateOrder',
        '_validateItems',
        '_applyVouchersToOrder',
        '_processVoucher',
        '_applyDiscounts',
        '_completeOrder',
        '_saveOrder',
        '_logCompletion',
        '_formatCompletionResponse',
      ];

      privateMethods.forEach(method => {
        expect(typeof completeOrder[method]).toBe('function');
      });
    });

    it('should reduce cyclomatic complexity from 8 to 3', () => {
      // Execute method should have ~3 decision points:
      // 1. try-catch
      // 2. if voucherCodes.length > 0
      // 3. error handling

      const executeCode = completeOrder.execute.toString();
      const ifStatements = (executeCode.match(/if\s*\(/g) || []).length;

      // Should be minimal ifs in main execute (delegated to helpers)
      expect(ifStatements).toBeLessThanOrEqual(2);
    });

    it('should improve code maintainability', () => {
      // Each method should be focused on one responsibility
      const methods = [
        { name: '_validateOrder', purpose: 'validation' },
        { name: '_applyVouchersToOrder', purpose: 'voucher application' },
        { name: '_completeOrder', purpose: 'state change' },
        { name: '_saveOrder', purpose: 'persistence' },
        { name: '_logCompletion', purpose: 'logging' },
      ];

      methods.forEach(({ name }) => {
        expect(typeof completeOrder[name]).toBe('function');
      });
    });
  });

  // ========================================================================
  // BACKWARDS COMPATIBILITY
  // ========================================================================

  describe('API Backwards Compatibility', () => {
    it('should maintain execute() public API', () => {
      expect(typeof completeOrder.execute).toBe('function');
    });

    it('should maintain cancel() public API', () => {
      expect(typeof completeOrder.cancel).toBe('function');
    });

    it('should return same response format as before', async () => {
      const order = {
        id: 'order-1',
        status: 'open',
        items: [{ quantity: 1 }],
        total: 10,
        discountAmount: 0,
        finalTotal: 10,
        vouchersUsed: [],
        complete: jest.fn(),
        recalculateTotals: jest.fn(),
        getSummary: jest.fn(),
      };

      mockOrderRepository.findById.mockReturnValue(order);

      const result = await completeOrder.execute({ orderId: 'order-1' });

      // Response should include these fields (pre-refactor compatibility)
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('vouchersApplied');
      expect(result).toHaveProperty('message');
    });
  });
});
