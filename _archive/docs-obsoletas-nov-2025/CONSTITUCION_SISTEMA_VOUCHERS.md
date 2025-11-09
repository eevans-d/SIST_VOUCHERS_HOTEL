# 🏛️ CONSTITUCIÓN DEL SISTEMA DE VOUCHERS DIGITALES
## Alineación 100% con Principios Constitucionales IA/Agénticos

**Versión Constitucional:** 1.0.0  
**Fecha de Adopción:** 21 de Octubre, 2025  
**Última Revisión:** 21 de Octubre, 2025  
**Estado:** Activo y Vinculante

---

## 📜 PREÁMBULO

Nosotros, los arquitectos, desarrolladores y stakeholders del Sistema de Vouchers Digitales para Hostal Playa Norte, reconociendo la necesidad de establecer un marco constitucional sólido que garantice calidad, seguridad, escalabilidad y sostenibilidad a largo plazo, adoptamos esta Constitución como documento rector que define los principios fundamentales, patrones arquitectónicos y estándares operacionales que gobernarán este sistema y todos sus componentes.

Esta Constitución se fundamenta en los **12 Pilares Constitucionales para Sistemas IA/Agénticos**, adaptados al contexto específico de nuestro sistema de vouchers digitales.

---

## 🎯 MISIÓN CONSTITUCIONAL

Implementar un sistema de vouchers digitales que sirva como **piloto ejemplar** de aplicación de principios constitucionales en sistemas de software, demostrando cómo la alineación con estándares fundamentales se traduce en:

- ✅ Valor de negocio tangible
- ✅ Operaciones sin fricción
- ✅ Seguridad y confiabilidad garantizada
- ✅ Mantenibilidad a largo plazo
- ✅ Escalabilidad controlada

---

## 📊 LOS 12 PILARES CONSTITUCIONALES

### **PILAR 1: PATRONES ARQUITECTÓNICOS** 🏗️
**Prioridad:** 🔴 CRÍTICA

#### 1.1 Arquitectura Hexagonal (Ports & Adapters)

**Principio:** Separación estricta de capas para máxima flexibilidad y testabilidad.

```
┌────────────────────────────────────────────────────────┐
│                    DOMAIN CORE                         │
│  • Entities (Voucher, Stay, Redemption)               │
│  • Value Objects (VoucherCode, HMAC)                  │
│  • Business Rules (isValid, canRedeem)                │
│  • Domain Events (VoucherEmitted, VoucherRedeemed)   │
└────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────┴──────────────────────────────┐
│                APPLICATION LAYER                        │
│  • Use Cases (EmitVoucher, RedeemVoucher)             │
│  • Commands & Queries (CQRS)                          │
│  • Event Handlers                                      │
│  • DTOs & Mappers                                      │
└─────────────────────────────────────────────────────────┘
          ▲                                    ▲
          │                                    │
┌─────────┴────────┐              ┌───────────┴─────────┐
│  INFRASTRUCTURE  │              │    PRESENTATION     │
│  • SQLiteRepo    │              │    • REST API       │
│  • EventBus      │              │    • PWA Interface  │
│  • Logger        │              │    • CLI Tools      │
└──────────────────┘              └─────────────────────┘
```

**Estructura de Directorios Mandatoria:**
```
backend/src/
├── domain/
│   ├── entities/
│   │   ├── Voucher.js
│   │   ├── Stay.js
│   │   └── Redemption.js
│   ├── value-objects/
│   │   ├── VoucherCode.js
│   │   └── HMACSignature.js
│   ├── repositories/  # Interfaces
│   │   ├── VoucherRepository.js
│   │   └── RedemptionRepository.js
│   └── events/
│       ├── VoucherEmitted.js
│       └── VoucherRedeemed.js
├── application/
│   ├── use-cases/
│   │   ├── EmitVoucherUseCase.js
│   │   └── RedeemVoucherUseCase.js
│   ├── commands/
│   │   ├── EmitVoucherCommand.js
│   │   └── RedeemVoucherCommand.js
│   ├── queries/
│   │   ├── GetVoucherQuery.js
│   │   └── GetRedemptionReportQuery.js
│   └── handlers/
│       ├── EmitVoucherHandler.js
│       └── RedeemVoucherHandler.js
├── infrastructure/
│   ├── persistence/
│   │   ├── SQLiteVoucherRepository.js
│   │   └── SQLiteRedemptionRepository.js
│   ├── messaging/
│   │   └── EventBus.js
│   ├── observability/
│   │   ├── ConstitutionalLogger.js
│   │   └── MetricsCollector.js
│   └── security/
│       ├── JWTAuthenticator.js
│       └── RateLimiter.js
└── presentation/
    ├── http/
    │   ├── routes/
    │   └── controllers/
    └── cli/
        └── commands/
```

**Reglas de Dependencia:**
1. ✅ Domain NO depende de nadie
2. ✅ Application solo depende de Domain
3. ✅ Infrastructure depende de Application y Domain
4. ✅ Presentation depende de Application
5. ❌ PROHIBIDO: Dependencias inversas

#### 1.2 Event-Driven Architecture

**Principio:** Comunicación desacoplada mediante eventos de dominio.

**Eventos de Dominio Obligatorios:**
```javascript
// domain/events/VoucherEmitted.js
class VoucherEmittedEvent {
  constructor(voucher, metadata) {
    this.eventId = uuidv4();
    this.eventType = 'voucher.emitted';
    this.aggregateId = voucher.id;
    this.aggregateType = 'Voucher';
    this.occurredAt = new Date();
    this.data = {
      voucherCode: voucher.code,
      stayId: voucher.stayId,
      validFrom: voucher.validFrom,
      validUntil: voucher.validUntil
    };
    this.metadata = {
      correlationId: metadata.correlationId,
      causationId: metadata.causationId,
      userId: metadata.userId
    };
  }
}

// application/handlers/VoucherEmittedHandler.js
class VoucherEmittedHandler {
  constructor(auditLogger, metricsCollector, notificationService) {
    this.auditLogger = auditLogger;
    this.metricsCollector = metricsCollector;
    this.notificationService = notificationService;
  }

  async handle(event) {
    // Auditoría
    await this.auditLogger.log({
      event: 'voucher_emitted',
      aggregateId: event.aggregateId,
      data: event.data,
      metadata: event.metadata
    });

    // Métricas
    await this.metricsCollector.increment('vouchers.emitted', {
      stayId: event.data.stayId
    });

    // Notificación (opcional)
    await this.notificationService.notify({
      type: 'voucher_ready',
      recipient: event.metadata.userId,
      data: event.data
    });
  }
}
```

**Event Bus Constitucional:**
```javascript
// infrastructure/messaging/EventBus.js
class ConstitutionalEventBus {
  constructor(logger, tracer) {
    this.handlers = new Map();
    this.logger = logger;
    this.tracer = tracer;
  }

  subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  async publish(event) {
    return this.tracer.span('event.publish', async (span) => {
      span.setAttributes({
        'event.type': event.eventType,
        'event.id': event.eventId,
        'aggregate.id': event.aggregateId
      });

      this.logger.info({
        event: 'domain_event_published',
        eventType: event.eventType,
        eventId: event.eventId,
        correlationId: event.metadata.correlationId
      });

      const handlers = this.handlers.get(event.eventType) || [];
      
      await Promise.all(
        handlers.map(handler => 
          this.executeHandler(handler, event, span)
        )
      );
    });
  }

  async executeHandler(handler, event, parentSpan) {
    return this.tracer.span('event.handle', { parent: parentSpan }, async (span) => {
      try {
        await handler.handle(event);
        span.setStatus({ code: 'OK' });
      } catch (error) {
        span.recordException(error);
        this.logger.error({
          event: 'event_handler_failed',
          handlerName: handler.constructor.name,
          error: error.message
        });
        throw error;
      }
    });
  }
}
```

#### 1.3 CQRS (Command Query Responsibility Segregation)

**Principio:** Separación clara entre operaciones de escritura (Commands) y lectura (Queries).

**Command Pattern:**
```javascript
// application/commands/RedeemVoucherCommand.js
const RedeemVoucherCommandSchema = z.object({
  voucherCode: z.string().regex(/^[A-Z]+-\d{4}-\d{4}$/),
  cafeteriaId: z.number().int().positive(),
  deviceId: z.string().uuid(),
  userId: z.number().int().positive()
});

class RedeemVoucherCommand {
  constructor(data) {
    const validated = RedeemVoucherCommandSchema.parse(data);
    Object.assign(this, validated);
    this.commandId = uuidv4();
    this.timestamp = new Date();
  }
}

// application/handlers/RedeemVoucherHandler.js
class RedeemVoucherHandler {
  constructor(voucherRepo, redemptionRepo, eventBus, tracer) {
    this.voucherRepo = voucherRepo;
    this.redemptionRepo = redemptionRepo;
    this.eventBus = eventBus;
    this.tracer = tracer;
  }

  async handle(command) {
    return this.tracer.span('command.redeem_voucher', async (span) => {
      span.setAttributes({
        'command.id': command.commandId,
        'voucher.code': command.voucherCode,
        'user.id': command.userId
      });

      // 1. Load aggregate
      const voucher = await this.voucherRepo.findByCode(command.voucherCode);
      
      if (!voucher) {
        throw new VoucherNotFoundError(command.voucherCode);
      }

      // 2. Execute business logic
      const redemption = voucher.redeem({
        cafeteriaId: command.cafeteriaId,
        deviceId: command.deviceId,
        userId: command.userId
      });

      // 3. Atomic persistence
      await this.redemptionRepo.saveWithVoucherUpdate(redemption, voucher);

      // 4. Publish events
      await this.eventBus.publish(new VoucherRedeemedEvent(voucher, redemption));

      return redemption;
    });
  }
}
```

**Query Pattern:**
```javascript
// application/queries/GetRedemptionReportQuery.js
const GetRedemptionReportQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cafeteriaId: z.number().int().positive().optional(),
  format: z.enum(['json', 'csv']).default('json')
});

class GetRedemptionReportQuery {
  constructor(data) {
    const validated = GetRedemptionReportQuerySchema.parse(data);
    Object.assign(this, validated);
    this.queryId = uuidv4();
  }
}

// application/handlers/GetRedemptionReportHandler.js
class GetRedemptionReportHandler {
  constructor(redemptionRepo, csvGenerator) {
    this.redemptionRepo = redemptionRepo;
    this.csvGenerator = csvGenerator;
  }

  async handle(query) {
    // Read-optimized query (puede usar vistas, denormalizadas, etc.)
    const redemptions = await this.redemptionRepo.findByDateRange(
      query.fromDate,
      query.toDate,
      { cafeteriaId: query.cafeteriaId }
    );

    if (query.format === 'csv') {
      return this.csvGenerator.generate(redemptions);
    }

    return redemptions;
  }
}
```

---

### **PILAR 2: ESTÁNDARES DE CÓDIGO** 📝
**Prioridad:** 🔴 CRÍTICA

#### 2.1 Convenciones de Nomenclatura (OBLIGATORIAS)

```javascript
// ✅ CORRECTO
// Variables y funciones: camelCase
const voucherCode = 'HPN-2025-0001';
function validateVoucher(code) { }

// Clases y constructores: PascalCase
class VoucherService { }
class RedeemVoucherCommand { }

// Constantes: UPPER_SNAKE_CASE
const MAX_REDEMPTION_ATTEMPTS = 5;
const JWT_EXPIRATION = '24h';

// Archivos: kebab-case
// voucher-service.js
// redeem-voucher-handler.js

// Interfaces (TypeScript) o JSDoc: PascalCase con prefijo I
/** @interface IVoucherRepository */

// ❌ INCORRECTO
const VoucherCode = 'HPN-2025-0001';  // No PascalCase para variables
function ValidateVoucher(code) { }     // No PascalCase para funciones
class voucherService { }               // No camelCase para clases
const max_redemption_attempts = 5;     // No snake_case para constantes
// VoucherService.js                   // No PascalCase para archivos
```

#### 2.2 Documentación JSDoc (OBLIGATORIA)

```javascript
/**
 * Canjea un voucher de forma atómica.
 * 
 * @param {Object} params - Parámetros del canje
 * @param {string} params.voucherCode - Código único del voucher (formato: HPN-YYYY-####)
 * @param {number} params.cafeteriaId - ID de la cafetería donde se canjea
 * @param {string} params.deviceId - ID único del dispositivo (UUID)
 * @param {number} params.userId - ID del usuario que ejecuta el canje
 * 
 * @returns {Promise<Redemption>} Objeto redemption con datos del canje
 * 
 * @throws {VoucherNotFoundError} Si el voucher no existe
 * @throws {VoucherAlreadyRedeemedError} Si el voucher ya fue canjeado
 * @throws {VoucherExpiredError} Si el voucher está expirado
 * @throws {ConflictError} Si hay conflicto de concurrencia
 * 
 * @example
 * const redemption = await redeemVoucher({
 *   voucherCode: 'HPN-2025-0001',
 *   cafeteriaId: 1,
 *   deviceId: '123e4567-e89b-12d3-a456-426614174000',
 *   userId: 42
 * });
 * 
 * @constitutional Pilar 2.1 - Estándares de Código
 * @transactional Operación atómica con rollback automático
 * @auditable Registra evento en audit_log
 */
async function redeemVoucher({ voucherCode, cafeteriaId, deviceId, userId }) {
  // Implementation...
}
```

#### 2.3 Testing Standards (OBLIGATORIOS)

**Cobertura Mínima Constitucional:**
- ✅ **Statements:** >80%
- ✅ **Branches:** >80%
- ✅ **Functions:** >80%
- ✅ **Lines:** >80%

**Distribución de Tests:**
- 🧪 **Unit Tests:** 60-70% de cobertura
- 🔗 **Integration Tests:** 20-30% de cobertura
- 🌐 **E2E Tests:** 10-15% de cobertura

**Estructura de Test Constitucional:**
```javascript
// tests/unit/domain/entities/Voucher.test.js
describe('Voucher Entity [CONSTITUTIONAL]', () => {
  describe('Business Rules', () => {
    describe('isValid()', () => {
      it('should return true for active voucher within date range', () => {
        // Arrange
        const voucher = new Voucher({
          code: 'HPN-2025-0001',
          status: 'active',
          validFrom: new Date('2025-01-15'),
          validUntil: new Date('2025-01-17')
        });

        // Act
        const result = voucher.isValid();

        // Assert
        expect(result).toBe(true);
      });

      it('should return false for expired voucher', () => {
        // Arrange
        const voucher = new Voucher({
          code: 'HPN-2025-0001',
          status: 'active',
          validFrom: new Date('2025-01-15'),
          validUntil: new Date('2025-01-17')
        });
        jest.useFakeTimers().setSystemTime(new Date('2025-01-20'));

        // Act
        const result = voucher.isValid();

        // Assert
        expect(result).toBe(false);
        
        // Cleanup
        jest.useRealTimers();
      });

      // Property-based testing para casos edge
      it('should never be valid with status other than active', () => {
        fc.assert(
          fc.property(
            fc.constantFrom('redeemed', 'expired', 'cancelled'),
            fc.date(),
            fc.date(),
            (status, validFrom, validUntil) => {
              const voucher = new Voucher({
                code: 'HPN-2025-0001',
                status,
                validFrom,
                validUntil
              });
              return voucher.isValid() === false;
            }
          )
        );
      });
    });

    describe('redeem()', () => {
      it('should change status to redeemed and emit event', () => {
        // Arrange
        const voucher = new Voucher({
          code: 'HPN-2025-0001',
          status: 'active',
          validFrom: new Date('2025-01-15'),
          validUntil: new Date('2025-01-17')
        });

        // Act
        const event = voucher.redeem({
          cafeteriaId: 1,
          deviceId: 'device-001',
          userId: 42
        });

        // Assert
        expect(voucher.status).toBe('redeemed');
        expect(event).toBeInstanceOf(VoucherRedeemedEvent);
        expect(event.data.voucherCode).toBe('HPN-2025-0001');
      });

      it('should throw VoucherNotValidError for invalid voucher', () => {
        // Arrange
        const voucher = new Voucher({
          code: 'HPN-2025-0001',
          status: 'expired',
          validFrom: new Date('2025-01-15'),
          validUntil: new Date('2025-01-17')
        });

        // Act & Assert
        expect(() => {
          voucher.redeem({
            cafeteriaId: 1,
            deviceId: 'device-001',
            userId: 42
          });
        }).toThrow(VoucherNotValidError);
      });
    });
  });
});
```

**Test de Integración Constitucional (Test Case #10):**
```javascript
// tests/integration/reports/reconciliation.test.js
describe('[CONSTITUTIONAL TEST CASE #10] CSV Reconciliation', () => {
  let db;
  let app;

  beforeEach(async () => {
    db = await setupTestDatabase();
    app = await createTestApp(db);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('should include 7 rows: 3 online + 4 offline redemptions', async () => {
    // ========== ARRANGE ==========
    // Emitir 10 vouchers
    const vouchers = await Promise.all(
      Array.from({ length: 10 }, (_, i) => 
        emitVoucher(db, {
          code: `HPN-2025-${String(i + 1).padStart(4, '0')}`,
          stayId: 1,
          validFrom: '2025-01-15',
          validUntil: '2025-01-17'
        })
      )
    );

    // 3 canjes ONLINE
    await request(app)
      .post('/api/vouchers/redeem')
      .send({
        code: 'HPN-2025-0001',
        cafeteriaId: 1,
        deviceId: 'device-online-1',
        userId: 42
      })
      .expect(200);

    await request(app)
      .post('/api/vouchers/redeem')
      .send({
        code: 'HPN-2025-0002',
        cafeteriaId: 1,
        deviceId: 'device-online-1',
        userId: 42
      })
      .expect(200);

    await request(app)
      .post('/api/vouchers/redeem')
      .send({
        code: 'HPN-2025-0003',
        cafeteriaId: 1,
        deviceId: 'device-online-2',
        userId: 43
      })
      .expect(200);

    // 4 canjes OFFLINE (sincronizados posteriormente)
    const offlineRedemptions = [
      { code: 'HPN-2025-0004', deviceId: 'device-offline-1' },
      { code: 'HPN-2025-0005', deviceId: 'device-offline-1' },
      { code: 'HPN-2025-0006', deviceId: 'device-offline-2' },
      { code: 'HPN-2025-0007', deviceId: 'device-offline-2' }
    ];

    await request(app)
      .post('/api/sync/redemptions')
      .send({
        deviceId: 'device-offline-1',
        redemptions: offlineRedemptions.slice(0, 2).map((r, i) => ({
          local_id: uuidv4(),
          voucher_code: r.code,
          cafeteria_id: 1,
          device_id: r.deviceId,
          timestamp: new Date().toISOString()
        }))
      })
      .expect(200);

    await request(app)
      .post('/api/sync/redemptions')
      .send({
        deviceId: 'device-offline-2',
        redemptions: offlineRedemptions.slice(2).map((r, i) => ({
          local_id: uuidv4(),
          voucher_code: r.code,
          cafeteria_id: 1,
          device_id: r.deviceId,
          timestamp: new Date().toISOString()
        }))
      })
      .expect(200);

    // ========== ACT ==========
    const response = await request(app)
      .get('/api/reports/redemptions')
      .query({
        from: '2025-01-01',
        to: '2025-01-31',
        format: 'csv'
      })
      .set('Authorization', `Bearer ${getAdminToken()}`)
      .expect(200)
      .expect('Content-Type', /text\/csv/);

    // ========== ASSERT ==========
    const csvLines = response.text.trim().split('\n');
    
    // 1. Verificar número de líneas (header + 7 data rows)
    expect(csvLines).toHaveLength(8);
    
    // 2. Verificar header
    const header = csvLines[0];
    expect(header).toBe('code,guest_name,room,redeemed_at,cafeteria,device_id');
    
    // 3. Verificar columnas obligatorias en data rows
    const dataRows = csvLines.slice(1);
    dataRows.forEach(row => {
      const columns = row.split(',');
      expect(columns).toHaveLength(6);
      
      // Verificar device_id presente
      expect(columns[5]).toMatch(/device-(online|offline)-\d+/);
      
      // Verificar cafeteria presente
      expect(columns[4]).toBeTruthy();
    });
    
    // 4. Verificar códigos específicos canjeados
    const codes = dataRows.map(row => row.split(',')[0]);
    expect(codes).toContain('HPN-2025-0001');
    expect(codes).toContain('HPN-2025-0002');
    expect(codes).toContain('HPN-2025-0003');
    expect(codes).toContain('HPN-2025-0004');
    expect(codes).toContain('HPN-2025-0005');
    expect(codes).toContain('HPN-2025-0006');
    expect(codes).toContain('HPN-2025-0007');
    
    // 5. Verificar que vouchers NO canjeados no aparecen
    expect(codes).not.toContain('HPN-2025-0008');
    expect(codes).not.toContain('HPN-2025-0009');
    expect(codes).not.toContain('HPN-2025-0010');
    
    // 6. Verificar mix de devices online y offline
    const devices = dataRows.map(row => row.split(',')[5]);
    const onlineDevices = devices.filter(d => d.includes('online'));
    const offlineDevices = devices.filter(d => d.includes('offline'));
    
    expect(onlineDevices).toHaveLength(3);
    expect(offlineDevices).toHaveLength(4);
  });
});
```

#### 2.4 Code Quality Gates (AUTOMATIZADOS)

```yaml
# .github/workflows/quality-gates.yml
name: Constitutional Quality Gates

on: [push, pull_request]

jobs:
  quality_gates:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      # GATE 1: Linting
      - name: Gate 1 - Lint Code
        run: npm run lint
        continue-on-error: false
      
      # GATE 2: Type Checking (si usa TypeScript)
      - name: Gate 2 - Type Check
        run: npm run type-check
        continue-on-error: false
      
      # GATE 3: Unit Tests
      - name: Gate 3 - Unit Tests
        run: npm run test:unit -- --coverage
        continue-on-error: false
      
      # GATE 4: Coverage Threshold
      - name: Gate 4 - Check Coverage >80%
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80%"
            exit 1
          fi
      
      # GATE 5: Integration Tests
      - name: Gate 5 - Integration Tests
        run: npm run test:integration
        continue-on-error: false
      
      # GATE 6: Security Scan
      - name: Gate 6 - Security Scan
        run: npm audit --audit-level=high
        continue-on-error: false
      
      # GATE 7: Complexity Analysis
      - name: Gate 7 - Complexity Check
        run: npx complexity-report --maxcc 10 src/
        continue-on-error: false
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: constitutional
```

---

### **PILAR 3: AUTONOMÍA Y RESILIENCIA** 🤖
**Prioridad:** 🔴 CRÍTICA

#### 3.1 Niveles de Autonomía (DEFINIDOS)

```javascript
// domain/agents/AutonomyLevel.js
const AutonomyLevel = {
  SUPERVISED: {
    level: 0,
    name: 'Supervised',
    description: 'Todas las acciones requieren aprobación humana explícita',
    constraints: {
      maxTokens: 500,
      maxDuration: 10000, // 10 segundos
      maxIterations: 3,
      budgetPerSession: 1.00, // $1 USD
      requiresApproval: ['read', 'write', 'execute']
    }
  },
  
  SEMI_AUTONOMOUS: {
    level: 1,
    name: 'Semi-Autonomous',
    description: 'Acciones de lectura automáticas, escritura requiere confirmación',
    constraints: {
      maxTokens: 1000,
      maxDuration: 30000, // 30 segundos
      maxIterations: 5,
      budgetPerSession: 5.00, // $5 USD
      requiresApproval: ['write', 'execute']
    }
  },
  
  AUTONOMOUS: {
    level: 2,
    name: 'Autonomous',
    description: 'Aprobación solo para acciones irreversibles',
    constraints: {
      maxTokens: 2000,
      maxDuration: 60000, // 60 segundos
      maxIterations: 10,
      budgetPerSession: 10.00, // $10 USD
      requiresApproval: ['delete', 'admin_action']
    }
  }
};

// application/agents/ConstitutionalAgent.js
class ConstitutionalAgent {
  constructor(config) {
    this.autonomyLevel = AutonomyLevel[config.autonomyLevel];
    this.tracer = new DistributedTracer();
    this.logger = new ConstitutionalLogger();
    this.costTracker = new CostTracker();
    this.iterationCount = 0;
    this.startTime = Date.now();
  }

  async execute(task) {
    return this.tracer.span('agent.execute', async (span) => {
      span.setAttributes({
        'agent.autonomy_level': this.autonomyLevel.level,
        'agent.task_type': task.type
      });

      // Check constraints BEFORE execution
      this.validateConstraints(task);

      // Percepción → Razonamiento → Acción
      const perception = await this.perceive(task);
      const reasoning = await this.reason(perception);
      
      // Human-in-the-loop si es necesario
      if (this.requiresHumanApproval(task, reasoning)) {
        const approval = await this.requestHumanApproval(reasoning);
        if (!approval.granted) {
          throw new ActionRejectedError(approval.reason);
        }
      }
      
      return this.act(reasoning);
    });
  }

  validateConstraints(task) {
    // Iteration limit
    if (this.iterationCount >= this.autonomyLevel.constraints.maxIterations) {
      throw new ConstraintViolationError('Max iterations exceeded');
    }

    // Duration limit
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.autonomyLevel.constraints.maxDuration) {
      throw new ConstraintViolationError('Max duration exceeded');
    }

    // Budget limit
    if (this.costTracker.totalCost > this.autonomyLevel.constraints.budgetPerSession) {
      throw new ConstraintViolationError('Budget exceeded');
    }
  }

  requiresHumanApproval(task, reasoning) {
    const actionType = this.classifyAction(task);
    return this.autonomyLevel.constraints.requiresApproval.includes(actionType);
  }

  async requestHumanApproval(reasoning) {
    this.logger.info({
      event: 'human_approval_requested',
      reasoning: reasoning,
      autonomyLevel: this.autonomyLevel.level
    });

    // Implementación depende del canal (UI, webhook, etc.)
    return await this.approvalService.request({
      reasoning,
      timeout: 300000 // 5 minutos
    });
  }
}
```

#### 3.2 Comunicación Multi-Agente (PROTOCOLO)

```javascript
// infrastructure/messaging/AgentProtocol.js
const AgentMessageSchema = z.object({
  messageId: z.string().uuid(),
  messageType: z.enum([
    'REQUEST',
    'RESPONSE',
    'NOTIFICATION',
    'QUERY',
    'COMMAND'
  ]),
  senderId: z.string(),
  receiverId: z.string().optional(), // null = broadcast
  correlationId: z.string().uuid(),
  timestamp: z.date(),
  payload: z.object({}).passthrough(),
  metadata: z.object({
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
    ttl: z.number().int().positive().default(60000), // 60 segundos
    retryPolicy: z.object({
      maxAttempts: z.number().int().positive().default(3),
      backoffMs: z.number().int().positive().default(1000)
    }).optional()
  })
});

class AgentCommunicationBus {
  constructor(logger, tracer) {
    this.agents = new Map();
    this.messageQueue = new PriorityQueue();
    this.logger = logger;
    this.tracer = tracer;
  }

  registerAgent(agentId, agent) {
    this.agents.set(agentId, agent);
    this.logger.info({
      event: 'agent_registered',
      agentId,
      agentType: agent.constructor.name
    });
  }

  async send(message) {
    const validated = AgentMessageSchema.parse(message);
    
    return this.tracer.span('agent.message.send', async (span) => {
      span.setAttributes({
        'message.id': validated.messageId,
        'message.type': validated.messageType,
        'sender.id': validated.senderId,
        'receiver.id': validated.receiverId || 'broadcast'
      });

      if (validated.receiverId) {
        // Unicast
        await this.deliverToAgent(validated.receiverId, validated);
      } else {
        // Broadcast
        await Promise.all(
          Array.from(this.agents.keys())
            .filter(agentId => agentId !== validated.senderId)
            .map(agentId => this.deliverToAgent(agentId, validated))
        );
      }
    });
  }

  async deliverToAgent(agentId, message) {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      this.logger.warn({
        event: 'agent_not_found',
        agentId,
        messageId: message.messageId
      });
      return;
    }

    try {
      await agent.receiveMessage(message);
      
      this.logger.debug({
        event: 'message_delivered',
        messageId: message.messageId,
        agentId
      });
    } catch (error) {
      this.logger.error({
        event: 'message_delivery_failed',
        messageId: message.messageId,
        agentId,
        error: error.message
      });

      // Retry si aplica
      if (message.metadata.retryPolicy) {
        await this.scheduleRetry(agentId, message);
      }
    }
  }
}
```

#### 3.3 Manejo de Errores y Circuit Breakers (OBLIGATORIO)

```javascript
// infrastructure/resilience/CircuitBreaker.js
class ConstitutionalCircuitBreaker {
  constructor(config = {}) {
    this.threshold = config.threshold || 5;
    this.timeout = config.timeout || 60000; // 60 segundos
    this.halfOpenAttempts = config.halfOpenAttempts || 3;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  async execute(operation, fallback) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        return this.executeFallback(fallback, 'Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      return this.executeFallback(fallback, error.message);
    }
  }

  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenAttempts) {
        this.state = 'CLOSED';
        logger.info({
          event: 'circuit_breaker_closed',
          threshold: this.threshold
        });
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.timeout;
      
      logger.error({
        event: 'circuit_breaker_opened',
        failureCount: this.failureCount,
        threshold: this.threshold,
        nextAttemptTime: this.nextAttemptTime
      });
    }
  }

  async executeFallback(fallback, reason) {
    if (!fallback) {
      throw new CircuitBreakerOpenError(reason);
    }
    
    logger.warn({
      event: 'circuit_breaker_fallback_executed',
      reason
    });
    
    return typeof fallback === 'function' ? await fallback() : fallback;
  }
}

// infrastructure/resilience/RetryPolicy.js
class ExponentialBackoffRetry {
  constructor(config = {}) {
    this.maxAttempts = config.maxAttempts || 3;
    this.baseDelayMs = config.baseDelayMs || 1000;
    this.maxDelayMs = config.maxDelayMs || 30000;
    this.jitterMs = config.jitterMs || 100;
  }

  async execute(operation, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        logger.warn({
          event: 'retry_attempt',
          attempt,
          maxAttempts: this.maxAttempts,
          error: error.message,
          context
        });

        if (attempt < this.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    logger.error({
      event: 'retry_exhausted',
      maxAttempts: this.maxAttempts,
      error: lastError.message,
      context
    });

    throw lastError;
  }

  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);
    const jitter = Math.random() * this.jitterMs;
    return cappedDelay + jitter;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

### **PILAR 4: GESTIÓN DE PROMPTS** 💬
**Prioridad:** 🟡 ALTA

```javascript
// application/prompts/PromptRegistry.js
class ConstitutionalPromptRegistry {
  constructor() {
    this.prompts = new Map();
    this.versioning = new Map();
  }

  register(prompt) {
    const validated = PromptSchema.parse(prompt);
    
    this.prompts.set(validated.id, validated);
    
    if (!this.versioning.has(validated.id)) {
      this.versioning.set(validated.id, []);
    }
    this.versioning.get(validated.id).push({
      version: validated.version,
      timestamp: new Date(),
      prompt: validated
    });

    logger.info({
      event: 'prompt_registered',
      promptId: validated.id,
      version: validated.version
    });
  }

  get(promptId, version = 'latest') {
    if (version === 'latest') {
      return this.prompts.get(promptId);
    }
    
    const versions = this.versioning.get(promptId) || [];
    const found = versions.find(v => v.version === version);
    return found?.prompt;
  }
}

// Ejemplo: Prompt para Resolución de Conflictos
const CONFLICT_RESOLUTION_PROMPT = {
  id: 'voucher-conflict-resolution',
  version: '1.2.0',
  category: 'conflict_resolution',
  template: `
## ROLE
You are a Voucher Conflict Resolution Agent for Hostal Playa Norte.

## TASK
Analyze the redemption conflict and determine the optimal resolution strategy.

## CONTEXT
- System policy: Server timestamp wins in case of conflicts
- Business rules: No double redemptions allowed
- User experience: Minimize friction, provide clear explanations

## INPUT DATA
{conflict_data}

## CONSTRAINTS
- Output format: JSON
- Required fields: resolution, reason, next_actions
- Resolution options: "server_wins", "client_wins", "manual_review"
- Execution time: <500ms

## EXAMPLES
### Example 1: Simple offline conflict
Input: {
  "local_redemption": {
    "voucher_code": "HPN-2025-0001",
    "device_id": "device-offline-1",
    "timestamp": "2025-01-15T08:30:00Z"
  },
  "server_redemption": {
    "voucher_code": "HPN-2025-0001",
    "device_id": "device-online-1",
    "timestamp": "2025-01-15T08:25:00Z"
  }
}

Output: {
  "resolution": "server_wins",
  "reason": "Server redemption occurred 5 minutes earlier",
  "next_actions": [
    "Notify device-offline-1 user",
    "Update local IndexedDB",
    "Show apologetic message"
  ],
  "confidence": 0.95
}

## OUTPUT FORMAT
{
  "resolution": string,
  "reason": string,
  "next_actions": string[],
  "confidence": number
}
`,
  validation: z.object({
    resolution: z.enum(['server_wins', 'client_wins', 'manual_review']),
    reason: z.string().min(10),
    next_actions: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }),
  metrics: {
    accuracy: 0.95,
    consistency: 0.98,
    avgLatency: 350 // ms
  },
  testCases: [
    {
      input: { /* ... */ },
      expectedOutput: { /* ... */ }
    }
  ]
};
```

---

### **PILAR 5: SEGURIDAD Y PRIVACIDAD** 🔒
**Prioridad:** 🔴 CRÍTICA

#### 5.1 Autenticación y Autorización (JWT + RBAC)

```javascript
// infrastructure/security/JWTAuthenticator.js
class ConstitutionalJWTAuthenticator {
  constructor(config) {
    this.jwtSecret = config.JWT_SECRET;
    this.jwtExpiration = config.JWT_EXPIRATION || '24h';
    this.issuer = config.JWT_ISSUER || 'hostal-playa-norte';
  }

  generateToken(user) {
    const payload = {
      user_id: user.id,
      username: user.username,
      role: user.role,
      cafeteria_id: user.cafeteriaId,
      
      // Claims estándar
      iss: this.issuer,
      sub: String(user.id),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiration(this.jwtExpiration)
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256'
    });
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
        algorithms: ['HS256']
      });

      return {
        valid: true,
        user: {
          id: decoded.user_id,
          username: decoded.username,
          role: decoded.role,
          cafeteriaId: decoded.cafeteria_id
        }
      };
    } catch (error) {
      logger.warn({
        event: 'jwt_verification_failed',
        error: error.message
      });

      return {
        valid: false,
        error: error.message
      };
    }
  }

  parseExpiration(expiration) {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));
    
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400
    };
    
    return value * (units[unit] || 3600);
  }
}

// infrastructure/security/RBACAuthorizer.js
const PERMISSIONS = {
  admin: [
    'vouchers:create',
    'vouchers:read',
    'vouchers:update',
    'vouchers:delete',
    'reports:read',
    'reports:export',
    'users:manage',
    'settings:manage'
  ],
  
  reception: [
    'vouchers:create',
    'vouchers:read',
    'reports:read',
    'reports:export'
  ],
  
  cafeteria: [
    'vouchers:read',
    'vouchers:redeem',
    'sync:execute',
    'conflicts:resolve'
  ]
};

class RBACAuthorizer {
  static authorize(user, permission) {
    const userPermissions = PERMISSIONS[user.role] || [];
    const hasPermission = userPermissions.includes(permission);

    logger.debug({
      event: 'authorization_check',
      userId: user.id,
      role: user.role,
      permission,
      granted: hasPermission
    });

    return hasPermission;
  }

  static middleware(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'No authentication token provided'
        });
      }

      if (!RBACAuthorizer.authorize(req.user, permission)) {
        logger.warn({
          event: 'authorization_denied',
          userId: req.user.id,
          role: req.user.role,
          permission,
          path: req.path
        });

        return res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' required`,
          requiredPermission: permission,
          userRole: req.user.role
        });
      }

      next();
    };
  }
}
```

#### 5.2 Input Validation y Sanitization (Zod)

```javascript
// application/validation/schemas.js
const VoucherCodeSchema = z.string()
  .regex(/^[A-Z]+-\d{4}-\d{4}$/, 'Invalid voucher code format')
  .transform(code => code.trim().toUpperCase());

const DateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
  .refine(date => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid date');

const EmitVoucherRequestSchema = z.object({
  stay_id: z.number().int().positive(),
  valid_from: DateSchema,
  valid_until: DateSchema,
  breakfast_count: z.number().int().positive().max(30)
}).refine(data => {
  const from = new Date(data.valid_from);
  const until = new Date(data.valid_until);
  return until >= from;
}, {
  message: 'valid_until must be >= valid_from',
  path: ['valid_until']
});

const RedeemVoucherRequestSchema = z.object({
  code: VoucherCodeSchema,
  cafeteria_id: z.number().int().positive(),
  device_id: z.string().uuid(),
  correlation_id: z.string().uuid().optional()
});

// Middleware de validación
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      logger.warn({
        event: 'validation_failed',
        path: req.path,
        errors: error.errors,
        body: req.body
      });

      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors
      });
    }
  };
}
```

#### 5.3 Data Privacy y PII Protection

```javascript
// infrastructure/privacy/PIIRedactor.js
class PIIRedactor {
  static readonly PII_FIELDS = [
    'guest_email',
    'guest_phone',
    'guest_document',
    'credit_card',
    'password',
    'ssn'
  ];

  static redactObject(obj, level = 'INFO') {
    if (level === 'DEBUG') {
      // En DEBUG, permitir más datos (pero nunca passwords)
      return this.redactSensitive(obj);
    }

    // En INFO/WARN/ERROR, redactar todo PII
    const redacted = { ...obj };
    
    for (const field of this.PII_FIELDS) {
      if (redacted[field]) {
        redacted[field] = this.maskValue(redacted[field]);
      }
    }

    return redacted;
  }

  static maskValue(value) {
    if (typeof value !== 'string') {
      return '[REDACTED]';
    }

    // Mostrar solo primeros 2 y últimos 2 caracteres
    if (value.length > 4) {
      return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
    }

    return '*'.repeat(value.length);
  }

  static redactSensitive(obj) {
    const redacted = { ...obj };
    
    const ALWAYS_REDACT = ['password', 'credit_card', 'ssn'];
    for (const field of ALWAYS_REDACT) {
      if (redacted[field]) {
        redacted[field] = '[REDACTED]';
      }
    }

    return redacted;
  }
}

// Uso en Logger
class ConstitutionalLogger {
  log(level, event, data = {}) {
    const redacted = PIIRedactor.redactObject(data, level);
    
    const logEntry = {
      level,
      event,
      correlation_id: this.getCorrelationId(),
      timestamp: new Date().toISOString(),
      ...redacted
    };

    this.winston.log(level, logEntry);
  }
}
```

---

[Continuará en PARTE 2 debido a límites de longitud...]

¿Deseas que continúe con los pilares 6-12 y los checklists operacionales completos?
