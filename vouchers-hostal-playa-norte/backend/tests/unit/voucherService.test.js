import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { voucherService } from '../../src/services/voucherService.js';
import { getDb } from '../../src/config/database.js';

describe('VoucherService', () => {
  let db;

  beforeAll(() => {
    db = createTestDB();
  });

  afterAll(() => {
    cleanupTestDB(db);
  });

  beforeEach(() => {
    // Limpiar datos entre tests
    db.exec('DELETE FROM redemptions');
    db.exec('DELETE FROM vouchers');
    db.exec('DELETE FROM stays');
    db.exec('DELETE FROM sqlite_sequence');
  });

  describe('emitVouchers', () => {
    it('debe emitir vouchers correctamente', async () => {
      // Crear estadía de prueba
      const stayResult = db.prepare(`
        INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test Guest', '101', '2025-01-01', '2025-01-05', 3);

      const result = await voucherService.emitVouchers({
        stay_id: stayResult.lastInsertRowid,
        valid_from: '2025-01-02',
        valid_until: '2025-01-04',
        breakfast_count: 3,
        correlation_id: 'test-001',
        user_id: 1
      });

      expect(result.success).toBe(true);
      expect(result.vouchers).toHaveLength(3);
      expect(result.vouchers[0]).toHaveProperty('code');
      expect(result.vouchers[0]).toHaveProperty('qr_image');
      expect(result.vouchers[0].code).toMatch(/^HPN-\d{4}-\d{4}$/);
    });

    it('debe generar códigos únicos secuenciales', async () => {
      const stayResult = db.prepare(`
        INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test Guest', '101', '2025-01-01', '2025-01-05', 3);

      const result = await voucherService.emitVouchers({
        stay_id: stayResult.lastInsertRowid,
        valid_from: '2025-01-02',
        valid_until: '2025-01-04',
        breakfast_count: 3,
        correlation_id: 'test-002',
        user_id: 1
      });

      const codes = result.vouchers.map(v => v.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(3);
      expect(codes[0]).toBe('HPN-2025-0001');
      expect(codes[1]).toBe('HPN-2025-0002');
      expect(codes[2]).toBe('HPN-2025-0003');
    });

    it('debe rechazar fechas inválidas', async () => {
      const stayResult = db.prepare(`
        INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test Guest', '101', '2025-01-01', '2025-01-05', 3);

      await expect(
        voucherService.emitVouchers({
          stay_id: stayResult.lastInsertRowid,
          valid_from: '2025-01-10', // Después del checkout
          valid_until: '2025-01-15',
          breakfast_count: 1,
          correlation_id: 'test-003',
          user_id: 1
        })
      ).rejects.toThrow();
    });

    it('debe rechazar estadía inexistente', async () => {
      await expect(
        voucherService.emitVouchers({
          stay_id: 9999,
          valid_from: '2025-01-02',
          valid_until: '2025-01-04',
          breakfast_count: 1,
          correlation_id: 'test-004',
          user_id: 1
        })
      ).rejects.toThrow('Estadía');
    });
  });

  describe('validateVoucher', () => {
    let testVoucher;

    beforeEach(async () => {
      // Crear estadía y voucher de prueba
      const stayResult = db.prepare(`
        INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test Guest', '101', '2025-01-01', '2025-12-31', 1);

      const result = await voucherService.emitVouchers({
        stay_id: stayResult.lastInsertRowid,
        valid_from: '2025-01-01',
        valid_until: '2025-12-31',
        breakfast_count: 1,
        correlation_id: 'test-setup',
        user_id: 1
      });

      testVoucher = result.vouchers[0];
    });

    it('debe validar voucher activo correctamente', async () => {
      const result = await voucherService.validateVoucher({
        code: testVoucher.code,
        hmac: testVoucher.hmac_signature,
        correlation_id: 'test-005'
      });

      expect(result.valid).toBe(true);
      expect(result.voucher.code).toBe(testVoucher.code);
      expect(result.voucher.guest_name).toBe('Test Guest');
    });

    it('debe rechazar HMAC inválido', async () => {
      await expect(
        voucherService.validateVoucher({
          code: testVoucher.code,
          hmac: 'invalid-hmac-signature',
          correlation_id: 'test-006'
        })
      ).rejects.toThrow('Firma HMAC inválida');
    });

    it('debe detectar voucher ya canjeado', async () => {
      // Canjear voucher
      await voucherService.redeemVoucher({
        code: testVoucher.code,
        cafeteria_id: 1,
        device_id: 'test-device',
        correlation_id: 'test-007',
        user_id: 1
      });

      // Intentar validar nuevamente
      const result = await voucherService.validateVoucher({
        code: testVoucher.code,
        correlation_id: 'test-008'
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('VOUCHER_ALREADY_REDEEMED');
    });
  });

  describe('redeemVoucher', () => {
    let testVoucher;

    beforeEach(async () => {
      const stayResult = db.prepare(`
        INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test Guest', '101', '2025-01-01', '2025-12-31', 1);

      const result = await voucherService.emitVouchers({
        stay_id: stayResult.lastInsertRowid,
        valid_from: '2025-01-01',
        valid_until: '2025-12-31',
        breakfast_count: 1,
        correlation_id: 'test-setup',
        user_id: 1
      });

      testVoucher = result.vouchers[0];
    });

    it('debe canjear voucher exitosamente', async () => {
      const result = await voucherService.redeemVoucher({
        code: testVoucher.code,
        cafeteria_id: 1,
        device_id: 'test-device',
        correlation_id: 'test-009',
        user_id: 1
      });

      expect(result.success).toBe(true);
      expect(result.redemption.voucher_code).toBe(testVoucher.code);
      expect(result.redemption.redemption_id).toBeGreaterThan(0);
    });

    it('debe prevenir doble canje (mismo dispositivo)', async () => {
      // Primer canje
      await voucherService.redeemVoucher({
        code: testVoucher.code,
        cafeteria_id: 1,
        device_id: 'test-device',
        correlation_id: 'test-010',
        user_id: 1
      });

      // Segundo intento
      await expect(
        voucherService.redeemVoucher({
          code: testVoucher.code,
          cafeteria_id: 1,
          device_id: 'test-device',
          correlation_id: 'test-011',
          user_id: 1
        })
      ).rejects.toThrow('Voucher ya canjeado');
    });

    it('debe prevenir doble canje (diferente dispositivo)', async () => {
      // Primer canje
      await voucherService.redeemVoucher({
        code: testVoucher.code,
        cafeteria_id: 1,
        device_id: 'device-1',
        correlation_id: 'test-012',
        user_id: 1
      });

      // Segundo intento desde otro dispositivo
      await expect(
        voucherService.redeemVoucher({
          code: testVoucher.code,
          cafeteria_id: 1,
          device_id: 'device-2',
          correlation_id: 'test-013',
          user_id: 1
        })
      ).rejects.toThrow('Voucher ya canjeado');
    });

    it('debe actualizar estado del voucher a "redeemed"', async () => {
      await voucherService.redeemVoucher({
        code: testVoucher.code,
        cafeteria_id: 1,
        device_id: 'test-device',
        correlation_id: 'test-014',
        user_id: 1
      });

      const voucher = db.prepare('SELECT status FROM vouchers WHERE code = ?')
        .get(testVoucher.code);

      expect(voucher.status).toBe('redeemed');
    });
  });

  describe('cancelVoucher', () => {
    let testVoucher;

    beforeEach(async () => {
      const stayResult = db.prepare(`
        INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test Guest', '101', '2025-01-01', '2025-12-31', 1);

      const result = await voucherService.emitVouchers({
        stay_id: stayResult.lastInsertRowid,
        valid_from: '2025-01-01',
        valid_until: '2025-12-31',
        breakfast_count: 1,
        correlation_id: 'test-setup',
        user_id: 1
      });

      testVoucher = result.vouchers[0];
    });

    it('debe cancelar voucher correctamente', async () => {
      const result = await voucherService.cancelVoucher({
        code: testVoucher.code,
        reason: 'Test cancellation',
        correlation_id: 'test-015',
        user_id: 1
      });

      expect(result.success).toBe(true);

      const voucher = db.prepare('SELECT status FROM vouchers WHERE code = ?')
        .get(testVoucher.code);

      expect(voucher.status).toBe('cancelled');
    });

    it('debe rechazar cancelación de voucher canjeado', async () => {
      // Canjear primero
      await voucherService.redeemVoucher({
        code: testVoucher.code,
        cafeteria_id: 1,
        device_id: 'test-device',
        correlation_id: 'test-016',
        user_id: 1
      });

      // Intentar cancelar
      await expect(
        voucherService.cancelVoucher({
          code: testVoucher.code,
          reason: 'Test',
          correlation_id: 'test-017',
          user_id: 1
        })
      ).rejects.toThrow('No se puede cancelar un voucher ya canjeado');
    });
  });
});
