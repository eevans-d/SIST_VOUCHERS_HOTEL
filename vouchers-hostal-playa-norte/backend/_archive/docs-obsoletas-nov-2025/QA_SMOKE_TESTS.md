# QA & Smoke Tests - Sistema Vouchers Hotel

## Objetivo

Validar que después de cada deploy en producción:
1. **Infraestructura**: App arranca, DB conecta, healthcheck pasa.
2. **APIs críticas**: Login, crear/validar/redeem vouchers.
3. **Experiencia de usuario**: Flujo completo operativo.
4. **Seguridad**: Headers correctos, CORS funciona, rate limiting activo.

---

## Automated Tests (Jest + Supertest)

### 1. Healthcheck

```javascript
// tests/smoke.test.js
import request from 'supertest';
import express from 'express';

const app = express();
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: 'production' });
});

describe('Smoke Tests - Healthcheck', () => {
  test('GET /health debe retornar 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.environment).toBe('production');
  });

  test('Response debe incluir timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).getTime()).toBeGreaterThan(0);
  });

  test('Database debe estar conectada', async () => {
    const res = await request(app).get('/health');
    expect(res.body.database).toBeDefined();
  });
});
```

### 2. Autenticación

```javascript
describe('Smoke Tests - Autenticación', () => {
  test('POST /api/auth/login con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@hotel.com',
        password: 'testPassword123!'
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  test('POST /api/auth/login con credenciales inválidas debe retornar 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@hotel.com',
        password: 'wrongPassword'
      });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('Rate limiting en /api/auth/login (max 5 attempts en 15min)', async () => {
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@hotel.com',
          password: 'wrong'
        });
      
      if (i < 5) {
        expect(res.statusCode).toBe(401);
      } else {
        expect(res.statusCode).toBe(429); // Too Many Requests
      }
    }
  });
});
```

### 3. Vouchers - Flujo completo

```javascript
describe('Smoke Tests - Vouchers Completos', () => {
  let token;
  let stayId;
  let voucherId;

  beforeAll(async () => {
    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hotel.com', password: 'testPassword123!' });
    token = loginRes.body.accessToken;
  });

  test('POST /api/stays - crear hospedaje', async () => {
    const res = await request(app)
      .post('/api/stays')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hotelCode: 'HPN',
        guestName: 'Juan Pérez',
        checkInDate: '2025-02-01',
        checkOutDate: '2025-02-05',
        roomNumber: '101',
        amount: 1000
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    stayId = res.body.id;
  });

  test('POST /api/vouchers - generar voucher', async () => {
    const res = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stayId: stayId,
        denomination: 100,
        quantity: 10
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.code).toBeDefined();
    expect(res.body.qrCode).toBeDefined();
    voucherId = res.body.id;
  });

  test('GET /api/vouchers/:id - obtener detalles del voucher', async () => {
    const res = await request(app)
      .get(`/api/vouchers/${voucherId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBeDefined();
    expect(res.body.status).toBe('ACTIVE');
  });

  test('POST /api/vouchers/:id/validate - validar voucher', async () => {
    const res = await request(app)
      .post(`/api/vouchers/${voucherId}/validate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  test('POST /api/vouchers/:id/redeem - canjear voucher', async () => {
    const res = await request(app)
      .post(`/api/vouchers/${voucherId}/redeem`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 100
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('REDEEMED');
  });
});
```

### 4. Seguridad

```javascript
describe('Smoke Tests - Seguridad', () => {
  test('Headers de seguridad están presentes', async () => {
    const res = await request(app).get('/health');
    
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  test('CORS: request desde origen no permitido debe ser rechazado', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://malicious-site.com');
    
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('CORS: request desde origen permitido debe tener header', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://hpn-vouchers-backend.fly.dev');
    
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  test('Request sin Authorization header a endpoint protegido debe retornar 401', async () => {
    const res = await request(app)
      .get('/api/vouchers')
      .set('Authorization', '');
    
    expect(res.statusCode).toBe(401);
  });
});
```

---

## Manual Checklist (Post-Deploy)

### Infraestructura (5 min)

- [ ] **App arranca sin errores**
  ```bash
  flyctl logs -a hpn-vouchers-backend --no-tail | head -50
  ```
  Buscar: `✅ Base de datos conectada`, `✅ Servicios inicializados`

- [ ] **Healthcheck responde 200 OK**
  ```bash
  curl -s https://hpn-vouchers-backend.fly.dev/health | jq .
  ```
  Esperado: `{"status":"ok", "database":"connected"}`

- [ ] **HTTPS es obligatorio**
  ```bash
  curl -I http://hpn-vouchers-backend.fly.dev/ 2>&1 | grep -i location
  ```
  Esperado: HTTP 301 redirected a HTTPS

- [ ] **Base de datos accesible**
  ```bash
  flyctl ssh console -a hpn-vouchers-backend
  sqlite3 /data/vouchers.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
  exit
  ```
  Esperado: Mostrar número de tablas (> 0)

### APIs Core (10 min)

- [ ] **Login funciona**
  ```bash
  curl -X POST https://hpn-vouchers-backend.fly.dev/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@hotel.com","password":"testPassword123!"}'
  ```
  Esperado: `{"accessToken":"...", "refreshToken":"..."}`

- [ ] **Crear hospedaje funciona**
  ```bash
  TOKEN="<from login above>"
  curl -X POST https://hpn-vouchers-backend.fly.dev/api/stays \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"hotelCode":"HPN","guestName":"Test","checkInDate":"2025-02-01","checkOutDate":"2025-02-05","roomNumber":"101","amount":1000}'
  ```
  Esperado: Código 201 con ID del hospedaje

- [ ] **Generar voucher funciona**
  ```bash
  STAY_ID="<from create stay above>"
  curl -X POST https://hpn-vouchers-backend.fly.dev/api/vouchers \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"stayId":"'$STAY_ID'","denomination":100,"quantity":5}'
  ```
  Esperado: Código 201 con código de voucher y QR

- [ ] **Validar voucher funciona**
  ```bash
  VOUCHER_ID="<from generate voucher>"
  curl -X POST https://hpn-vouchers-backend.fly.dev/api/vouchers/$VOUCHER_ID/validate \
    -H "Authorization: Bearer $TOKEN"
  ```
  Esperado: `{"valid":true}`

- [ ] **Canjear voucher funciona**
  ```bash
  curl -X POST https://hpn-vouchers-backend.fly.dev/api/vouchers/$VOUCHER_ID/redeem \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"amount":100}'
  ```
  Esperado: Código 200 con status `REDEEMED`

### Seguridad (5 min)

- [ ] **Headers de seguridad presentes**
  ```bash
  curl -I https://hpn-vouchers-backend.fly.dev/health | grep -i "X-Frame\|X-Content\|Strict-Transport"
  ```
  Esperado: Ver X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security

- [ ] **CSP header presente**
  ```bash
  curl -I https://hpn-vouchers-backend.fly.dev/health | grep -i "content-security"
  ```
  Esperado: Contener `Content-Security-Policy: default-src 'self'...`

- [ ] **Rate limiting funciona**
  ```bash
  for i in {1..6}; do 
    curl -s -w "%{http_code}\n" https://hpn-vouchers-backend.fly.dev/health | tail -1
  done
  ```
  Esperado: Últimas 5 = 200, última (6ta) = 429 (Too Many Requests)

- [ ] **CORS correctamente configurado**
  ```bash
  # Request desde origen permitido
  curl -I https://hpn-vouchers-backend.fly.dev/health \
    -H "Origin: https://hpn-vouchers-backend.fly.dev" | grep -i "access-control"
  ```
  Esperado: Ver `Access-Control-Allow-Origin: https://hpn-vouchers-backend.fly.dev`

### Observabilidad (3 min)

- [ ] **/metrics responde y contiene contadores**
  ```bash
  curl -s https://hpn-vouchers-backend.fly.dev/metrics | head -30
  ```
  Esperado: Líneas que incluyan `http_requests_total` y `process_` metrics

- [ ] **Errores 5xx se reflejan**
  ```bash
  # Forzar una ruta inexistente y ver que no suma 5xx (debe ser 404)
  curl -s -o /dev/null -w "%{http_code}\n" https://hpn-vouchers-backend.fly.dev/no-existe
  # Luego consultar métricas de errores
  curl -s https://hpn-vouchers-backend.fly.dev/metrics | grep http_server_errors_total || true
  ```
  Esperado: Normalmente vacío si no hubo 5xx

### Performance (5 min)

- [ ] **Latencia de /health < 500ms**
  ```bash
  for i in {1..5}; do
    time curl -s https://hpn-vouchers-backend.fly.dev/health > /dev/null
  done
  ```
  Esperado: real < 500ms en mayoría de requests

- [ ] **Latencia de login < 1s**
  ```bash
  time curl -X POST https://hpn-vouchers-backend.fly.dev/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@hotel.com","password":"testPassword123!"}'
  ```
  Esperado: real < 1s

### Logs y Monitoreo (5 min)

- [ ] **Logs limpios (sin errores)**
  ```bash
  flyctl logs -a hpn-vouchers-backend --no-tail 2>&1 | tail -50 | grep -i error
  ```
  Esperado: Vacío o solo warning esperados

- [ ] **Logs muestran actividad**
  ```bash
  flyctl logs -a hpn-vouchers-backend --no-tail 2>&1 | tail -20
  ```
  Esperado: Ver requests HTTP, timestamps recientes

---

## Checklist de Release

### Antes de marcar "LISTO PARA PRODUCCIÓN"

- [ ] Todos los automated tests pasando
- [ ] Manual checklist completado (✅ en todas las secciones)
- [ ] Logs sin errores P0/P1
- [ ] Performance dentro de SLA (p95 < 2s)
- [ ] Backup de DB realizado
- [ ] Secretos rotados (si última rotación > 90 días)
- [ ] Security audit pasado
- [ ] Documentación actualizada (OPERACION.md, SECRETOS.md)

### Rollback Plan

Si algo falla:
```bash
# Ver releases anteriores
flyctl releases -a hpn-vouchers-backend --limit 10

# Volver a release anterior
flyctl releases rollback -a hpn-vouchers-backend
```

---

## Reporting

### Template de reporte QA post-deploy

```markdown
## QA Report - Fecha: [YYYY-MM-DD]

### Información del Deploy
- **Release**: v[X.Y.Z]
- **Hash Commit**: [abc123...]
- **Deploy Time**: [HH:MM UTC]
- **Ambiente**: production (Fly.io)

### Resultados

#### Infraestructura
- [ ] ✅ App arranca sin errores
- [ ] ✅ Healthcheck: OK
- [ ] ✅ HTTPS: Activo
- [ ] ✅ DB: Conectada

#### APIs Core
- [ ] ✅ Login: OK
- [ ] ✅ Crear hospedaje: OK
- [ ] ✅ Generar voucher: OK
- [ ] ✅ Validar voucher: OK
- [ ] ✅ Canjear voucher: OK

#### Seguridad
- [ ] ✅ Headers de seguridad: Presentes
- [ ] ✅ CSP: Configurado
- [ ] ✅ CORS: OK
- [ ] ✅ Rate limiting: OK

#### Performance
- [ ] ✅ Latencia /health: < 500ms
- [ ] ✅ Latencia login: < 1s
- [ ] ✅ p95: Dentro de SLA

#### Logs
- [ ] ✅ Sin errores P0/P1
- [ ] ✅ Actividad normal

### Conclusión
✅ **QA APROBADO - LISTO PARA PRODUCCIÓN**

Observaciones: [Si las hay]

---

Reportado por: [Nombre]
Fecha: [YYYY-MM-DD HH:MM UTC]
```

---

**Última actualización**: 2025-01-15
**Versión**: 1.0
