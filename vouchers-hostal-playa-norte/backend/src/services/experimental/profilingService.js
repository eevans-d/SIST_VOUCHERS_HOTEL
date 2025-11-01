/**
 * Performance Profiling Service
 * CPU, Memory, I/O profiling and bottleneck detection
 * Issues: #24 → #25 → #26 (Logging → Anomaly → Profiling)
 *
 * Pattern: Comprehensive performance analysis
 * Features:
 *  - CPU profiling
 *  - Memory usage tracking
 *  - I/O operation monitoring
 *  - Bottleneck detection
 *  - Flame graph generation
 *  - Performance metrics export
 */

import { performance, PerformanceObserver } from 'perf_hooks';

export default class ProfilingService {
  constructor(config = {}) {
    this.config = {
      enableCpuProfiling: config.enableCpuProfiling !== false,
      enableMemoryProfiling: config.enableMemoryProfiling !== false,
      enableIoProfiling: config.enableIoProfiling !== false,
      sampleInterval: config.sampleInterval || 100, // ms
      retentionSeconds: config.retentionSeconds || 3600, // 1 hour
      bottleneckThreshold: config.bottleneckThreshold || 100, // ms
      ...config
    };

    // Storage
    this.cpuSamples = [];
    this.memorySamples = [];
    this.ioOperations = [];
    this.functionTimings = new Map();
    this.marks = new Map();
    this.bottlenecks = [];

    // Performance tracking
    this.startTime = Date.now();
    this.totalOperations = 0;

    // Initialize observers
    this._initializeObservers();
  }

  /**
   * Initialize performance observers
   * @private
   */
  _initializeObservers() {
    if (!this.config.enableCpuProfiling && !this.config.enableMemoryProfiling) {
      return;
    }

    // Memory sampling
    if (this.config.enableMemoryProfiling) {
      this._startMemorySampling();
    }
  }

  /**
   * Start memory sampling
   * @private
   */
  _startMemorySampling() {
    this.memoryInterval = setInterval(() => {
      const memory = process.memoryUsage();
      this.memorySamples.push({
        timestamp: Date.now(),
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss
      });

      // Cleanup old samples
      this._cleanupMemorySamples();
    }, this.config.sampleInterval);
  }

  /**
   * Cleanup old memory samples
   * @private
   */
  _cleanupMemorySamples() {
    const cutoffTime = Date.now() - this.config.retentionSeconds * 1000;
    this.memorySamples = this.memorySamples.filter(
      (s) => s.timestamp > cutoffTime
    );
  }

  /**
   * Mark the start of an operation
   * @param {string} label - Operation identifier
   */
  markStart(label) {
    performance.mark(`${label}-start`);
    this.marks.set(`${label}-start`, Date.now());
  }

  /**
   * Mark the end of an operation and measure
   * @param {string} label - Operation identifier
   * @returns {object} Timing information
   */
  markEnd(label) {
    performance.mark(`${label}-end`);
    const endTime = Date.now();

    try {
      performance.measure(label, `${label}-start`, `${label}-end`);
      const measure = performance.getEntriesByName(label)[0];
      const duration = measure.duration;

      const timing = {
        label,
        duration,
        startTime: this.marks.get(`${label}-start`),
        endTime,
        timestamp: Date.now()
      };

      this._recordFunctionTiming(label, duration);
      this._checkBottleneck(label, duration);
      this.totalOperations++;

      return timing;
    } catch (error) {
      return { label, error: error.message };
    }
  }

  /**
   * Record function timing
   * @private
   */
  _recordFunctionTiming(label, duration) {
    if (!this.functionTimings.has(label)) {
      this.functionTimings.set(label, {
        label,
        callCount: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        averageTime: 0,
        lastCalled: Date.now(),
        timings: []
      });
    }

    const stats = this.functionTimings.get(label);
    stats.callCount++;
    stats.totalTime += duration;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.averageTime = stats.totalTime / stats.callCount;
    stats.lastCalled = Date.now();
    stats.timings.push(duration);

    // Keep last 1000 timings
    if (stats.timings.length > 1000) {
      stats.timings.shift();
    }
  }

  /**
   * Check if operation is a bottleneck
   * @private
   */
  _checkBottleneck(label, duration) {
    if (duration > this.config.bottleneckThreshold) {
      this.bottlenecks.push({
        label,
        duration,
        timestamp: Date.now(),
        severity: this._calculateSeverity(duration)
      });

      // Keep last 1000 bottlenecks
      if (this.bottlenecks.length > 1000) {
        this.bottlenecks.shift();
      }
    }
  }

  /**
   * Calculate severity of bottleneck
   * @private
   */
  _calculateSeverity(duration) {
    const threshold = this.config.bottleneckThreshold;
    if (duration > threshold * 5) return 'critical';
    if (duration > threshold * 3) return 'high';
    if (duration > threshold * 1.5) return 'medium';
    return 'low';
  }

  /**
   * Measure async operation
   * @param {string} label - Operation identifier
   * @param {function} fn - Async function to measure
   * @returns {Promise} Result of the function
   */
  async measureAsync(label, fn) {
    this.markStart(label);
    try {
      const result = await fn();
      this.markEnd(label);
      return result;
    } catch (error) {
      this.markEnd(label);
      throw error;
    }
  }

  /**
   * Measure sync operation
   * @param {string} label - Operation identifier
   * @param {function} fn - Sync function to measure
   * @returns {*} Result of the function
   */
  measureSync(label, fn) {
    this.markStart(label);
    try {
      const result = fn();
      this.markEnd(label);
      return result;
    } catch (error) {
      this.markEnd(label);
      throw error;
    }
  }

  /**
   * Get function timing statistics
   * @param {string} label - Function label (optional)
   * @returns {object|array} Timing statistics
   */
  getFunctionTimings(label = null) {
    if (label) {
      return this.functionTimings.get(label) || null;
    }

    return Array.from(this.functionTimings.values()).sort(
      (a, b) => b.totalTime - a.totalTime
    );
  }

  /**
   * Get top N slowest functions
   * @param {number} n - Number of functions to return
   * @returns {array} Top N functions by average time
   */
  getTopSlowestFunctions(n = 10) {
    return Array.from(this.functionTimings.values())
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, n);
  }

  /**
   * Get memory statistics
   * @returns {object} Memory usage statistics
   */
  getMemoryStats() {
    if (this.memorySamples.length === 0) {
      return null;
    }

    const samples = this.memorySamples;
    const heapUsedValues = samples.map((s) => s.heapUsed);
    const heapTotalValues = samples.map((s) => s.heapTotal);
    const rssValues = samples.map((s) => s.rss);

    const calculateStats = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length;
      const stddev = Math.sqrt(variance);

      return {
        current: values[values.length - 1],
        min: sorted[0],
        max: sorted[sorted.length - 1],
        average: mean,
        stddev,
        samples: values.length
      };
    };

    return {
      timestamp: Date.now(),
      heapUsed: calculateStats(heapUsedValues),
      heapTotal: calculateStats(heapTotalValues),
      rss: calculateStats(rssValues),
      currentProcess: process.memoryUsage()
    };
  }

  /**
   * Get memory trend
   * @returns {object} Memory trend over time
   */
  getMemoryTrend() {
    if (this.memorySamples.length < 2) {
      return null;
    }

    const samples = this.memorySamples;
    const firstHeapUsed = samples[0].heapUsed;
    const lastHeapUsed = samples[samples.length - 1].heapUsed;
    const changePercent =
      ((lastHeapUsed - firstHeapUsed) / firstHeapUsed) * 100;

    return {
      startHeap: firstHeapUsed,
      endHeap: lastHeapUsed,
      changeBytes: lastHeapUsed - firstHeapUsed,
      changePercent: changePercent.toFixed(2),
      trend: lastHeapUsed > firstHeapUsed ? 'increasing' : 'decreasing',
      samples: samples.length,
      timeSpan: samples[samples.length - 1].timestamp - samples[0].timestamp
    };
  }

  /**
   * Detect memory leak pattern
   * @returns {object|null} Memory leak indicators
   */
  detectMemoryLeak() {
    if (this.memorySamples.length < 10) {
      return null;
    }

    const samples = this.memorySamples;
    const trend = this.getMemoryTrend();

    if (!trend || trend.trend !== 'increasing') {
      return null;
    }

    // Check if consistently increasing
    let increasing = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].heapUsed > samples[i - 1].heapUsed) {
        increasing++;
      }
    }

    const consistencyPercent = (increasing / (samples.length - 1)) * 100;

    if (consistencyPercent > 70) {
      return {
        probability: 'high',
        changePercent: trend.changePercent,
        consistencyPercent: consistencyPercent.toFixed(2),
        totalChange: trend.changeBytes,
        samples: samples.length,
        timeSpan: trend.timeSpan
      };
    }

    return null;
  }

  /**
   * Get I/O operation statistics
   * @returns {object} I/O statistics
   */
  getIoStats() {
    if (this.ioOperations.length === 0) {
      return null;
    }

    const operations = this.ioOperations;
    const byType = {};

    operations.forEach((op) => {
      if (!byType[op.type]) {
        byType[op.type] = {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0
        };
      }
      byType[op.type].count++;
      byType[op.type].totalTime += op.duration;
      byType[op.type].minTime = Math.min(byType[op.type].minTime, op.duration);
      byType[op.type].maxTime = Math.max(byType[op.type].maxTime, op.duration);
      byType[op.type].avgTime =
        byType[op.type].totalTime / byType[op.type].count;
    });

    return {
      totalOperations: operations.length,
      byType,
      timestamp: Date.now()
    };
  }

  /**
   * Record I/O operation
   * @param {string} type - Operation type (read, write, etc)
   * @param {string} resource - Resource name
   * @param {number} duration - Duration in ms
   */
  recordIoOperation(type, resource, duration) {
    this.ioOperations.push({
      type,
      resource,
      duration,
      timestamp: Date.now()
    });

    // Keep last 10000 operations
    if (this.ioOperations.length > 10000) {
      this.ioOperations.shift();
    }
  }

  /**
   * Get bottlenecks
   * @param {string} severity - Filter by severity (optional)
   * @returns {array} Bottleneck operations
   */
  getBottlenecks(severity = null) {
    if (severity) {
      return this.bottlenecks
        .filter((b) => b.severity === severity)
        .sort((a, b) => b.duration - a.duration);
    }

    return this.bottlenecks.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get performance summary
   * @returns {object} Overall performance summary
   */
  getPerformanceSummary() {
    const timings = Array.from(this.functionTimings.values());
    const totalTime = timings.reduce((sum, t) => sum + t.totalTime, 0);
    const avgTime = timings.length > 0 ? totalTime / this.totalOperations : 0;

    return {
      uptime: Date.now() - this.startTime,
      totalOperations: this.totalOperations,
      totalBottlenecks: this.bottlenecks.length,
      avgOperationTime: avgTime,
      totalTime,
      functionsTracked: timings.length,
      topFunction: timings[0] || null,
      memory: this.getMemoryStats(),
      ioStats: this.getIoStats(),
      timestamp: Date.now()
    };
  }

  /**
   * Generate flame graph data
   * @returns {object} Flame graph structure
   */
  generateFlameGraphData() {
    const timings = Array.from(this.functionTimings.values())
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 50);

    const totalTime = timings.reduce((sum, t) => sum + t.totalTime, 0);

    return {
      name: 'root',
      value: totalTime,
      children: timings.map((t) => ({
        name: t.label,
        value: t.totalTime,
        percentage: ((t.totalTime / totalTime) * 100).toFixed(2),
        callCount: t.callCount,
        avgTime: t.averageTime
      }))
    };
  }

  /**
   * Generate CPU profiling report
   * @returns {object} CPU profiling data
   */
  generateCpuReport() {
    const timings = this.getTopSlowestFunctions(20);
    const summary = this.getPerformanceSummary();

    return {
      title: 'CPU Profiling Report',
      timestamp: new Date().toISOString(),
      duration: summary.uptime,
      summary: {
        totalOperations: summary.totalOperations,
        totalTime: summary.totalTime,
        averageTime: summary.avgOperationTime
      },
      topFunctions: timings.map((t) => ({
        name: t.label,
        callCount: t.callCount,
        totalTime: t.totalTime.toFixed(2),
        averageTime: t.averageTime.toFixed(2),
        minTime: t.minTime.toFixed(2),
        maxTime: t.maxTime.toFixed(2),
        percentage: ((t.totalTime / summary.totalTime) * 100).toFixed(2)
      })),
      bottlenecks: this.getBottlenecks('critical').slice(0, 10)
    };
  }

  /**
   * Generate memory profiling report
   * @returns {object} Memory profiling data
   */
  generateMemoryReport() {
    const memoryStats = this.getMemoryStats();
    const memoryTrend = this.getMemoryTrend();
    const memoryLeak = this.detectMemoryLeak();

    return {
      title: 'Memory Profiling Report',
      timestamp: new Date().toISOString(),
      current: {
        heapUsedMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
      },
      statistics: memoryStats,
      trend: memoryTrend,
      possibleLeak: memoryLeak
    };
  }

  /**
   * Clear all profiling data
   */
  clear() {
    this.cpuSamples = [];
    this.memorySamples = [];
    this.ioOperations = [];
    this.functionTimings.clear();
    this.bottlenecks = [];
    this.marks.clear();
    this.totalOperations = 0;
    this.startTime = Date.now();
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
      operationsTracked: this.totalOperations,
      functionsMonitored: this.functionTimings.size,
      bottlenecksDetected: this.bottlenecks.length,
      memorySamplesCollected: this.memorySamples.length,
      ioOperationsRecorded: this.ioOperations.length,
      timestamp: Date.now()
    };
  }

  /**
   * Destructor - cleanup intervals
   */
  destroy() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
  }
}
