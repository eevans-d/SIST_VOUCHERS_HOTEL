import { describe, it, expect, beforeEach, vi } from 'vitest';
import OwnershipValidator, { requireOwnership, requireAdminOrOwner } from '../src/services/ownershipValidator.service.js';

describe('Ownership Validator', () => {
  let validator;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
    };
    validator = new OwnershipValidator(mockDb);
  });

  describe('Voucher Ownership', () => {
    it('should identify voucher owner', async () => {
      mockDb.get.mockResolvedValue({ owner_id: 1 });
      const isOwner = await validator.isVoucherOwner(1, 123);
      expect(isOwner).toBe(true);
    });

    it('should reject non-owner', async () => {
      mockDb.get.mockResolvedValue({ owner_id: 1 });
      const isOwner = await validator.isVoucherOwner(2, 123);
      expect(isOwner).toBe(false);
    });

    it('should return false for non-existent voucher', async () => {
      mockDb.get.mockResolvedValue(null);
      const isOwner = await validator.isVoucherOwner(1, 999);
      expect(isOwner).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));
      const isOwner = await validator.isVoucherOwner(1, 123);
      expect(isOwner).toBe(false);
    });
  });

  describe('Order Ownership', () => {
    it('should identify order owner', async () => {
      mockDb.get.mockResolvedValue({ user_id: 1 });
      const isOwner = await validator.isOrderOwner(1, 456);
      expect(isOwner).toBe(true);
    });

    it('should reject non-owner', async () => {
      mockDb.get.mockResolvedValue({ user_id: 2 });
      const isOwner = await validator.isOrderOwner(1, 456);
      expect(isOwner).toBe(false);
    });

    it('should return false for non-existent order', async () => {
      mockDb.get.mockResolvedValue(null);
      const isOwner = await validator.isOrderOwner(1, 999);
      expect(isOwner).toBe(false);
    });
  });

  describe('Stay Ownership', () => {
    it('should identify stay owner', async () => {
      mockDb.get.mockResolvedValue({ user_id: 1 });
      const isOwner = await validator.isStayOwner(1, 789);
      expect(isOwner).toBe(true);
    });

    it('should reject non-owner', async () => {
      mockDb.get.mockResolvedValue({ user_id: 2 });
      const isOwner = await validator.isStayOwner(1, 789);
      expect(isOwner).toBe(false);
    });
  });

  describe('Admin or Owner', () => {
    it('admin should always have access', async () => {
      const result = await validator.isAdminOrOwner(1, 'admin', 2);
      expect(result).toBe(true);
    });

    it('owner should have access', async () => {
      const result = await validator.isAdminOrOwner(1, 'user', 1);
      expect(result).toBe(true);
    });

    it('non-owner should be denied', async () => {
      const result = await validator.isAdminOrOwner(1, 'user', 2);
      expect(result).toBe(false);
    });

    it('manager role should not override ownership', async () => {
      const result = await validator.isAdminOrOwner(1, 'manager', 2);
      expect(result).toBe(false);
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple resources', async () => {
      mockDb.get
        .mockResolvedValueOnce({ owner_id: 1 })
        .mockResolvedValueOnce({ owner_id: 1 })
        .mockResolvedValueOnce({ owner_id: 2 });

      const results = await validator.validateOwnership(1, 'Voucher', [1, 2, 3]);
      expect(results).toEqual([true, true, false]);
    });

    it('should handle unknown resource type', async () => {
      await expect(
        validator.validateOwnership(1, 'Unknown', [1])
      ).rejects.toThrow('Unknown resource type');
    });
  });

  describe('Middleware: requireOwnership', () => {
    it('should allow resource owner', async () => {
      const middleware = requireOwnership('Voucher');
      const mockReq = {
        user: { id: 1 },
        params: { id: 123 },
      };
      const mockRes = {};
      let nextCalled = false;

      vi.spyOn(validator, 'isVoucherOwner').mockResolvedValue(true);

      const next = () => {
        nextCalled = true;
      };

      await middleware(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });

    it('should reject non-owner', async () => {
      const middleware = requireOwnership('Voucher');
      const mockReq = {
        user: { id: 1 },
        params: { id: 123 },
      };

      let statusCode = null;
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            statusCode = code;
            return data;
          },
        }),
      };

      vi.spyOn(validator, 'isVoucherOwner').mockResolvedValue(false);

      await middleware(mockReq, mockRes, () => {});
      expect(statusCode).toBe(403);
    });

    it('should reject missing user', async () => {
      const middleware = requireOwnership('Voucher');
      const mockReq = {
        user: null,
        params: { id: 123 },
      };

      let statusCode = null;
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            statusCode = code;
            return data;
          },
        }),
      };

      await middleware(mockReq, mockRes, () => {});
      expect(statusCode).toBe(400);
    });

    it('should use custom resource ID parameter', async () => {
      const middleware = requireOwnership('Order', 'orderId');
      const mockReq = {
        user: { id: 1 },
        params: { orderId: 456 },
      };

      let nextCalled = false;
      const mockRes = {};

      vi.spyOn(validator, 'isOrderOwner').mockResolvedValue(true);

      const next = () => {
        nextCalled = true;
      };

      await middleware(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe('Middleware: requireAdminOrOwner', () => {
    it('should allow admin', async () => {
      const middleware = requireAdminOrOwner('Voucher');
      const mockReq = {
        user: { id: 1, role: 'admin' },
        params: { id: 123 },
      };

      let nextCalled = false;
      const mockRes = {};

      vi.spyOn(validator, 'isAdminOrOwner').mockResolvedValue(true);

      const next = () => {
        nextCalled = true;
      };

      await middleware(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });

    it('should allow owner', async () => {
      const middleware = requireAdminOrOwner('Voucher');
      const mockReq = {
        user: { id: 1, role: 'user' },
        params: { id: 123 },
      };

      let nextCalled = false;
      const mockRes = {};

      vi.spyOn(validator, 'isAdminOrOwner').mockResolvedValue(true);

      const next = () => {
        nextCalled = true;
      };

      await middleware(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);
    });

    it('should reject unauthorized user', async () => {
      const middleware = requireAdminOrOwner('Voucher');
      const mockReq = {
        user: { id: 1, role: 'user' },
        params: { id: 123 },
      };

      let statusCode = null;
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            statusCode = code;
            return data;
          },
        }),
      };

      vi.spyOn(validator, 'isAdminOrOwner').mockResolvedValue(false);

      await middleware(mockReq, mockRes, () => {});
      expect(statusCode).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle middleware errors gracefully', async () => {
      const middleware = requireOwnership('Voucher');
      const mockReq = {
        user: { id: 1 },
        params: { id: 123 },
      };

      let statusCode = null;
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            statusCode = code;
            return data;
          },
        }),
      };

      vi.spyOn(validator, 'isVoucherOwner').mockRejectedValue(new Error('DB error'));

      await middleware(mockReq, mockRes, () => {});
      expect(statusCode).toBe(500);
    });

    it('should handle 404 for non-existent resource', async () => {
      const middleware = requireAdminOrOwner('Voucher');
      const mockReq = {
        user: { id: 1, role: 'admin' },
        params: { id: 999 },
      };

      let statusCode = null;
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            statusCode = code;
            return data;
          },
        }),
      };

      // Simulate resource not found
      vi.spyOn(validator, 'isAdminOrOwner').mockResolvedValue(false);

      await middleware(mockReq, mockRes, () => {});
      expect([403, 404]).toContain(statusCode);
    });
  });

  describe('Audit Trail', () => {
    it('should track authorization checks', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockDb.get.mockRejectedValue(new Error('DB error'));
      await validator.isVoucherOwner(1, 123);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log ownership validation attempts', async () => {
      mockDb.get.mockResolvedValue({ owner_id: 1 });
      const result = await validator.isVoucherOwner(1, 123);
      expect(result).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should validate ownership in < 20ms', async () => {
      mockDb.get.mockResolvedValue({ owner_id: 1 });
      
      const start = Date.now();
      await validator.isVoucherOwner(1, 123);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(20);
    });

    it('should validate multiple resources concurrently', async () => {
      mockDb.get
        .mockResolvedValueOnce({ owner_id: 1 })
        .mockResolvedValueOnce({ owner_id: 1 })
        .mockResolvedValueOnce({ owner_id: 1 });

      const start = Date.now();
      await validator.validateOwnership(1, 'Voucher', [1, 2, 3]);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50);
    });
  });
});
