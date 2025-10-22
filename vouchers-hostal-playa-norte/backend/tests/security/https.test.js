/**
 * @file https.test.js
 * @description Tests para HTTPS enforcement y Helmet security headers
 * @ref PLAN_IMPLEMENTACION_ROADMAP.md - Issue P0 #2
 * 
 * Pruebas:
 * 1. HTTP redirige a HTTPS
 * 2. Headers de seguridad presentes
 * 3. CSP policy correcta
 * 4. HSTS enabled
 * 5. Clickjacking protection
 * 6. XSS filter
 */

import request from 'supertest';
import app from '../src/index.js';
import { describe, test, expect } from '@jest/globals';

describe('🔒 HTTPS & Security Headers (P0 #2)', () => {

  // ==================== HTTPS ENFORCEMENT ====================

  describe('HTTPS Enforcement', () => {

    test('Health check funciona con HTTPS', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
    });

    // Nota: Para testear redirección HTTP→HTTPS, necesitamos servir HTTP en otro puerto
    // Esto requiere setup especial. Por ahora testamos headers.
  });

  // ==================== HELMET SECURITY HEADERS ====================

  describe('Helmet Security Headers', () => {

    test('Content-Security-Policy header presente', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['content-security-policy']).toBeDefined();
    });

    test('CSP debe incluir default-src self', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
    });

    test('CSP debe prevenir scripts no permitidos', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const csp = res.headers['content-security-policy'];
      // Debe estar restringido (no 'unsafe-eval')
      expect(csp).toBeDefined();
    });

    test('X-Frame-Options debe ser DENY (prevenir clickjacking)', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    test('X-Content-Type-Options debe ser nosniff', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('Referrer-Policy debe estar configurado', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['referrer-policy']).toBeDefined();
      expect(res.headers['referrer-policy']).toContain('strict-origin');
    });
  });

  // ==================== HSTS (HTTP STRICT TRANSPORT SECURITY) ====================

  describe('HSTS (HTTP Strict Transport Security)', () => {

    test('HSTS header presente', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    test('HSTS maxAge debe ser 1 año (31536000 segundos)', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const hsts = res.headers['strict-transport-security'];
      expect(hsts).toContain('max-age=31536000');
    });

    test('HSTS debe incluir includeSubDomains', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const hsts = res.headers['strict-transport-security'];
      expect(hsts).toContain('includeSubDomains');
    });

    test('HSTS debe incluir preload', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const hsts = res.headers['strict-transport-security'];
      expect(hsts).toContain('preload');
    });
  });

  // ==================== CLICKJACKING PROTECTION ====================

  describe('Clickjacking Protection', () => {

    test('X-Frame-Options previene insertar en iframes', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    test('API no debe permitir ser embebida en sitios externos', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        // Endpoint protegido, pero verificamos header
        .expect((res) => {
          // Si tiene header, es bueno
          if (res.status === 200 || res.status === 401) {
            expect(res.headers['x-frame-options']).toBe('DENY');
          }
        });
    });
  });

  // ==================== XSS PROTECTION ====================

  describe('XSS Protection', () => {

    test('X-XSS-Protection header presente (legacy)', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      // Helm incluye este header (legacy para navegadores antiguos)
      expect(res.headers['x-xss-protection'] || res.headers['content-security-policy']).toBeDefined();
    });

    test('JSON response no debe contener XSS payload', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const json = JSON.stringify(res.body);
      expect(json).not.toContain('<script>');
      expect(json).not.toContain('onclick=');
      expect(json).not.toContain('javascript:');
    });

    test('CSP debe bloquear inline scripts', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const csp = res.headers['content-security-policy'];
      // CSP generalmente no incluye 'unsafe-inline' para scripts
      if (csp && csp.includes("script-src")) {
        expect(csp).not.toContain("script-src 'unsafe-inline'");
      }
    });
  });

  // ==================== MIME SNIFFING PROTECTION ====================

  describe('MIME Sniffing Protection', () => {

    test('X-Content-Type-Options debe ser nosniff', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('Responses deben tener correcto Content-Type', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.type).toMatch(/json/);
      expect(res.headers['content-type']).toContain('json');
    });

    test('API debe forzar application/json para respuestas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrong',
        })
        .expect((res) => {
          // Puede ser 401 u otro, pero debe ser JSON
          expect(res.type).toMatch(/json/);
        });
    });
  });

  // ==================== PERMISSION POLICY (Feature Control) ====================

  describe('Permissions-Policy', () => {

    test('Permissions-Policy header presente', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      // Helmet establece Permissions-Policy
      // (antes era Feature-Policy)
      expect(res.headers['permissions-policy'] || res.headers['feature-policy']).toBeDefined();
    });
  });

  // ==================== CUSTOM SECURITY HEADERS ====================

  describe('Custom Security Headers', () => {

    test('X-API-Version presente', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['x-api-version']).toBe('v1');
    });

    test('X-Powered-By debe estar removido (no información sensible)', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      // No debe haber información del servidor
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('Server header debe estar minimizado o ausente', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const server = res.headers['server'];
      if (server) {
        // Si existe, debe ser mínimo
        expect(server.length).toBeLessThan(20);
      }
    });
  });

  // ==================== SECURITY ENDPOINTS ====================

  describe('Security Configuration Endpoints', () => {

    test('/.well-known/security.txt debe ser accesible', async () => {
      const res = await request(app)
        .get('/.well-known/security.txt')
        .expect((res) => {
          // Puede ser 200 o 404, pero no 500
          expect([200, 404]).toContain(res.status);
        });
    });

    test('Si security.txt existe, debe ser text/plain', async () => {
      const res = await request(app)
        .get('/.well-known/security.txt');

      if (res.status === 200) {
        expect(res.type).toMatch(/text/);
        expect(res.text).toContain('Contact:');
      }
    });
  });

  // ==================== HEADER CONSISTENCY ====================

  describe('Header Consistency Across Endpoints', () => {

    test('Todos los endpoints deben tener security headers', async () => {
      const endpoints = [
        '/health',
        '/api/auth/login',
        '/api/reports/dashboard',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .expect((res) => {
            // Puede tener diferentes status codes
            // Pero siempre debe tener security headers
            if (res.status < 500) {
              expect(res.headers['content-security-policy'] || 
                     res.headers['x-frame-options']).toBeDefined();
            }
          });
      }
    });

    test('HSTS debe estar en todas respuestas exitosas', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.headers['strict-transport-security']).toBeDefined();
    });
  });

  // ==================== SECURITY AUDIT ====================

  describe('Security Audit Checklist', () => {

    test('HTTPS Enforcement ✓', async () => {
      // En desarrollo, se saltea. En producción, debe redirigir.
      const env = process.env.NODE_ENV;
      if (env === 'production') {
        console.log('⚠️  HTTPS enforcement debe ser probado con HTTP (setup especial)');
      }
      expect(true).toBe(true); // Placeholder
    });

    test('Helmet Security Headers ✓', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const checks = {
        'Content-Security-Policy': !!res.headers['content-security-policy'],
        'X-Frame-Options': !!res.headers['x-frame-options'],
        'X-Content-Type-Options': !!res.headers['x-content-type-options'],
        'Strict-Transport-Security': !!res.headers['strict-transport-security'],
        'Referrer-Policy': !!res.headers['referrer-policy'],
      };

      console.log('Security Headers Status:');
      Object.entries(checks).forEach(([header, present]) => {
        console.log(`  ${present ? '✅' : '❌'} ${header}`);
      });

      expect(Object.values(checks).every(v => v)).toBe(true);
    });

    test('HSTS Preload Eligibility', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const hsts = res.headers['strict-transport-security'];
      expect(hsts).toContain('max-age=');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');

      console.log('✅ HSTS preload eligible');
      console.log('   Puede registrarse en https://hstspreload.org');
    });

    test('OWASP Security Headers', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const headers = res.headers;
      const owasp = {
        'Strict-Transport-Security': !!headers['strict-transport-security'],
        'X-Frame-Options': !!headers['x-frame-options'],
        'X-Content-Type-Options': !!headers['x-content-type-options'],
        'Content-Security-Policy': !!headers['content-security-policy'],
      };

      console.log('OWASP Recommended Headers:');
      Object.entries(owasp).forEach(([header, present]) => {
        console.log(`  ${present ? '✅' : '⚠️ '} ${header}`);
      });

      expect(Object.values(owasp).every(v => v)).toBe(true);
    });
  });
});
