# ISSUE #32: Advanced DDoS Protection Service - Documentación Completa

## Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Conceptos de Ataques DDoS](#conceptos-de-ataques-ddos)
3. [Capas de Protección](#capas-de-protección)
4. [Análisis Comportamental](#análisis-comportamental)
5. [Rate Limiting Avanzado](#rate-limiting-avanzado)
6. [Detección de Patrones](#detección-de-patrones)
7. [Integración](#integración)
8. [Ejemplos de Uso](#ejemplos-de-uso)
9. [Resolución de Problemas](#resolución-de-problemas)
10. [Checklist de Validación](#checklist-de-validación)

---

## Descripción General

### ¿Qué es DDoS?

**DDoS (Distributed Denial of Service)** es un ataque donde múltiples dispositivos comprometidos inundan un servidor con tráfico malicioso, haciéndolo inaccessible para usuarios legítimos.

```
Ataque DDoS:
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Bot 1      │   │  Bot 2      │   │  Bot 3      │
│ (Hacked PC) │   │(Hacked IoT) │   │(Hacked Web) │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       │   Solicitudes masivas sin parar   │
       ├─────────────────┼─────────────────┤
       │                 │                 │
       ▼                 ▼                 ▼
    ┌─────────────────────────────┐
    │   Servidor Objetivo         │
    │  (Sobrecargado, caída)      │
    └─────────────────────────────┘
       │
       ▼
Usuarios legítimos no pueden acceder
```

### Problemas que Resuelve

- **Disponibilidad:** Mantener el servicio accesible durante ataques
- **Resiliencia:** Detectar y adaptarse a patrones de ataque
- **Seguridad:** Identificar IPs/usuarios maliciosos
- **Observabilidad:** Monitorear y alertar sobre ataques
- **Escalabilidad:** Proteger durante picos de tráfico

### Tipos de DDoS

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **Volumétrico** | Inunda con datos masivos | 100 Gbps de solicitudes |
| **Protocolo** | Explota debilidades del protocolo | SYN flood, UDP flood |
| **Capa de Aplicación** | Ataca endpoints específicos | HTTP request flood |
| **Amplificación** | Usa servidores de terceros | DNS amplification |

---

## Conceptos de Ataques DDoS

### 1. Ataques Volumétricos

**Objetivo:** Saturar el ancho de banda

```
Características:
- Muchas solicitudes (100K+/s)
- Tamaño pequeño a mediano
- Desde múltiples IPs (botnet)
- Pattern: Solicitudes similares repetidas

Detección:
✓ Spike repentino de solicitudes
✓ Muchas IPs nuevas en corto tiempo
✓ Incremento de tráfico entrante > 10x normal
```

### 2. Ataques de Protocolo

**Objetivo:** Explotar debilidades en TCP/UDP

```
Características:
- SYN flood: conexiones TCP sin completar
- UDP flood: paquetes UDP sin respuesta
- Fragmentación: paquetes fragmentados malformados

Detección:
✓ Muchas conexiones TIME_WAIT
✓ Respuestas ICMP anómalas
✓ Paquetes malformados
```

### 3. Ataques de Capa de Aplicación

**Objetivo:** Agotarrecursos del servidor

```
Características:
- Solicitudes HTTP válidas pero excesivas
- Dirigidas a endpoints costosos
- Comportamiento más legítimo (cache busting)
- Típicamente 1K-10K rps

Detección:
✓ Solicitudes a mismo endpoint
✓ User-Agent consistente pero raro
✓ Referrer malformado o ausente
✓ Sin cookies/JS normales
```

### 4. Indicadores de Compromiso (IoCs)

```
IP Indicators:
- Múltiples failed logins desde misma IP
- Acceso a honeypot paths
- Geolocalización imposible (cambios de país en <1ms)
- Patrón de rotación de IPs (botnet)

Behavioral Indicators:
- Escaneo de vulnerabilidades conocidas
- Fuzzing de parámetros
- Enumeración de usuarios
- Path traversal attempts
```

---

## Capas de Protección

### Arquitectura de Defensa en Profundidad

```
┌─────────────────────────────────────────────────────┐
│ Capa 1: Rate Limiting Básico                        │
│ - Límites por IP (1000 req/min)                     │
│ - Límites por usuario (500 req/min)                 │
│ - Límites globales (100K req/min)                   │
├─────────────────────────────────────────────────────┤
│ Capa 2: Honeypot Detection                          │
│ - Rutas trampa (/admin, /phpmyadmin, /.env)        │
│ - Detección de bots automáticos                     │
│ - Bloqueo inmediato después de 3 hits              │
├─────────────────────────────────────────────────────┤
│ Capa 3: Geo-IP Filtering                           │
│ - Bloqueo de países específicos                     │
│ - Validación de geolocalización                     │
│ - Detección de proxies/VPNs                         │
├─────────────────────────────────────────────────────┤
│ Capa 4: Behavioral Analysis                         │
│ - Detección de anomalías estadísticas              │
│ - Análisis de patrones de tráfico                  │
│ - Scoring de suspiciosidad                         │
├─────────────────────────────────────────────────────┤
│ Capa 5: Pattern Recognition                         │
│ - Escaneo de endpoints                              │
│ - Enumeración de usuarios                           │
│ - Detección de fuzzing                              │
├─────────────────────────────────────────────────────┤
│ Capa 6: Blocking & Graylist                         │
│ - Blocklist (bloqueo permanente)                   │
│ - Graylist (monitoreo intensivo)                   │
│ - Whitelist (bypass de protecciones)               │
└─────────────────────────────────────────────────────┘
```

---

## Análisis Comportamental

### 1. Detección de Anomalías Estadísticas

Usa la **desviación estándar** para detectar comportamiento anómalo:

```
Concepto:
- Normal: 5 requests/segundo
- σ (desv. estándar): 2 requests/seg
- Threshold: 2.5 σ

Si request_rate > 5 + (2.5 × 2) = 10 reqs/seg → ANOMALY

Implementación:
1. Recopilar histórico de 24 horas
2. Calcular media y desviación estándar
3. Comparar solicitud actual contra distribución
4. Si > 2.5σ → Marcar como anómala
```

### 2. Métricas por IP

```javascript
Metrics = {
  requestCount: 500,           // Total solicitudes
  errorCount: 100,             // Solicitudes con error
  lastRequestTime: 1698456789, // Última solicitud
  totalDataTransferred: 5242880, // Bytes (5MB)
  averageRequestSize: 10485,   // Bytes promedio
  uniqueEndpoints: 15,         // Endpoints únicos accedidos
  uniqueUsers: 3,              // Usuarios únicos
  uniqueUserAgents: 2,         // User-Agents únicos
  accessedEndpoints: [...],    // Lista de endpoints
  users: [...]                 // Lista de usuarios
}

Indicadores de Ataque:
- errorCount / requestCount > 50% → Exploitation attempts
- uniqueEndpoints > 50 & requestCount < 100 → Scanning
- uniqueUsers > 20 → User enumeration
- uniqueUserAgents > 5 & requestCount < 50 → Bot rotation
```

### 3. Learning Period

Durante las primeras 24 horas, el sistema aprende el comportamiento normal:

```javascript
Learning Period: 3600000ms (1 hora por defecto)

Durante Learning:
✓ Se recopilan métricas
✓ No se bloquean anomalías
✓ Se generan alertas informativas
✓ Se calibran thresholds

Después de Learning:
✓ Se usan thresholds calculados
✓ Se bloquean anomalías significativas
✓ El sistema es más agresivo
```

---

## Rate Limiting Avanzado

### Algoritmo de Límite Deslizante (Sliding Window)

```
Ventana: 60 segundos, Límite: 10 solicitudes

Timeline:
t=10s: Req 1 ✓ (1/10)
t=15s: Req 2 ✓ (2/10)
...
t=50s: Req 10 ✓ (10/10)
t=55s: Req 11 ✗ Rechazado (ventana llena)
       ↓ En 10s más (t=65s), Req 1 caduca
t=65s: Req 11 ✓ (1/10)
```

### Multi-Dimensionalidad

```
DDoSProtectionService implementa 4 límites simultáneos:

1. GLOBAL (100K reqs/min)
   - Toda la plataforma
   - Detecta ataques massivos
   
2. PER-IP (1000 reqs/min)
   - Por dirección IP fuente
   - Detecta ataques de single botnet
   
3. PER-USER (500 reqs/min)
   - Por usuario autenticado
   - Detecta abuso de cuenta
   
4. PER-ENDPOINT (10K reqs/min)
   - Por endpoint específico
   - Detecta targeting de recurso

Si CUALQUIERA es excedido → RECHAZAR
```

---

## Detección de Patrones

### Patrón 1: Escaneo de Endpoints

```
Indicadores:
- Acceso a >50 endpoints únicos
- Con <100 solicitudes totales
- En corto período (minutos)

Ejemplo:
GET /api/users    ✓
GET /api/products ✓
GET /api/admin    ✓
...
GET /api/x50      ✓
Total: 50 endpoints en 2 minutos

Acción: +20 puntos suspiciosidad
Score: 20/100 (graylist si >30)
```

### Patrón 2: Enumeración de Usuarios

```
Indicadores:
- Muchas solicitudes a /api/users/:id
- Con IDs secuenciales o números
- En corto período

Ejemplo:
GET /api/users/1    ✓
GET /api/users/2    ✓
...
GET /api/users/50   ✓
Total: 20+ usuarios únicos desde 1 IP

Acción: +15 puntos suspiciosidad
Score: 15/100
```

### Patrón 3: Tasa de Error Alta

```
Indicadores:
- >50% de respuestas 4xx/5xx
- Intenta múltiples payloads
- Prueba inyección SQL, XSS, etc.

Ejemplo:
POST /api/users {"name": "'; DROP TABLE--"} → 400 Bad Request
POST /api/users {"name": "<script>alert(1)</script>"} → 400 Bad Request
...

Acción: +20 puntos suspiciosidad
Score: 20/100
```

### Patrón 4: User-Agent Inconsistente

```
Indicadores:
- Múltiples User-Agents desde mismo IP
- Rotación frecuente
- Típico de botnets

Ejemplo:
Mozilla/5.0 (Windows...)
curl/7.64.1
python-requests/2.25.1
Custom-Bot/1.0
...

Acción: +15 puntos suspiciosidad
Score: 15/100
```

### Patrón 5: Métodos HTTP Raros

```
Indicadores:
- Uso de TRACE, CONNECT, OPTIONS
- Típicamente no usados por aplicaciones
- Indicador de reconnaissance

Métodos Sospechosos:
- TRACE: Debugging de servidor
- CONNECT: Proxy tunneling
- OPTIONS: CORS reconnaissance

Acción: +25 puntos suspiciosidad
Score: 25/100
```

---

## Integración

### Configuración Inicial

```javascript
import DDoSProtectionService from './services/ddosProtectionService.js';

// Crear servicio con configuración
const ddosProtection = new DDoSProtectionService({
  // Rate Limiting
  globalRateLimit: { requests: 100000, window: 60 },
  perIpRateLimit: { requests: 1000, window: 60 },
  perUserRateLimit: { requests: 500, window: 60 },
  perEndpointRateLimit: { requests: 10000, window: 60 },
  
  // Behavioral Analysis
  anomalyThreshold: 2.5,           // Standard deviations
  learningPeriod: 3600000,         // 1 hour
  historyWindow: 86400000,         // 24 hours
  
  // Thresholds
  suspiciousScoreThreshold: 50,    // Graylist
  blockThreshold: 80,              // Block
  graylistThreshold: 30,           // Monitor closely
  
  // Features
  enableRateLimit: true,
  enableBehavioralAnalysis: true,
  enableGeoFiltering: true,
  enableHoneypot: true,
  
  // GeoIP
  blockedCountries: ['CN', 'RU', 'KP'],
  allowedCountries: [],
  
  // Honeypot
  honeypotPaths: ['/admin', '/wp-admin', '/phpmyadmin', '/.env'],
  
  // Cleanup
  cleanupInterval: 300000 // 5 minutes
});
```

### Middleware de Express

```javascript
// Aplicar protección DDoS antes de rutas
app.use((req, res, next) => {
  const analysis = ddosProtection.analyzeRequest({
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    requestSize: req.get('content-length') || 0,
    statusCode: res.statusCode
  });

  // Permitir solicitud
  if (analysis.allowed) {
    res.setHeader('X-DDoS-Score', analysis.suspiciousScore);
    return next();
  }

  // Bloquear solicitud
  res.status(429).json({
    error: 'Too Many Requests',
    reason: analysis.reason,
    retryAfter: 60
  });
});

// Rutas protegidas
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});
```

### Whitelisting de Confianza

```javascript
// Whitelist IPs de proveedores de monitoreo
ddosProtection.whitelistIp('1.1.1.1');              // Cloudflare DNS
ddosProtection.whitelistIp('8.8.8.8');              // Google DNS
ddosProtection.whitelistIp('203.0.113.0/24');       // Tu CDN

// Whitelist con expiración
ddosProtection.whitelistIp('192.168.1.100', 86400); // 24 horas
```

---

## Ejemplos de Uso

### Ejemplo 1: Protección Básica

```javascript
const ddosProtection = new DDoSProtectionService();

app.use((req, res, next) => {
  const analysis = ddosProtection.analyzeRequest({
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  if (!analysis.allowed) {
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  next();
});
```

### Ejemplo 2: Monitoreo y Alertas

```javascript
const ddosProtection = new DDoSProtectionService({
  blockThreshold: 75  // Más tolerante
});

app.use((req, res, next) => {
  const analysis = ddosProtection.analyzeRequest({
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Log para análisis
  if (analysis.suspiciousScore > 50) {
    console.warn('[SECURITY ALERT]', {
      ip: analysis.ip,
      score: analysis.suspiciousScore,
      threats: analysis.threats,
      endpoint: analysis.endpoint
    });

    // Enviar alerta
    if (analysis.suspiciousScore > 70) {
      sendSecurityAlert({
        type: 'HIGH_SUSPICION',
        ip: analysis.ip,
        threats: analysis.threats
      });
    }
  }

  next();
});
```

### Ejemplo 3: GeoIP Filtering

```javascript
const ddosProtection = new DDoSProtectionService({
  enableGeoFiltering: true,
  blockedCountries: ['CN', 'RU', 'KP'],      // Bloquear estos
  allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'MX'],  // Solo estos
  requireGeoVerification: true
});

// Para solicitudes internacionales
app.post('/api/users', (req, res) => {
  const analysis = ddosProtection.analyzeRequest({
    ip: req.ip,
    path: req.path,
    method: 'POST',
    requestSize: JSON.stringify(req.body).length
  });

  if (!analysis.allowed) {
    return res.status(403).json({ error: 'Access Denied' });
  }

  // Procesar solicitud
});
```

### Ejemplo 4: Inteligencia de Ataque

```javascript
// Dashboard de seguridad
app.get('/admin/ddos/status', (req, res) => {
  const metrics = ddosProtection.getMetrics();
  const health = ddosProtection.getHealth();

  res.json({
    health,
    metrics,
    topThreats: getTopThreats(ddosProtection),
    blockedIps: Array.from(ddosProtection.blocklist.entries())
      .map(([ip, data]) => ({
        ip,
        blockedAt: new Date(data.addedAt),
        expiresAt: new Date(data.expiresAt),
        reason: data.reason
      })),
    graylistedIps: Array.from(ddosProtection.graylist.entries())
      .map(([ip, data]) => ({
        ip,
        suspiciousCount: data.suspiciousCount
      }))
  });
});

function getTopThreats(ddosProtection) {
  const threatCounts = {};
  
  for (const metrics of ddosProtection.ipMetrics.values()) {
    // Analizar patrones
  }

  return Object.entries(threatCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([threat, count]) => ({ threat, count }));
}
```

---

## Resolución de Problemas

### Problema 1: Falsos Positivos (Bloqueo de Usuarios Legítimos)

**Síntoma:** Usuarios legítimos obtienen "429 Too Many Requests"

**Causas:**

1. **Thresholds muy bajos:**
   ```javascript
   // Muy restrictivo
   perIpRateLimit: { requests: 10, window: 60 }
   ```

2. **Múltiples usuarios desde 1 IP** (office proxy):
   ```javascript
   // Oficina con NAT
   IP: 203.0.113.0
   Usuarios: 50 personas
   Límite: 100 reqs/min para toda la IP
   → Bloqueo frecuente
   ```

3. **Applciación con picos legítimos:**
   ```javascript
   // Dashboard con autorefresh cada 5s × 50 usuarios
   = 600 reqs/min desde 1 IP
   ```

**Solución:**

```javascript
// Aumentar límites
const ddosProtection = new DDoSProtectionService({
  perIpRateLimit: { requests: 5000, window: 60 },
  perUserRateLimit: { requests: 1000, window: 60 }
});

// O whitelist de IPs conocidas
ddosProtection.whitelistIp('203.0.113.0');     // Oficina
ddosProtection.whitelistIp('198.51.100.0');    // Partner
```

### Problema 2: Ataques Distribuidos No Detectados

**Síntoma:** DDoS desde muchas IPs diferentes pasa sin ser detectado

**Causas:**

1. **Rate limit muy alto:**
   ```javascript
   // Cada IP hace 5-10 requests (bajo)
   // Pero hay 10K IPs
   // Total: 50K-100K requests = permitido
   ```

2. **Behavioral analysis deshabilitado:**
   ```javascript
   enableBehavioralAnalysis: false  // NO RECOMENDADO
   ```

3. **Patrones no reconocidos:**
   ```javascript
   // Atacante accede a endpoints legítimos
   // Con User-Agents realistas
   // Difícil de distinguir de tráfico normal
   ```

**Solución:**

```javascript
// Habilitar todas las protecciones
const ddosProtection = new DDoSProtectionService({
  enableBehavioralAnalysis: true,
  enableGeoFiltering: true,
  enableHoneypot: true,
  anomalyThreshold: 2.5,  // Sensible
  blockThreshold: 70      // Más agresivo
});

// Monitorear global rate limit
if (ddosProtection.metrics.requestsBlocked > 1000) {
  // Probable ataque distribuido
  triggerAlert('DISTRIBUTED_ATTACK');
}
```

### Problema 3: Cleanup No Funciona

**Síntoma:** Memoria sigue creciendo, entries nunca se limpian

**Causas:**

1. **Cleanup interval muy alto:**
   ```javascript
   cleanupInterval: 86400000  // 24 horas
   ```

2. **History window muy largo:**
   ```javascript
   historyWindow: 31536000000  // 1 año
   ```

3. **Muchas IPs únicas:**
   ```javascript
   // 1M IPs únicas × 1 año de historial
   // = Uso masivo de memoria
   ```

**Solución:**

```javascript
const ddosProtection = new DDoSProtectionService({
  cleanupInterval: 60000,      // 1 minuto
  historyWindow: 86400000,     // 24 horas (no 1 año)
  learningPeriod: 3600000      // 1 hora
});

// O limpiar manualmente si es necesario
app.post('/admin/ddos/cleanup', (req, res) => {
  const cleaned = ddosProtection.cleanup();
  res.json({ cleaned });
});
```

---

## Checklist de Validación

### Antes de Producción

- [ ] Todos los tests pasan (npm test)
- [ ] Coverage 100%
- [ ] Rate limits calibrados para tu carga normal
- [ ] Behavioral analysis habilitado
- [ ] GeoIP filtering configurado
- [ ] Honeypot paths configurado
- [ ] Thresholds ajustados (no muy estricto, no muy permisivo)
- [ ] Cleanup interval apropiado
- [ ] Whitelist de IPs confiables
- [ ] Alertas configuradas para eventos
- [ ] Métricas siendo registradas
- [ ] Dashboard de monitoreo funciona
- [ ] Tests de ataque simulado pasados
- [ ] Documentación actualizada
- [ ] Equipo de seguridad entrenado

### Operaciones

- [ ] Monitorear métricas diariamente
- [ ] Revisar IPs bloqueadas
- [ ] Analizar patrones de ataque
- [ ] Ajustar thresholds según análisis
- [ ] Validar que cleanup está funcionando
- [ ] Revisar tamaño de memoria
- [ ] Probar failover/redundancia
- [ ] Auditar whitelist periódicamente

---

## Resumen

**Advanced DDoS Protection Service** proporciona protección multicapa contra ataques DDoS:

- ✅ Rate limiting por IP, usuario, endpoint y global
- ✅ Detección de comportamiento anómalo
- ✅ Análisis de patrones de ataque
- ✅ Honeypot detection
- ✅ GeoIP filtering
- ✅ Scoring de suspiciosidad
- ✅ Blocklist/Graylist/Whitelist management
- ✅ Cleanup automático
- ✅ Métricas y alertas

**Próximos Pasos:**

1. Calibrar limits para tu carga normal
2. Habilitar análisis comportamental
3. Configurar GeoIP filtering
4. Implementar alertas
5. Monitorear y ajustar

---

**Versión:** 1.0.0  
**Última Actualización:** Sprint 5, Octubre 2025  
**Autor:** Sistema de Seguridad Avanzada  
**Estado:** Producción
