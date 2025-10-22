const Voucher = require('../../../src/domain/entities/Voucher');

describe('Voucher Entity', () => {
  let voucher;

  beforeEach(() => {
    voucher = Voucher.create({
      stayId: '123e4567-e89b-12d3-a456-426614174000',
      expiryDate: new Date('2025-12-31'),
    });
  });

  describe('creation', () => {
    test('should create a new voucher with default values', () => {
      expect(voucher).toBeDefined();
      expect(voucher.stayId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(voucher.status).toBe('pending');
      expect(voucher.code).toMatch(/^VOC-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(voucher.redemptionDate).toBeNull();
    });

    test('should assign UUID if not provided', () => {
      expect(voucher.id).toBeUndefined();
    });

    test('should generate unique codes', () => {
      const v1 = Voucher.create({ stayId: 'stay1' });
      const v2 = Voucher.create({ stayId: 'stay2' });
      expect(v1.code).not.toBe(v2.code);
    });

    test('should validate required fields', () => {
      expect(() => {
        new Voucher({
          stayId: null,
          code: 'VOC-ABC-1234',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }).toThrow();
    });
  });

  describe('state transitions', () => {
    test('should activate pending voucher', () => {
      expect(voucher.status).toBe('pending');
      voucher.activate();
      expect(voucher.status).toBe('active');
    });

    test('should not activate non-pending voucher', () => {
      voucher.activate();
      expect(() => voucher.activate()).toThrow(
        /No se puede activar voucher en estado 'active'/
      );
    });

    test('should redeem active voucher', () => {
      voucher.activate();
      voucher.redeem('2 cafés');

      expect(voucher.status).toBe('redeemed');
      expect(voucher.redemptionDate).toBeDefined();
      expect(voucher.redemptionNotes).toBe('2 cafés');
    });

    test('should not redeem inactive voucher', () => {
      expect(() => voucher.redeem()).toThrow(
        /No se puede canjear voucher en estado 'pending'/
      );
    });

    test('should not redeem expired voucher', () => {
      voucher.activate();
      voucher.expiryDate = new Date('2020-01-01');

      expect(() => voucher.redeem()).toThrow(/Voucher expirado/);
    });

    test('should expire active voucher', () => {
      voucher.activate();
      voucher.expire();

      expect(voucher.status).toBe('expired');
    });

    test('should cancel non-redeemed voucher', () => {
      voucher.cancel();
      expect(voucher.status).toBe('cancelled');
    });

    test('should not cancel redeemed voucher', () => {
      voucher.activate();
      voucher.redeem();

      expect(() => voucher.cancel()).toThrow(
        /No se puede cancelar un voucher ya canjeado/
      );
    });
  });

  describe('validations', () => {
    test('should validate valid voucher', () => {
      voucher.activate();
      expect(voucher.isValid()).toBe(true);
    });

    test('should not validate pending voucher', () => {
      expect(voucher.isValid()).toBe(false);
    });

    test('should not validate expired voucher', () => {
      voucher.activate();
      voucher.expiryDate = new Date('2020-01-01');
      expect(voucher.isValid()).toBe(false);
    });

    test('should check if can redeem', () => {
      expect(voucher.canRedeem()).toBe(false);
      voucher.activate();
      expect(voucher.canRedeem()).toBe(true);
    });

    test('should identify expired vouchers', () => {
      voucher.expiryDate = new Date('2020-01-01');
      expect(voucher.isExpired()).toBe(true);
    });
  });

  describe('calculations', () => {
    test('should calculate days remaining', () => {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      voucher.expiryDate = sevenDaysFromNow;

      const daysRemaining = voucher.getDaysRemaining();
      expect(daysRemaining).toBeGreaterThanOrEqual(6);
      expect(daysRemaining).toBeLessThanOrEqual(7);
    });

    test('should return negative days if expired', () => {
      voucher.expiryDate = new Date('2020-01-01');
      const daysRemaining = voucher.getDaysRemaining();
      expect(daysRemaining).toBeLessThan(0);
    });
  });

  describe('serialization', () => {
    test('should serialize to JSON', () => {
      voucher.activate();
      const json = voucher.toJSON();

      expect(json.id).toBe(voucher.id);
      expect(json.code).toBe(voucher.code);
      expect(json.status).toBe('active');
      expect(json.createdAt).toBeDefined();
      expect(json.daysRemaining).toBeDefined();
      expect(json.isExpired).toBe(false);
    });

    test('should exclude QR if requested', () => {
      voucher.qrCode = 'https://example.com/qr';
      const jsonWithQR = voucher.toJSON(true);
      const jsonWithoutQR = voucher.toJSON(false);

      expect(jsonWithQR.qrCode).toBeDefined();
      expect(jsonWithoutQR.qrCode).toBeUndefined();
    });
  });

  describe('code generation', () => {
    test('should generate valid code format', () => {
      const code = Voucher.generateCode();
      expect(code).toMatch(/^VOC-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(code.length).toBeLessThanOrEqual(20);
    });

    test('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(Voucher.generateCode());
      }
      expect(codes.size).toBe(100);
    });
  });

  describe('edge cases', () => {
    test('should handle null redemption date', () => {
      expect(voucher.redemptionDate).toBeNull();
      voucher.activate();
      expect(voucher.redemptionDate).toBeNull();
      voucher.redeem();
      expect(voucher.redemptionDate).toBeDefined();
    });

    test('should update updatedAt on state change', () => {
      const originalUpdatedAt = voucher.updatedAt;
      // pequeño delay para asegurar que el timestamp es diferente
      setTimeout(() => {
        voucher.activate();
        expect(voucher.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime()
        );
      }, 10);
    });

    test('should accept custom code', () => {
      const customCode = 'VOC-CUSTOM-9999';
      const v = Voucher.create({
        stayId: 'stay-123',
        code: customCode,
      });
      expect(v.code).toBe(customCode);
    });

    test('should accept custom expiry date', () => {
      const customDate = new Date('2099-12-31');
      const v = Voucher.create({
        stayId: 'stay-123',
        expiryDate: customDate,
      });
      expect(v.expiryDate).toEqual(customDate);
    });
  });
});
