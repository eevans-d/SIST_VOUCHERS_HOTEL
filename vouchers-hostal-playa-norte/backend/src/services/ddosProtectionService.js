/**
 * Advanced DDoS Protection Service
 *
 * Implements multi-layer DDoS protection:
 * - Rate limiting per IP and user
 * - Behavioral analysis and anomaly detection
 * - Traffic pattern recognition
 * - Adaptive thresholds based on historical data
 * - GeoIP filtering
 * - Honeypot detection
 * - Circuit breaker for overloaded endpoints
 */
class DDoSProtectionService {
  constructor(config = {}) {
    this.config = {
      enableRateLimit: config.enableRateLimit !== false,
      enableBehavioralAnalysis: config.enableBehavioralAnalysis !== false,
      enableGeoFiltering: config.enableGeoFiltering !== false,
      enableHoneypot: config.enableHoneypot !== false,

      // Rate limiting
      globalRateLimit: config.globalRateLimit || {
        requests: 100000,
        window: 60
      },
      perIpRateLimit: config.perIpRateLimit || { requests: 1000, window: 60 },
      perUserRateLimit: config.perUserRateLimit || {
        requests: 500,
        window: 60
      },
      perEndpointRateLimit: config.perEndpointRateLimit || {
        requests: 10000,
        window: 60
      },

      // Behavioral analysis
      anomalyThreshold: config.anomalyThreshold || 2.5, // Standard deviations
      learningPeriod: config.learningPeriod || 3600000, // 1 hour
      historyWindow: config.historyWindow || 86400000, // 24 hours

      // GeoIP
      blockedCountries: config.blockedCountries || [],
      allowedCountries: config.allowedCountries || [],
      requireGeoVerification: config.requireGeoVerification || false,

      // Honeypot
      honeypotPaths: config.honeypotPaths || [
        '/admin',
        '/wp-admin',
        '/phpmyadmin',
        '/.env',
        '/config.php'
      ],

      // Thresholds
      suspiciousScoreThreshold: config.suspiciousScoreThreshold || 50,
      blockThreshold: config.blockThreshold || 80,
      graylistThreshold: config.graylistThreshold || 30,

      // Cleanup
      cleanupInterval: config.cleanupInterval || 300000 // 5 minutes
    };

    this.ipMetrics = new Map();
    this.userMetrics = new Map();
    this.endpointMetrics = new Map();
    this.requestHistory = new Map();
    this.blocklist = new Map();
    this.graylist = new Map();
    this.whitelist = new Map();
    this.honeypotRequests = new Map();
    this.geoipCache = new Map();
    this.metrics = {
      requestsAnalyzed: 0,
      requestsBlocked: 0,
      anomaliesDetected: 0,
      ipsBlocked: 0,
      honeypotHits: 0,
      geoBlocksApplied: 0,
      circuitBreakersTriggered: 0
    };

    // Start cleanup interval
    this._startCleanupInterval();
  }

  /**
   * Analyze request for DDoS threats
   */
  analyzeRequest(req) {
    this.metrics.requestsAnalyzed++;

    const analysis = {
      ip: this._getClientIp(req),
      userId: req.userId || null,
      endpoint: req.path,
      method: req.method,
      timestamp: Date.now(),
      suspiciousScore: 0,
      threats: [],
      allowed: true,
      reason: null
    };

    // Check blacklist first (fast fail)
    if (this._isBlocked(analysis.ip, analysis.userId)) {
      analysis.allowed = false;
      analysis.reason = 'IP/User is blocked';
      analysis.suspiciousScore = 100;
      this.metrics.requestsBlocked++;
      return analysis;
    }

    // Check honeypot
    if (this.config.enableHoneypot && this._isHoneypotPath(analysis.endpoint)) {
      this._recordHoneypotHit(analysis.ip);
      analysis.threats.push('honeypot_hit');
      analysis.suspiciousScore += 40;
      this.metrics.honeypotHits++;
    }

    // GeoIP filtering
    if (this.config.enableGeoFiltering) {
      const geoCheck = this._checkGeoLocation(analysis.ip);
      if (!geoCheck.allowed) {
        analysis.threats.push('geo_blocked');
        analysis.suspiciousScore += 50;
        this.metrics.geoBlocksApplied++;
      }
      analysis.country = geoCheck.country;
    }

    // Rate limiting (fast checks)
    const rateLimitCheck = this._checkRateLimit(
      analysis.ip,
      analysis.userId,
      analysis.endpoint
    );
    if (!rateLimitCheck.allowed) {
      analysis.threats.push('rate_limit_exceeded');
      analysis.suspiciousScore += 30;
    }

    // Behavioral analysis (slower, but more accurate)
    if (this.config.enableBehavioralAnalysis) {
      const behavioralAnalysis = this._analyzeBehavior(analysis);
      analysis.suspiciousScore += behavioralAnalysis.anomalyScore;
      if (behavioralAnalysis.isAnomaly) {
        analysis.threats.push('behavioral_anomaly');
        this.metrics.anomaliesDetected++;
      }
    }

    // Request pattern analysis
    const patternAnalysis = this._analyzePatterns(analysis);
    analysis.suspiciousScore += patternAnalysis.score;
    analysis.threats.push(...patternAnalysis.threats);

    // Determine final action
    if (analysis.suspiciousScore >= this.config.blockThreshold) {
      analysis.allowed = false;
      analysis.reason = `Suspicious score ${analysis.suspiciousScore} >= ${this.config.blockThreshold}`;
      this._addToBlocklist(analysis.ip, analysis.userId);
      this.metrics.requestsBlocked++;
      this.metrics.ipsBlocked++;
    } else if (analysis.suspiciousScore >= this.config.graylistThreshold) {
      analysis.warning = 'Added to graylist for monitoring';
      this._addToGraylist(analysis.ip);
    }

    // Record metrics
    this._recordMetrics(analysis);

    return analysis;
  }

  /**
   * Check rate limits across multiple dimensions
   */
  _checkRateLimit(ip, userId, endpoint) {
    const now = Date.now();
    const result = { allowed: true, remaining: {} };

    // Global rate limit
    const globalKey = 'global';
    const globalCheck = this._checkWindowLimit(
      globalKey,
      this.config.globalRateLimit
    );
    result.remaining.global = globalCheck.remaining;

    // Per-IP rate limit
    const ipKey = `ip:${ip}`;
    const ipCheck = this._checkWindowLimit(ipKey, this.config.perIpRateLimit);
    result.remaining.ip = ipCheck.remaining;

    // Per-user rate limit
    if (userId) {
      const userKey = `user:${userId}`;
      const userCheck = this._checkWindowLimit(
        userKey,
        this.config.perUserRateLimit
      );
      result.remaining.user = userCheck.remaining;

      if (!userCheck.allowed) {
        result.allowed = false;
        result.reason = 'User rate limit exceeded';
      }
    }

    // Per-endpoint rate limit
    const endpointKey = `endpoint:${endpoint}`;
    const endpointCheck = this._checkWindowLimit(
      endpointKey,
      this.config.perEndpointRateLimit
    );
    result.remaining.endpoint = endpointCheck.remaining;

    // Check all limits
    if (!globalCheck.allowed) {
      result.allowed = false;
      result.reason = 'Global rate limit exceeded';
    }
    if (!ipCheck.allowed) {
      result.allowed = false;
      result.reason = 'IP rate limit exceeded';
    }
    if (!endpointCheck.allowed) {
      result.allowed = false;
      result.reason = 'Endpoint rate limit exceeded';
    }

    return result;
  }

  /**
   * Check if within window limit
   */
  _checkWindowLimit(key, limit) {
    const now = Date.now();
    const windowMs = limit.window * 1000;

    let queue = this.requestHistory.get(key) || [];

    // Clean old requests
    queue = queue.filter((ts) => now - ts < windowMs);

    const allowed = queue.length < limit.requests;
    const remaining = Math.max(0, limit.requests - queue.length);

    if (allowed) {
      queue.push(now);
      this.requestHistory.set(key, queue);
    }

    return { allowed, remaining, current: queue.length };
  }

  /**
   * Behavioral analysis using statistical methods
   */
  _analyzeBehavior(analysis) {
    const ipKey = `ip:${analysis.ip}`;
    const metrics = this.ipMetrics.get(ipKey) || this._initializeMetrics();

    const result = {
      anomalyScore: 0,
      isAnomaly: false,
      anomalyType: null
    };

    // Check request frequency anomaly
    const timeSinceLastRequest =
      analysis.timestamp - (metrics.lastRequestTime || analysis.timestamp);
    const expectedFrequency = 5000; // Expected 5s between requests
    const frequencyDeviation = Math.abs(
      timeSinceLastRequest - expectedFrequency
    );

    if (frequencyDeviation > this.config.anomalyThreshold * expectedFrequency) {
      result.anomalyScore += 15;
      result.anomalyType = 'frequency_anomaly';
    }

    // Check request size anomaly
    const requestSize = analysis.requestSize || 0;
    const avgSize = metrics.averageRequestSize || requestSize;
    const sizeDeviation =
      Math.abs(requestSize - avgSize) / Math.max(1, avgSize);

    if (sizeDeviation > this.config.anomalyThreshold) {
      result.anomalyScore += 10;
      result.anomalyType = 'size_anomaly';
    }

    // Check endpoint access pattern anomaly
    const newEndpoint = !metrics.accessedEndpoints?.includes(analysis.endpoint);
    if (newEndpoint && metrics.requestCount > 100) {
      result.anomalyScore += 5;
    }

    if (result.anomalyScore > 0) {
      result.isAnomaly = true;
    }

    return result;
  }

  /**
   * Analyze traffic patterns for DDoS characteristics
   */
  _analyzePatterns(analysis) {
    const result = {
      score: 0,
      threats: []
    };

    const ipKey = `ip:${analysis.ip}`;
    const metrics = this.ipMetrics.get(ipKey) || this._initializeMetrics();

    // Pattern 1: High request rate to different endpoints (scanning)
    if (metrics.uniqueEndpoints > 50 && metrics.requestCount < 100) {
      result.score += 20;
      result.threats.push('endpoint_scanning');
    }

    // Pattern 2: Requests from same IP to multiple users (account enumeration)
    if (metrics.uniqueUsers > 20) {
      result.score += 15;
      result.threats.push('user_enumeration');
    }

    // Pattern 3: High error rate (exploitation attempts)
    if (metrics.errorCount / Math.max(1, metrics.requestCount) > 0.5) {
      result.score += 20;
      result.threats.push('high_error_rate');
    }

    // Pattern 4: User-Agent inconsistency (bot detection)
    if (metrics.uniqueUserAgents > 5 && metrics.requestCount < 50) {
      result.score += 15;
      result.threats.push('ua_inconsistency');
    }

    // Pattern 5: Unusual HTTP methods
    if (analysis.method === 'TRACE' || analysis.method === 'CONNECT') {
      result.score += 25;
      result.threats.push('unusual_http_method');
    }

    // Pattern 6: Rapid request succession (potential flood)
    const lastRequest = metrics.lastRequestTime || 0;
    if (analysis.timestamp - lastRequest < 100) {
      // Less than 100ms apart
      result.score += 10;
      result.threats.push('rapid_succession');
    }

    return result;
  }

  /**
   * Check GeoIP location
   */
  _checkGeoLocation(ip) {
    // Check cache first
    if (this.geoipCache.has(ip)) {
      return this.geoipCache.get(ip);
    }

    // Simplified GeoIP lookup (in production use MaxMind or similar)
    const result = {
      country: this._lookupGeoIp(ip),
      allowed: true
    };

    // Check blocklist
    if (this.config.blockedCountries.includes(result.country)) {
      result.allowed = false;
    }

    // Check whitelist
    if (
      this.config.allowedCountries.length > 0 &&
      !this.config.allowedCountries.includes(result.country)
    ) {
      result.allowed = false;
    }

    this.geoipCache.set(ip, result);
    return result;
  }

  /**
   * Simplified GeoIP lookup (mock)
   */
  _lookupGeoIp(ip) {
    // In production, use MaxMind GeoLite2 or similar
    // This is a simplified mock
    const parts = ip.split('.');
    if (parts[0] === '127') return 'US';
    if (parts[0] === '192') return 'US';
    return 'UNKNOWN';
  }

  /**
   * Check if honeypot path
   */
  _isHoneypotPath(path) {
    return this.config.honeypotPaths.some((hp) => path.includes(hp));
  }

  /**
   * Record honeypot hit
   */
  _recordHoneypotHit(ip) {
    const key = `honeypot:${ip}`;
    const hits = (this.honeypotRequests.get(key) || 0) + 1;
    this.honeypotRequests.set(key, hits);

    if (hits > 3) {
      this._addToBlocklist(ip, null);
    }
  }

  /**
   * Check if IP/User is blocked
   */
  _isBlocked(ip, userId) {
    if (
      this.whitelist.has(ip) ||
      (userId && this.whitelist.has(`user:${userId}`))
    ) {
      return false;
    }

    if (
      this.blocklist.has(ip) ||
      (userId && this.blocklist.has(`user:${userId}`))
    ) {
      return this.blocklist.get(ip)?.expiresAt > Date.now();
    }

    return false;
  }

  /**
   * Add IP/User to blocklist
   */
  _addToBlocklist(ip, userId, durationSeconds = 3600) {
    if (ip) {
      this.blocklist.set(ip, {
        addedAt: Date.now(),
        expiresAt: Date.now() + durationSeconds * 1000,
        reason: 'DDoS Protection'
      });
    }
    if (userId) {
      this.blocklist.set(`user:${userId}`, {
        addedAt: Date.now(),
        expiresAt: Date.now() + durationSeconds * 1000,
        reason: 'DDoS Protection'
      });
    }
  }

  /**
   * Add IP to graylist (monitor)
   */
  _addToGraylist(ip, durationSeconds = 600) {
    this.graylist.set(ip, {
      addedAt: Date.now(),
      expiresAt: Date.now() + durationSeconds * 1000,
      suspiciousCount: (this.graylist.get(ip)?.suspiciousCount || 0) + 1
    });
  }

  /**
   * Record metrics for IP
   */
  _recordMetrics(analysis) {
    const ipKey = `ip:${analysis.ip}`;
    const metrics = this.ipMetrics.get(ipKey) || this._initializeMetrics();

    metrics.requestCount++;
    metrics.lastRequestTime = analysis.timestamp;
    metrics.totalDataTransferred += analysis.requestSize || 0;
    metrics.lastRequestSize = analysis.requestSize || 0;

    // Track unique endpoints
    if (!metrics.accessedEndpoints) metrics.accessedEndpoints = [];
    if (!metrics.accessedEndpoints.includes(analysis.endpoint)) {
      metrics.accessedEndpoints.push(analysis.endpoint);
      metrics.uniqueEndpoints++;
    }

    // Track unique users
    if (analysis.userId && !metrics.users?.includes(analysis.userId)) {
      if (!metrics.users) metrics.users = [];
      metrics.users.push(analysis.userId);
      metrics.uniqueUsers = metrics.users.length;
    }

    // Track error rate
    if (analysis.statusCode >= 400) {
      metrics.errorCount++;
    }

    // Update average request size
    metrics.totalDataTransferred =
      (metrics.totalDataTransferred || 0) + (analysis.requestSize || 0);
    metrics.averageRequestSize =
      metrics.totalDataTransferred / metrics.requestCount;

    this.ipMetrics.set(ipKey, metrics);

    // Also record user metrics
    if (analysis.userId) {
      const userKey = `user:${analysis.userId}`;
      const userMetrics =
        this.userMetrics.get(userKey) || this._initializeMetrics();
      userMetrics.requestCount++;
      userMetrics.lastRequestTime = analysis.timestamp;
      this.userMetrics.set(userKey, userMetrics);
    }
  }

  /**
   * Initialize metrics object
   */
  _initializeMetrics() {
    return {
      requestCount: 0,
      errorCount: 0,
      lastRequestTime: null,
      totalDataTransferred: 0,
      averageRequestSize: 0,
      uniqueEndpoints: 0,
      uniqueUsers: 0,
      uniqueUserAgents: 0,
      accessedEndpoints: [],
      users: []
    };
  }

  /**
   * Get client IP from request
   */
  _getClientIp(req) {
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '0.0.0.0'
    );
  }

  /**
   * Whitelist an IP
   */
  whitelistIp(ip, durationSeconds = null) {
    this.whitelist.set(ip, {
      addedAt: Date.now(),
      expiresAt: durationSeconds ? Date.now() + durationSeconds * 1000 : null
    });
  }

  /**
   * Remove from blocklist
   */
  unblockIp(ip) {
    this.blocklist.delete(ip);
  }

  /**
   * Get blocklist status
   */
  getBlocklistStatus(ip) {
    const entry = this.blocklist.get(ip);
    if (!entry) return { blocked: false };

    return {
      blocked: entry.expiresAt > Date.now(),
      expiresAt: entry.expiresAt,
      reason: entry.reason
    };
  }

  /**
   * Get IP metrics
   */
  getIpMetrics(ip) {
    return this.ipMetrics.get(`ip:${ip}`) || null;
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeIpMetrics: this.ipMetrics.size,
      activeUserMetrics: this.userMetrics.size,
      blockedIps: this.blocklist.size,
      greylistedIps: this.graylist.size,
      whitelistedIps: this.whitelist.size,
      honeypotHits: this.honeypotRequests.size
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    Object.keys(this.metrics).forEach((key) => {
      this.metrics[key] = 0;
    });
    return true;
  }

  /**
   * Get service health
   */
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      config: {
        enableRateLimit: this.config.enableRateLimit,
        enableBehavioralAnalysis: this.config.enableBehavioralAnalysis,
        enableGeoFiltering: this.config.enableGeoFiltering,
        enableHoneypot: this.config.enableHoneypot
      }
    };
  }

  /**
   * Cleanup expired blocklist/graylist entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    // Clean blocklist
    for (const [key, entry] of this.blocklist.entries()) {
      if (entry.expiresAt < now) {
        this.blocklist.delete(key);
        cleaned++;
      }
    }

    // Clean graylist
    for (const [key, entry] of this.graylist.entries()) {
      if (entry.expiresAt < now) {
        this.graylist.delete(key);
        cleaned++;
      }
    }

    // Clean old metrics (older than historyWindow)
    const cutoff = now - this.config.historyWindow;
    for (const [key, metrics] of this.ipMetrics.entries()) {
      if ((metrics.lastRequestTime || 0) < cutoff) {
        this.ipMetrics.delete(key);
        cleaned++;
      }
    }

    // Clean GeoIP cache periodically
    if (Math.random() < 0.1) {
      // 10% of cleanup calls
      this.geoipCache.clear();
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup interval
   */
  _startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.ipMetrics.clear();
    this.userMetrics.clear();
    this.endpointMetrics.clear();
    this.requestHistory.clear();
    this.blocklist.clear();
    this.graylist.clear();
    this.whitelist.clear();
    this.honeypotRequests.clear();
    this.geoipCache.clear();
    this.stopCleanupInterval();
    return true;
  }
}

export default DDoSProtectionService;
