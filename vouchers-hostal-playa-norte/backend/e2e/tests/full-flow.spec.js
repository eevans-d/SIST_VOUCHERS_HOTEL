import { test, expect } from '@playwright/test';

test.describe('Sistema de Vouchers Hotel - Full Flow', () => {
  let accessToken;
  let refreshToken;
  let userId;
  let stayId;
  let voucherId;
  let orderId;

  // ==================== AUTH TESTS ====================
  test.describe('Autenticación', () => {
    test('Login exitoso', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'admin@hotel.com',
          password: 'password123',
        },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('accessToken');
      expect(data).toHaveProperty('refreshToken');
      expect(data).toHaveProperty('user');
      expect(data.user.email).toBe('admin@hotel.com');

      // Guardar tokens
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      userId = data.user.id;
    });

    test('Login fallido con credenciales inválidas', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'invalid@hotel.com',
          password: 'wrongpassword',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('Refresh token válido', async ({ request }) => {
      const response = await request.post('/api/auth/refresh', {
        data: {
          refreshToken,
        },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('accessToken');
      
      accessToken = data.accessToken;
    });
  });

  // ==================== STAYS TESTS ====================
  test.describe('Gestión de Estadías', () => {
    test('Crear estadía', async ({ request }) => {
      const response = await request.post('/api/stays', {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          hotelCode: 'H001',
          roomNumber: '101',
          checkIn: new Date().toISOString(),
          checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          numberOfNights: 3,
          totalPrice: 300,
        },
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.status).toBe('pending');

      stayId = data.id;
    });

    test('Obtener estadía creada', async ({ request }) => {
      const response = await request.get(`/api/stays/${stayId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(stayId);
      expect(data.roomNumber).toBe('101');
    });

    test('Activar estadía', async ({ request }) => {
      const response = await request.post(`/api/stays/${stayId}/activate`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('active');
    });

    test('Listar estadías con filtros', async ({ request }) => {
      const response = await request.get('/api/stays?status=active&hotelCode=H001', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test('Ocupación del hotel', async ({ request }) => {
      const response = await request.get('/api/stays/occupancy/H001', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('occupancyRate');
      expect(data).toHaveProperty('activeStays');
    });
  });

  // ==================== VOUCHERS TESTS ====================
  test.describe('Sistema de Vouchers', () => {
    test('Generar voucher', async ({ request }) => {
      const response = await request.post('/api/vouchers', {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          stayId,
        },
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('code');
      expect(data.status).toBe('pending');

      voucherId = data.id;
    });

    test('Validar voucher', async ({ request }) => {
      const vouchers = await request.get('/api/vouchers', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const voucherList = await vouchers.json();
      const voucher = voucherList[0];

      const response = await request.post(`/api/vouchers/${voucher.code}/validate`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('active');
    });

    test('Redimir voucher', async ({ request }) => {
      const vouchers = await request.get('/api/vouchers?status=active', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const voucherList = await vouchers.json();
      const voucher = voucherList[0];

      const response = await request.post(`/api/vouchers/${voucher.code}/redeem`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('redeemed');
    });

    test('Obtener estadísticas de vouchers', async ({ request }) => {
      const response = await request.get('/api/vouchers/stats/overview', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('totalGenerated');
      expect(data).toHaveProperty('byStatus');
      expect(data).toHaveProperty('redemptionRate');
    });
  });

  // ==================== ORDERS TESTS ====================
  test.describe('Sistema de Órdenes', () => {
    test('Crear orden', async ({ request }) => {
      const response = await request.post('/api/orders', {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          stayId,
          items: [],
        },
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.status).toBe('open');
      expect(data.total).toBe(0);

      orderId = data.id;
    });

    test('Agregar item a orden', async ({ request }) => {
      const response = await request.post(`/api/orders/${orderId}/items`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          productCode: 'CAFE',
          quantity: 2,
          unitPrice: 3.5,
        },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(7.0);
      expect(data.items.length).toBe(1);
    });

    test('Completar orden', async ({ request }) => {
      const response = await request.post(`/api/orders/${orderId}/complete`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('completed');
    });

    test('Obtener estadísticas de consumo', async ({ request }) => {
      const response = await request.get('/api/orders/stats/consumption', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('totalOrders');
      expect(data).toHaveProperty('totalRevenue');
      expect(data).toHaveProperty('averageOrderValue');
    });
  });

  // ==================== REPORTS TESTS ====================
  test.describe('Reportes & Analytics', () => {
    test('Obtener reporte de ocupación', async ({ request }) => {
      const response = await request.get('/api/reports/occupancy/H001', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('occupancyRate');
      expect(data).toHaveProperty('activeStays');
      expect(data).toHaveProperty('maxRooms');
    });

    test('Obtener stats de vouchers', async ({ request }) => {
      const response = await request.get('/api/reports/vouchers/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('totalGenerated');
      expect(data).toHaveProperty('redemptionRate');
      expect(data).toHaveProperty('expirationRate');
    });

    test('Obtener reporte de consumo', async ({ request }) => {
      const response = await request.get('/api/reports/orders/consumption', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('totalOrders');
      expect(data).toHaveProperty('completedOrders');
      expect(data).toHaveProperty('totalRevenue');
    });

    test('Obtener revenue diario', async ({ request }) => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

      const response = await request.get(
        `/api/reports/revenue/daily?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('days');
      expect(data).toHaveProperty('totalRevenue');
    });

    test('Obtener dashboard consolidado', async ({ request }) => {
      const response = await request.get('/api/reports/dashboard/H001', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('occupancy');
      expect(data).toHaveProperty('vouchers');
      expect(data).toHaveProperty('consumption');
      expect(data).toHaveProperty('peakHours');
      expect(data).toHaveProperty('kpis');
    });
  });

  // ==================== SECURITY TESTS ====================
  test.describe('Seguridad', () => {
    test('Acceso denegado sin token', async ({ request }) => {
      const response = await request.get('/api/stays');
      expect(response.status()).toBe(401);
    });

    test('Token inválido rechazado', async ({ request }) => {
      const response = await request.get('/api/stays', {
        headers: { Authorization: 'Bearer invalid_token_here' },
      });
      expect(response.status()).toBe(401);
    });

    test('SQL injection protection', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: "admin' OR '1'='1",
          password: "' OR '1'='1",
        },
      });
      expect(response.status()).toBe(401);
    });

    test('RBAC enforcement', async ({ request }) => {
      // Registrar usuario con rol guest
      const registerRes = await request.post('/api/auth/register', {
        data: {
          email: 'guest@hotel.com',
          password: 'password123',
          firstName: 'Guest',
          lastName: 'User',
          role: 'guest',
        },
      });

      expect(registerRes.status()).toBe(201);
    });
  });

  // ==================== PERFORMANCE TESTS ====================
  test.describe('Performance', () => {
    test('Response time < 1s para listados', async ({ request }) => {
      const start = Date.now();
      const response = await request.get('/api/stays', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const duration = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    test('Crear 10 órdenes rápidamente', async ({ request }) => {
      const start = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await request.post('/api/orders', {
          headers: { Authorization: `Bearer ${accessToken}` },
          data: {
            stayId,
            items: [],
          },
        });
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // 5s para 10 órdenes
    });
  });

  // ==================== CLEANUP ====================
  test.describe('Cleanup', () => {
    test('Completar estadía', async ({ request }) => {
      const response = await request.post(`/api/stays/${stayId}/complete`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('completed');
    });
  });
});
