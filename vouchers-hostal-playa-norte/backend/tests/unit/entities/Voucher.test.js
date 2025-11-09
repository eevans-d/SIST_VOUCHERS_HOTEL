import { describe, it, expect, beforeEach } from '@jest/globals';
import { Voucher } from '../../../src/domain/entities/Voucher.js';

// UUID válido estático para pruebas (evitamos dependencia de generador en assertions)
const STAY_ID = '00000000-0000-0000-0000-000000000001';

function buildValidVoucher(overrides = {}) {
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return Voucher.create({
    stayId: STAY_ID,
    code: overrides.code || 'VOC-TEST-001',
    validFrom: overrides.validFrom || now,
    validUntil: overrides.validUntil || later,
    hmacSignature: overrides.hmacSignature || 'abc123',
    ...(overrides.status ? { status: overrides.status } : {})
  });
}

describe('Voucher Entity (aligned)', () => {
  let voucher;

  beforeEach(() => {
    voucher = buildValidVoucher();
  });

  describe('Creation', () => {
    it('crea voucher válido con campos obligatorios', () => {
      expect(voucher).toBeDefined();
      expect(voucher.id).toBeDefined();
      expect(voucher.code).toBe('VOC-TEST-001');
      expect(voucher.status).toBe('active'); // por default en schema
      expect(voucher.validUntil > voucher.validFrom).toBe(true);
    });

    it('lanza error si validUntil <= validFrom', () => {
      const now = new Date();
      const same = new Date(now);
      expect(() => buildValidVoucher({ validFrom: now, validUntil: same })).toThrow(
        'validUntil must be after validFrom'
      );
    });
  });

  describe('Estado y transiciones', () => {
    it('redeem() cambia status a redeemed', () => {
      voucher.redeem();
      expect(voucher.status).toBe('redeemed');
      expect(voucher.isRedeemed()).toBe(true);
    });

    it('redeem() falla si status no es active', () => {
      voucher.status = 'cancelled';
      expect(() => voucher.redeem()).toThrow('Only active vouchers can be redeemed');
    });

    it('cancel() cambia status a cancelled', () => {
      voucher.cancel();
      expect(voucher.status).toBe('cancelled');
    });

    it('cancel() falla si ya está redeemed', () => {
      voucher.redeem();
      expect(() => voucher.cancel()).toThrow('Cannot cancel a redeemed voucher');
    });
  });

  describe('Expiración', () => {
    it('isExpired() true si fecha pasada', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pastLater = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const expired = buildValidVoucher({ validFrom: past, validUntil: pastLater });
      expect(expired.isExpired()).toBe(true);
    });

    it('isActive() false si expirado', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pastLater = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const expired = buildValidVoucher({ validFrom: past, validUntil: pastLater });
      expect(expired.isActive()).toBe(false);
    });
  });

  describe('Serialización', () => {
    it('toJSON() expone campos esperados', () => {
      const json = voucher.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('code', 'VOC-TEST-001');
      expect(json).toHaveProperty('stayId', STAY_ID);
      expect(json).toHaveProperty('status', 'active');
      expect(typeof json.validUntil).toBe('string');
    });

    it('fromPersistence() reconstruye instancia', () => {
      const data = voucher.toPersistence();
      const restored = Voucher.fromPersistence(data);
      expect(restored.code).toBe(voucher.code);
      expect(restored.validUntil.getTime()).toBe(voucher.validUntil.getTime());
      expect(restored.status).toBe('active');
    });
  });
});
