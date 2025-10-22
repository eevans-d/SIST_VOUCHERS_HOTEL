import { describe, it, expect, beforeEach } from '@jest/globals';
import { Voucher } from '../../../src/domain/entities/Voucher.js';

describe('Voucher Entity', () => {
  let voucher;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);

  beforeEach(() => {
    voucher = Voucher.create({
      stayId: 'stay-123',
      code: 'VOC-TEST-001',
      qrCode: 'https://example.com/qr',
      expiryDate,
    });
  });

  describe('Creation', () => {
    it('should create a voucher with valid data', () => {
      expect(voucher).toBeDefined();
      expect(voucher.id).toBeDefined();
      expect(voucher.code).toBe('VOC-TEST-001');
      expect(voucher.status).toBe('pending');
    });

    it('should throw error with invalid data', () => {
      expect(() => {
        Voucher.create({
          stayId: 'stay-123',
          code: '',
          qrCode: 'https://example.com/qr',
          expiryDate,
        });
      }).toThrow();
    });
  });

  describe('State Transitions', () => {
    it('should activate from pending', () => {
      voucher.activate();
      expect(voucher.status).toBe('active');
    });

    it('should throw error activating non-pending voucher', () => {
      voucher.activate();
      expect(() => voucher.activate()).toThrow();
    });

    it('should redeem from active', () => {
      voucher.activate();
      voucher.redeem('Test redemption');
      expect(voucher.status).toBe('redeemed');
      expect(voucher.redemptionNotes).toBe('Test redemption');
      expect(voucher.redemptionDate).toBeDefined();
    });

    it('should throw error redeeming non-active voucher', () => {
      expect(() => voucher.redeem()).toThrow();
    });

    it('should expire from active', () => {
      voucher.activate();
      voucher.expire();
      expect(voucher.status).toBe('expired');
    });

    it('should cancel from pending or active', () => {
      voucher.cancel('Test cancel');
      expect(voucher.status).toBe('cancelled');
      expect(voucher.redemptionNotes).toBe('Test cancel');
    });
  });

  describe('Expiration', () => {
    it('should detect expired voucher', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredVoucher = new Voucher({
        id: 'v-1',
        stayId: 'stay-123',
        code: 'VOC-EXPIRED',
        qrCode: 'https://example.com/qr',
        status: 'active',
        expiryDate: pastDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(expiredVoucher.isExpired()).toBe(true);
    });

    it('should calculate days remaining', () => {
      voucher.activate();
      const daysRemaining = voucher.getDaysRemaining();
      expect(daysRemaining).toBeGreaterThan(0);
      expect(daysRemaining).toBeLessThanOrEqual(30);
    });
  });

  describe('Validation', () => {
    it('should validate active and non-expired voucher', () => {
      voucher.activate();
      expect(voucher.isValid()).toBe(true);
    });

    it('should not validate expired voucher', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredVoucher = new Voucher({
        id: 'v-1',
        stayId: 'stay-123',
        code: 'VOC-EXPIRED',
        qrCode: 'https://example.com/qr',
        status: 'active',
        expiryDate: pastDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(expiredVoucher.isValid()).toBe(false);
    });

    it('should not validate non-active voucher', () => {
      expect(voucher.isValid()).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const json = voucher.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('stayId');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('expiryDate');
    });

    it('should deserialize from database', () => {
      const data = {
        id: 'v-1',
        stayId: 'stay-123',
        code: 'VOC-001',
        qrCode: 'https://example.com/qr',
        status: 'active',
        redemptionDate: null,
        expiryDate: expiryDate.toISOString(),
        redemptionNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const restored = Voucher.fromDatabase(data);
      expect(restored.id).toBe('v-1');
      expect(restored.code).toBe('VOC-001');
      expect(restored.status).toBe('active');
    });
  });
});
