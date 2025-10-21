const request = require('supertest');
const { app } = require('../../src/server');
const { getDb } = require('../../src/config/database');

describe('Vouchers API Integration', () => {
  let db;
  let adminToken;
  let cafeteriaToken;
  let testStayId;

  beforeAll(() => {
    db = createTestDB();
    adminToken = generateTestToken(1, 'admin');
    cafeteriaToken = generateTestToken(2, 'cafeteria');
  });

  afterAll(() => {
    cleanupTestDB(db);
  });

  beforeEach(() => {
    // Limpiar datos
    db.exec('DELETE FROM redemptions');
    db.exec('DELETE FROM vouchers');
    db.exec('DELETE FROM stays');
    db.exec('DELETE FROM sqlite_sequence');

    // Crear estadía de prueba
    const result = db.prepare(`
      INSERT INTO stays (guest_name, room_number, checkin_date, checkout_date, breakfast_count)
      VALUES (?, ?, ?, ?, ?)
    `).run('Integration Test', '101', '2025-01-01', '2025-12-31', 3);

    testStayId = result.lastInsertRowid;
  });

  describe('POST /api/vouchers', () => {
    it('debe emitir vouchers con autenticación válida', async () => {
      const response = await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-02',
          valid_until: '2025-01-05',
          breakfast_count: 3
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.vouchers).toHaveLength(3);
      expect(response.body.vouchers[0]).toHaveProperty('qr_image');
    });

    it('debe rechazar sin autenticación', async () => {
      await request(app)
        .post('/api/vouchers')
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-02',
          valid_until: '2025-01-05',
          breakfast_count: 1
        })
        .expect(401);
    });

    it('debe rechazar con rol insuficiente', async () => {
      await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-02',
          valid_until: '2025-01-05',
          breakfast_count: 1
        })
        .expect(403);
    });

    it('debe validar datos de entrada', async () => {
      const response = await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-10',
          valid_until: '2025-01-05', // Fecha inválida
          breakfast_count: 1
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('debe incluir correlation ID en respuesta', async () => {
      const response = await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-02',
          valid_until: '2025-01-05',
          breakfast_count: 1
        })
        .expect(201);

      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('POST /api/vouchers/validate', () => {
    let testVoucherCode;
    let testVoucherHmac;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-01',
          valid_until: '2025-12-31',
          breakfast_count: 1
        });

      testVoucherCode = response.body.vouchers[0].code;
      testVoucherHmac = response.body.vouchers[0].hmac_signature;
    });

    it('debe validar voucher correctamente', async () => {
      const response = await request(app)
        .post('/api/vouchers/validate')
        .send({
          code: testVoucherCode,
          hmac: testVoucherHmac
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.voucher.code).toBe(testVoucherCode);
    });

    it('debe rechazar HMAC inválido', async () => {
      await request(app)
        .post('/api/vouchers/validate')
        .send({
          code: testVoucherCode,
          hmac: 'invalid-hmac'
        })
        .expect(400);
    });

    it('debe aplicar rate limiting', async () => {
      // Hacer 101 requests (límite es 100)
      const requests = [];
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(app)
            .post('/api/vouchers/validate')
            .send({ code: testVoucherCode })
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/vouchers/redeem', () => {
    let testVoucherCode;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-01',
          valid_until: '2025-12-31',
          breakfast_count: 1
        });

      testVoucherCode = response.body.vouchers[0].code;
    });

    it('debe canjear voucher exitosamente', async () => {
      const response = await request(app)
        .post('/api/vouchers/redeem')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          code: testVoucherCode,
          cafeteria_id: 1,
          device_id: 'test-device-001'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.redemption.voucher_code).toBe(testVoucherCode);
    });

    it('debe prevenir doble canje', async () => {
      // Primer canje
      await request(app)
        .post('/api/vouchers/redeem')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          code: testVoucherCode,
          cafeteria_id: 1,
          device_id: 'device-1'
        })
        .expect(200);

      // Segundo intento
      await request(app)
        .post('/api/vouchers/redeem')
        .set('Authorization', `Bearer ${cafeteriaToken}`)
        .send({
          code: testVoucherCode,
          cafeteria_id: 1,
          device_id: 'device-2'
        })
        .expect(409);
    });

    it('debe rechazar sin autenticación', async () => {
      await request(app)
        .post('/api/vouchers/redeem')
        .send({
          code: testVoucherCode,
          cafeteria_id: 1,
          device_id: 'test-device'
        })
        .expect(401);
    });

    it('debe aplicar rate limiting por dispositivo', async () => {
      // Crear múltiples vouchers
      await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-01',
          valid_until: '2025-12-31',
          breakfast_count: 60
        });

      const vouchers = db.prepare('SELECT code FROM vouchers ORDER BY id').all();

      // Intentar canjear 51 (límite es 50)
      const requests = vouchers.slice(0, 51).map(v =>
        request(app)
          .post('/api/vouchers/redeem')
          .set('Authorization', `Bearer ${cafeteriaToken}`)
          .send({
            code: v.code,
            cafeteria_id: 1,
            device_id: 'same-device'
          })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/vouchers/:code', () => {
    let testVoucherCode;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stay_id: testStayId,
          valid_from: '2025-01-01',
          valid_until: '2025-12-31',
          breakfast_count: 1
        });

      testVoucherCode = response.body.vouchers[0].code;
    });

    it('debe obtener información del voucher', async () => {
      const response = await request(app)
        .get(`/api/vouchers/${testVoucherCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.voucher.code).toBe(testVoucherCode);
      expect(response.body.voucher.guest_name).toBe('Integration Test');
    });

    it('debe retornar 404 para voucher inexistente', async () => {
      await request(app)
        .get('/api/vouchers/HPN-2025-9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});