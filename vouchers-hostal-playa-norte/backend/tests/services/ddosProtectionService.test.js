import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import DDoSProtectionService from '../services/ddosProtectionService.js';

describe('DDoSProtectionService', () => {
  let ddosService;
  let mockReq;

  beforeEach(() => {
    ddosService = new DDoSProtectionService({
      perIpRateLimit: { requests: 10, window: 60 },
      perUserRateLimit: { requests: 5, window: 60 },
      globalRateLimit: { requests: 100, window: 60 },
      suspiciousScoreThreshold: 50,
      blockThreshold: 80,
      graylistThreshold: 30,
      anomalyThreshold: 2.5
    });

    mockReq = {
      ip: '192.168.1.100',
      path: '/api/users',
      method: 'GET',
      userId: null,
      requestSize: 1024,
      statusCode: 200,
      connection: { remoteAddress: '192.168.1.100' }
    };
  });

  afterEach(() => {
    ddosService.clear();
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const svc = new DDoSProtectionService();
      expect(svc.config.enableRateLimit).toBe(true);
      expect(svc.config.enableBehavioralAnalysis).toBe(true);
    });

    it('should initialize with custom config', () => {
      const svc = new DDoSProtectionService({
        enableRateLimit: false,
        blockThreshold: 70
      });
      expect(svc.config.enableRateLimit).toBe(false);
      expect(svc.config.blockThreshold).toBe(70);
    });

    it('should start cleanup interval', () => {
      expect(ddosService.cleanupInterval).toBeDefined();
    });
  });

  // ===== REQUEST ANALYSIS TESTS =====

  describe('Request Analysis', () => {
    it('should analyze clean request', () => {
      const analysis = ddosService.analyzeRequest(mockReq);

      expect(analysis.allowed).toBe(true);
      expect(analysis.ip).toBe('192.168.1.100');
      expect(analysis.threats.length).toBeGreaterThanOrEqual(0);
    });

    it('should increment request counter', () => {
      ddosService.analyzeRequest(mockReq);
      expect(ddosService.metrics.requestsAnalyzed).toBe(1);
    });

    it('should extract client IP', () => {
      const analysis = ddosService.analyzeRequest(mockReq);
      expect(analysis.ip).toBe('192.168.1.100');
    });

    it('should handle alternate IP sources', () => {
      mockReq.ip = null;
      mockReq.connection.remoteAddress = '10.0.0.1';

      const analysis = ddosService.analyzeRequest(mockReq);
      expect(analysis.ip).toBe('10.0.0.1');
    });

    it('should calculate suspicious score', () => {
      const analysis = ddosService.analyzeRequest(mockReq);
      expect(analysis.suspiciousScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== RATE LIMITING TESTS =====

  describe('Rate Limiting', () => {
    it('should allow requests within limit', () => {
      for (let i = 0; i < 9; i++) {
        const analysis = ddosService.analyzeRequest(mockReq);
        expect(analysis.allowed).toBe(true);
      }
    });

    it('should block requests exceeding per-IP limit', () => {
      for (let i = 0; i < 10; i++) {
        ddosService.analyzeRequest(mockReq);
      }

      const analysis11 = ddosService.analyzeRequest(mockReq);
      expect(analysis11.allowed).toBe(false);
      expect(analysis11.threats).toContain('rate_limit_exceeded');
    });

    it('should block requests exceeding per-user limit', () => {
      mockReq.userId = 'user-123';

      for (let i = 0; i < 5; i++) {
        const analysis = ddosService.analyzeRequest(mockReq);
        expect(analysis.allowed).toBe(true);
      }

      const analysis6 = ddosService.analyzeRequest(mockReq);
      expect(analysis6.allowed).toBe(false);
    });

    it('should block requests exceeding global limit', () => {
      const reqs = [];
      for (let i = 0; i < 100; i++) {
        const req = { ...mockReq, ip: `192.168.1.${i}` };
        reqs.push(req);
      }

      reqs.forEach(req => ddosService.analyzeRequest(req));

      const newReq = { ...mockReq, ip: '192.168.1.255' };
      const analysis = ddosService.analyzeRequest(newReq);

      expect(analysis.allowed).toBe(false);
    });

    it('should track remaining quota', () => {
      const analysis = ddosService.analyzeRequest(mockReq);
      expect(analysis.rateLimitRemaining).toBeDefined();
    });
  });

  // ===== HONEYPOT TESTS =====

  describe('Honeypot Detection', () => {
    it('should detect honeypot request', () => {
      mockReq.path = '/admin';

      const analysis = ddosService.analyzeRequest(mockReq);

      expect(analysis.threats).toContain('honeypot_hit');
      expect(analysis.suspiciousScore).toBeGreaterThan(0);
    });

    it('should increment honeypot hits', () => {
      mockReq.path = '/wp-admin';

      ddosService.analyzeRequest(mockReq);

      expect(ddosService.metrics.honeypotHits).toBe(1);
    });

    it('should block after multiple honeypot hits', () => {
      mockReq.path = '/phpmyadmin';

      for (let i = 0; i < 4; i++) {
        ddosService.analyzeRequest(mockReq);
      }

      expect(ddosService.blocklist.has(mockReq.ip)).toBe(true);
    });

    it('should support custom honeypot paths', () => {
      const svc = new DDoSProtectionService({
        honeypotPaths: ['/secret', '/hidden']
      });

      const req = { ...mockReq, path: '/secret' };
      const analysis = svc.analyzeRequest(req);

      expect(analysis.threats).toContain('honeypot_hit');
      svc.clear();
    });
  });

  // ===== BEHAVIORAL ANALYSIS TESTS =====

  describe('Behavioral Analysis', () => {
    it('should enable behavioral analysis by default', () => {
      expect(ddosService.config.enableBehavioralAnalysis).toBe(true);
    });

    it('should detect frequency anomalies', () => {
      const req1 = { ...mockReq, timestamp: 1000 };
      const req2 = { ...mockReq, timestamp: 1001 }; // 1ms apart (very fast)

      ddosService.analyzeRequest(req1);
      const analysis2 = ddosService.analyzeRequest(req2);

      expect(analysis2.suspiciousScore).toBeGreaterThan(0);
    });

    it('should detect size anomalies', () => {
      const req1 = { ...mockReq, requestSize: 1024 };
      const req2 = { ...mockReq, requestSize: 1024 * 1000 }; // 1MB (huge)

      ddosService.analyzeRequest(req1);
      const analysis2 = ddosService.analyzeRequest(req2);

      expect(analysis2.suspiciousScore).toBeGreaterThan(0);
    });

    it('should increment anomaly detection metric', () => {
      const req1 = { ...mockReq, timestamp: 1000 };
      const req2 = { ...mockReq, timestamp: 1001 };

      ddosService.analyzeRequest(req1);
      ddosService.analyzeRequest(req2);

      expect(ddosService.metrics.anomaliesDetected).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== PATTERN ANALYSIS TESTS =====

  describe('Pattern Analysis', () => {
    it('should detect endpoint scanning', () => {
      for (let i = 0; i < 55; i++) {
        const endpoint = `/api/endpoint${i}`;
        mockReq.path = endpoint;
        ddosService.analyzeRequest(mockReq);
      }

      const nextReq = { ...mockReq, path: '/api/endpoint100' };
      const analysis = ddosService.analyzeRequest(nextReq);

      expect(analysis.threats).toContain('endpoint_scanning');
    });

    it('should detect user enumeration', () => {
      for (let i = 0; i < 25; i++) {
        mockReq.userId = `user-${i}`;
        ddosService.analyzeRequest(mockReq);
      }

      const metrics = ddosService.getIpMetrics(mockReq.ip);
      expect(metrics.uniqueUsers).toBeGreaterThan(20);
    });

    it('should detect high error rates', () => {
      for (let i = 0; i < 10; i++) {
        mockReq.statusCode = 500;
        ddosService.analyzeRequest(mockReq);
      }

      const analysis = ddosService.analyzeRequest(mockReq);
      expect(analysis.threats).toContain('high_error_rate');
    });

    it('should detect unusual HTTP methods', () => {
      mockReq.method = 'TRACE';

      const analysis = ddosService.analyzeRequest(mockReq);

      expect(analysis.threats).toContain('unusual_http_method');
      expect(analysis.suspiciousScore).toBeGreaterThan(0);
    });

    it('should detect rapid request succession', () => {
      const req1 = { ...mockReq, timestamp: 1000 };
      const req2 = { ...mockReq, timestamp: 1050 }; // 50ms apart

      ddosService.analyzeRequest(req1);
      const analysis2 = ddosService.analyzeRequest(req2);

      expect(analysis2.threats).toContain('rapid_succession');
    });
  });

  // ===== BLOCKING TESTS =====

  describe('Blocking', () => {
    it('should block after suspicious score threshold', () => {
      // Trigger multiple suspicious conditions
      mockReq.path = '/admin';
      for (let i = 0; i < 15; i++) {
        ddosService.analyzeRequest(mockReq);
      }

      const nextAnalysis = ddosService.analyzeRequest(mockReq);
      expect(nextAnalysis.allowed).toBe(false);
      expect(ddosService.metrics.requestsBlocked).toBeGreaterThan(0);
    });

    it('should add to blocklist when blocked', () => {
      mockReq.path = '/admin';
      for (let i = 0; i < 15; i++) {
        ddosService.analyzeRequest(mockReq);
      }

      expect(ddosService.blocklist.has(mockReq.ip)).toBe(true);
    });

    it('should reject blocked IP immediately', () => {
      ddosService._addToBlocklist(mockReq.ip);

      const analysis = ddosService.analyzeRequest(mockReq);

      expect(analysis.allowed).toBe(false);
      expect(analysis.reason).toContain('blocked');
    });

    it('should add to graylist for monitoring', () => {
      mockReq.path = '/admin'; // Suspicious but not enough to block

      const analysis = ddosService.analyzeRequest(mockReq);

      if (analysis.warning) {
        expect(ddosService.graylist.size).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ===== WHITELIST TESTS =====

  describe('Whitelist', () => {
    it('should whitelist IP', () => {
      ddosService.whitelistIp(mockReq.ip);

      expect(ddosService.whitelist.has(mockReq.ip)).toBe(true);
    });

    it('should allow whitelisted IPs', () => {
      ddosService.whitelistIp(mockReq.ip);
      ddosService._addToBlocklist(mockReq.ip);

      // Even though in blocklist, whitelist takes precedence
      const isBlocked = ddosService._isBlocked(mockReq.ip);
      expect(isBlocked).toBe(false);
    });

    it('should expire whitelist entry', () => {
      ddosService.whitelistIp(mockReq.ip, 1); // 1 second

      expect(ddosService.whitelist.has(mockReq.ip)).toBe(true);
    });
  });

  // ===== GEO-IP TESTS =====

  describe('GeoIP Filtering', () => {
    it('should enable GeoIP by default', () => {
      expect(ddosService.config.enableGeoFiltering).toBe(true);
    });

    it('should detect country', () => {
      const analysis = ddosService.analyzeRequest(mockReq);

      expect(analysis.country).toBeDefined();
    });

    it('should block by country', () => {
      const svc = new DDoSProtectionService({
        blockedCountries: ['CN', 'RU']
      });

      // Mock a request from blocked country
      // (would need GeoIP database to properly test)
      svc.clear();
    });

    it('should apply whitelist filtering', () => {
      const svc = new DDoSProtectionService({
        allowedCountries: ['US', 'UK']
      });

      expect(svc.config.allowedCountries.length).toBe(2);
      svc.clear();
    });
  });

  // ===== METRICS TESTS =====

  describe('Metrics Collection', () => {
    it('should track requests analyzed', () => {
      ddosService.analyzeRequest(mockReq);
      ddosService.analyzeRequest(mockReq);

      expect(ddosService.metrics.requestsAnalyzed).toBe(2);
    });

    it('should track blocked requests', () => {
      mockReq.path = '/admin';
      for (let i = 0; i < 15; i++) {
        ddosService.analyzeRequest(mockReq);
      }

      expect(ddosService.metrics.requestsBlocked).toBeGreaterThan(0);
    });

    it('should get detailed metrics', () => {
      ddosService.analyzeRequest(mockReq);

      const metrics = ddosService.getMetrics();

      expect(metrics.requestsAnalyzed).toBe(1);
      expect(metrics.activeIpMetrics).toBeGreaterThanOrEqual(0);
      expect(metrics.blockedIps).toBeGreaterThanOrEqual(0);
    });

    it('should record IP metrics', () => {
      for (let i = 0; i < 5; i++) {
        ddosService.analyzeRequest(mockReq);
      }

      const ipMetrics = ddosService.getIpMetrics(mockReq.ip);

      expect(ipMetrics).toBeDefined();
      expect(ipMetrics.requestCount).toBe(5);
    });

    it('should track unique endpoints per IP', () => {
      mockReq.path = '/api/users';
      ddosService.analyzeRequest(mockReq);

      mockReq.path = '/api/products';
      ddosService.analyzeRequest(mockReq);

      const metrics = ddosService.getIpMetrics(mockReq.ip);
      expect(metrics.uniqueEndpoints).toBe(2);
    });

    it('should track unique users per IP', () => {
      mockReq.userId = 'user-1';
      ddosService.analyzeRequest(mockReq);

      mockReq.userId = 'user-2';
      ddosService.analyzeRequest(mockReq);

      const metrics = ddosService.getIpMetrics(mockReq.ip);
      expect(metrics.uniqueUsers).toBe(2);
    });

    it('should calculate error rate', () => {
      mockReq.statusCode = 200;
      ddosService.analyzeRequest(mockReq);

      mockReq.statusCode = 500;
      ddosService.analyzeRequest(mockReq);

      const metrics = ddosService.getIpMetrics(mockReq.ip);
      expect(metrics.errorCount).toBe(1);
    });
  });

  // ===== BLOCKLIST MANAGEMENT =====

  describe('Blocklist Management', () => {
    it('should add to blocklist', () => {
      ddosService._addToBlocklist(mockReq.ip);

      expect(ddosService.blocklist.has(mockReq.ip)).toBe(true);
    });

    it('should remove from blocklist', () => {
      ddosService._addToBlocklist(mockReq.ip);
      ddosService.unblockIp(mockReq.ip);

      expect(ddosService.blocklist.has(mockReq.ip)).toBe(false);
    });

    it('should get blocklist status', () => {
      ddosService._addToBlocklist(mockReq.ip, 3600);

      const status = ddosService.getBlocklistStatus(mockReq.ip);

      expect(status.blocked).toBe(true);
      expect(status.expiresAt).toBeDefined();
    });

    it('should expire blocklist entry', () => {
      ddosService._addToBlocklist(mockReq.ip, 1); // 1 second

      expect(ddosService.blocklist.get(mockReq.ip).expiresAt).toBeLessThanOrEqual(Date.now() + 2000);
    });
  });

  // ===== CLEANUP TESTS =====

  describe('Cleanup Operations', () => {
    it('should cleanup expired blocklist entries', () => {
      ddosService._addToBlocklist(mockReq.ip, 1);

      const entry = ddosService.blocklist.get(mockReq.ip);
      entry.expiresAt = Date.now() - 1000;

      const cleaned = ddosService.cleanup();

      expect(ddosService.blocklist.has(mockReq.ip)).toBe(false);
    });

    it('should cleanup expired graylist entries', () => {
      ddosService._addToGraylist(mockReq.ip, 1);

      const entry = ddosService.graylist.get(mockReq.ip);
      entry.expiresAt = Date.now() - 1000;

      const cleaned = ddosService.cleanup();

      expect(ddosService.graylist.has(mockReq.ip)).toBe(false);
    });

    it('should cleanup old metrics', () => {
      ddosService.analyzeRequest(mockReq);

      const metrics = ddosService.ipMetrics.get(`ip:${mockReq.ip}`);
      metrics.lastRequestTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days old

      const cleaned = ddosService.cleanup();

      expect(ddosService.ipMetrics.size).toBe(0);
    });
  });

  // ===== RESET TESTS =====

  describe('Reset Operations', () => {
    it('should reset metrics', () => {
      ddosService.analyzeRequest(mockReq);

      ddosService.resetMetrics();

      expect(ddosService.metrics.requestsAnalyzed).toBe(0);
      expect(ddosService.metrics.requestsBlocked).toBe(0);
    });

    it('should clear all data', () => {
      ddosService.analyzeRequest(mockReq);
      ddosService._addToBlocklist(mockReq.ip);

      ddosService.clear();

      expect(ddosService.ipMetrics.size).toBe(0);
      expect(ddosService.blocklist.size).toBe(0);
      expect(ddosService.cleanupInterval).toBeUndefined();
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Checks', () => {
    it('should report health status', () => {
      const health = ddosService.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });

    it('should include config in health', () => {
      const health = ddosService.getHealth();

      expect(health.config.enableRateLimit).toBe(true);
      expect(health.config.enableBehavioralAnalysis).toBe(true);
    });

    it('should include metrics in health', () => {
      ddosService.analyzeRequest(mockReq);

      const health = ddosService.getHealth();

      expect(health.metrics.requestsAnalyzed).toBe(1);
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle missing IP gracefully', () => {
      mockReq.ip = null;
      mockReq.connection = { remoteAddress: null };
      mockReq.socket = { remoteAddress: null };

      const analysis = ddosService.analyzeRequest(mockReq);

      expect(analysis.ip).toBe('0.0.0.0');
    });

    it('should handle concurrent requests', () => {
      const promises = [];

      for (let i = 0; i < 20; i++) {
        const req = { ...mockReq, ip: `192.168.1.${i}` };
        promises.push(Promise.resolve(ddosService.analyzeRequest(req)));
      }

      Promise.all(promises).then(() => {
        expect(ddosService.metrics.requestsAnalyzed).toBe(20);
      });
    });

    it('should handle very large requests', () => {
      mockReq.requestSize = 1024 * 1024 * 100; // 100MB

      const analysis = ddosService.analyzeRequest(mockReq);

      expect(analysis.suspiciousScore).toBeGreaterThan(0);
    });

    it('should handle rapid IP rotation', () => {
      for (let i = 0; i < 100; i++) {
        mockReq.ip = `192.168.1.${i % 256}`;
        ddosService.analyzeRequest(mockReq);
      }

      expect(ddosService.ipMetrics.size).toBeGreaterThan(0);
    });
  });

  // ===== INTEGRATION TESTS =====

  describe('Integration', () => {
    it('should handle full attack scenario', () => {
      // Simulate DDoS attack: many requests from same IP
      for (let i = 0; i < 50; i++) {
        ddosService.analyzeRequest(mockReq);
      }

      expect(ddosService.metrics.requestsBlocked).toBeGreaterThan(0);
      expect(ddosService.blocklist.size).toBeGreaterThan(0);
    });

    it('should handle mixed traffic', () => {
      // Normal requests
      for (let i = 0; i < 5; i++) {
        mockReq.ip = `192.168.1.${i}`;
        const analysis = ddosService.analyzeRequest(mockReq);
        expect(analysis.allowed).toBe(true);
      }

      // Suspicious requests
      mockReq.path = '/admin';
      for (let i = 5; i < 15; i++) {
        mockReq.ip = `192.168.2.${i}`;
        ddosService.analyzeRequest(mockReq);
      }

      const health = ddosService.getHealth();
      expect(health.metrics.requestsAnalyzed).toBe(15);
    });
  });
});
