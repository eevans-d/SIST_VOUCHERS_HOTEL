# ISSUE #30: API Gateway Service - Documentación Completa

## Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Conceptos Fundamentales](#conceptos-fundamentales)
3. [Arquitectura](#arquitectura)
4. [Algoritmos Clave](#algoritmos-clave)
5. [Integración](#integración)
6. [Ejemplos de Uso](#ejemplos-de-uso)
7. [Resolución de Problemas](#resolución-de-problemas)
8. [Checklist de Validación](#checklist-de-validación)

---

## Descripción General

### ¿Qué es el API Gateway?

El **API Gateway Service** es un servicio de gestión centralizada de solicitudes HTTP que actúa como punto de entrada único para todas las API del sistema. Proporciona control granular sobre autenticación, autorización, limitación de velocidad, almacenamiento en caché, circuit breaking y métricas de rendimiento.

**Problemas que resuelve:**

- **Fragmentación:** Múltiples servicios sin punto de entrada centralizado
- **Seguridad:** Autenticación y autorización inconsistentes
- **Performance:** Caché inconsistente y sin deduplicación
- **Confiabilidad:** Falta de protección contra fallos en cascada
- **Observabilidad:** Métricas dispersas sin visión centralizada
- **Escalabilidad:** Contención en endpoints populares
- **Cumplimiento:** Falta de auditoría centralizada

### Características Principales

```
✓ Autenticación JWT con roles
✓ Limitación de velocidad por endpoint y cliente
✓ Circuit breaker (3 estados: closed/open/half-open)
✓ Caché de respuestas con TTL configurable
✓ Validación de solicitudes centralizada
✓ Transformación de solicitud/respuesta
✓ Métricas per-endpoint
✓ Middleware global
✓ Health checks
✓ Soporte RBAC (Role-Based Access Control)
```

---

## Conceptos Fundamentales

### 1. Autenticación JWT

**JWT (JSON Web Token)** es un estándar para transmitir información de forma segura entre partes como objeto JSON.

```
Token Structure:
Header.Payload.Signature

Ejemplo:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJpZCI6IjEyMyIsInJvbGUiOiJhZG1pbiJ9.
signature_hash
```

**En APIGatewayService:**

```javascript
// El gateway valida que el token sea:
1. Presente en el header Authorization
2. Formato "Bearer <token>"
3. Firmado correctamente con jwtSecret
4. No expirado
5. Contenga los roles necesarios (si se requiere)
```

**Flujo de Autenticación:**

```
Solicitud con Token
        ↓
Extrae Bearer Token
        ↓
Verifica Firma (HS256)
        ↓
Valida Expiración
        ↓
Extrae Roles
        ↓
Compara con Roles Requeridos
        ↓
Autenticación OK / FAIL
```

### 2. Control de Acceso Basado en Roles (RBAC)

RBAC es un modelo de seguridad donde los permisos se asignan a roles, no a usuarios individuales.

**Ejemplo:**

```javascript
// Ruta que requiere rol 'admin'
gateway.registerRoute('DELETE', '/api/users/:id', deleteUserHandler, {
  requiresAuth: true,
  roles: ['admin']  // Solo usuarios con rol 'admin' pueden acceder
});

// Ruta que requiere múltiples roles
gateway.registerRoute('GET', '/api/reports', getReportsHandler, {
  requiresAuth: true,
  roles: ['admin', 'analyst', 'manager']  // Cualquiera de estos roles
});

// Ruta pública
gateway.registerRoute('GET', '/api/public', publicHandler, {
  requiresAuth: false
});
```

**Validación de Roles:**

```
1. Usuario envía token con roles ['user']
2. Ruta requiere roles ['admin']
3. Gateway comprueba: ['user'] ∩ ['admin'] = ∅
4. Acceso denegado: 403 Forbidden
```

### 3. Limitación de Velocidad (Rate Limiting)

Rate limiting controla cuántas solicitudes un cliente puede hacer en una ventana de tiempo, previniendo abuso y ataques.

**Estrategia: Sliding Window**

```
Ventana: 60 segundos, Límite: 5 solicitudes

Timeline:
t=10s: Req 1 ✓ (1/5)
t=15s: Req 2 ✓ (2/5)
t=20s: Req 3 ✓ (3/5)
t=25s: Req 4 ✓ (4/5)
t=30s: Req 5 ✓ (5/5)
t=35s: Req 6 ✗ (ventana llena, retry después de 40s)
       ↓
       (Cuando t ≥ 70s, Req 1 caduca de la ventana)
t=71s: Req 6 ✓ (1/5)
```

**API Gateway implementa:**

```javascript
requestQueue: {
  '127.0.0.1:GET:/api/users': [timestamp1, timestamp2, ...],
  // Limpia timestamps fuera de la ventana
  // Rechaza si hay >= requests en la ventana actual
}
```

### 4. Circuit Breaker

El Circuit Breaker previene que solicitudes se envíen a un servicio degradado, similar a un disyuntor eléctrico.

**Estados del Circuit Breaker:**

```
                    ┌─────────────┐
                    │   CLOSED    │  (Operación Normal)
                    │             │  • Las solicitudes pasan
                    │  Requests   │  • Se rastrean errores
                    │   → OK      │  • Si errorRate > threshold
                    └──────┬──────┘     → OPEN
                           │
                   Error Rate > 50%
                           │
                           ↓
                    ┌─────────────┐
                    │    OPEN     │  (Disyuntor Abierto)
                    │             │  • Las solicitudes fallan
                    │  Requests   │    inmediatamente
                    │    → FAIL   │  • Espera timeout
                    │ (fail-fast) │  • Después → HALF-OPEN
                    └──────┬──────┘
                           │
                    Timeout Reached (60s)
                           │
                           ↓
                    ┌─────────────┐
                    │ HALF-OPEN   │  (Testeo de Recuperación)
                    │             │  • Permite solicitudes limitadas
                    │  Test Mode  │  • Si OK → CLOSED
                    │             │  • Si ERROR → OPEN
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                   OK            ERROR
                    │             │
                    ↓             ↓
                 CLOSED        OPEN
```

**Configuración en API Gateway:**

```javascript
circuitBreakerThreshold: 50,      // Abre si 50% de errores
circuitBreakerTimeout: 60000,     // Timeout a half-open después de 60s
```

### 5. Caché de Respuestas

El caché reduce latencia y carga del backend almacenando respuestas de solicitudes GET.

**Estrategia:**

```javascript
Cache Key = Method:Path:Query
Cache Value = { response, timestamp, ttl }

GET /api/users?page=1 → Clave: GET:/api/users:{page:1}
GET /api/users?page=2 → Clave: GET:/api/users:{page:2}

Validación:
Si (ahora - timestamp) < ttl → Usar caché
Si (ahora - timestamp) >= ttl → Eliminar entrada, solicitar backend
```

**Características:**

```
✓ Solo almacena GET (operaciones idempotentes)
✓ TTL configurable por ruta (default: 300s)
✓ Limpieza automática de entradas expiradas
✓ Invalidación manual por patrón
✓ Métricas: cache hits, misses, hit rate
```

---

## Arquitectura

### Estructura de Componentes

```
┌─────────────────────────────────────────────────┐
│           API Gateway Service                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────────────────────────────────┐   │
│  │   Capa de Entrada (Request Pipeline)   │   │
│  │  1. Validación de tamaño                │   │
│  │  2. Búsqueda de ruta                    │   │
│  │  3. Ejecución de middleware             │   │
│  └────────────────────────────────────────┘   │
│                     ↓                          │
│  ┌────────────────────────────────────────┐   │
│  │     Capa de Seguridad                   │   │
│  │  1. Autenticación JWT                   │   │
│  │  2. Validación de roles (RBAC)          │   │
│  │  3. Bloqueo de caché no autenticado     │   │
│  └────────────────────────────────────────┘   │
│                     ↓                          │
│  ┌────────────────────────────────────────┐   │
│  │     Capa de Optimización                │   │
│  │  1. Búsqueda en caché                   │   │
│  │  2. Limitación de velocidad             │   │
│  │  3. Circuit breaker                     │   │
│  └────────────────────────────────────────┘   │
│                     ↓                          │
│  ┌────────────────────────────────────────┐   │
│  │     Capa de Procesamiento               │   │
│  │  1. Validación de solicitud             │   │
│  │  2. Ejecución del manejador             │   │
│  │  3. Timeout                             │   │
│  │  4. Transformación de respuesta         │   │
│  └────────────────────────────────────────┘   │
│                     ↓                          │
│  ┌────────────────────────────────────────┐   │
│  │     Capa de Salida                      │   │
│  │  1. Caché de respuesta                  │   │
│  │  2. Registro de métricas                │   │
│  │  3. Envío de respuesta                  │   │
│  └────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Estructuras de Datos Internas

```javascript
// 1. RUTAS REGISTRADAS
routes: Map<String, RouteDefinition>
  Clave: "METHOD:/path"
  Valor: {
    method: "GET",
    path: "/api/users",
    handler: Function,
    requiresAuth: Boolean,
    roles: String[],
    cacheable: Boolean,
    cacheTTL: Number,
    rateLimit: { requests: Number, window: Number },
    validation: Function,
    description: String,
    ...
  }

// 2. CACHÉ DE SOLICITUDES
requestCache: Map<String, CacheEntry>
  Clave: "METHOD:/path:query_hash"
  Valor: {
    response: Object,
    timestamp: Number,
    ttl: Number  // en segundos
  }
  
// 3. MÉTRICAS PER-ENDPOINT
requestMetrics: Map<String, Metrics>
  Clave: "METHOD:/path"
  Valor: {
    requests: Number,
    success: Number,
    errors: Number,
    cacheHits: Number,
    cacheMisses: Number,
    totalLatency: Number,
    avgLatency: Number,
    lastError: String,
    errorRate: Number,
    successRate: Number,
    lastAccess: Number
  }

// 4. CIRCUIT BREAKERS PER-ENDPOINT
circuitBreakers: Map<String, CircuitBreakerState>
  Clave: "METHOD:/path"
  Valor: {
    state: "closed" | "open" | "half-open",
    failures: Number,
    successes: Number,
    lastFailureTime: Number,
    lastStateChange: Number
  }

// 5. LIMITACIÓN DE VELOCIDAD
requestQueue: Map<String, Number[]>
  Clave: "client_ip:METHOD:/path"
  Valor: [timestamp1, timestamp2, ...]  // timestamps en ventana
```

### Pipeline de Procesamiento de Solicitud

```
ENTRADA: Request HTTP
    ↓
[1] VALIDAR TAMAÑO
    if (size > maxRequestSize) → 413 Payload Too Large
    ↓
[2] BUSCAR RUTA
    if (!route found) → 404 Not Found
    ↓
[3] EJECUTAR MIDDLEWARE
    for (middleware in middlewares) {
        if (!middleware(req)) → Rechazar
    }
    ↓
[4] AUTENTICAR
    if (route.requiresAuth) {
        if (!token) → 401 Unauthorized
        if (!valid_token) → 401 Unauthorized
        if (roles && !has_roles) → 403 Forbidden
    }
    ↓
[5] VERIFICAR CACHÉ (solo GET)
    if (GET && cached) → Devolver caché
    ↓
[6] LIMITACIÓN DE VELOCIDAD
    if (rate_limit_exceeded) → 429 Too Many Requests
    ↓
[7] CIRCUIT BREAKER
    if (breaker.state === "open") → 503 Service Unavailable
    ↓
[8] VALIDAR SOLICITUD
    if (validation && !valid) → 400 Bad Request
    ↓
[9] EJECUTAR MANEJADOR (con timeout)
    try {
        response = await handler(req, res)
    } catch (timeout) {
        → 504 Gateway Timeout
    } catch (error) {
        → 500 Internal Server Error
    }
    ↓
[10] CACHEAR RESPUESTA
     if (GET && cacheable && success) {
         cache.set(key, response)
     }
    ↓
[11] REGISTRAR MÉTRICAS
     metrics.update(...)
    ↓
SALIDA: Response HTTP
```

---

## Algoritmos Clave

### Algoritmo 1: Limitación de Velocidad (Sliding Window)

```javascript
/*
 * ALGORITMO: Limitación de velocidad con ventana deslizante
 * ENTRADA: request, routeKey
 * SALIDA: { allowed: Boolean, retryAfter: Number }
 */

_checkRateLimit(req, routeKey) {
  const key = `${req.ip}:${routeKey}`;
  const rateLimit = this.routes.get(routeKey).rateLimit;
  
  if (!rateLimit) return { allowed: true };
  
  const now = Date.now();
  const windowMs = rateLimit.window * 1000; // ms
  const maxRequests = rateLimit.requests;
  
  // Obtener cola de solicitudes para este cliente
  let queue = this.requestQueue.get(key) || [];
  
  // Limpiar solicitudes fuera de la ventana
  queue = queue.filter(ts => (now - ts) < windowMs);
  
  if (queue.length < maxRequests) {
    // Permitir solicitud
    queue.push(now);
    this.requestQueue.set(key, queue);
    return { allowed: true };
  } else {
    // Solicitud rechazada
    const oldestRequest = Math.min(...queue);
    const retryAfter = Math.ceil(
      (oldestRequest + windowMs - now) / 1000
    );
    return { allowed: false, retryAfter };
  }
}

/*
 * COMPLEJIDAD:
 * - Tiempo: O(n) donde n = solicitudes en ventana (típicamente 5-100)
 *   Pero con limpieza automática, el factor constante es bajo
 * - Espacio: O(m) donde m = clientes únicos × rutas
 */
```

### Algoritmo 2: Circuit Breaker con Estados

```javascript
/*
 * ALGORITMO: Circuit Breaker de 3 estados
 * ENTRADA: routeKey
 * SALIDA: { isOpen: Boolean }
 */

_checkCircuitBreaker(routeKey) {
  const now = Date.now();
  let breaker = this.circuitBreakers.get(routeKey);
  
  if (!breaker) {
    breaker = {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      lastStateChange: now
    };
    this.circuitBreakers.set(routeKey, breaker);
  }
  
  // Transición de OPEN a HALF-OPEN después de timeout
  if (breaker.state === 'open') {
    const timeSinceOpen = now - breaker.lastStateChange;
    if (timeSinceOpen > this.config.circuitBreakerTimeout) {
      breaker.state = 'half-open';
      breaker.successes = 0;
      breaker.failures = 0;
    } else {
      return { isOpen: true };
    }
  }
  
  // En HALF-OPEN, permitir solicitud de prueba
  // (se registrará éxito/fallo después)
  
  return { isOpen: false };
}

_recordCircuitBreakerFailure(routeKey) {
  let breaker = this.circuitBreakers.get(routeKey);
  if (!breaker) return;
  
  breaker.failures++;
  breaker.lastFailureTime = Date.now();
  
  const totalRequests = breaker.failures + breaker.successes;
  const errorRate = (breaker.failures / totalRequests) * 100;
  
  // Transición de CLOSED a OPEN si error rate > threshold
  if (breaker.state === 'closed' && 
      errorRate > this.config.circuitBreakerThreshold) {
    breaker.state = 'open';
    breaker.lastStateChange = Date.now();
  }
  
  // Volver a OPEN si falla en HALF-OPEN
  if (breaker.state === 'half-open') {
    breaker.state = 'open';
    breaker.lastStateChange = Date.now();
    breaker.failures = 0;
    breaker.successes = 0;
  }
}

_recordCircuitBreakerSuccess(routeKey) {
  let breaker = this.circuitBreakers.get(routeKey);
  if (!breaker) return;
  
  breaker.successes++;
  
  // Si en HALF-OPEN y tiene suficientes éxitos → CLOSED
  if (breaker.state === 'half-open' && breaker.successes >= 3) {
    breaker.state = 'closed';
    breaker.lastStateChange = Date.now();
    breaker.failures = 0;
    breaker.successes = 0;
  }
}

/*
 * DIAGRAMA DE TRANSICIONES:
 * 
 * CLOSED ──error rate > 50%──> OPEN
 *   ↑                            │
 *   │                    timeout (60s)
 *   │                            │
 *   └──────────────────────── HALF-OPEN
 *           success (3x)
 */
```

### Algoritmo 3: Búsqueda de Caché con Expiración TTL

```javascript
/*
 * ALGORITMO: Caché con validación de TTL
 * ENTRADA: routeKey, request
 * SALIDA: cached_response o null
 */

_getCachedResponse(routeKey, req) {
  const cacheKey = this._generateCacheKey(routeKey, req);
  const cached = this.requestCache.get(cacheKey);
  
  if (!cached) return null;
  
  const now = Date.now();
  const ageSeconds = (now - cached.timestamp) / 1000;
  const ttlSeconds = cached.ttl || 300;
  
  if (ageSeconds < ttlSeconds) {
    // Respuesta válida en caché
    this._recordMetric(routeKey, 'cacheHit');
    return cached.response;
  } else {
    // Respuesta expirada, eliminar
    this.requestCache.delete(cacheKey);
    this._recordMetric(routeKey, 'cacheMiss');
    return null;
  }
}

_generateCacheKey(routeKey, req) {
  // Convertir query a string determinista
  const queryStr = Object.keys(req.query)
    .sort()
    .map(k => `${k}=${req.query[k]}`)
    .join('&');
  
  return `${routeKey}:${queryStr}`;
}

_cacheResponse(routeKey, req, response) {
  const cacheKey = this._generateCacheKey(routeKey, req);
  const route = this.routes.get(routeKey);
  
  this.requestCache.set(cacheKey, {
    response,
    timestamp: Date.now(),
    ttl: route.cacheTTL || 300  // segundos
  });
}

/*
 * COMPLEJIDAD:
 * - Búsqueda: O(1) hash map lookup
 * - Inserción: O(1) hash map set
 * - Generación de clave: O(k) donde k = parámetros query
 */
```

---

## Integración

### Cómo Registrar Rutas

```javascript
import APIGatewayService from './services/apiGatewayService.js';

const gateway = new APIGatewayService({
  jwtSecret: process.env.JWT_SECRET,
  maxRequestSize: 10 * 1024 * 1024,  // 10MB
  requestTimeout: 30000                 // 30s
});

// Ruta pública sin autenticación
gateway.registerRoute(
  'GET',
  '/api/public/products',
  async (req, res) => {
    return { products: [...] };
  },
  {
    description: 'List all public products',
    cacheable: true,
    cacheTTL: 600,  // 10 minutos
    rateLimit: { requests: 100, window: 60 }
  }
);

// Ruta protegida con autenticación
gateway.registerRoute(
  'POST',
  '/api/users',
  async (req, res) => {
    return { id: 1, ...req.body };
  },
  {
    requiresAuth: true,
    description: 'Create new user',
    validation: (data) => ({
      valid: data.email && data.name,
      errors: !data.email ? ['Email required'] : []
    }),
    rateLimit: { requests: 10, window: 60 }
  }
);

// Ruta que requiere rol específico
gateway.registerRoute(
  'DELETE',
  '/api/users/:id',
  async (req, res) => {
    return { deleted: true };
  },
  {
    requiresAuth: true,
    roles: ['admin'],
    description: 'Delete user (admin only)',
    rateLimit: { requests: 5, window: 60 }
  }
);
```

### Middleware Global

```javascript
// Registrar middleware global que se ejecuta en TODAS las solicitudes
gateway.use((req, res) => {
  // Log de solicitud
  console.log(`${req.method} ${req.path}`);
  return true;  // Continuar
});

gateway.use((req, res) => {
  // Validar headers requeridos
  if (!req.headers['content-type']) {
    return false;  // Rechazar
  }
  return true;
});

gateway.use((req, res) => {
  // Agregar header de respuesta
  res.header = res.header || {};
  res.header['x-gateway-version'] = '1.0.0';
  return true;
});
```

### Transformación de Solicitud/Respuesta

```javascript
// Transformar solicitud (remover campos sensibles)
const transformed = gateway.transformRequest(
  { password: 'secret', email: 'user@example.com', name: 'John' },
  { stripFields: ['password'] }
);
// Resultado: { email: 'user@example.com', name: 'John' }

// Mapear nombres de campos
const mapped = gateway.transformRequest(
  { user_name: 'John', user_email: 'john@example.com' },
  { mapFields: { user_name: 'name', user_email: 'email' } }
);
// Resultado: { name: 'John', email: 'john@example.com' }

// Enriquecer campos
const enriched = gateway.transformRequest(
  { name: 'John' },
  { enrichFields: { role: 'user', createdAt: new Date() } }
);
// Resultado: { name: 'John', role: 'user', createdAt: ... }

// Transformar respuesta
const response = gateway.transformResponse(
  { id: 1, name: 'Product', internalNotes: '...' },
  { stripFields: ['internalNotes'], format: 'wrapped' }
);
// Resultado: { data: { id: 1, name: 'Product' } }
```

### Manejo de Errores

```javascript
// El gateway devuelve códigos HTTP estándar:

// 400 Bad Request - Solicitud inválida
// - Validación fallida
// - Tamaño excesivo

// 401 Unauthorized - Autenticación fallida
// - Token ausente o inválido

// 403 Forbidden - Autorización fallida
// - Roles insuficientes

// 404 Not Found - Ruta no encontrada

// 413 Payload Too Large - Solicitud muy grande

// 429 Too Many Requests - Límite de velocidad excedido

// 500 Internal Server Error - Error del manejador

// 503 Service Unavailable - Circuit breaker abierto

// 504 Gateway Timeout - Timeout de solicitud
```

---

## Ejemplos de Uso

### Ejemplo 1: Sistema de Comercio Electrónico

```javascript
const gateway = new APIGatewayService();

// Catálogo público (sin autenticación, cacheable, rate limit relajado)
gateway.registerRoute('GET', '/api/products', getProducts, {
  requiresAuth: false,
  cacheable: true,
  cacheTTL: 1800,  // 30 minutos
  rateLimit: { requests: 1000, window: 60 }
});

// Detalle de producto (similar)
gateway.registerRoute('GET', '/api/products/:id', getProduct, {
  requiresAuth: false,
  cacheable: true,
  cacheTTL: 3600,  // 1 hora
  rateLimit: { requests: 500, window: 60 }
});

// Crear orden (autenticación, sin caché, rate limit estricto)
gateway.registerRoute('POST', '/api/orders', createOrder, {
  requiresAuth: true,
  cacheable: false,
  validation: (data) => ({
    valid: data.items && data.items.length > 0,
    errors: []
  }),
  rateLimit: { requests: 10, window: 60 }
});

// Cancelar orden (solo propietario o admin)
gateway.registerRoute('DELETE', '/api/orders/:id', cancelOrder, {
  requiresAuth: true,
  roles: ['admin', 'customer'],  // Customer puede cancelar su propia orden
  rateLimit: { requests: 5, window: 60 }
});

// Panel de admin (solo administradores)
gateway.registerRoute('GET', '/api/admin/analytics', getAnalytics, {
  requiresAuth: true,
  roles: ['admin'],
  cacheable: true,
  cacheTTL: 300,  // 5 minutos (más frecuente que datos públicos)
  rateLimit: { requests: 100, window: 60 }
});
```

### Ejemplo 2: API Médica (Cumplimiento HIPAA)

```javascript
const gateway = new APIGatewayService({
  jwtSecret: process.env.JWT_SECRET,
  requestTimeout: 15000,
  enableCaching: false  // No cachear datos de pacientes
});

// Información pública del hospital
gateway.registerRoute('GET', '/api/hospital/info', getHospitalInfo, {
  requiresAuth: false,
  cacheable: true,
  cacheTTL: 3600
});

// Consultar historial de paciente (auditar, no cachear)
gateway.registerRoute('GET', '/api/patient/:id/history', getPatientHistory, {
  requiresAuth: true,
  roles: ['doctor', 'nurse'],
  cacheable: false,  // NUNCA cachear datos médicos
  validation: (data) => {
    // Validar consentimiento
    return { valid: true, errors: [] };
  },
  rateLimit: { requests: 20, window: 60 }
});

// Actualizar tratamiento
gateway.registerRoute('PUT', '/api/patient/:id/treatment', updateTreatment, {
  requiresAuth: true,
  roles: ['doctor'],
  cacheable: false,
  validation: (data) => ({
    valid: data.treatment && data.doctor_notes,
    errors: []
  }),
  rateLimit: { requests: 10, window: 60 }
});

// Auditoría de acceso (para cumplimiento)
gateway.use((req, res) => {
  // Log todo acceso a datos de pacientes
  if (req.path.includes('/patient/')) {
    auditLog({
      timestamp: Date.now(),
      user: req.user?.id,
      action: `${req.method} ${req.path}`,
      ip: req.ip
    });
  }
  return true;
});
```

### Ejemplo 3: API de IoT (Millones de Dispositivos)

```javascript
const gateway = new APIGatewayService({
  maxRequestSize: 1024 * 1024,  // 1MB (menos que web)
  requestTimeout: 10000,  // 10s (menos que web)
  circuitBreakerThreshold: 30  // Más sensible a fallos
});

// Envío de datos de sensor (ultra-alto volumen)
gateway.registerRoute('POST', '/api/sensors/:id/data', recordSensorData, {
  requiresAuth: true,
  cacheable: false,
  validation: (data) => ({
    valid: data.temperature !== undefined && data.humidity !== undefined,
    errors: []
  }),
  rateLimit: { requests: 10000, window: 60 }  // 10K reqs/min por dispositivo
});

// Actualización de estado del dispositivo
gateway.registerRoute('PUT', '/api/devices/:id/status', updateDeviceStatus, {
  requiresAuth: true,
  cacheable: false,
  rateLimit: { requests: 100, window: 60 }
});

// Consultar historial de sensor (cacheable, por rendimiento)
gateway.registerRoute('GET', '/api/sensors/:id/history', getSensorHistory, {
  requiresAuth: true,
  cacheable: true,
  cacheTTL: 60,  // 1 minuto (datos frescos pero cacheable)
  rateLimit: { requests: 100, window: 60 }
});

// Agregados (caché largo, datos computados)
gateway.registerRoute('GET', '/api/analytics/daily', getDailyAnalytics, {
  requiresAuth: true,
  roles: ['analyst'],
  cacheable: true,
  cacheTTL: 3600,  // 1 hora
  rateLimit: { requests: 100, window: 60 }
});
```

---

## Resolución de Problemas

### Problema 1: Solicitudes Rechazadas con 401 Unauthorized

**Síntoma:** El cliente obtiene 401 aunque dice que está enviando el token.

**Causas Comunes:**

1. **Token no presente:**
   ```javascript
   // Incorrecto
   fetch('http://api.example.com/api/users', {
     headers: { 'Authorization': 'eyJhbGciOiJ...' }
   });
   
   // Correcto
   fetch('http://api.example.com/api/users', {
     headers: { 'Authorization': 'Bearer eyJhbGciOiJ...' }
   });
   ```

2. **Token expirado:**
   ```javascript
   // Verificar expiración
   const decoded = jwt.decode(token);
   if (decoded.exp * 1000 < Date.now()) {
     console.log('Token expirado, renovar');
   }
   ```

3. **JWT Secret incorrecto:**
   ```javascript
   // En cliente
   const token = jwt.sign({ id: 1 }, 'wrong-secret');
   
   // En gateway
   const gateway = new APIGatewayService({
     jwtSecret: 'correct-secret'  // No coincide → 401
   });
   ```

**Solución:**

```javascript
// Verificar token manualmente
const token = req.headers.authorization?.split(' ')[1];
if (!token) {
  console.log('No token provided');
} else {
  try {
    const decoded = jwt.verify(token, gateway.config.jwtSecret);
    console.log('Token válido:', decoded);
  } catch (err) {
    console.log('Token inválido:', err.message);
  }
}
```

### Problema 2: Circuit Breaker Siempre Abierto

**Síntoma:** `503 Service Unavailable` incluso cuando el servicio está activo.

**Causas:**

1. **Threshold muy bajo (50%):**
   ```javascript
   // Si el servicio ocasionalmente falla el 50%+ de solicitudes
   // el circuit breaker se abre
   ```

2. **Timeout muy corto:**
   ```javascript
   // Timeout de 5s pero algunas solicitudes legítimas tardan 8s
   circuitBreakerTimeout: 5000  // Muy corto
   ```

**Diagnóstico:**

```javascript
// Verificar estado del circuit breaker
const breaker = gateway.circuitBreakers.get('GET:/api/test');
console.log('Estado:', breaker.state);
console.log('Fallos:', breaker.failures);
console.log('Éxitos:', breaker.successes);
console.log('Error rate:', 
  (breaker.failures / (breaker.failures + breaker.successes) * 100).toFixed(1) + '%'
);
```

**Solución:**

```javascript
// Aumentar threshold y timeout
const gateway = new APIGatewayService({
  circuitBreakerThreshold: 70,      // 70% de errores para abrir
  circuitBreakerTimeout: 120000     // 2 minutos
});

// O resetear manualmente en producción (cuidado)
gateway.resetCircuitBreakers();
```

### Problema 3: Caché Devuelve Datos Antiguos

**Síntoma:** Datos actualizados en el backend pero el cliente recibe versión antigua.

**Causas:**

1. **TTL muy largo:**
   ```javascript
   cacheTTL: 86400  // 24 horas → datos muy antiguos
   ```

2. **Caché no se invalida:**
   ```javascript
   // Backend actualiza datos pero caché no se limpia
   updateUser(id, data);  // DB actualizada
   // Cache aún tiene la versión anterior
   ```

**Solución:**

```javascript
// Opción 1: TTL más corto
gateway.registerRoute('GET', '/api/users/:id', getUser, {
  cacheable: true,
  cacheTTL: 60  // 1 minuto en lugar de 24 horas
});

// Opción 2: Invalidar caché al actualizar
gateway.registerRoute('PUT', '/api/users/:id', async (req, res) => {
  const user = await updateUser(req.params.id, req.body);
  
  // Limpiar caché relacionado
  gateway.clearCache(`users`);  // Invalida GET:/api/users*
  
  return user;
});

// Opción 3: Deshabilitar caché para datos críticos
gateway.registerRoute('GET', '/api/account/balance', getBalance, {
  cacheable: false  // Siempre frescos
});
```

### Problema 4: Rate Limit Demasiado Restrictivo

**Síntoma:** Clientes legítimos obtienen `429 Too Many Requests`.

**Análisis:**

```javascript
// Si configuraste 10 req/60s pero los usuarios tienen picos:
// Usuario A: 15 solicitudes en 60s (3 segundos entre cada una)
// → Requieren: 15 req/60s mínimo

// Para aplicaciones web típicas:
GET /api/products: 1000 req/60s
POST /api/orders: 10 req/60s
GET /api/account: 100 req/60s
```

**Solución:**

```javascript
// Ajustar basado en patrón de uso
gateway.registerRoute('GET', '/api/products', getProducts, {
  rateLimit: {
    requests: 1000,  // 1000 solicitudes
    window: 60       // por minuto
  }
});

// Para endpoints menos usados
gateway.registerRoute('POST', '/api/payment', processPayment, {
  rateLimit: {
    requests: 5,     // 5 solicitudes
    window: 60       // por minuto
  }
});
```

---

## Checklist de Validación

### Antes de Pasar a Producción

- [ ] Todos los tests pasan (`npm test`)
- [ ] Coverage 100% (`npm run test:coverage`)
- [ ] JWT secret configurado correctamente
- [ ] Rate limits ajustados según patrones de uso
- [ ] Circuit breaker threshold apropiado
- [ ] TTL de caché óptimo para el caso de uso
- [ ] Middleware de seguridad registrado
- [ ] Transformaciones de request/response configuradas
- [ ] Roles RBAC definidos
- [ ] Documentación actualizada
- [ ] Health checks funcionando
- [ ] Métricas siendo registradas
- [ ] Logs siendo generados
- [ ] Timeouts configurados apropiadamente
- [ ] Validación de entrada en todas las rutas protegidas

### Operaciones Regulares

- [ ] Revisar métricas cada hora
- [ ] Monitorear circuit breakers abiertos
- [ ] Limpiar caché cuando sea necesario
- [ ] Validar que los logs se están escribiendo
- [ ] Verificar que JWT secrets se rotan cada 90 días
- [ ] Auditar accesos a rutas sensibles
- [ ] Actualizar rate limits según crecimiento
- [ ] Revisar tiempo de respuesta promedio

### Debugging

- [ ] Habilitar logs detallados
- [ ] Revisar estado de circuit breakers
- [ ] Verificar caché hit/miss ratio
- [ ] Revisar tokens JWT
- [ ] Verificar roles de usuario
- [ ] Comprobar cumplimiento de límites de velocidad
- [ ] Revisar timeouts de solicitud
- [ ] Analizar errores últimos

---

## Resumen

El **API Gateway Service** proporciona un punto de entrada centralizado y seguro para todas las solicitudes HTTP en tu sistema, con características empresariales como autenticación JWT, limitación de velocidad, circuit breaking, caché de respuestas y métricas detalladas.

**Características Clave:**
- ✅ Autenticación y autorización centralizadas
- ✅ Protección contra degradación de servicios
- ✅ Optimización de rendimiento mediante caché
- ✅ Limitación de velocidad configurable
- ✅ Métricas y observabilidad
- ✅ Middleware global
- ✅ Validación de solicitudes
- ✅ Transformación de datos

**Próximos Pasos:**
1. Registrar todas tus rutas API
2. Configurar autenticación JWT
3. Ajustar rate limits
4. Monitorear métricas
5. Optimizar TTL de caché

---

**Versión:** 1.0.0  
**Última Actualización:** Sprint 5, Octubre 2025  
**Autor:** Sistema de Seguridad Avanzada  
**Estado:** Producción
