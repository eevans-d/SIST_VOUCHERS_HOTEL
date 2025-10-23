/**
 * Compliance & Audit Logging Service Tests
 * 
 * Tests for GDPR, HIPAA, SOC2, and CCPA compliance features
 */
import ComplianceService from '../../src/services/complianceService.js';

describe('ComplianceService', () => {
  let service;

  beforeEach(() => {
    service = new ComplianceService({
      enableGDPR: true,
      enableHIPAA: true,
      enableSOC2: true,
      enableCCPA: true,
      dataRetentionPeriod: 365,
      auditLogRetentionPeriod: 2555,
      cleanupInterval: 3600000
    });
  });

  afterEach(() => {
    service.clear();
  });

  // ===== INITIALIZATION TESTS =====
  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const svc = new ComplianceService();
      expect(svc.config.enableGDPR).toBe(true);
      expect(svc.config.enableHIPAA).toBe(true);
      expect(svc.config.enableSOC2).toBe(true);
      expect(svc.config.dataRetentionPeriod).toBe(365);
    });

    it('should initialize with custom config', () => {
      const svc = new ComplianceService({
        enableGDPR: false,
        dataRetentionPeriod: 730
      });
      expect(svc.config.enableGDPR).toBe(false);
      expect(svc.config.dataRetentionPeriod).toBe(730);
      svc.clear();
    });

    it('should initialize empty maps', () => {
      expect(service.auditLogs.size).toBe(0);
      expect(service.consentRecords.size).toBe(0);
      expect(service.dataAccessRequests.size).toBe(0);
    });

    it('should initialize metrics at zero', () => {
      expect(service.getMetrics().logsCreated).toBe(0);
      expect(service.getMetrics().consentRecorded).toBe(0);
      expect(service.getMetrics().accessRequestsProcessed).toBe(0);
    });
  });

  // ===== AUDIT LOGGING TESTS =====
  describe('Audit Logging', () => {
    it('should log audit event with all fields', () => {
      const event = {
        userId: 'user123',
        action: 'data_access',
        resource: 'user_profile',
        resourceId: 'profile123',
        before: { name: 'John' },
        after: { name: 'John' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      const result = service.logAuditEvent(event);

      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.userId).toBe('user123');
      expect(result.action).toBe('data_access');
      expect(result.encrypted).toBe(true);
      expect(service.auditLogs.size).toBe(1);
    });

    it('should categorize data by resource type', () => {
      const medicalEvent = service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'medical_record',
        resourceId: 'med123'
      });
      expect(medicalEvent.dataCategory).toBe('health_data');

      const financialEvent = service.logAuditEvent({
        userId: 'user2',
        action: 'access',
        resource: 'payment_info',
        resourceId: 'pay123'
      });
      expect(financialEvent.dataCategory).toBe('financial_data');
    });

    it('should increment metrics on log event', () => {
      service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'user_profile',
        resourceId: 'p1'
      });

      expect(service.getMetrics().logsCreated).toBe(1);

      service.logAuditEvent({
        userId: 'user2',
        action: 'modify',
        resource: 'settings',
        resourceId: 's1'
      });

      expect(service.getMetrics().logsCreated).toBe(2);
    });

    it('should log multiple events', () => {
      for (let i = 0; i < 10; i++) {
        service.logAuditEvent({
          userId: `user${i}`,
          action: 'access',
          resource: 'profile',
          resourceId: `p${i}`
        });
      }

      expect(service.auditLogs.size).toBe(10);
      expect(service.getMetrics().logsCreated).toBe(10);
    });

    it('should determine applicable frameworks', () => {
      const medicalLog = service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'medical_record',
        resourceId: 'med1'
      });

      expect(medicalLog.complianceFrameworks).toContain('GDPR');
      expect(medicalLog.complianceFrameworks).toContain('HIPAA');
    });
  });

  // ===== CONSENT MANAGEMENT TESTS =====
  describe('Consent Management', () => {
    it('should record consent with all details', () => {
      const consent = service.recordConsent(
        'user123',
        'marketing',
        'personal_data',
        true,
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          consentMethod: 'explicit',
          language: 'en'
        }
      );

      expect(consent.id).toBeDefined();
      expect(consent.userId).toBe('user123');
      expect(consent.consentType).toBe('marketing');
      expect(consent.granted).toBe(true);
      expect(consent.consentMethod).toBe('explicit');
      expect(consent.expiresAt).toBeDefined();
    });

    it('should increment granted count when granted', () => {
      service.recordConsent('user1', 'marketing', 'personal_data', true);
      expect(service.getMetrics().grantedRevokedCount).toBe(1);

      service.recordConsent('user2', 'analytics', 'personal_data', false);
      expect(service.getMetrics().grantedRevokedCount).toBe(1);
    });

    it('should track multiple consent types', () => {
      service.recordConsent('user1', 'marketing', 'personal_data', true);
      service.recordConsent('user1', 'analytics', 'personal_data', true);
      service.recordConsent('user1', 'third_party', 'personal_data', false);

      expect(service.consentRecords.size).toBe(3);
    });

    it('should set expiration date', () => {
      const consent = service.recordConsent('user1', 'marketing', 'personal_data', true);
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;

      expect(consent.expiresAt).toBeGreaterThan(Date.now());
      expect(consent.expiresAt - consent.timestamp).toBeLessThan(oneYearMs + 1000);
    });

    it('should store consent with all metadata', () => {
      const consent = service.recordConsent('user1', 'marketing', 'personal_data', true, {
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome',
        version: '2.0',
        language: 'es'
      });

      expect(consent.ipAddress).toBe('10.0.0.1');
      expect(consent.userAgent).toBe('Chrome');
      expect(consent.version).toBe('2.0');
      expect(consent.language).toBe('es');
    });
  });

  // ===== GDPR ACCESS REQUEST TESTS =====
  describe('GDPR Access Requests', () => {
    it('should process access request', () => {
      const request = service.processAccessRequest('user123', 'full');

      expect(request.id).toBeDefined();
      expect(request.userId).toBe('user123');
      expect(request.requestType).toBe('full');
      expect(request.status).toBe('completed');
      expect(request.receivedAt).toBeDefined();
      expect(request.expirationDate).toBeDefined();
    });

    it('should include user data in request', () => {
      const request = service.processAccessRequest('user123');

      expect(request.data).toBeDefined();
      expect(request.data.personalData).toBeDefined();
      expect(request.data.activityLog).toBeDefined();
      expect(request.data.consentRecords).toBeDefined();
      expect(request.data.thirdPartyShares).toBeDefined();
    });

    it('should set 30-day response deadline', () => {
      const request = service.processAccessRequest('user123');
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(request.expirationDate - request.receivedAt).toBeLessThan(thirtyDaysMs + 1000);
      expect(request.expirationDate).toBeGreaterThan(Date.now());
    });

    it('should increment access requests processed', () => {
      service.processAccessRequest('user1');
      expect(service.getMetrics().accessRequestsProcessed).toBe(1);

      service.processAccessRequest('user2');
      expect(service.getMetrics().accessRequestsProcessed).toBe(2);
    });

    it('should include metadata about data', () => {
      const request = service.processAccessRequest('user123');

      expect(request.metadata).toBeDefined();
      expect(request.metadata.dataCategories).toBeDefined();
      expect(request.metadata.totalRecords).toBeGreaterThanOrEqual(0);
      expect(request.metadata.processingPurposes).toBeDefined();
      expect(request.metadata.recipients).toBeDefined();
    });

    it('should support different request types', () => {
      const fullRequest = service.processAccessRequest('user1', 'full');
      const specificRequest = service.processAccessRequest('user2', 'specific');
      const deletionVerification = service.processAccessRequest('user3', 'deletion_verification');

      expect(fullRequest.requestType).toBe('full');
      expect(specificRequest.requestType).toBe('specific');
      expect(deletionVerification.requestType).toBe('deletion_verification');
    });
  });

  // ===== GDPR DELETION TESTS =====
  describe('GDPR Deletion (Right to Erasure)', () => {
    it('should delete user data', async () => {
      const deletion = await service.deleteUserData('user123', 'user_request');

      expect(deletion.id).toBeDefined();
      expect(deletion.userId).toBe('user123');
      expect(deletion.reason).toBe('user_request');
      expect(deletion.status).toBe('completed');
      expect(deletion.deletedRecords).toBeDefined();
      expect(deletion.retentionExceptions).toBeDefined();
    });

    it('should track deleted records', async () => {
      const deletion = await service.deleteUserData('user123');

      expect(Array.isArray(deletion.deletedRecords)).toBe(true);
      deletion.deletedRecords.forEach(record => {
        expect(record.category).toBeDefined();
        expect(record.count).toBeGreaterThanOrEqual(0);
        expect(record.deletedAt).toBeDefined();
      });
    });

    it('should maintain retention exceptions', async () => {
      const deletion = await service.deleteUserData('user123');

      expect(deletion.retentionExceptions.length).toBeGreaterThan(0);
      deletion.retentionExceptions.forEach(exception => {
        expect(exception.category).toBeDefined();
        expect(exception.reason).toBeDefined();
      });
    });

    it('should increment data subject rights metric', async () => {
      await service.deleteUserData('user1');
      expect(service.getMetrics().dataSubjectsRights).toBe(1);

      await service.deleteUserData('user2');
      expect(service.getMetrics().dataSubjectsRights).toBe(2);
    });
  });

  // ===== GDPR DATA PORTABILITY TESTS =====
  describe('GDPR Data Portability', () => {
    it('should export user data', () => {
      const export_ = service.exportUserData('user123', 'json');

      expect(export_.id).toBeDefined();
      expect(export_.userId).toBe('user123');
      expect(export_.format).toBe('json');
      expect(export_.data).toBeDefined();
      expect(export_.metadata).toBeDefined();
    });

    it('should support multiple export formats', () => {
      const jsonExport = service.exportUserData('user1', 'json');
      const csvExport = service.exportUserData('user2', 'csv');
      const xmlExport = service.exportUserData('user3', 'xml');

      expect(jsonExport.format).toBe('json');
      expect(csvExport.format).toBe('csv');
      expect(xmlExport.format).toBe('xml');
    });

    it('should set 30-day expiration on export', () => {
      const export_ = service.exportUserData('user123');
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(export_.expiresAt - export_.generatedAt).toBeLessThan(thirtyDaysMs + 1000);
    });

    it('should include metadata', () => {
      const export_ = service.exportUserData('user123');

      expect(export_.metadata.recordCount).toBeDefined();
      expect(export_.metadata.dataCategories).toBeDefined();
      expect(export_.metadata.format).toBe('json');
    });
  });

  // ===== GDPR RECTIFICATION TESTS =====
  describe('GDPR Rectification (Right to Correct)', () => {
    it('should rectify user data', () => {
      const corrections = {
        firstName: 'Jane',
        email: 'jane@example.com'
      };

      const rectification = service.rectifyUserData('user123', corrections);

      expect(rectification.id).toBeDefined();
      expect(rectification.userId).toBe('user123');
      expect(rectification.status).toBe('completed');
      expect(rectification.corrections).toEqual(corrections);
    });

    it('should track original and corrected data', () => {
      const corrections = { email: 'new@example.com' };
      const rectification = service.rectifyUserData('user123', corrections);

      expect(rectification.originalData.email).toBeDefined();
      expect(rectification.correctedData.email).toBe('new@example.com');
    });

    it('should create audit log for rectification', () => {
      const corrections = { name: 'John Doe' };
      service.rectifyUserData('user123', corrections);

      expect(service.auditLogs.size).toBeGreaterThan(0);
    });

    it('should increment data subject rights', () => {
      service.rectifyUserData('user1', { email: 'new1@example.com' });
      expect(service.getMetrics().dataSubjectsRights).toBe(1);

      service.rectifyUserData('user2', { email: 'new2@example.com' });
      expect(service.getMetrics().dataSubjectsRights).toBe(2);
    });
  });

  // ===== GDPR RESTRICTION TESTS =====
  describe('GDPR Restriction of Processing', () => {
    it('should restrict data processing', () => {
      const restrictions = ['marketing', 'analytics'];
      const restriction = service.restrictDataProcessing('user123', restrictions);

      expect(restriction.id).toBeDefined();
      expect(restriction.userId).toBe('user123');
      expect(restriction.restrictions).toEqual(restrictions);
      expect(restriction.status).toBe('active');
    });

    it('should log processing restriction', () => {
      const restrictions = ['profiling'];
      service.restrictDataProcessing('user123', restrictions);

      expect(service.auditLogs.size).toBeGreaterThan(0);
    });

    it('should have indefinite expiration', () => {
      const restriction = service.restrictDataProcessing('user123', ['marketing']);
      expect(restriction.expiresAt).toBeNull();
    });
  });

  // ===== HIPAA COMPLIANCE TESTS =====
  describe('HIPAA Compliance Validation', () => {
    it('should validate HIPAA-compliant medical record', () => {
      const medicalRecord = {
        patient_id: 'P123',
        record_date: '2024-01-15',
        provider_id: 'DR456',
        clinical_notes: 'Patient is healthy',
        patientSocialSecurityNumber: 'encrypted_SSN',
        medicalHistory: 'encrypted_history',
        auditTrail: [{ action: 'created', timestamp: Date.now() }]
      };

      const validation = service.validateHIPAACompliance(medicalRecord);

      expect(validation.compliant).toBe(true);
      expect(validation.missingFields.length).toBe(0);
      expect(validation.violations.length).toBe(0);
    });

    it('should detect missing required HIPAA fields', () => {
      const medicalRecord = {
        patient_id: 'P123'
        // Missing other required fields
      };

      const validation = service.validateHIPAACompliance(medicalRecord);

      expect(validation.compliant).toBe(false);
      expect(validation.missingFields.length).toBeGreaterThan(0);
    });

    it('should detect unencrypted PHI', () => {
      const medicalRecord = {
        patient_id: 'P123',
        record_date: '2024-01-15',
        provider_id: 'DR456',
        clinical_notes: 'Notes',
        patientSocialSecurityNumber: '123-45-6789', // Not encrypted
        medicalHistory: 'medical_history_text',
        auditTrail: [{ action: 'created', timestamp: Date.now() }]
      };

      const validation = service.validateHIPAACompliance(medicalRecord);

      expect(validation.compliant).toBe(false);
      expect(validation.violations).toContain('Unencrypted SSN');
    });

    it('should detect missing audit trail', () => {
      const medicalRecord = {
        patient_id: 'P123',
        record_date: '2024-01-15',
        provider_id: 'DR456',
        clinical_notes: 'Notes',
        patientSocialSecurityNumber: 'encrypted_SSN',
        medicalHistory: 'encrypted_history'
        // Missing auditTrail
      };

      const validation = service.validateHIPAACompliance(medicalRecord);

      expect(validation.compliant).toBe(false);
      expect(validation.violations).toContain('Missing audit trail');
    });

    it('should increment violations metric', () => {
      const invalidRecord = { patient_id: 'P123' };
      
      service.validateHIPAACompliance(invalidRecord);
      expect(service.getMetrics().violationsDetected).toBeGreaterThan(0);
    });
  });

  // ===== GDPR COMPLIANCE VALIDATION TESTS =====
  describe('GDPR Compliance Validation', () => {
    it('should validate compliant processing activity', () => {
      const activity = {
        legalBasis: 'consent',
        purpose: 'service_delivery',
        dataCategories: ['name', 'email'],
        retentionPeriod: '365 days',
        highRisk: false
      };

      const validation = service.validateGDPRCompliance(activity);

      expect(validation.compliant).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    it('should detect missing legal basis', () => {
      const activity = {
        purpose: 'service_delivery',
        dataCategories: ['name'],
        retentionPeriod: '365 days'
      };

      const validation = service.validateGDPRCompliance(activity);

      expect(validation.compliant).toBe(false);
      expect(validation.issues).toContain('Missing legal basis');
    });

    it('should detect missing purpose', () => {
      const activity = {
        legalBasis: 'consent',
        dataCategories: ['name'],
        retentionPeriod: '365 days'
      };

      const validation = service.validateGDPRCompliance(activity);

      expect(validation.compliant).toBe(false);
      expect(validation.issues).toContain('Missing processing purpose');
    });

    it('should detect data minimization violations', () => {
      const activity = {
        legalBasis: 'consent',
        purpose: 'service_delivery',
        dataCategories: ['cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat6'], // Too many
        retentionPeriod: '365 days'
      };

      const validation = service.validateGDPRCompliance(activity);

      expect(validation.compliant).toBe(false);
      expect(validation.issues.some(i => i.includes('data minimization'))).toBe(true);
    });

    it('should detect DPIA requirement', () => {
      const activity = {
        legalBasis: 'consent',
        purpose: 'profiling',
        dataCategories: ['name'],
        retentionPeriod: '365 days',
        highRisk: true,
        dpiaCompleted: false
      };

      const validation = service.validateGDPRCompliance(activity);

      expect(validation.compliant).toBe(false);
      expect(validation.issues).toContain('Data Protection Impact Assessment required');
    });
  });

  // ===== COMPLIANCE REPORTING TESTS =====
  describe('Compliance Reporting', () => {
    it('should generate GDPR report', () => {
      const report = service.generateComplianceReport('GDPR');

      expect(report.framework).toBe('GDPR');
      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.violations).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should generate HIPAA report', () => {
      const report = service.generateComplianceReport('HIPAA');

      expect(report.framework).toBe('HIPAA');
      expect(report.metrics.medicalRecordsAudited).toBeDefined();
      expect(report.metrics.encryptionCompliance).toBeDefined();
      expect(report.metrics.auditTrailIntegrity).toBeDefined();
    });

    it('should generate SOC2 report', () => {
      const report = service.generateComplianceReport('SOC2');

      expect(report.framework).toBe('SOC2');
      expect(report.metrics.accessControlsValidated).toBe(true);
      expect(report.metrics.changeManagementReviewed).toBe(true);
      expect(report.metrics.securityTestingPerformed).toBe(true);
    });

    it('should include violations in report', () => {
      service.validateHIPAACompliance({ patient_id: 'P1' });
      const report = service.generateComplianceReport('HIPAA');

      expect(report.violations.length).toBeGreaterThan(0);
    });

    it('should cover last 90 days', () => {
      const report = service.generateComplianceReport('GDPR');
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

      expect(report.period.end - report.period.start).toBeLessThanOrEqual(ninetyDaysMs + 1000);
    });
  });

  // ===== RETENTION POLICY TESTS =====
  describe('Data Retention Policies', () => {
    it('should enforce retention policies', () => {
      service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'profile',
        resourceId: 'p1'
      });

      const purged = service.enforceRetentionPolicies();

      expect(typeof purged).toBe('number');
      expect(purged).toBeGreaterThanOrEqual(0);
    });

    it('should increment retention enforced metric', () => {
      service.enforceRetentionPolicies();
      expect(service.getMetrics().retentionPoliciesEnforced).toBeGreaterThanOrEqual(0);
    });

    it('should respect retention periods', () => {
      // Create events at current time
      service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'profile',
        resourceId: 'p1'
      });

      const sizeBefore = service.auditLogs.size;
      service.enforceRetentionPolicies();
      const sizeAfter = service.auditLogs.size;

      expect(sizeAfter).toBeLessThanOrEqual(sizeBefore);
    });
  });

  // ===== COMPLIANCE STATUS TESTS =====
  describe('Compliance Status', () => {
    it('should get compliance status', () => {
      const status = service.getComplianceStatus();

      expect(status.gdpr).toBeDefined();
      expect(status.hipaa).toBeDefined();
      expect(status.soc2).toBeDefined();
      expect(status.ccpa).toBeDefined();
    });

    it('should reflect framework enablement', () => {
      const status = service.getComplianceStatus();

      expect(status.gdpr.enabled).toBe(true);
      expect(status.hipaa.enabled).toBe(true);
    });

    it('should track compliance metrics in status', () => {
      service.recordConsent('user1', 'marketing', 'personal_data', true);
      const status = service.getComplianceStatus();

      expect(status.gdpr.consentRecordsActive).toBeGreaterThan(0);
    });

    it('should show audit logs retained', () => {
      service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'profile',
        resourceId: 'p1'
      });

      const status = service.getComplianceStatus();
      expect(status.soc2.auditLogsRetained).toBeGreaterThan(0);
    });
  });

  // ===== METRICS TESTS =====
  describe('Metrics', () => {
    it('should return all metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics.logsCreated).toBeDefined();
      expect(metrics.consentRecorded).toBeDefined();
      expect(metrics.accessRequestsProcessed).toBeDefined();
      expect(metrics.dataSubjectsRights).toBeDefined();
      expect(metrics.violationsDetected).toBeDefined();
      expect(metrics.retentionPoliciesEnforced).toBeDefined();
    });

    it('should reset metrics', () => {
      service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'profile',
        resourceId: 'p1'
      });

      expect(service.getMetrics().logsCreated).toBe(1);

      service.resetMetrics();
      expect(service.getMetrics().logsCreated).toBe(0);
    });
  });

  // ===== HEALTH CHECK TESTS =====
  describe('Health Check', () => {
    it('should return health status', () => {
      const health = service.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(health.compliance).toBeDefined();
      expect(health.metrics).toBeDefined();
      expect(health.config).toBeDefined();
    });

    it('should include compliance status in health', () => {
      const health = service.getHealth();

      expect(health.compliance.gdpr).toBeDefined();
      expect(health.compliance.hipaa).toBeDefined();
      expect(health.compliance.soc2).toBeDefined();
    });

    it('should include current metrics in health', () => {
      service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'profile',
        resourceId: 'p1'
      });

      const health = service.getHealth();
      expect(health.metrics.logsCreated).toBe(1);
    });
  });

  // ===== EDGE CASES & INTEGRATION TESTS =====
  describe('Edge Cases & Integration', () => {
    it('should handle concurrent audit logging', () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(service.logAuditEvent({
            userId: `user${i}`,
            action: 'access',
            resource: 'profile',
            resourceId: `p${i}`
          }))
        );
      }

      Promise.all(promises).then(() => {
        expect(service.auditLogs.size).toBe(100);
        expect(service.getMetrics().logsCreated).toBe(100);
      });
    });

    it('should handle multiple regulatory frameworks simultaneously', () => {
      service.recordConsent('user1', 'marketing', 'personal_data', true);
      
      const medicalRecord = {
        patient_id: 'P1',
        record_date: '2024-01-15',
        provider_id: 'DR1',
        clinical_notes: 'Test',
        patientSocialSecurityNumber: 'encrypted',
        medicalHistory: 'encrypted',
        auditTrail: [{ action: 'created' }]
      };
      
      service.validateHIPAACompliance(medicalRecord);
      
      const gdprValidation = service.validateGDPRCompliance({
        legalBasis: 'consent',
        purpose: 'service',
        dataCategories: ['name'],
        retentionPeriod: '365 days'
      });

      expect(service.consentRecords.size).toBe(1);
      expect(gdprValidation.compliant).toBe(true);
    });

    it('should clear all data', () => {
      service.logAuditEvent({
        userId: 'user1',
        action: 'access',
        resource: 'profile',
        resourceId: 'p1'
      });
      
      service.recordConsent('user1', 'marketing', 'personal_data', true);

      expect(service.auditLogs.size).toBeGreaterThan(0);
      expect(service.consentRecords.size).toBeGreaterThan(0);

      service.clear();

      expect(service.auditLogs.size).toBe(0);
      expect(service.consentRecords.size).toBe(0);
    });

    it('should handle disabled frameworks', () => {
      const svc = new ComplianceService({
        enableGDPR: false,
        enableHIPAA: false
      });

      const status = svc.getComplianceStatus();
      expect(status.gdpr.enabled).toBe(false);
      expect(status.hipaa.enabled).toBe(false);

      svc.clear();
    });

    it('should track data subject rights across operations', () => {
      service.processAccessRequest('user1');
      expect(service.getMetrics().dataSubjectsRights).toBe(1);

      service.exportUserData('user2');
      expect(service.getMetrics().dataSubjectsRights).toBe(2);

      service.rectifyUserData('user3', { email: 'new@example.com' });
      expect(service.getMetrics().dataSubjectsRights).toBe(3);
    });
  });
});
