import request from 'supertest';
import app from '../../src/index.js';
import { dbManager } from '../../src/config/database.js';
import { generateTestToken } from '../helpers/auth.js';


describe('Sync API Integration', () => {
  let cafeteriaToken;
  let testVouchers;

  beforeAll(() => {
    cafeteriaToken = generateTestToken(2, 'cafeteria');
  });

  afterAll(() => {
    dbManager.close();
  });

  beforeEach(async () => {
    // Limpiar datos
    dbManager.getDb().exec('DELETE FROM sync_log');
    dbManager.getDb().exec('DELETE FROM redemptions');
    dbManager.getDb().exec('DELETE FROM vouchers');
    dbManager.getDb().exec('DELETE FROM stays');
    dbManager.getDb().exec('DELETE FROM sqlite_sequence');

    // Crear estadía y vouchers de prueba
    const stayResult = dbManager.getDb().prepare(`
      INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
      VALUES (?, ?, ?, ?, ?)
    `).run('Sync Test', '201', '2025-01-01', '2025-12-31', 5);

    const adminToken = generateTestToken(1, 'admin');
    const response = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        stay_id: stayResult.lastInsertRowid,
        valid_from: '2025-01-01',
        valid_until: '2025-12-31',
        breakfast_count: 5
      });

    testVouchers = response.body.vouchers;
  });

  describe('POST /api/sync/redemptions', () => {
    it('debe sincronizar canjes offline exitosamente', async () => {
      const response = await request(app)
        .post('/api/sync/redemptions')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          device_id: 'test-device-sync',
          redemptions: [
            {
              local_id: 'offline-001',
              voucher_code: testVouchers[0].code,
              cafeteria_id: 1,
              local_timestamp: new Date().toISOString()
            },
            {
              local_id: 'offline-002',
              voucher_code: testVouchers[1].code,
              cafeteria_id: 1,
              local_timestamp: new Date().toISOString()
            }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.summary.synced).toBe(2);
      expect(response.body.summary.conflicts).toBe(0);
      expect(response.body.summary.errors).toBe(0);
    });

    it('debe detectar conflictos de canje', async () => {
      // Canjear voucher online primero
      await request(app)
        .post('/api/vouchers/redeem')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          code: testVouchers[0].code,
          cafeteria_id: 1,
          device_id: 'device-online'
        });

      // Intentar sincronizar el mismo voucher desde offline
      const response = await request(app)
        .post('/api/sync/redemptions')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          device_id: 'device-offline',
          redemptions: [
            {
              local_id: 'offline-conflict',
              voucher_code: testVouchers[0].code,
              cafeteria_id: 1,
              local_timestamp: new Date().toISOString()
            }
          ]
        })
        .expect(207); // Multi-Status

      expect(response.body.summary.conflicts).toBe(1);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts[0].reason).toBe('ALREADY_REDEEMED');
    });

    it('debe sincronizar batch mixto (éxitos + conflictos)', async () => {
      // Canjear uno online
      await request(app)
        .post('/api/vouchers/redeem')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          code: testVouchers[0].code,
          cafeteria_id: 1,
          device_id: 'device-online'
        });

      // Sincronizar batch con conflicto y éxitos
      const response = await request(app)
        .post('/api/sync/redemptions')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          device_id: 'device-offline',
          redemptions: [
            {
              local_id: 'offline-001',
              voucher_code: testVouchers[0].code, // Conflicto
              cafeteria_id: 1,
              local_timestamp: new Date().toISOString()
            },
            {
              local_id: 'offline-002',
              voucher_code: testVouchers[1].code, // Éxito
              cafeteria_id: 1,
              local_timestamp: new Date().toISOString()
            },
            {
              local_id: 'offline-003',
              voucher_code: testVouchers[2].code, // Éxito
              cafeteria_id: 1,
              local_timestamp: new Date().toISOString()
            }
          ]
        })
        .expect(207);

      expect(response.body.summary.synced).toBe(2);
      expect(response.body.summary.conflicts).toBe(1);
    });

    it('debe registrar sync en sync_log', async () => {
      await request(app)
        .post('/api/sync/redemptions')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          device_id: 'test-device-log',
          redemptions: [
            {
              local_id: 'offline-log',
              voucher_code: testVouchers[0].code,
              cafeteria_id: 1,
              local_timestamp: new Date().toISOString()
            }
          ]
        });

      const logs = dbManager.getDb().prepare('SELECT * FROM sync_log WHERE device_id = ?')
        .all('test-device-log');

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].result).toBe('success');
    });

    it('debe validar estructura de redemptions', async () => {
      const response = await request(app)
        .post('/api/sync/redemptions')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          device_id: 'test-device',
          redemptions: [
            {
              // Falta local_id
              voucher_code: testVouchers[0].code,
              cafeteria_id: 1
            }
          ]
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('debe limitar tamaño de batch (máx 50)', async () => {
      const largeRedemptions = Array.from({ length: 51 }, (_, i) => ({
        local_id: `offline-${i}`,
        voucher_code: testVouchers[0].code,
        cafeteria_id: 1,
        local_timestamp: new Date().toISOString()
      }));

      await request(app)
        .post('/api/sync/redemptions')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          device_id: 'test-device',
          redemptions: largeRedemptions
        })
        .expect(400);
    });
  });

  describe('GET /api/sync/history', () => {
    beforeEach(async () => {
      // Crear historial de sync
      await request(app)
        .post('/api/sync/redemptions')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          device_id: 'history-device',
          redemptions: [
            {
              local_id: 'hist-001',
              voucher_code: testVouchers[0].code,
              cafeteria_id: 1,
              local_timestamp: new Date().toISOString()
            }
          ]
        });
    });

    it('debe obtener historial de sincronización', async () => {
      const response = await request(app)
        .get('/api/sync/history')
        .query({ device_id: 'history-device' })
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .expect(200);

      expect(response.body.device_id).toBe('history-device');
      expect(response.body.history).toBeDefined();
      expect(response.body.history.length).toBeGreaterThan(0);
    });

    it('debe requerir device_id', async () => {
      await request(app)
        .get('/api/sync/history')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .expect(400);
    });

    it('debe limitar cantidad de resultados', async () => {
      const response = await request(app)
        .get('/api/sync/history')
        .query({ device_id: 'history-device', limit: 5 })
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .expect(200);

      expect(response.body.history.length).toBeLessThanOrEqual(5);
    });
  });
});
