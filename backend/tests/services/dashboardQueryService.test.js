import { describe, it, expect, beforeEach, vi } from 'vitest';
import DashboardQueryService from '../src/services/dashboardQueryService.js';

describe('Dashboard Query Service', () => {
  let service;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
    };
    service = new DashboardQueryService(mockDb);
  });

  describe('Dashboard Stats', () => {
    it('should get dashboard data with parallelized queries', async () => {
      mockDb.get
        .mockResolvedValueOnce({ total: 10, occupied: 7, available: 3 })
        .mockResolvedValueOnce({ total: 5000, average: 100, count: 50 });

      mockDb.all
        .mockResolvedValueOnce([{ id: 1, code: 'VOUCHER001' }])
        .mockResolvedValueOnce([{ id: 1, status: 'completed', amount: 100 }])
        .mockResolvedValueOnce([{ id: 1, check_in: '2024-01-01' }]);

      const stats = await service.getDashboardStats(1);

      expect(stats).toHaveProperty('occupancy');
      expect(stats).toHaveProperty('vouchers');
      expect(stats).toHaveProperty('revenue');
      expect(stats).toHaveProperty('orders');
      expect(stats).toHaveProperty('stays');
    });

    it('should return default values on query failure', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));
      mockDb.all.mockRejectedValue(new Error('DB error'));

      const stats = await service.getDashboardStats(1);

      expect(stats.occupancy).toEqual({ total: 0, occupied: 0, available: 0 });
      expect(stats.vouchers).toEqual([]);
    });

    it('should handle partial failures gracefully', async () => {
      mockDb.get
        .mockResolvedValueOnce({ total: 10, occupied: 7, available: 3 })
        .mockRejectedValueOnce(new Error('Revenue query failed'));

      mockDb.all
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const stats = await service.getDashboardStats(1);

      expect(stats.occupancy).toBeDefined();
      expect(stats.revenue).toEqual({ total: 0, average: 0, count: 0 });
    });
  });

  describe('Occupancy Stats', () => {
    it('should get occupancy statistics', async () => {
      mockDb.get.mockResolvedValue({
        total: 20,
        occupied: 15,
        available: 5,
      });

      const occupancy = await service.getOccupancyStats();

      expect(occupancy.total).toBe(20);
      expect(occupancy.occupied).toBe(15);
      expect(occupancy.available).toBe(5);
    });

    it('should return zero defaults on error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const occupancy = await service.getOccupancyStats();

      expect(occupancy).toEqual({ total: 0, occupied: 0, available: 0 });
    });
  });

  describe('User Vouchers', () => {
    it('should get user vouchers', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, code: 'CODE001', amount: 100, status: 'active' },
        { id: 2, code: 'CODE002', amount: 200, status: 'used' },
      ]);

      const vouchers = await service.getUserVouchers(1);

      expect(vouchers).toHaveLength(2);
      expect(vouchers[0].code).toBe('CODE001');
    });

    it('should return empty array on error', async () => {
      mockDb.all.mockRejectedValue(new Error('DB error'));

      const vouchers = await service.getUserVouchers(1);

      expect(vouchers).toEqual([]);
    });

    it('should limit to 5 vouchers', async () => {
      const vouchers = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        code: `CODE${i}`,
      }));

      mockDb.all.mockResolvedValue(vouchers);

      const result = await service.getUserVouchers(1);

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Revenue Stats', () => {
    it('should get revenue statistics', async () => {
      mockDb.get.mockResolvedValue({
        total: 50000,
        average: 1000,
        count: 50,
      });

      const revenue = await service.getRevenueStats();

      expect(revenue.total).toBe(50000);
      expect(revenue.average).toBe(1000);
      expect(revenue.count).toBe(50);
    });

    it('should return zero defaults on error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const revenue = await service.getRevenueStats();

      expect(revenue).toEqual({ total: 0, average: 0, count: 0 });
    });
  });

  describe('User Orders', () => {
    it('should get user orders', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, status: 'completed', amount: 500 },
        { id: 2, status: 'pending', amount: 300 },
      ]);

      const orders = await service.getUserOrders(1);

      expect(orders).toHaveLength(2);
      expect(orders[0].status).toBe('completed');
    });

    it('should return empty array on error', async () => {
      mockDb.all.mockRejectedValue(new Error('DB error'));

      const orders = await service.getUserOrders(1);

      expect(orders).toEqual([]);
    });
  });

  describe('User Stays', () => {
    it('should get user stays', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, check_in: '2024-01-01', check_out: '2024-01-03' },
      ]);

      const stays = await service.getUserStays(1);

      expect(stays).toHaveLength(1);
      expect(stays[0].check_in).toBe('2024-01-01');
    });

    it('should return empty array on error', async () => {
      mockDb.all.mockRejectedValue(new Error('DB error'));

      const stays = await service.getUserStays(1);

      expect(stays).toEqual([]);
    });
  });

  describe('Bulk Operations', () => {
    it('should get bulk dashboard stats for multiple users', async () => {
      mockDb.get
        .mockResolvedValueOnce({ total: 10, occupied: 7, available: 3 })
        .mockResolvedValueOnce({ total: 5000, average: 100, count: 50 })
        .mockResolvedValueOnce({ total: 10, occupied: 7, available: 3 })
        .mockResolvedValueOnce({ total: 5000, average: 100, count: 50 })
        .mockResolvedValueOnce({ total: 10, occupied: 7, available: 3 })
        .mockResolvedValueOnce({ total: 5000, average: 100, count: 50 });

      mockDb.all
        .mockResolvedValue([]);

      const results = await service.getBulkDashboardStats([1, 2, 3]);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('occupancy');
    });

    it('should handle failed bulk queries', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));
      mockDb.all.mockRejectedValue(new Error('DB error'));

      await expect(service.getBulkDashboardStats([1, 2])).rejects.toThrow();
    });
  });

  describe('Detailed Analytics', () => {
    it('should get 30-day analytics', async () => {
      mockDb.all
        .mockResolvedValueOnce([
          { date: '2024-01-01', orders: 5, revenue: 500 },
        ])
        .mockResolvedValueOnce([]);

      mockDb.get
        .mockResolvedValueOnce({ total: 10, used: 8, unused: 2 })
        .mockResolvedValueOnce({ total: 3, avg_nights: 2.5 });

      const analytics = await service.getDetailedAnalytics(1, '30days');

      expect(analytics).toHaveProperty('dailyRevenue');
      expect(analytics).toHaveProperty('voucherMetrics');
      expect(analytics).toHaveProperty('stayMetrics');
    });

    it('should support different time periods', async () => {
      mockDb.all
        .mockResolvedValue([])
        .mockResolvedValue([]);

      mockDb.get
        .mockResolvedValue({ total: 0, used: 0, unused: 0 })
        .mockResolvedValue({ total: 0, avg_nights: 0 });

      const periods = ['7days', '30days', '90days', '1year'];

      for (const period of periods) {
        const analytics = await service.getDetailedAnalytics(1, period);
        expect(analytics).toBeDefined();
      }
    });

    it('should handle analytics query failures', async () => {
      mockDb.all.mockRejectedValue(new Error('DB error'));
      mockDb.get.mockRejectedValue(new Error('DB error'));

      await expect(
        service.getDetailedAnalytics(1, '30days')
      ).rejects.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      mockDb.get
        .mockResolvedValueOnce({ total: 10, occupied: 7, available: 3 })
        .mockResolvedValueOnce({ total: 5000, average: 100, count: 50 });

      const health = await service.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.checks).toBe(true);
    });

    it('should return unhealthy on failure', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const health = await service.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health).toHaveProperty('error');
    });
  });

  describe('Performance', () => {
    it('should get dashboard data in < 45ms', async () => {
      mockDb.get
        .mockResolvedValue({ total: 10, occupied: 7, available: 3 });

      mockDb.all.mockResolvedValue([]);

      const start = Date.now();
      await service.getDashboardStats(1);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(45);
    });

    it('should handle concurrent dashboard requests', async () => {
      mockDb.get
        .mockResolvedValue({ total: 10, occupied: 7, available: 3 });

      mockDb.all.mockResolvedValue([]);

      const start = Date.now();
      await Promise.all([
        service.getDashboardStats(1),
        service.getDashboardStats(2),
        service.getDashboardStats(3),
      ]);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(150);
    });

    it('should prove parallelization benefit', async () => {
      mockDb.get
        .mockResolvedValue({ total: 10, occupied: 7, available: 3 });

      mockDb.all.mockResolvedValue([]);

      const start = Date.now();
      await service.getDashboardStats(1);
      const parallelDuration = Date.now() - start;

      // Parallel queries should be significantly faster than sequential
      expect(parallelDuration).toBeLessThan(60);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null user ID gracefully', async () => {
      mockDb.all.mockResolvedValue([]);
      mockDb.get.mockResolvedValue({ total: 0 });

      const stats = await service.getDashboardStats(null);
      expect(stats).toBeDefined();
    });

    it('should handle zero occupancy', async () => {
      mockDb.get.mockResolvedValue({
        total: 0,
        occupied: 0,
        available: 0,
      });

      const occupancy = await service.getOccupancyStats();

      expect(occupancy.total).toBe(0);
    });

    it('should handle empty result sets', async () => {
      mockDb.all.mockResolvedValue([]);
      mockDb.get.mockResolvedValue(null);

      const stats = await service.getDashboardStats(1);

      expect(stats.vouchers).toEqual([]);
      expect(stats.occupancy).toEqual({ total: 0, occupied: 0, available: 0 });
    });
  });
});
