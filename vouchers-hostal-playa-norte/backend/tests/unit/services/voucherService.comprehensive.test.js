import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VoucherService } from '../../../src/services/voucherService.js';
import { getDb } from '../../../src/config/database.js';
import { CryptoService } from '../../../src/services/cryptoService.js';
import { QRService } from '../../../src/services/qrService.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError
} from '../../../src/middleware/errorHandler.js';

// Mock dependencies
jest.mock('../../../src/config/database');
jest.mock('../../../src/services/cryptoService');
jest.mock('../../../src/services/qrService');
jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  auditLogger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('VoucherService', () => {
  let mockDb;
  let mockPrepare;
  let mockGet;
  let mockRun;
  let mockTransaction;

  beforeEach(() => {
    // Setup database mocks
    mockGet = jest.fn();
    mockRun = jest.fn();
    mockPrepare = jest.fn().mockReturnValue({
      get: mockGet,
      run: mockRun,
      all: jest.fn()
    });
    mockTransaction = jest.fn();

    mockDb = {
      prepare: mockPrepare,
      transaction: mockTransaction
    };

    getDb.mockReturnValue(mockDb);

    // Setup service mocks
    CryptoService.generateVoucherCode = jest.fn();
    CryptoService.generateVoucherHMAC = jest.fn();
    CryptoService.verifyVoucherHMAC = jest.fn();
    QRService.generateVoucherQR = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('emitVouchers', () => {
    const validStay = {
      id: 1,
      checkin_date: '2025-11-01',
      checkout_date: '2025-11-05',
      status: 'active'
    };

    const validParams = {
      stay_id: 1,
      valid_from: '2025-11-01',
      valid_until: '2025-11-05',
      breakfast_count: 2,
      correlation_id: 'test-correlation-123',
      user_id: 1
    };

    it('should emit vouchers successfully', async () => {
      // Arrange
      mockGet.mockReturnValue(validStay);
      mockRun.mockReturnValue({ lastInsertRowid: 1 });
      mockTransaction.mockImplementation((fn) => fn());

      CryptoService.generateVoucherCode
        .mockReturnValueOnce('VOUCHER001')
        .mockReturnValueOnce('VOUCHER002');

      CryptoService.generateVoucherHMAC
        .mockReturnValueOnce('hmac1')
        .mockReturnValueOnce('hmac2');

      QRService.generateVoucherQR.mockResolvedValue({
        qr_code: 'base64-qr-code',
        qr_text: 'qr-text'
      });

      // Act
      const result = await VoucherService.emitVouchers(validParams);

      // Assert
      expect(result).toHaveProperty('vouchers');
      expect(result.vouchers).toHaveLength(2);
      expect(result.vouchers[0]).toMatchObject({
        code: 'VOUCHER001',
        hmac_signature: 'hmac1',
        qr_code: 'base64-qr-code'
      });

      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM stays WHERE id = ?');
      expect(mockGet).toHaveBeenCalledWith(1);
      expect(CryptoService.generateVoucherCode).toHaveBeenCalledTimes(2);
      expect(QRService.generateVoucherQR).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundError when stay does not exist', async () => {
      // Arrange
      mockGet.mockReturnValue(null);

      // Act & Assert
      await expect(VoucherService.emitVouchers(validParams))
        .rejects
        .toThrow(NotFoundError);      expect(mockGet).toHaveBeenCalledWith(1);
    });

    it('should throw ValidationError when dates are outside stay period', async () => {
      // Arrange
      mockGet.mockReturnValue(validStay);

      const invalidParams = {
        ...validParams,
        valid_from: '2025-10-31', // Before checkin
        valid_until: '2025-11-06'  // After checkout
      };

      // Act & Assert
      await expect(VoucherService.emitVouchers(invalidParams))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle breakfast_count = 0', async () => {
      // Arrange
      mockGet.mockReturnValue(validStay);
      const paramsWithZero = { ...validParams, breakfast_count: 0 };

      // Act
      const result = await VoucherService.emitVouchers(paramsWithZero);

      // Assert
      expect(result.vouchers).toHaveLength(0);
      expect(CryptoService.generateVoucherCode).not.toHaveBeenCalled();
    });

    it('should handle QR generation failure gracefully', async () => {
      // Arrange
      mockGet.mockReturnValue(validStay);
      mockRun.mockReturnValue({ lastInsertRowid: 1 });
      mockTransaction.mockImplementation((fn) => fn());

      CryptoService.generateVoucherCode.mockReturnValue('VOUCHER001');
      CryptoService.generateVoucherHMAC.mockReturnValue('hmac1');
      QRService.generateVoucherQR.mockRejectedValue(new Error('QR generation failed'));

      // Act & Assert
      await expect(VoucherService.emitVouchers(validParams))
        .rejects
        .toThrow('QR generation failed');
    });
  });

  describe('validateVoucher', () => {
    const validVoucher = {
      id: 1,
      code: 'VOUCHER001',
      stay_id: 1,
      valid_from: '2025-11-01',
      valid_until: '2025-11-05',
      hmac_signature: 'valid-hmac',
      status: 'active',
      guest_name: 'Juan Pérez',
      room_number: '101',
      is_redeemed: false,
      redemption: null
    };

    const validParams = {
      code: 'VOUCHER001',
      hmac: 'valid-hmac',
      correlation_id: 'test-correlation-123'
    };

    it('should validate voucher successfully', async () => {
      // Arrange
      // Mock getVoucher call
      mockGet.mockReturnValueOnce(validVoucher) // For getVoucher
            .mockReturnValueOnce(null); // For redemption check
      CryptoService.verifyVoucherHMAC.mockReturnValue(true);

      // Act
      const result = await VoucherService.validateVoucher(validParams);

      // Assert
      expect(result).toMatchObject({
        valid: true,
        voucher: {
          code: 'VOUCHER001',
          guest_name: 'Juan Pérez',
          room: '101',
          status: 'active'
        }
      });

      expect(CryptoService.verifyVoucherHMAC).toHaveBeenCalledWith(
        'VOUCHER001',
        '2025-11-01',
        '2025-11-05',
        1,
        'valid-hmac'
      );
    });    it('should return invalid for non-existent voucher', async () => {
      // Arrange
      mockGet.mockReturnValue(null);

      // Act
      const result = await VoucherService.validateVoucher(validParams);

      // Assert
      expect(result).toMatchObject({
        valid: false,
        reason: 'Voucher no encontrado'
      });
    });

    it('should return invalid for expired voucher', async () => {
      // Arrange
      const expiredVoucher = {
        ...validVoucher,
        valid_until: '2025-10-31' // Expired
      };
      mockGet.mockReturnValue(expiredVoucher);

      // Act
      const result = await VoucherService.validateVoucher(validParams);

      // Assert
      expect(result).toMatchObject({
        valid: false,
        reason: 'Voucher expirado'
      });
    });

    it('should return invalid for used voucher', async () => {
      // Arrange
      const usedVoucher = {
        ...validVoucher,
        status: 'used',
        used_at: '2025-11-02 10:00:00'
      };
      mockGet.mockReturnValue(usedVoucher);

      // Act
      const result = await VoucherService.validateVoucher(validParams);

      // Assert
      expect(result).toMatchObject({
        valid: false,
        reason: 'Voucher ya utilizado'
      });
    });

    it('should return invalid for tampered voucher (HMAC mismatch)', async () => {
      // Arrange
      mockGet.mockReturnValue(validVoucher);
      CryptoService.verifyVoucherHMAC.mockReturnValue(false);

      // Act
      const result = await VoucherService.validateVoucher(validParams);

      // Assert
      expect(result).toMatchObject({
        valid: false,
        reason: 'Voucher alterado o inválido'
      });
    });

    it('should handle missing required parameters', async () => {
      // Arrange
      const invalidParams = { code: '', receptionista: 'Juan' };

      // Act & Assert
      await expect(VoucherService.validateVoucher(invalidParams))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('redeemVoucher', () => {
    const validVoucher = {
      id: 1,
      code: 'VOUCHER001',
      stay_id: 1,
      valid_from: '2025-11-01',
      valid_until: '2025-11-05',
      hmac_signature: 'valid-hmac',
      status: 'active',
      used_at: null
    };

    const validParams = {
      code: 'VOUCHER001',
      receptionista: 'Juan Pérez',
      notes: 'Desayuno servido',
      correlation_id: 'test-correlation-123'
    };

    it('should redeem voucher successfully', async () => {
      // Arrange
      mockGet.mockReturnValue(validVoucher);
      CryptoService.verifyVoucherHMAC.mockReturnValue(true);
      mockRun.mockReturnValue({ changes: 1 });
      mockTransaction.mockImplementation((fn) => fn());

      // Act
      const result = await VoucherService.redeemVoucher(validParams);

      // Assert
      expect(result).toMatchObject({
        success: true,
        message: 'Voucher canjeado exitosamente',
        voucher_id: 1
      });

      expect(mockRun).toHaveBeenCalledWith(
        expect.arrayContaining([
          'used',
          expect.any(String), // used_at timestamp
          'Juan Pérez',
          'Desayuno servido',
          'VOUCHER001'
        ])
      );
    });

    it('should throw ConflictError for already used voucher', async () => {
      // Arrange
      const usedVoucher = { ...validVoucher, status: 'used' };
      mockGet.mockReturnValue(usedVoucher);

      // Act & Assert
      await expect(VoucherService.redeemVoucher(validParams))
        .rejects
        .toThrow(ConflictError);
    });

    it('should throw NotFoundError for non-existent voucher', async () => {
      // Arrange
      mockGet.mockReturnValue(null);

      // Act & Assert
      await expect(VoucherService.redeemVoucher(validParams))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should handle database update failure', async () => {
      // Arrange
      mockGet.mockReturnValue(validVoucher);
      CryptoService.verifyVoucherHMAC.mockReturnValue(true);
      mockRun.mockReturnValue({ changes: 0 }); // Update failed
      mockTransaction.mockImplementation((fn) => fn());

      // Act & Assert
      await expect(VoucherService.redeemVoucher(validParams))
        .rejects
        .toThrow('Error al actualizar voucher');
    });
  });

  describe('getVoucherStats', () => {
    it('should return comprehensive voucher statistics', async () => {
      // Arrange
      mockGet
        .mockReturnValueOnce({ total: 100 })
        .mockReturnValueOnce({ used: 75 })
        .mockReturnValueOnce({ active: 20 })
        .mockReturnValueOnce({ expired: 5 });

      // Act
      const result = await VoucherService.getVoucherStats({
        stay_id: 1,
        correlation_id: 'test-123'
      });

      // Assert
      expect(result).toMatchObject({
        total_vouchers: 100,
        used_vouchers: 75,
        active_vouchers: 20,
        expired_vouchers: 5,
        usage_rate: 0.75
      });
    });

    it('should handle zero vouchers gracefully', async () => {
      // Arrange
      mockGet
        .mockReturnValueOnce({ total: 0 })
        .mockReturnValueOnce({ used: 0 })
        .mockReturnValueOnce({ active: 0 })
        .mockReturnValueOnce({ expired: 0 });

      // Act
      const result = await VoucherService.getVoucherStats({
        stay_id: 1,
        correlation_id: 'test-123'
      });

      // Assert
      expect(result).toMatchObject({
        total_vouchers: 0,
        usage_rate: 0
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      getDb.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Act & Assert
      await expect(VoucherService.emitVouchers({
        stay_id: 1,
        valid_from: '2025-11-01',
        valid_until: '2025-11-05',
        breakfast_count: 1
      })).rejects.toThrow('Database connection failed');
    });

    it('should validate date formats correctly', async () => {
      // Arrange
      mockGet.mockReturnValue({
        id: 1,
        checkin_date: '2025-11-01',
        checkout_date: '2025-11-05'
      });

      const invalidDateParams = {
        stay_id: 1,
        valid_from: 'invalid-date',
        valid_until: '2025-11-05',
        breakfast_count: 1
      };

      // Act & Assert
      await expect(VoucherService.emitVouchers(invalidDateParams))
        .rejects
        .toThrow();
    });

    it('should handle transaction rollback on error', async () => {
      // Arrange
      mockGet.mockReturnValue({
        id: 1,
        checkin_date: '2025-11-01',
        checkout_date: '2025-11-05'
      });

      mockTransaction.mockImplementation((fn) => {
        throw new Error('Transaction failed');
      });

      // Act & Assert
      await expect(VoucherService.emitVouchers({
        stay_id: 1,
        valid_from: '2025-11-01',
        valid_until: '2025-11-05',
        breakfast_count: 1
      })).rejects.toThrow('Transaction failed');
    });
  });
});
