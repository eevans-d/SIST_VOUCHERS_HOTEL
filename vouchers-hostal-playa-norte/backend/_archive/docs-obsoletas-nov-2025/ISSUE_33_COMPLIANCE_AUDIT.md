# Issue #33: Compliance & Audit Logging - Regulatory Compliance Framework

## 1. Descripción General

### Problema Resuelto
Las aplicaciones empresariales deben cumplir con múltiples regulaciones internacionales:

- **GDPR** (Europa): Derechos del sujeto de datos, consentimiento, privacidad
- **HIPAA** (USA): Información médica protegida, auditoría, encriptación
- **SOC2** (Certificación): Controles de acceso, gestión de cambios, logging
- **CCPA** (California): Derechos del consumidor, transparencia

Sin estas capacidades, las organizaciones enfrentan:
- Multas regulatorias: €20M o 4% del ingresos (GDPR)
- Pérdida de licencia médica (HIPAA)
- Suspensión de servicios (SOC2)
- Litigios civiles (CCPA)

### Solución Implementada
`ComplianceService` proporciona:

1. **Auditoría Completa**: Cada acción registrada con contexto (usuario, IP, hora, antes/después)
2. **Gestión de Consentimiento**: Rastreo explícito de permisos de usuario
3. **Derechos GDPR**: Acceso, rectificación, erasión, portabilidad, restricción
4. **Cumplimiento HIPAA**: Validación de PHI, encriptación, pistas de auditoría
5. **Reportes SOC2**: Documentación de controles, incidents
6. **Políticas de Retención**: Limpieza automática de datos vencidos

### Beneficios Empresariales

| Aspecto | Antes | Después |
|--------|-------|---------|
| Regulación | Manual, incompleta | Automática, auditable |
| Derechos de usuario | No soportados | Implementados (5 GDPR) |
| Multas de cumplimiento | Alto riesgo | Mitigado |
| Auditorías externas | Fallidas | Pasan auditoría |
| Respuesta a incidentes | Horas | Segundos |

---

## 2. Conceptos Fundamentales

### GDPR - Reglamento General de Protección de Datos

**Alcance**: Cualquier organización que procese datos de residentes de la UE

**Principios Core**:
1. **Lawfulness** (Legalidad): Consentimiento, contrato, u otra base legal
2. **Purpose Limitation** (Limitación de propósito): Solo usar para fin declarado
3. **Data Minimization** (Minimización): Solo recopilar datos necesarios
4. **Accuracy** (Precisión): Mantener datos correctos
5. **Storage Limitation** (Limitación de almacenamiento): Borrar después del período de retención

**Derechos del Sujeto de Datos (Art. 12-22)**:

```
┌─────────────────────────────────────────┐
│ Derechos GDPR del Sujeto de Datos      │
├─────────────────────────────────────────┤
│ Art. 15: Derecho de acceso (Access)     │
│ Art. 16: Derecho de rectificación       │
│ Art. 17: Derecho al olvido (Erasure)    │
│ Art. 18: Derecho a restricción          │
│ Art. 20: Derecho a portabilidad         │
│ Art. 21: Derecho de oposición           │
└─────────────────────────────────────────┘
```

**Basas Legales para Procesamiento**:
1. Consentimiento (explícito, informado, revocable)
2. Contrato (necesario para prestar servicio)
3. Obligación legal (impuesto por ley)
4. Interés vital (salvar vida)
5. Misión pública (gobierno, salud)
6. Interés legítimo (balanceado con derechos del usuario)

### HIPAA - Ley de Portabilidad y Responsabilidad de Seguros Médicos

**Alcance**: Entidades cubiertas (hospitales, clínicas, aseguradoras) y asociados comerciales

**Componentes Regulatorios**:

1. **Privacy Rule** (Regla de Privacidad)
   - Quién puede acceder a PHI (Información de Salud Protegida)
   - Autorización del paciente requerida
   - Limitación de uso mínimo necesario

2. **Security Rule** (Regla de Seguridad)
   - Encriptación de PHI (en tránsito y en reposo)
   - Controles de acceso basados en roles
   - Auditoría de todos los accesos

3. **Breach Notification Rule**
   - Notificar en 60 días si hay exposición
   - Documentar todos los accesos/modificaciones

**Requisitos de PHI**:
```javascript
// Campos Requeridos para Registros Médicos
{
  patient_id: "encrypted",           // Identificador único cifrado
  record_date: "2024-01-15",         // Fecha del registro
  provider_id: "encrypted",          // ID del proveedor cifrado
  clinical_notes: "encrypted",       // Notas clínicas cifradas
  patientSocialSecurityNumber: "encrypted", // SSN cifrado
  medicalHistory: "encrypted",       // Historial médico cifrado
  auditTrail: [                       // Pista de auditoría obligatoria
    {
      action: "accessed",
      userId: "doc123",
      timestamp: 1705334400000,
      ipAddress: "192.168.1.1"
    }
  ]
}
```

### SOC2 - Service Organization Control 2

**Propósito**: Certificar controles de seguridad de proveedores de servicios

**Cinco Principios de Confianza**:

1. **Security**: Proteger contra acceso no autorizado
2. **Availability**: Mantener disponibilidad según SLA
3. **Processing Integrity**: Procesar datos completos, precisos, autorizados
4. **Confidentiality**: Proteger información confidencial
5. **Privacy**: Recopilar/usar datos según consentimiento

**Requisitos de Auditoría**:
- Logs de auditoría sin cambios ✓
- Gestión de cambios documentada ✓
- Control de acceso (RBAC) ✓
- Monitoreo de seguridad ✓
- Incidentes documentados ✓

### CCPA - Ley de Privacidad del Consumidor de California

**Alcance**: Empresas que hacen negocio en California y recopilan datos de residentes

**Derechos del Consumidor**:
1. **Right to Know**: Qué datos tenemos, cómo se usan
2. **Right to Delete**: Borrar datos (con excepciones legales)
3. **Right to Opt-Out**: Rechazar venta/compartición de datos
4. **Right to Correct**: Rectificar datos inexactos
5. **Right to Access**: Obtener copia de datos

**Diferencias con GDPR**:

| Aspecto | GDPR | CCPA |
|--------|------|------|
| Consentimiento | Opt-in (explícito) | Opt-out (por defecto permitido) |
| Múltiples bases | Sí (6 bases legales) | Solo consentimiento/negocio |
| Alcance | Solo ciudadanos UE | Residentes CA |
| Multa máxima | €20M o 4% ingresos | $2,500-$7,500 por violación |
| Notificación de brecha | 72 horas | Sin demora |

---

## 3. Arquitectura del Sistema

### Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────┐
│              ComplianceService                            │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────┐  ┌──────────────────┐              │
│  │ Audit Logging   │  │ Consent Manager  │              │
│  │                 │  │                  │              │
│  │ • logAuditEvent │  │ • recordConsent  │              │
│  │ • getMetrics    │  │ • getConsents    │              │
│  └─────────────────┘  └──────────────────┘              │
│                                                            │
│  ┌────────────────────┐  ┌─────────────────┐            │
│  │ GDPR Rights Engine │  │ HIPAA Validator │            │
│  │                    │  │                 │            │
│  │ • accessRequest    │  │ • validatePHI   │            │
│  │ • deleteData       │  │ • checkEncrypt  │            │
│  │ • exportData       │  │ • auditTrail    │            │
│  │ • rectifyData      │  └─────────────────┘            │
│  │ • restrictProcess  │                                   │
│  └────────────────────┘  ┌─────────────────┐            │
│                          │ Reporting       │            │
│                          │ Engine          │            │
│                          │ • GDPR Report   │            │
│                          │ • HIPAA Report  │            │
│                          │ • SOC2 Report   │            │
│                          │ • CCPA Report   │            │
│                          └─────────────────┘            │
│                                                            │
│  ┌─────────────────────────────────────┐               │
│  │ Data Storage & Retention Policies   │               │
│  │                                     │               │
│  │ • auditLogs (Map)                   │               │
│  │ • consentRecords (Map)              │               │
│  │ • dataAccessRequests (Map)          │               │
│  │ • complianceViolations (Map)        │               │
│  │ • enforceRetentionPolicies()        │               │
│  └─────────────────────────────────────┘               │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Estructuras de Datos

#### AuditLog
```javascript
{
  id: "1705334400000-a1b2c3d4e",
  timestamp: 1705334400000,
  userId: "user123",
  action: "data_access",                    // data_access, modification, deletion
  resource: "user_profile",
  resourceId: "profile123",
  before: { name: "John" },                 // Estado anterior
  after: { name: "John Doe" },              // Estado nuevo
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  status: "success",                        // success, failed, blocked
  details: { reason: "user_request" },
  dataCategory: "personal_data",            // GDPR categoría
  complianceFrameworks: ["GDPR", "HIPAA"],  // Marcos aplicables
  encrypted: true
}
```

#### ConsentRecord
```javascript
{
  id: "1705334400000-f1g2h3i4j",
  userId: "user123",
  consentType: "marketing",                 // marketing, analytics, third_party, etc.
  dataCategory: "personal_data",
  granted: true,
  timestamp: 1705334400000,
  expiresAt: 1736870400000,                 // 1 año después
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  consentMethod: "explicit",                // explicit, implicit, opt-out
  language: "en",
  version: "1.0"
}
```

#### AccessRequest
```javascript
{
  id: "1705334400000-k1l2m3n4o",
  userId: "user123",
  requestType: "full",                      // full, specific, deletion_verification
  status: "completed",
  receivedAt: 1705334400000,
  expirationDate: 1708013200000,            // 30 días después
  data: {
    personalData: { userId, dataCollected },
    activityLog: [...],
    consentRecords: [...],
    thirdPartyShares: [...]
  },
  metadata: {
    dataCategories: ["personal_data", "activity"],
    totalRecords: 145,
    processingPurposes: ["service_delivery", "analytics"],
    recipients: ["internal_systems", "cloud_storage"]
  }
}
```

---

## 4. Algoritmos Clave

### Algoritmo 1: Evaluación de Cumplimiento GDPR

```
FUNCIÓN validar_cumplimiento_gdpr(actividad_procesamiento):
  
  validacion = {
    cumple: true,
    problemas: []
  }
  
  // 1. Verificar Base Legal
  SI no actividad.base_legal:
    validacion.cumple = false
    validacion.problemas.append("Base legal faltante")
  
  // 2. Verificar Limitación de Propósito
  SI no actividad.proposito:
    validacion.cumple = false
    validacion.problemas.append("Propósito faltante")
  
  // 3. Verificar Minimización de Datos (máx 5 categorías)
  SI actividad.categorias_datos.longitud > 5:
    validacion.cumple = false
    validacion.problemas.append("Demasiadas categorías (principio de minimización)")
  
  // 4. Verificar Limitación de Almacenamiento
  SI no actividad.periodo_retencion:
    validacion.cumple = false
    validacion.problemas.append("Período de retención faltante")
  
  // 5. Verificar DPIA (si es alto riesgo)
  SI actividad.alto_riesgo Y no actividad.dpia_completada:
    validacion.cumple = false
    validacion.problemas.append("DPIA requerido")
  
  RETORNA validacion
```

**Complejidad**: O(n) donde n = categorías de datos
**Tiempo**: ~5ms por validación

### Algoritmo 2: Validación de Cumplimiento HIPAA

```
FUNCIÓN validar_hipaa(registro_medico):
  
  validacion = {
    cumple: true,
    campos_faltantes: [],
    violaciones: []
  }
  
  // 1. Verificar Campos Requeridos
  CAMPOS_REQUERIDOS = [
    "patient_id",
    "record_date",
    "provider_id",
    "clinical_notes"
  ]
  
  PARA cada campo EN CAMPOS_REQUERIDOS:
    SI no registro_medico[campo]:
      validacion.campos_faltantes.append(campo)
      validacion.cumple = false
  
  // 2. Verificar Encriptación de PHI
  SI no esta_encriptado(registro_medico.patientSocialSecurityNumber):
    validacion.violaciones.append("SSN sin encriptar")
    validacion.cumple = false
  
  SI no esta_encriptado(registro_medico.medicalHistory):
    validacion.violaciones.append("Historial médico sin encriptar")
    validacion.cumple = false
  
  // 3. Verificar Pista de Auditoría
  SI no registro_medico.auditTrail O registro_medico.auditTrail.vacia():
    validacion.violaciones.append("Pista de auditoría faltante")
    validacion.cumple = false
  
  RETORNA validacion
```

**Complejidad**: O(1) para campos, O(n) para auditoría donde n = entradas de auditoría
**Tiempo**: ~10ms por validación

### Algoritmo 3: Procesamiento de Solicitud de Acceso GDPR

```
FUNCIÓN procesar_solicitud_acceso(usuario_id, tipo_solicitud):
  
  solicitud = {
    id: generar_id(),
    usuario_id: usuario_id,
    tipo_solicitud: tipo_solicitud,
    estado: "recibida",
    recibida_en: ahora(),
    fecha_vencimiento: ahora() + 30_dias,
    datos: null,
    metadatos: {}
  }
  
  // 1. Recopilar todos los datos del usuario (O(n) donde n = registros)
  datos_usuario = {
    datos_personales: obtener_datos_personales(usuario_id),
    registro_actividad: obtener_registro(usuario_id),
    registros_consentimiento: obtener_consentimientos(usuario_id),
    accesos_terceros: obtener_accesos_terceros(usuario_id)
  }
  
  // 2. Validar integridad de datos
  PARA cada categoria EN datos_usuario:
    SI datos_usuario[categoria] es invalida:
      registrar_violation("Datos corrompidos en " + categoria)
      solicitud.estado = "error"
      RETORNA solicitud
  
  // 3. Preparar respuesta
  solicitud.datos = datos_usuario
  solicitud.metadatos = {
    categorias_datos: obtener_claves(datos_usuario),
    registros_totales: contar_registros(datos_usuario),
    propositos_procesamiento: obtener_propositos(usuario_id),
    destinatarios: obtener_destinatarios(usuario_id)
  }
  
  // 4. Marcar como completada
  solicitud.estado = "completada"
  solicitud.completada_en = ahora()
  
  RETORNA solicitud
```

**Complejidad**: O(n) donde n = total de registros del usuario
**Tiempo**: 50-500ms según cantidad de datos
**Garantía**: Completar dentro de 30 días (requerimiento legal)

### Algoritmo 4: Política de Retención de Datos

```
FUNCIÓN aplicar_politicas_retencion():
  
  ahora = timestamp_actual()
  retencion_ms = politica.periodo_retencion * 24 * 60 * 60 * 1000
  retencion_auditoria_ms = politica.periodo_retencion_auditoria * 24 * 60 * 60 * 1000
  
  purgado = 0
  
  // 1. Purgar datos normales (365 días por defecto)
  PARA cada (id, log) EN auditLogs:
    SI (ahora - log.timestamp) > retencion_ms:
      auditLogs.eliminar(id)
      purgado = purgado + 1
  
  // 2. Purgar logs de auditoría (7 años para cumplimiento legal)
  PARA cada (id, log) EN auditLogs:
    SI (ahora - log.timestamp) > retencion_auditoria_ms:
      auditLogs.eliminar(id)
      purgado = purgado + 1
  
  // 3. Purgar registros de consentimiento (expirados)
  PARA cada (id, registro) EN registros_consentimiento:
    SI registro.expira_en Y ahora > registro.expira_en:
      registros_consentimiento.eliminar(id)
      purgado = purgado + 1
  
  // 4. Registrar operación de retención
  registrar_auditoria({
    accion: "retencion_aplicada",
    registros_purgados: purgado,
    timestamp: ahora
  })
  
  RETORNA purgado
```

**Complejidad**: O(n) donde n = total de registros
**Tiempo**: 100-1000ms según cantidad de registros
**Programación**: Se ejecuta cada hora automáticamente
**Auditoría**: Cada purga se registra en pista de auditoría

---

## 5. Integración

### Configuración

```javascript
// Inicializar con configuración personalizada
const complianceService = new ComplianceService({
  // Marcos regulatorios
  enableGDPR: true,
  enableHIPAA: true,
  enableSOC2: true,
  enableCCPA: true,
  
  // Períodos de retención (días)
  dataRetentionPeriod: 365,              // 1 año
  auditLogRetentionPeriod: 2555,         // 7 años (GDPR recomendado)
  consentRecordRetentionPeriod: 1825,    // 5 años
  
  // Categorías GDPR de datos
  gdprDataCategories: [
    'personal_data',
    'sensitive_data',
    'financial_data',
    'health_data'
  ],
  
  // Derechos GDPR soportados
  gdprRights: [
    'access',
    'rectification',
    'erasure',
    'restriction',
    'portability'
  ],
  
  // Campos requeridos para registros médicos HIPAA
  hipaaRequiredFieldsForMedicalRecords: [
    'patient_id',
    'record_date',
    'provider_id',
    'clinical_notes'
  ],
  
  // Niveles de auditoría
  auditLogLevel: 'INFO',                 // DEBUG, INFO, WARN, ERROR
  logAllDataAccess: true,
  logAllModifications: true,
  encryptAuditLogs: true,
  
  // Limpieza automática
  cleanupInterval: 3600000               // Cada 1 hora
});
```

### Middleware de Express

```javascript
// Middleware para registrar acceso a datos sensibles
app.use((req, res, next) => {
  // Determinar si la ruta accede a datos sensibles
  const isSensitiveRoute = [
    '/api/medical',
    '/api/payments',
    '/api/user/profile'
  ].some(route => req.path.includes(route));
  
  if (isSensitiveRoute) {
    complianceService.logAuditEvent({
      userId: req.user?.id,
      action: 'data_access',
      resource: req.path,
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'initiated'
    });
  }
  
  next();
});

// Middleware para registrar modificaciones
app.post('/api/user/:id', (req, res, next) => {
  complianceService.logAuditEvent({
    userId: req.user?.id,
    action: 'data_modification',
    resource: 'user_profile',
    resourceId: req.params.id,
    before: req.body.before,
    after: req.body.after,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  next();
});
```

### Flujo Completo: Solicitud de Acceso de Datos (GDPR Art. 15)

```javascript
// 1. Usuario solicita sus datos
POST /api/compliance/data-access-request
{
  userId: "user123"
}

// 2. Backend crea solicitud
const request = complianceService.processAccessRequest('user123', 'full');

// 3. Sistema recopila datos (O(n) donde n = registros)
// - Datos personales: nombre, email, teléfono
// - Registro de actividad: logins, descargas, cambios
// - Registros de consentimiento: marketing, analytics
// - Accesos de terceros: partners, integraciones

// 4. Generar respuesta
{
  requestId: "1705334400000-abc123",
  userId: "user123",
  status: "completed",
  data: {
    personalData: { ... },
    activityLog: [ ... ],
    consentRecords: [ ... ],
    thirdPartyShares: [ ... ]
  },
  metadata: {
    dataCategories: 4,
    totalRecords: 1247,
    processingPurposes: ["service_delivery", "analytics"],
    recipients: ["internal_systems", "cloud_storage"]
  },
  completedAt: 1705334400000,
  expiresAt: 1708013200000  // 30 días
}

// 5. Auditoría: Registrar que se procesó la solicitud
// Sistema automáticamente crea entrada de auditoría
```

### Flujo Completo: Solicitud de Eliminación (GDPR Art. 17)

```javascript
// 1. Usuario solicita eliminar sus datos
DELETE /api/compliance/user-data
{
  userId: "user123",
  reason: "user_request"
}

// 2. Backend valida solicitud
const deletion = await complianceService.deleteUserData('user123', 'user_request');

// 3. Sistema identifica datos para eliminar y excepciones
{
  deletedRecords: [
    { category: "personal_data", count: 5, deletedAt: 1705334400000 },
    { category: "activity_logs", count: 150, deletedAt: 1705334400000 }
  ],
  retentionExceptions: [
    { category: "audit_logs", reason: "Legal retention (7 years)" },
    { category: "tax_records", reason: "Tax compliance" }
  ]
}

// 4. Auditoría: Registrar eliminación
// Nota: audit_logs se retienen pero marcan "datos de usuario eliminados"
```

### Flujo Completo: Validación HIPAA

```javascript
// 1. Guardar registro médico
const medicalRecord = {
  patient_id: 'P123',
  record_date: '2024-01-15',
  provider_id: 'DR456',
  clinical_notes: 'Patient presents with flu-like symptoms',
  patientSocialSecurityNumber: await encrypt('123-45-6789'),
  medicalHistory: await encrypt('[Allergies, Previous surgeries...]'),
  auditTrail: [
    {
      action: 'created',
      userId: 'dr456',
      timestamp: Date.now(),
      ipAddress: '192.168.1.1'
    }
  ]
};

// 2. Validar cumplimiento
const validation = complianceService.validateHIPAACompliance(medicalRecord);

// 3. Respuesta
if (validation.compliant) {
  // Guardar registro
} else {
  // Rechazar: "Unencrypted SSN", "Missing audit trail", etc.
}

// 4. Cada acceso se registra
complianceService.logAuditEvent({
  userId: 'doctor123',
  action: 'medical_record_access',
  resource: 'medical_record',
  resourceId: 'P123-REC001',
  details: { diagnosis: 'viewed' }
});
```

---

## 6. Ejemplos de Uso

### Ejemplo 1: Aplicación de E-commerce (GDPR + CCPA)

```javascript
// Configurar cumplimiento
const complianceService = new ComplianceService({
  enableGDPR: true,
  enableCCPA: true,
  dataRetentionPeriod: 365
});

// Usuario se registra y acepta términos
app.post('/api/register', (req, res) => {
  const userId = 'user_' + Date.now();
  
  // Registrar consentimiento
  complianceService.recordConsent(
    userId,
    'marketing',
    'personal_data',
    req.body.marketingConsent,
    {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      consentMethod: 'explicit'
    }
  );
  
  complianceService.recordConsent(
    userId,
    'analytics',
    'personal_data',
    req.body.analyticsConsent,
    {
      ipAddress: req.ip,
      consentMethod: 'explicit'
    }
  );
  
  res.json({ userId, registered: true });
});

// Usuario compra producto
app.post('/api/purchase', (req, res) => {
  // Auditar acceso a datos financieros
  complianceService.logAuditEvent({
    userId: req.user.id,
    action: 'payment_processing',
    resource: 'payment_information',
    resourceId: req.body.orderId,
    ipAddress: req.ip
  });
  
  // Procesar pago...
});

// Usuario solicita datos (CCPA/GDPR Art. 15)
app.get('/api/compliance/my-data', (req, res) => {
  const accessRequest = complianceService.processAccessRequest(req.user.id);
  res.json(accessRequest);
});

// Usuario solicita eliminar datos (GDPR Art. 17 / CCPA)
app.delete('/api/compliance/my-data', async (req, res) => {
  const deletion = await complianceService.deleteUserData(req.user.id);
  res.json({ message: 'Data deletion initiated', ...deletion });
});
```

### Ejemplo 2: Plataforma Médica (HIPAA)

```javascript
const complianceService = new ComplianceService({
  enableHIPAA: true,
  enableGDPR: true,
  auditLogRetentionPeriod: 2555 // 7 años HIPAA
});

// Guardar registro médico
app.post('/api/medical-records', async (req, res) => {
  const medicalRecord = {
    patient_id: await encrypt(req.body.patientId),
    record_date: new Date().toISOString(),
    provider_id: await encrypt(req.user.id),
    clinical_notes: await encrypt(req.body.notes),
    patientSocialSecurityNumber: await encrypt(req.body.ssn),
    medicalHistory: await encrypt(req.body.history),
    auditTrail: [
      {
        action: 'created',
        userId: req.user.id,
        timestamp: Date.now(),
        ipAddress: req.ip
      }
    ]
  };
  
  // Validar HIPAA
  const validation = complianceService.validateHIPAACompliance(medicalRecord);
  
  if (!validation.compliant) {
    return res.status(400).json({
      error: 'HIPAA compliance failed',
      violations: validation.violations,
      missingFields: validation.missingFields
    });
  }
  
  // Guardar y registrar auditoría
  const savedRecord = await MedicalRecord.create(medicalRecord);
  
  complianceService.logAuditEvent({
    userId: req.user.id,
    action: 'medical_record_created',
    resource: 'medical_record',
    resourceId: savedRecord.id,
    details: { encrypted: true }
  });
  
  res.json(savedRecord);
});

// Generar reporte HIPAA para auditoría anual
app.get('/api/compliance/hipaa-report', (req, res) => {
  const report = complianceService.generateComplianceReport('HIPAA');
  res.json(report);
});
```

### Ejemplo 3: SaaS Enterprise (SOC2)

```javascript
const complianceService = new ComplianceService({
  enableSOC2: true,
  auditLogLevel: 'DEBUG',
  logAllDataAccess: true,
  logAllModifications: true,
  encryptAuditLogs: true
});

// Middleware: Auditar todos los cambios
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    complianceService.logAuditEvent({
      userId: req.user?.id,
      action: req.method === 'DELETE' ? 'resource_deleted' : 'resource_modified',
      resource: req.path,
      resourceId: req.params.id,
      before: req.body.before,
      after: req.body.after,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  next();
});

// Estado de cumplimiento para dashboard
app.get('/api/admin/compliance-status', (req, res) => {
  const status = complianceService.getComplianceStatus();
  res.json(status);
});

// Generar reporte SOC2 para auditor externo
app.get('/api/admin/soc2-report', (req, res) => {
  const report = complianceService.generateComplianceReport('SOC2');
  res.json(report);
});
```

---

## 7. Resolución de Problemas

### Problema 1: "¿Por qué se rechazó la solicitud de acceso GDPR?"

**Síntomas**:
- Usuario recibe error 400: "Access request failed"
- No recibe datos 30 días después

**Causas Potenciales**:
1. Usuario ID inválido o no encontrado
2. Datos corrompidos en alguna categoría
3. Permisos insuficientes en auditoría

**Solución**:
```javascript
// 1. Verificar que el usuario existe
const user = await User.findById(userId);
if (!user) {
  console.error('Usuario no encontrado:', userId);
  return;
}

// 2. Validar integridad de datos antes de recopilar
const auditLogs = Array.from(service.auditLogs.values())
  .filter(log => log.userId === userId);
  
if (!auditLogs.every(log => log.id && log.timestamp)) {
  console.error('Logs de auditoría corrompidos:', userId);
  return;
}

// 3. Procesar solicitud nuevamente
const request = complianceService.processAccessRequest(userId);
console.log('Solicitud procesada:', request.status);
```

### Problema 2: "¿Cómo manejo el incumplimiento HIPAA detectado?"

**Síntomas**:
- `validateHIPAACompliance()` retorna `compliant: false`
- Violaciones como "Unencrypted SSN" o "Missing audit trail"

**Causas**:
1. Datos médicos guardados sin encriptación
2. No se creó entrada de auditoría
3. Campos obligatorios faltantes

**Solución**:
```javascript
// 1. Asegurar encriptación
const patientData = {
  patient_id: await encryptionService.encrypt(id),
  patientSocialSecurityNumber: await encryptionService.encrypt(ssn),
  medicalHistory: await encryptionService.encrypt(history)
};

// 2. Siempre incluir auditoría
const medicalRecord = {
  ...patientData,
  auditTrail: [
    {
      action: 'created',
      userId: req.user.id,
      timestamp: Date.now(),
      ipAddress: req.ip
    }
  ]
};

// 3. Validar antes de guardar
const validation = complianceService.validateHIPAACompliance(medicalRecord);
if (!validation.compliant) {
  throw new Error('HIPAA validation failed: ' + validation.violations.join(', '));
}

// 4. Guardar y registrar auditoría
await MedicalRecord.create(medicalRecord);
```

### Problema 3: "¿Cómo evito multas GDPR por violaciones de datos?"

**Síntomas**:
- Brecha de seguridad detectada
- Necesita notificar a autoridades (GDPR Art. 33-34)
- Usuarios afectados requieren notificación

**Procedimiento de Respuesta a Incidentes**:

```javascript
// 1. Detectar brecha (automático o manual)
class SecurityIncidentHandler {
  async handleBreach(breachDetails) {
    const breach = {
      id: generateId(),
      detectedAt: Date.now(),
      affectedUsers: [],
      severity: 'high',
      type: 'unauthorized_access',
      ...breachDetails
    };
    
    // 2. Registrar inmediatamente
    complianceService.logAuditEvent({
      userId: 'system',
      action: 'security_breach_detected',
      resource: 'system_security',
      resourceId: breach.id,
      details: breachDetails,
      status: 'incident'
    });
    
    // 3. Notificar supervisores
    await notificationService.alertSecurityTeam(breach);
    
    // 4. Recopilar evidencia
    breach.affectedUsers = await this.getAffectedUsers(breachDetails);
    breach.affectedDataCategories = this.identifyAffectedData(breachDetails);
    
    // 5. Notificación GDPR (dentro de 72 horas)
    if (breach.affectedUsers.length > 0) {
      await this.notifyDataProtectionAuthority(breach);
      await this.notifyAffectedUsers(breach);
    }
    
    return breach;
  }
}
```

### Problema 4: "¿Cómo asegurar cumplimiento SOC2?"

**Checklist Pre-Auditoría**:

- [ ] Todos los cambios registrados en auditoría
- [ ] Logs de auditoría no modificables (append-only)
- [ ] Control de acceso basado en roles (RBAC)
- [ ] Incidentes documentados y respondidos
- [ ] Cumplimiento de retención de 7 años
- [ ] Encriptación en tránsito (TLS 1.2+)
- [ ] Encriptación en reposo para datos sensibles

```javascript
// Validar cumplimiento
const health = complianceService.getHealth();
const status = complianceService.getComplianceStatus();

const soc2Compliant = 
  health.compliance.soc2.status === 'compliant' &&
  status.soc2.auditLogsRetained > 0 &&
  status.soc2.accessControlsValidated;

if (soc2Compliant) {
  console.log('✓ SOC2 compliant');
} else {
  console.error('✗ SOC2 non-compliant - remediate before audit');
}
```

---

## 8. Checklist de Validación

### Pre-Producción

- [ ] Todos los marcos regulatorios habilitados según geografía
- [ ] Períodos de retención configurados según regulaciones
- [ ] Encriptación habilitada para audit logs
- [ ] HTTPS/TLS 1.2+ en todas las conexiones
- [ ] Controles de acceso basados en roles (RBAC) implementados
- [ ] Consentimiento registrado para todos los usuarios
- [ ] Logs de auditoría verificados (10+ entradas)
- [ ] Plan de respuesta a incidentes documentado
- [ ] Contacto DPO (Data Protection Officer) identificado

### Operaciones Continuas

- [ ] Auditoría de logs revisar semanalmente
- [ ] Reportes de cumplimiento generar mensualmente
- [ ] Solicitudes de acceso responder dentro de 30 días
- [ ] Solicitudes de eliminación procesar inmediatamente
- [ ] Incidentes documentar dentro de 24 horas
- [ ] Pruebas de retención ejecutar mensualmente
- [ ] Revisar consentimientos vencidos trimestralmente
- [ ] Validar encriptación de PHI continuamente

### Post-Incidente

- [ ] Brecha documentada dentro de 24 horas
- [ ] Usuarios notificados dentro de 72 horas (GDPR)
- [ ] Autoridades notificadas (si aplica)
- [ ] Root cause analysis completado
- [ ] Medidas correctivas implementadas
- [ ] Pruebas de remediación ejecutadas
- [ ] Auditoría retrospectiva completada

---

## 9. Soporte y Contacto

**Para Preguntas sobre Cumplimiento**:
- Email: compliance@empresa.com
- DPO: data-protection-officer@empresa.com
- Seguridad: security@empresa.com

**Recursos Externos**:
- GDPR Text: https://gdpr-info.eu/
- HIPAA Guidance: https://www.hhs.gov/hipaa/
- SOC2 Framework: https://www.aicpa.org/soc
- CCPA Law: https://oag.ca.gov/privacy/ccpa
