import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { ReportService } from '../../../src/application/services/ReportService.js';

describe('ReportService', () => {
  let reportService;
  let mockStayRepository;
  let mockOrderRepository;
  let mockVoucherRepository;
  let mockLogger;

  beforeEach(() => {
    mockStayRepository = {
      findByHotelCode: vi.fn()
    };

    mockOrderRepository = {
      findByDateRange: vi.fn()
    };

    mockVoucherRepository = {
      findByDateRange: vi.fn()
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    };

    reportService = new ReportService({
      stayRepository: mockStayRepository,
      orderRepository: mockOrderRepository,
      voucherRepository: mockVoucherRepository,
      logger: mockLogger
    });
  });

  describe('getOccupancyRate', () => {
    it('should calculate occupancy rate correctly', async () => {
      const mockStays = [
        { status: 'active', checkIn: '2025-10-22', checkOut: '2025-10-25' },
        { status: 'active', checkIn: '2025-10-22', checkOut: '2025-10-26' },
        { status: 'completed', checkIn: '2025-10-20', checkOut: '2025-10-22' }
      ];

      mockStayRepository.findByHotelCode.mockResolvedValue(mockStays);

      const result = await reportService.getOccupancyRate('H001');

      expect(result).toHaveProperty('occupancyRate');
      expect(result).toHaveProperty('activeStays', 2);
      expect(result).toHaveProperty('timestamp');
    });

    it('should filter stays by date range', async () => {
      const mockStays = [
        { status: 'active', checkIn: '2025-10-22', checkOut: '2025-10-25' },
        { status: 'active', checkIn: '2025-10-01', checkOut: '2025-10-05' }
      ];

      mockStayRepository.findByHotelCode.mockResolvedValue(mockStays);

      const dateRange = { startDate: '2025-10-22', endDate: '2025-10-31' };
      const result = await reportService.getOccupancyRate('H001', dateRange);

      expect(result).toHaveProperty('occupancyRate');
    });
  });

  describe('getVoucherStats', () => {
    it('should calculate voucher statistics', async () => {
      const mockVouchers = [
        { status: 'redeemed' },
        { status: 'redeemed' },
        { status: 'active' },
        { status: 'expired' },
        { status: 'pending' }
      ];

      mockVoucherRepository.findByDateRange.mockResolvedValue(mockVouchers);

      const result = await reportService.getVoucherStats();

      expect(result).toHaveProperty('totalGenerated', 5);
      expect(result.byStatus.redeemed).toBe(2);
      expect(result.byStatus.active).toBe(1);
      expect(result.byStatus.expired).toBe(1);
      expect(result).toHaveProperty('redemptionRate');
    });

    it('should handle empty voucher list', async () => {
      mockVoucherRepository.findByDateRange.mockResolvedValue([]);

      const result = await reportService.getVoucherStats();

      expect(result.totalGenerated).toBe(0);
      expect(result.redemptionRate).toBe(0);
    });
  });

  describe('getOrderConsumption', () => {
    it('should calculate order consumption metrics', async () => {
      const mockOrders = [
        {
          status: 'completed',
          total: 100,
          discountAmount: 10,
          finalTotal: 90,
          items: [{ quantity: 2 }, { quantity: 1 }]
        },
        {
          status: 'completed',
          total: 50,
          discountAmount: 5,
          finalTotal: 45,
          items: [{ quantity: 1 }]
        },
        {
          status: 'cancelled',
          total: 30,
          discountAmount: 0,
          finalTotal: 30,
          items: []
        }
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await reportService.getOrderConsumption();

      expect(result.totalOrders).toBe(3);
      expect(result.completedOrders).toBe(2);
      expect(result.cancelledOrders).toBe(1);
      expect(result.totalRevenue).toBe(180);
      expect(result.totalDiscount).toBe(15);
      expect(result.totalItems).toBe(4);
    });

    it('should filter orders by status', async () => {
      const mockOrders = [
        { status: 'completed', total: 100, finalTotal: 90, discountAmount: 10, items: [] },
        { status: 'cancelled', total: 30, finalTotal: 30, discountAmount: 0, items: [] }
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await reportService.getOrderConsumption(null, { status: 'completed' });

      expect(result.totalOrders).toBe(1);
    });
  });

  describe('getDailyRevenue', () => {
    it('should calculate daily revenue breakdown', async () => {
      const mockOrders = [
        {
          createdAt: '2025-10-22T10:00:00Z',
          total: 100,
          finalTotal: 90,
          discountAmount: 10
        },
        {
          createdAt: '2025-10-22T14:00:00Z',
          total: 50,
          finalTotal: 45,
          discountAmount: 5
        },
        {
          createdAt: '2025-10-23T09:00:00Z',
          total: 200,
          finalTotal: 180,
          discountAmount: 20
        }
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await reportService.getDailyRevenue('2025-10-22', '2025-10-23');

      expect(result.days.length).toBe(2);
      expect(result.days[0].date).toBe('2025-10-22');
      expect(result.days[0].orders).toBe(2);
      expect(result.days[0].revenue).toBe(150);
      expect(result.totalRevenue).toBe(315);
    });
  });

  describe('getTopProducts', () => {
    it('should identify top products by quantity', async () => {
      const mockOrders = [
        {
          items: [
            { productCode: 'CAFE', productName: 'Café', quantity: 5, subtotal: 17.5 },
            { productCode: 'JUICE', productName: 'Jugo', quantity: 2, subtotal: 8 }
          ]
        },
        {
          items: [
            { productCode: 'CAFE', productName: 'Café', quantity: 3, subtotal: 10.5 }
          ]
        }
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await reportService.getTopProducts(10);

      expect(result.products.length).toBe(2);
      expect(result.products[0].code).toBe('CAFE');
      expect(result.products[0].quantity).toBe(8);
    });

    it('should respect limit parameter', async () => {
      const mockOrders = [
        {
          items: [
            { productCode: 'A', productName: 'A', quantity: 1, subtotal: 5 },
            { productCode: 'B', productName: 'B', quantity: 2, subtotal: 10 },
            { productCode: 'C', productName: 'C', quantity: 3, subtotal: 15 }
          ]
        }
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await reportService.getTopProducts(2);

      expect(result.products.length).toBe(2);
    });
  });

  describe('getPeakHours', () => {
    it('should identify peak consumption hours', async () => {
      const mockOrders = [
        { createdAt: '2025-10-22T09:00:00Z', finalTotal: 50, total: 50 },
        { createdAt: '2025-10-22T09:30:00Z', finalTotal: 45, total: 45 },
        { createdAt: '2025-10-22T12:00:00Z', finalTotal: 100, total: 100 },
        { createdAt: '2025-10-22T18:00:00Z', finalTotal: 30, total: 30 }
      ];

      mockOrderRepository.findByDateRange.mockResolvedValue(mockOrders);

      const result = await reportService.getPeakHours();

      expect(result.hourlyDistribution).toBeDefined();
      expect(result.peakHour).toBeDefined();
      expect(result.peakHourOrders).toBeGreaterThan(0);
    });
  });

  describe('getOverallSummary', () => {
    it('should compile all metrics into summary', async () => {
      mockStayRepository.findByHotelCode.mockResolvedValue([
        { status: 'active' },
        { status: 'active' }
      ]);

      mockVoucherRepository.findByDateRange.mockResolvedValue([
        { status: 'redeemed' },
        { status: 'active' }
      ]);

      mockOrderRepository.findByDateRange.mockResolvedValue([
        { status: 'completed', total: 100, finalTotal: 90, discountAmount: 10, items: [] }
      ]);

      const result = await reportService.getOverallSummary('H001');

      expect(result).toHaveProperty('hotel', 'H001');
      expect(result).toHaveProperty('occupancy');
      expect(result).toHaveProperty('vouchers');
      expect(result).toHaveProperty('consumption');
      expect(result).toHaveProperty('peakHours');
      expect(result).toHaveProperty('kpis');
      expect(result.kpis).toHaveProperty('occupancyRate');
      expect(result.kpis).toHaveProperty('voucherRedemptionRate');
      expect(result.kpis).toHaveProperty('averageOrderValue');
      expect(result.kpis).toHaveProperty('totalRevenue');
    });
  });
});
