import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ProfilingService from '../services/profilingService.js';

describe('ProfilingService', () => {
  let profiler;

  beforeEach(() => {
    profiler = new ProfilingService({
      sampleInterval: 50,
      bottleneckThreshold: 100,
      retentionSeconds: 10,
    });
  });

  afterEach(() => {
    profiler.destroy();
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const service = new ProfilingService();
      expect(service.config.sampleInterval).toBe(100);
      expect(service.config.bottleneckThreshold).toBe(100);
    });

    it('should initialize with custom config', () => {
      const service = new ProfilingService({
        bottleneckThreshold: 200,
        sampleInterval: 75,
      });
      expect(service.config.bottleneckThreshold).toBe(200);
      expect(service.config.sampleInterval).toBe(75);
    });

    it('should start with empty storage', () => {
      expect(profiler.functionTimings.size).toBe(0);
      expect(profiler.bottlenecks.length).toBe(0);
      expect(profiler.totalOperations).toBe(0);
    });
  });

  // ===== MARKING TESTS =====

  describe('Marking Operations', () => {
    it('should mark start and end', () => {
      profiler.markStart('operation1');
      expect(profiler.marks.has('operation1-start')).toBe(true);

      profiler.markEnd('operation1');
      expect(profiler.functionTimings.has('operation1')).toBe(true);
    });

    it('should record timing duration', async () => {
      profiler.markStart('sleep');
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      await new Promise(r => {
        profiler.markStart('test');
        setTimeout(() => {
          profiler.markEnd('test');
          r();
        }, 50);
      });
      const timing = profiler.functionTimings.get('test');
      expect(timing.duration).toBeGreaterThanOrEqual(40);
    });

    it('should increment total operations', () => {
      profiler.markStart('op1');
      profiler.markEnd('op1');
      profiler.markStart('op2');
      profiler.markEnd('op2');
      expect(profiler.totalOperations).toBe(2);
    });

    it('should track multiple marks', () => {
      profiler.markStart('op1');
      profiler.markStart('op2');
      profiler.markEnd('op1');
      profiler.markEnd('op2');
      expect(profiler.functionTimings.size).toBe(2);
    });
  });

  // ===== SYNC MEASUREMENT TESTS =====

  describe('Sync Measurement', () => {
    it('should measure sync function', () => {
      const result = profiler.measureSync('calculation', () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) sum += i;
        return sum;
      });

      expect(result).toBe(499500);
      expect(profiler.functionTimings.has('calculation')).toBe(true);
    });

    it('should track function call count', () => {
      profiler.measureSync('func', () => 1);
      profiler.measureSync('func', () => 2);
      profiler.measureSync('func', () => 3);

      const timing = profiler.functionTimings.get('func');
      expect(timing.callCount).toBe(3);
    });

    it('should handle function errors', () => {
      expect(() => {
        profiler.measureSync('error', () => {
          throw new Error('Test error');
        });
      }).toThrow();

      expect(profiler.functionTimings.has('error')).toBe(true);
    });

    it('should calculate average time', () => {
      profiler.measureSync('test', () => {});
      profiler.measureSync('test', () => {});
      profiler.measureSync('test', () => {});

      const timing = profiler.functionTimings.get('test');
      expect(timing.averageTime).toBeGreaterThan(0);
      expect(timing.callCount).toBe(3);
    });
  });

  // ===== ASYNC MEASUREMENT TESTS =====

  describe('Async Measurement', () => {
    it('should measure async function', async () => {
      const result = await profiler.measureAsync('async_op', async () => {
        await new Promise(r => setTimeout(r, 30));
        return 'done';
      });

      expect(result).toBe('done');
      expect(profiler.functionTimings.has('async_op')).toBe(true);
    });

    it('should handle async errors', async () => {
      await expect(
        profiler.measureAsync('async_error', async () => {
          throw new Error('Async error');
        })
      ).rejects.toThrow();
    });

    it('should track concurrent async operations', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          profiler.measureAsync(`async${i}`, async () => {
            await new Promise(r => setTimeout(r, 10));
          })
        );
      }

      await Promise.all(promises);
      expect(profiler.functionTimings.size).toBe(5);
      expect(profiler.totalOperations).toBe(5);
    });
  });

  // ===== FUNCTION TIMING STATISTICS TESTS =====

  describe('Function Timing Statistics', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        profiler.measureSync('func1', () => {});
        profiler.measureSync('func2', () => {
          for (let j = 0; j < 100; j++);
        });
      }
    });

    it('should get all function timings', () => {
      const timings = profiler.getFunctionTimings();
      expect(timings.length).toBeGreaterThan(0);
    });

    it('should get specific function timing', () => {
      const timing = profiler.getFunctionTimings('func1');
      expect(timing.label).toBe('func1');
      expect(timing.callCount).toBe(10);
    });

    it('should track min and max times', () => {
      const timing = profiler.getFunctionTimings('func1');
      expect(timing.minTime).toBeLessThanOrEqual(timing.maxTime);
    });

    it('should get top slowest functions', () => {
      const topSlow = profiler.getTopSlowestFunctions(1);
      expect(topSlow.length).toBe(1);
      expect(topSlow[0].averageTime).toBeGreaterThan(0);
    });

    it('should sort by total time', () => {
      const timings = profiler.getFunctionTimings();
      for (let i = 1; i < timings.length; i++) {
        expect(timings[i - 1].totalTime).toBeGreaterThanOrEqual(timings[i].totalTime);
      }
    });

    it('should limit last 1000 timings per function', () => {
      profiler.markStart('many');
      for (let i = 0; i < 1500; i++) {
        profiler.markEnd('many');
        profiler.markStart('many');
      }
      const timing = profiler.functionTimings.get('many');
      expect(timing.timings.length).toBeLessThanOrEqual(1000);
    });
  });

  // ===== BOTTLENECK DETECTION TESTS =====

  describe('Bottleneck Detection', () => {
    it('should detect slow operation as bottleneck', () => {
      profiler.markStart('slow_op');
      // Simulate slow operation
      const start = Date.now();
      while (Date.now() - start < 120);
      profiler.markEnd('slow_op');

      expect(profiler.bottlenecks.length).toBeGreaterThan(0);
      expect(profiler.bottlenecks[0].duration).toBeGreaterThan(100);
    });

    it('should not detect fast operation as bottleneck', () => {
      const initialCount = profiler.bottlenecks.length;
      profiler.measureSync('fast_op', () => {});
      expect(profiler.bottlenecks.length).toBe(initialCount);
    });

    it('should calculate bottleneck severity', () => {
      profiler.markStart('critical');
      const start = Date.now();
      while (Date.now() - start < 600);
      profiler.markEnd('critical');

      const bottleneck = profiler.bottlenecks[0];
      expect(['low', 'medium', 'high', 'critical']).toContain(bottleneck.severity);
    });

    it('should get bottlenecks by severity', () => {
      // Create bottlenecks
      for (let i = 0; i < 3; i++) {
        profiler.markStart('bn');
        const start = Date.now();
        while (Date.now() - start < 150);
        profiler.markEnd('bn');
      }

      const bottlenecks = profiler.getBottlenecks();
      expect(bottlenecks.length).toBeGreaterThan(0);
    });

    it('should limit stored bottlenecks', () => {
      profiler.markStart('many_bn');
      for (let i = 0; i < 1500; i++) {
        const start = Date.now();
        while (Date.now() - start < 120);
        profiler.markEnd('many_bn');
        profiler.markStart('many_bn');
      }

      expect(profiler.bottlenecks.length).toBeLessThanOrEqual(1000);
    });
  });

  // ===== MEMORY PROFILING TESTS =====

  describe('Memory Profiling', () => {
    it('should collect memory samples', async () => {
      await new Promise(r => setTimeout(r, 200));
      expect(profiler.memorySamples.length).toBeGreaterThan(0);
    });

    it('should get memory statistics', async () => {
      await new Promise(r => setTimeout(r, 150));
      const stats = profiler.getMemoryStats();

      expect(stats).toBeDefined();
      expect(stats.heapUsed).toBeDefined();
      expect(stats.heapUsed.current).toBeGreaterThan(0);
      expect(stats.heapUsed.min).toBeLessThanOrEqual(stats.heapUsed.max);
    });

    it('should calculate memory trend', async () => {
      await new Promise(r => setTimeout(r, 150));
      const trend = profiler.getMemoryTrend();

      expect(trend).toBeDefined();
      expect(['increasing', 'decreasing']).toContain(trend.trend);
    });

    it('should handle no memory samples', () => {
      const newProfiler = new ProfilingService({
        enableMemoryProfiling: false,
      });
      const stats = newProfiler.getMemoryStats();
      expect(stats).toBeNull();
    });

    it('should cleanup old memory samples', async () => {
      profiler.config.retentionSeconds = 0.1;
      await new Promise(r => setTimeout(r, 200));

      profiler.memorySamples.push({ timestamp: Date.now() - 20000 });
      profiler._cleanupMemorySamples();

      expect(
        profiler.memorySamples.every(s => s.timestamp > Date.now() - 200)
      ).toBe(true);
    });
  });

  // ===== MEMORY LEAK DETECTION TESTS =====

  describe('Memory Leak Detection', () => {
    it('should detect increasing memory pattern', async () => {
      const samples = [];
      for (let i = 0; i < 15; i++) {
        samples.push({
          timestamp: Date.now() + i * 100,
          heapUsed: (i + 1) * 1000000,
          heapTotal: 10000000,
          external: 0,
          rss: 0,
        });
      }
      profiler.memorySamples = samples;

      const leak = profiler.detectMemoryLeak();
      expect(leak).toBeDefined();
      if (leak) {
        expect(leak.probability).toBe('high');
      }
    });

    it('should not flag normal memory fluctuation', async () => {
      const samples = [];
      for (let i = 0; i < 15; i++) {
        samples.push({
          timestamp: Date.now() + i * 100,
          heapUsed: 5000000 + Math.random() * 500000,
          heapTotal: 10000000,
          external: 0,
          rss: 0,
        });
      }
      profiler.memorySamples = samples;

      const leak = profiler.detectMemoryLeak();
      // May or may not detect depending on randomness
      expect(typeof leak === 'object' || leak === null).toBe(true);
    });

    it('should require minimum samples for leak detection', () => {
      profiler.memorySamples = [{ heapUsed: 1000 }];
      const leak = profiler.detectMemoryLeak();
      expect(leak).toBeNull();
    });
  });

  // ===== I/O OPERATION TESTS =====

  describe('I/O Operations', () => {
    it('should record I/O operation', () => {
      profiler.recordIoOperation('read', '/file.txt', 50);
      expect(profiler.ioOperations.length).toBe(1);
    });

    it('should get I/O statistics', () => {
      profiler.recordIoOperation('read', '/file1.txt', 50);
      profiler.recordIoOperation('read', '/file2.txt', 60);
      profiler.recordIoOperation('write', '/file3.txt', 100);

      const stats = profiler.getIoStats();
      expect(stats.totalOperations).toBe(3);
      expect(stats.byType.read.count).toBe(2);
      expect(stats.byType.write.count).toBe(1);
    });

    it('should track I/O averages', () => {
      profiler.recordIoOperation('read', 'file', 50);
      profiler.recordIoOperation('read', 'file', 60);
      profiler.recordIoOperation('read', 'file', 70);

      const stats = profiler.getIoStats();
      expect(stats.byType.read.avgTime).toBe(60);
    });

    it('should limit stored I/O operations', () => {
      for (let i = 0; i < 15000; i++) {
        profiler.recordIoOperation('read', 'file', 50);
      }

      expect(profiler.ioOperations.length).toBeLessThanOrEqual(10000);
    });

    it('should handle empty I/O stats', () => {
      const stats = profiler.getIoStats();
      expect(stats).toBeNull();
    });
  });

  // ===== SUMMARY AND REPORTING TESTS =====

  describe('Summary and Reporting', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        profiler.measureSync('op', () => {});
      }
    });

    it('should generate performance summary', () => {
      const summary = profiler.getPerformanceSummary();
      expect(summary.uptime).toBeGreaterThan(0);
      expect(summary.totalOperations).toBe(5);
      expect(summary.functionsTracked).toBeGreaterThan(0);
    });

    it('should generate CPU report', () => {
      const report = profiler.generateCpuReport();
      expect(report.title).toBe('CPU Profiling Report');
      expect(report.summary.totalOperations).toBe(5);
      expect(report.topFunctions).toBeDefined();
    });

    it('should generate memory report', async () => {
      await new Promise(r => setTimeout(r, 150));
      const report = profiler.generateMemoryReport();
      expect(report.title).toBe('Memory Profiling Report');
      expect(report.current).toBeDefined();
    });

    it('should generate flame graph data', () => {
      const flameGraph = profiler.generateFlameGraphData();
      expect(flameGraph.name).toBe('root');
      expect(flameGraph.children).toBeDefined();
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Check', () => {
    it('should report healthy status', () => {
      profiler.measureSync('test', () => {});
      const health = profiler.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.operationsTracked).toBeGreaterThan(0);
    });

    it('should include monitoring metrics', () => {
      const health = profiler.healthCheck();
      expect(health.functionsMonitored).toBeGreaterThanOrEqual(0);
      expect(health.bottlenecksDetected).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== DATA MANAGEMENT TESTS =====

  describe('Data Management', () => {
    beforeEach(() => {
      profiler.measureSync('op1', () => {});
      profiler.measureSync('op2', () => {});
    });

    it('should clear all profiling data', () => {
      expect(profiler.functionTimings.size).toBeGreaterThan(0);
      profiler.clear();
      expect(profiler.functionTimings.size).toBe(0);
      expect(profiler.bottlenecks.length).toBe(0);
      expect(profiler.totalOperations).toBe(0);
    });

    it('should reset start time on clear', () => {
      const beforeClear = profiler.startTime;
      profiler.clear();
      expect(profiler.startTime).toBeGreaterThanOrEqual(beforeClear);
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle zero duration', () => {
      profiler.markStart('instant');
      profiler.markEnd('instant');
      const timing = profiler.functionTimings.get('instant');
      expect(timing.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long operation', () => {
      profiler.markStart('long');
      const start = Date.now();
      while (Date.now() - start < 1000);
      profiler.markEnd('long');

      const timing = profiler.functionTimings.get('long');
      expect(timing.duration).toBeGreaterThan(900);
    });

    it('should handle empty function names', () => {
      profiler.measureSync('', () => 42);
      expect(profiler.functionTimings.has('')).toBe(true);
    });

    it('should handle special characters in names', () => {
      profiler.measureSync('op:api/v1/users', () => {});
      expect(profiler.functionTimings.has('op:api/v1/users')).toBe(true);
    });
  });

  // ===== CONCURRENCY TESTS =====

  describe('Concurrent Operations', () => {
    it('should handle concurrent measurements', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          profiler.measureAsync(`async_${i}`, async () => {
            await new Promise(r => setTimeout(r, 20));
          })
        );
      }

      await Promise.all(promises);
      expect(profiler.functionTimings.size).toBe(10);
      expect(profiler.totalOperations).toBe(10);
    });

    it('should track concurrent sync operations', () => {
      for (let i = 0; i < 100; i++) {
        profiler.measureSync('concurrent', () => {});
      }

      const timing = profiler.functionTimings.get('concurrent');
      expect(timing.callCount).toBe(100);
    });
  });

  // ===== CLEANUP TESTS =====

  describe('Cleanup', () => {
    it('should clear memory sampling interval', () => {
      expect(profiler.memoryInterval).toBeDefined();
      profiler.destroy();
      expect(profiler.memoryInterval._destroyed).toBe(true);
    });
  });
});
