import { describe, it, expect, beforeEach } from '@jest/globals';
import { Voucher } from '../../../src/domain/entities/Voucher.js';
import { randomUUID } from 'crypto';

describe('Voucher Entity', () => {
  let voucher;
  let stayId;
  let code;
  let qrCode;
  let expiryDate;

  beforeEach(() => {
    stayId = randomUUID();
    code = 'VOC-' + Math.random().toString(36).substring(2, 12).toUpperCase();
    qrCode = `VOC|${randomUUID()}|${code}|${stayId}`;
    expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    voucher = Voucher.create({
      stayId,
      code,
      qrCode,
      expiryDate,
    });
  });

  describe('Creation', () => {
    it('should create a voucher with valid data', () => {
      expect(voucher).toBeDefined();
      expect(voucher.id).toBeDefined();
      expect(voucher.stayId).toBe(stayId);
      expect(voucher.code).toBe(code);
      expect(voucher.status).toBe('pending');
    });
  });

  describe('State Transitions', () => {
    it('should activate from pending', () => {
      voucher.activate();
      expect(voucher.status).toBe('active');
    });

    it('should redeem from active', () => {
      voucher.activate();
      voucher.redeem('Test redemption');
      expect(voucher.status).toBe('redeemed');
      expect(voucher.redemptionNotes).toBe('Test redemption');
      expect(voucher.redemptionDate).toBeDefined();
    });

    it('should expire from active', () => {
      voucher.activate();
      voucher.expire();
      expect(voucher.status).toBe('expired');
    });

    it('should cancel from pending or active', () => {
      voucher.cancel();
      expect(voucher.status).toBe('cancelled');
    });
  });

  describe('Validation', () => {
    it('should validate active and non-expired voucher', () => {
      voucher.activate();
      expect(voucher.isValid()).toBe(true);
    });

    it('should not validate expired voucher', () => {
      const expiredVoucher = Voucher.create({
        stayId: randomUUID(),
        code: code + '2',
        qrCode: qrCode + '2',
        expiryDate: new Date(Date.now() - 1000).toISOString(),
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
    });
  });
});
