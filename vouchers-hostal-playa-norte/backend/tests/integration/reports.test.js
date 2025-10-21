const request = require('supertest');
const { app } = require('../../src/server');
const { getDb } = require('../../src/config/database');

describe('Reports API - Test Case #10', () => {
  let db;
  let adminToken;
  let cafeteriaToken;

  beforeAll(() => {
    db = createTestDB();
    adminToken = generateTestToken(1, 'admin');
    cafeteriaToken = generateTestToken(2, 'cafeteria');
  });

  afterAll(() => {
    cleanupTestDB(db);
  });

  describe('GET /api/reports/redemptions - CSV Format', () => {
    beforeEach(async () => {
      // Limpiar datos
      db.exec('DELETE FROM sync_log');
      db.exec('DELETE FROM redemptions');
      db.exec('DELETE FROM vouchers');
      db.exec('DELETE FROM stays');
      db.exec('DELETE FROM sqlite_sequence');

      // Crear estadía
      const stayResult = db.prepare(`
        INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
        VALUES (?, ?, ?, ?, ?)
      `).run('Test Guest CSV', '301', '2025-01-01', '2025-01-10', 10);

      // Emitir 10 vouchers
      await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stay_id: stayResult.lastInsertRowid,
          valid_from: '2025-01-02',
          valid_until: '2025-01-09',
          breakfast_count: 10
        });

      const vouchers = db.prepare('SELECT code FROM vouchers ORDER BY id').all();

      // 3 canjes ONLINE
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/vouchers/redeem')
          .set('Authorization', `Bearer ${cafeteriaToken}`)
          .send({
            code: vouchers[i].code,
            cafeteria_id: 1,
            device_id: `device-online-${i + 1}`
          });
      }

      // 4 canjes OFFLINE (simulados con sync)
      await request(app)
        .post('/api/sync/redemptions')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          device_id: 'device-offline-1',
          redemptions: [
            {
              local_id: 'offline-001',
              voucher_code: vouchers[3].code,
              cafeteria_id: 1,
              local_timestamp: new Date(Date.now() - 60000).toISOString()
            },
            {
              local_id: 'offline-002',
              voucher_code: vouchers[4].code,
              cafeteria_id: 1,
              local_timestamp: new Date(Date.now() - 50000).toISOString()
            },
            {
              local_id: 'offline-003',
              voucher_code: vouchers[5].code,
              cafeteria_id: 1,
              local_timestamp: new Date(Date.now() - 40000).toISOString()
            },
            {
              local_id: 'offline-004',
              voucher_code: vouchers[6].code,
              cafeteria_id: 1,
              local_timestamp: new Date(Date.now() - 30000).toISOString()
            }
          ]
        });
    });

    it('TEST CASE #10: debe generar CSV con 7 filas (3 online + 4 offline)', async () => {
      const response = await request(app)
        .get('/api/reports/redemptions')
        .query({
          from: '2025-01-01',
          to: '2025-01-31',
          format: 'csv'
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');

      const csvLines = response.text.trim().split('\n');
      
      // Header + 7 filas de datos
      expect(csvLines.length).toBe(8);
      
      // Verificar header
      expect(csvLines[0]).toBe('code,guest_name,room,redeemed_at,cafeteria,device_id,origin');
      
      // Verificar que incluye device_id y cafeteria
      const dataLines = csvLines.slice(1);
      dataLines.forEach(line => {
        const columns = line.split(',');
        expect(columns.length).toBe(7);
        expect(columns[4]).toMatch(/Cafetería/); // cafeteria
        expect(columns[5]).toMatch(/device-/);   // device_id
        expect(columns[6]).toMatch(/online|offline/); // origin
      });
      
      // Verificar códigos específicos
      const codes = dataLines.map(line => line.split(',')[0]);
      expect(codes).toContain('HPN-2025-0001');
      expect(codes).toContain('HPN-2025-0007');
      expect(codes).not.toContain('HPN-2025-0008'); // No canjeado
      
      // Verificar origen (online vs offline)
      const origins = dataLines.map(line => line.split(',')[6]);
      const onlineCount = origins.filter(o => o === 'online').length;
      const offlineCount = origins.filter(o => o === 'offline').length;
      
      expect(onlineCount).toBe(3);
      expect(offlineCount).toBe(4);
    });

    it('debe incluir metadata correcta', async () => {
      const response = await request(app)
        .get('/api/reports/redemptions')
        .query({
          from: '2025-01-01',
          to: '2025-01-31',
          format: 'json'
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.total_redemptions).toBe(7);
      expect(response.body.metadata.period).toEqual({
        from: '2025-01-01',
        to: '2025-01-31'
      });
    });

    it('debe filtrar por cafetería', async () => {
      const response = await request(app)
        .get('/api/reports/redemptions')
        .query({
          from: '2025-01-01',
          to: '2025-01-31',
          cafeteria_id: 1,
          format: 'csv'
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const csvLines = response.text.trim().split('\n');
      expect(csvLines.length).toBe(8); // Header + 7 filas
    });

    it('debe requerir autenticación admin', async () => {
      await request(app)
        .get('/api/reports/redemptions')
        .query({
          from: '2025-01-01',
          to: '2025-01-31',
          format: 'csv'
        })
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .expect(403);
    });
  });
});
