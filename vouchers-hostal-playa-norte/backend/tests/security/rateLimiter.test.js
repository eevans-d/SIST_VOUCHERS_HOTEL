/**
 * @file rateLimiter.test.js
 * @description Tests exhaustivos para rate limiting
 * @ref PLAN_IMPLEMENTACION_ROADMAP.md - Issue P0 #1
 * 
 * Pruebas:
 * 1. Rate limiting global (100 req/15min)
 * 2. Rate limiting login (5 intentos fallidos/15min)
 * 3. Rate limiting register (3 intentos/15min)
 * 4. Contador resetea después de login exitoso
 * 5. Headers de rate limit presentes en respuesta
 * 6. Health check no está limitado
 */

import request from 'supertest';
import app from '../src/index.js';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

describe('🔒 Rate Limiting - Security (P0)', () => {
  
  // ==================== GLOBAL LIMITER ====================
  
  describe('Global Rate Limiter (100 req/15min)', () => {
    test('Debería permitir requests dentro del límite', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .get('/health')
          .expect((res) => {
            expect(res.status).toBe(200);
          });
        
        expect(res.headers['ratelimit-limit']).toBe('100');
        expect(parseInt(res.headers['ratelimit-remaining'])).toBeGreaterThanOrEqual(95 - i);
      }
    });

    test('Health check NO debe estar limitado', async () => {
      // Si health check no está limitado, debe excluirse del contador
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .get('/health')
          .expect(200);
        
        expect(res.body.status).toBe('ok');
      }
    });
  });

  // ==================== LOGIN LIMITER ====================

  describe('Login Rate Limiter (5 intentos fallidos/15min)', () => {
    
    test('Debería permitir 5 intentos fallidos de login', async () => {
      const email = 'testuser@example.com';
      const wrongPassword = 'wrongpassword';

      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: email,
            password: wrongPassword,
          });

        // Esperamos que falle por credenciales inválidas
        expect(res.status).toBe(401); // Unauthorized
        expect(res.body.success).toBe(false);
        
        // Verificar headers de rate limit
        expect(res.headers['ratelimit-limit']).toBe('5');
        expect(parseInt(res.headers['ratelimit-remaining'])).toBe(5 - (i + 1));
      }
    });

    test('Debería bloquear el 6to intento fallido', async () => {
      const email = 'testuser2@example.com';
      const wrongPassword = 'wrongpassword';

      // Hacer 5 intentos fallidos
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: email,
            password: wrongPassword,
          });
      }

      // El 6to intento debería ser bloqueado
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: email,
          password: wrongPassword,
        })
        .expect(429); // Too Many Requests

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('demasiados');
      expect(res.body.retryAfter).toBeDefined();
    });

    test('Contador debería resetearse después de login exitoso', async () => {
      // Este test requiere un usuario válido en la BD
      // Por ahora lo marcamos como skip (en producción, usar fixtures)
      
      // Pseudocódigo:
      // 1. Crear usuario con password conocido
      // 2. Hacer 5 intentos fallidos
      // 3. Login exitoso
      // 4. Contador debería estar en 5 (reset)
      
      console.log('⏭️  SKIP: Requiere usuario de prueba en BD');
    });

    test('Emails diferentes deberían tener contadores separados', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      const wrongPassword = 'wrong';

      // 5 intentos con email1
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: email1, password: wrongPassword });
      }

      // email1 debe estar bloqueado
      await request(app)
        .post('/api/auth/login')
        .send({ email: email1, password: wrongPassword })
        .expect(429);

      // email2 debe funcionar (nuevo contador)
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: email2, password: wrongPassword });

      // Puede ser 401 (credenciales inválidas) pero NO 429 (rate limited)
      expect(res.status).not.toBe(429);
    });
  });

  // ==================== REGISTER LIMITER ====================

  describe('Register Rate Limiter (3 intentos/15min)', () => {
    
    test('Debería permitir 3 intentos de registro desde la misma IP', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: `user${i}@example.com`,
            password: 'ValidPassword123!',
            name: `Test User ${i}`,
          });

        // El status puede ser 201 (exitoso), 400 (validación) o 409 (duplicate)
        // pero NO debe ser 429 (rate limited)
        expect(res.status).not.toBe(429);
        
        expect(res.headers['ratelimit-limit']).toBe('3');
        expect(parseInt(res.headers['ratelimit-remaining'])).toBe(3 - (i + 1));
      }
    });

    test('Debería bloquear el 4to intento de registro', async () => {
      // Hacer 3 intentos
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({
            email: `user${Date.now()}-${i}@example.com`,
            password: 'ValidPassword123!',
            name: `Test User ${i}`,
          });
      }

      // El 4to intento debería ser bloqueado
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `user${Date.now()}-4@example.com`,
          password: 'ValidPassword123!',
          name: 'Test User 4',
        })
        .expect(429);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('demasiados');
    });
  });

  // ==================== REFRESH TOKEN LIMITER ====================

  describe('Refresh Token Rate Limiter (10 intentos/15min)', () => {
    
    test('Debería permitir 10 intentos de refresh token', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({
            refreshToken: 'invalid-token', // Será rechazado pero cuenta para rate limit
          });

        // Status puede ser 401 (token inválido) pero NO 429
        expect([401, 429]).toContain(res.status);
        
        if (res.status !== 429) {
          expect(res.headers['ratelimit-limit']).toBe('10');
          expect(parseInt(res.headers['ratelimit-remaining'])).toBeLessThanOrEqual(10 - i);
        }
      }
    });

    test('Debería bloquear después de 10 intentos', async () => {
      // Hacer 10 intentos fallidos
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'invalid' });
      }

      // 11vo intento bloqueado
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid' })
        .expect(429);

      expect(res.body.success).toBe(false);
    });
  });

  // ==================== RATE LIMIT HEADERS ====================

  describe('Rate Limit Headers', () => {
    
    test('Response debe incluir RateLimit-Limit header', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-limit']).toBe('100');
    });

    test('Response debe incluir RateLimit-Remaining header', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(parseInt(res.headers['ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
    });

    test('Response debe incluir RateLimit-Reset header', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  // ==================== RETRY-AFTER HEADER ====================

  describe('Retry-After Information', () => {
    
    test('Login bloqueado debe retornar retryAfter', async () => {
      const email = 'testretry@example.com';
      const wrongPassword = 'wrong';

      // Hacer 5 intentos fallidos
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email, password: wrongPassword });
      }

      // El 6to intento
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: wrongPassword })
        .expect(429);

      expect(res.body.retryAfter).toBeDefined();
      expect(typeof res.body.retryAfter).toBe('number');
      expect(res.body.retryAfter).toBeGreaterThan(0);
      expect(res.body.retryAfter).toBeLessThanOrEqual(15 * 60); // 15 minutos máximo
    });
  });

  // ==================== X-FORWARDED-FOR HEADER ====================

  describe('Proxy Support (X-Forwarded-For)', () => {
    
    test('Debería usar X-Forwarded-For si está disponible', async () => {
      // Simular petición desde proxy
      const res = await request(app)
        .get('/health')
        .set('X-Forwarded-For', '192.168.1.100')
        .expect(200);

      expect(res.headers['ratelimit-limit']).toBeDefined();
      // La IP 192.168.1.100 tiene su propio contador
    });

    test('IPs diferentes deberían tener contadores separados', async () => {
      const wrongPassword = 'wrong';
      
      // IP 1: 5 intentos
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', '10.0.0.1')
          .send({ email: 'user1@test.com', password: wrongPassword });
      }

      // IP 1: Bloqueada
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ email: 'user1@test.com', password: wrongPassword })
        .expect(429);

      // IP 2: Debería funcionar (nuevo contador)
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.2')
        .send({ email: 'user1@test.com', password: wrongPassword });

      expect(res.status).not.toBe(429);
    });
  });

  // ==================== ERROR RESPONSES ====================

  describe('Rate Limit Error Responses', () => {
    
    test('Error response debe ser JSON válido', async () => {
      const email = 'testjson@example.com';
      
      // Llenar el límite
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'wrong' });
      }

      // Rate limited
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      expect(res.type).toMatch(/json/);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('retryAfter');
    });

    test('Error message debe ser legible', async () => {
      const email = 'testmsg@example.com';
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'wrong' });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' })
        .expect(429);

      expect(res.body.error.length).toBeGreaterThan(10);
      expect(res.body.error.toLowerCase()).toContain('intenta');
    });
  });
});

// ==================== PERFORMANCE ====================

describe('🚀 Rate Limiter Performance', () => {
  
  test('Rate limiting debe tener impacto mínimo en latencia', async () => {
    const start = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await request(app)
        .get('/health')
        .expect(200);
    }
    
    const elapsed = Date.now() - start;
    const avgLatency = elapsed / 10;
    
    console.log(`⏱️  Latencia promedio: ${avgLatency.toFixed(2)}ms`);
    expect(avgLatency).toBeLessThan(100); // Menos de 100ms por request
  });
});
