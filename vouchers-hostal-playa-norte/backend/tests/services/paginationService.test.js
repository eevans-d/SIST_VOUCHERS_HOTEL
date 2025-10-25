import { describe, it, expect, beforeEach } from '@jest/globals';
import PaginationService from '../services/paginationService.js';

describe('PaginationService', () => {
  let paginationService;
  let mockRecords;

  beforeEach(() => {
    paginationService = new PaginationService({
      defaultLimit: 20,
      maxLimit: 100,
      enableStats: true,
    });

    // Mock records para testing
    mockRecords = [
      {
        id: '1',
        title: 'Order 1',
        description: 'First order',
        status: 'completed',
        price: 99.99,
        userId: 'user_1',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        title: 'Order 2',
        description: 'Second order',
        status: 'pending',
        price: 150.00,
        userId: 'user_2',
        createdAt: new Date('2024-01-02'),
      },
      {
        id: '3',
        title: 'Order 3',
        description: 'Third order',
        status: 'completed',
        price: 75.50,
        userId: 'user_1',
        createdAt: new Date('2024-01-03'),
      },
      {
        id: '4',
        title: 'Order 4',
        description: 'Fourth order',
        status: 'cancelled',
        price: 200.00,
        userId: 'user_3',
        createdAt: new Date('2024-01-04'),
      },
      {
        id: '5',
        title: 'Premium Order',
        description: 'Expensive item',
        status: 'pending',
        price: 500.00,
        userId: 'user_2',
        createdAt: new Date('2024-01-05'),
      },
    ];
  });

  describe('Parameter Parsing', () => {
    it('should parse basic query params', () => {
      const params = paginationService.parseParams({
        limit: '10',
        offset: '0',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(params.limit).toBe(10);
      expect(params.offset).toBe(0);
      expect(params.sortBy).toBe('createdAt');
      expect(params.sortOrder).toBe('desc');
    });

    it('should use defaults for missing params', () => {
      const params = paginationService.parseParams({});

      expect(params.limit).toBe(20);
      expect(params.offset).toBe(0);
      expect(params.sortBy).toBe('id');
      expect(params.sortOrder).toBe('asc');
    });

    it('should reject invalid sortOrder', () => {
      expect(() => {
        paginationService.parseParams({
          sortOrder: 'invalid',
        });
      }).toThrow('sortOrder must be "asc" or "desc"');
    });
  });

  describe('Limit Normalization', () => {
    it('should use default limit', () => {
      const limit = paginationService.normalizeLimit(undefined);
      expect(limit).toBe(20);
    });

    it('should enforce max limit', () => {
      const limit = paginationService.normalizeLimit(200);
      expect(limit).toBe(100);
    });

    it('should enforce min limit', () => {
      const limit = paginationService.normalizeLimit(0);
      expect(limit).toBe(1);
    });

    it('should parse string limits', () => {
      const limit = paginationService.normalizeLimit('25');
      expect(limit).toBe(25);
    });

    it('should handle invalid string limits', () => {
      const limit = paginationService.normalizeLimit('invalid');
      expect(limit).toBe(20);
    });
  });

  describe('Offset Normalization', () => {
    it('should parse offset', () => {
      const offset = paginationService.normalizeOffset('10');
      expect(offset).toBe(10);
    });

    it('should default to 0', () => {
      const offset = paginationService.normalizeOffset(undefined);
      expect(offset).toBe(0);
    });

    it('should enforce non-negative offset', () => {
      const offset = paginationService.normalizeOffset(-5);
      expect(offset).toBe(0);
    });
  });

  describe('Filter Parsing', () => {
    it('should parse search filter', () => {
      const filters = paginationService.parseFilters({
        search: 'Order',
      });

      expect(filters.search).toBe('order');
    });

    it('should parse status filter', () => {
      const filters = paginationService.parseFilters({
        status: 'completed',
      });

      expect(filters.status).toBe('completed');
    });

    it('should parse date range filters', () => {
      const filters = paginationService.parseFilters({
        startDate: '2024-01-01',
        endDate: '2024-01-05',
      });

      expect(filters.startDate).toBeInstanceOf(Date);
      expect(filters.endDate).toBeInstanceOf(Date);
    });

    it('should reject invalid date', () => {
      expect(() => {
        paginationService.parseFilters({
          startDate: 'invalid-date',
        });
      }).toThrow('Invalid startDate format');
    });

    it('should parse price range filters', () => {
      const filters = paginationService.parseFilters({
        minPrice: '50',
        maxPrice: '200',
      });

      expect(filters.minPrice).toBe(50);
      expect(filters.maxPrice).toBe(200);
    });

    it('should reject invalid prices', () => {
      expect(() => {
        paginationService.parseFilters({
          minPrice: 'invalid',
        });
      }).toThrow('Invalid minPrice');
    });

    it('should parse userId filter', () => {
      const filters = paginationService.parseFilters({
        userId: 'user_1',
      });

      expect(filters.userId).toBe('user_1');
    });

    it('should parse custom JSON filter', () => {
      const filters = paginationService.parseFilters({
        filter: '{"status":"completed","price":100}',
      });

      expect(filters.custom).toEqual({
        status: 'completed',
        price: 100,
      });
    });

    it('should reject invalid JSON filter', () => {
      expect(() => {
        paginationService.parseFilters({
          filter: '{invalid json}',
        });
      }).toThrow('Invalid filter JSON');
    });
  });

  describe('Cursor Encoding/Decoding', () => {
    it('should encode cursor', () => {
      const record = mockRecords[0];
      const cursor = paginationService.encodeCursor(record, 'createdAt', 'asc');

      expect(typeof cursor).toBe('string');
      expect(cursor.length > 0).toBe(true);
    });

    it('should decode cursor', () => {
      const record = mockRecords[0];
      const encoded = paginationService.encodeCursor(record, 'title', 'desc');
      const decoded = paginationService.decodeCursor(encoded);

      expect(decoded.id).toBe(record.id);
      expect(decoded.value).toBe(record.title);
      expect(decoded.sortOrder).toBe('desc');
    });

    it('should handle null cursor', () => {
      const decoded = paginationService.decodeCursor(null);
      expect(decoded).toBeNull();
    });

    it('should throw error for invalid cursor', () => {
      expect(() => {
        paginationService.decodeCursor('invalid!!!');
      }).toThrow('Invalid cursor format');
    });
  });

  describe('Filter Application', () => {
    it('should pass all filters check', () => {
      const record = mockRecords[0];
      const passes = paginationService.passesFilters(record, {});

      expect(passes).toBe(true);
    });

    it('should filter by search', () => {
      const record = mockRecords[0];
      const passes = paginationService.passesFilters(record, {
        search: 'order',
      });

      expect(passes).toBe(true);

      const fails = paginationService.passesFilters(record, {
        search: 'nonexistent',
      });

      expect(fails).toBe(false);
    });

    it('should filter by status', () => {
      const completed = mockRecords[0];
      const pending = mockRecords[1];

      const completedPasses = paginationService.passesFilters(completed, {
        status: 'completed',
      });
      const pendingFails = paginationService.passesFilters(pending, {
        status: 'completed',
      });

      expect(completedPasses).toBe(true);
      expect(pendingFails).toBe(false);
    });

    it('should filter by date range', () => {
      const record = mockRecords[0];
      const passes = paginationService.passesFilters(record, {
        startDate: new Date('2023-12-31'),
        endDate: new Date('2024-01-02'),
      });

      expect(passes).toBe(true);

      const fails = paginationService.passesFilters(record, {
        startDate: new Date('2024-01-02'),
      });

      expect(fails).toBe(false);
    });

    it('should filter by price range', () => {
      const record = mockRecords[0];  // price: 99.99

      const passes = paginationService.passesFilters(record, {
        minPrice: 50,
        maxPrice: 150,
      });

      expect(passes).toBe(true);

      const fails = paginationService.passesFilters(record, {
        minPrice: 100,
      });

      expect(fails).toBe(false);
    });

    it('should filter by userId', () => {
      const record = mockRecords[0];  // userId: user_1

      const passes = paginationService.passesFilters(record, {
        userId: 'user_1',
      });

      expect(passes).toBe(true);

      const fails = paginationService.passesFilters(record, {
        userId: 'user_2',
      });

      expect(fails).toBe(false);
    });

    it('should apply custom filters', () => {
      const record = mockRecords[0];

      const passes = paginationService.passesFilters(record, {
        custom: {
          status: 'completed',
          price: 99.99,
        },
      });

      expect(passes).toBe(true);

      const fails = paginationService.passesFilters(record, {
        custom: {
          status: 'pending',
        },
      });

      expect(fails).toBe(false);
    });
  });

  describe('Array Pagination', () => {
    it('should paginate records', () => {
      const params = paginationService.parseParams({
        limit: '2',
        offset: '0',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items.length).toBe(2);
      expect(result.pagination.totalRecords).toBe(5);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should apply sorting', () => {
      const params = paginationService.parseParams({
        limit: '5',
        sortBy: 'price',
        sortOrder: 'asc',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items[0].price).toBe(75.50);
      expect(result.items[result.items.length - 1].price).toBe(500.00);
    });

    it('should apply filtering', () => {
      const params = paginationService.parseParams({
        limit: '10',
        status: 'completed',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items.length).toBe(2);
      expect(result.items.every(r => r.status === 'completed')).toBe(true);
    });

    it('should handle cursor pagination', () => {
      const params = paginationService.parseParams({
        limit: '2',
        sortBy: 'title',
      });

      const firstPage = paginationService.paginateArray(mockRecords, params);
      expect(firstPage.items.length).toBe(2);

      const secondParams = paginationService.parseParams({
        limit: '2',
        cursor: firstPage.pagination.nextCursor,
        sortBy: 'title',
      });

      const secondPage = paginationService.paginateArray(mockRecords, secondParams);
      expect(secondPage.items.length).toBe(2);
      expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
    });

    it('should include pagination metadata', () => {
      const params = paginationService.parseParams({
        limit: '2',
        offset: '1',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.offset).toBe(1);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.pageCount).toBe(3);
    });

    it('should include filter metadata', () => {
      const params = paginationService.parseParams({
        limit: '10',
        status: 'completed',
        search: 'order',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.filters).toHaveProperty('status');
      expect(result.filters).toHaveProperty('search');
    });

    it('should include performance metrics', () => {
      const params = paginationService.parseParams({
        limit: '2',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.meta).toHaveProperty('queryTime');
      expect(result.meta).toHaveProperty('timestamp');
      expect(result.meta.queryTime >= 0).toBe(true);
    });

    it('should handle last page', () => {
      const params = paginationService.parseParams({
        limit: '2',
        offset: '4',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items.length).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle empty results', () => {
      const params = paginationService.parseParams({
        limit: '10',
        status: 'nonexistent',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items.length).toBe(0);
      expect(result.pagination.totalRecords).toBe(0);
    });
  });

  describe('Middleware', () => {
    it('should create pagination middleware', () => {
      const middleware = paginationService.paginationMiddleware();

      expect(typeof middleware).toBe('function');
    });

    it('should attach pagination to request', () => {
      const middleware = paginationService.paginationMiddleware();
      const req = {
        query: {
          limit: '10',
          offset: '0',
        },
      };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.pagination).toBeDefined();
      expect(req.pagination.limit).toBe(10);
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 for invalid params', () => {
      const middleware = paginationService.paginationMiddleware();
      const req = {
        query: {
          limit: '10',
          sortOrder: 'invalid',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Statistics', () => {
    it('should track queries processed', () => {
      const params = paginationService.parseParams({ limit: '2' });
      paginationService.paginateArray(mockRecords, params);

      const stats = paginationService.getStats();
      expect(stats.queriesProcessed).toBeGreaterThan(0);
    });

    it('should track total records filtered', () => {
      const params = paginationService.parseParams({ limit: '2' });
      paginationService.paginateArray(mockRecords, params);

      const stats = paginationService.getStats();
      expect(stats.totalRecordsFiltered).toBeGreaterThan(0);
    });

    it('should track cursor queries', () => {
      const params1 = paginationService.parseParams({ limit: '2' });
      const result1 = paginationService.paginateArray(mockRecords, params1);

      const params2 = paginationService.parseParams({
        limit: '2',
        cursor: result1.pagination.nextCursor,
      });
      paginationService.paginateArray(mockRecords, params2);

      const stats = paginationService.getStats();
      expect(stats.cursorQueriesExecuted).toBeGreaterThan(0);
    });

    it('should track offset queries', () => {
      const params = paginationService.parseParams({
        limit: '2',
        offset: '1',
      });
      paginationService.paginateArray(mockRecords, params);

      const stats = paginationService.getStats();
      expect(stats.offsetQueriesExecuted).toBeGreaterThan(0);
    });

    it('should calculate average query time', () => {
      const params = paginationService.parseParams({ limit: '2' });
      paginationService.paginateArray(mockRecords, params);

      const stats = paginationService.getStats();
      expect(stats.averageQueryTime >= 0).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should report healthy', () => {
      const health = paginationService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.serviceName).toBe('PaginationService');
    });

    it('should include timestamp', () => {
      const health = paginationService.healthCheck();

      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should include stats', () => {
      const health = paginationService.healthCheck();

      expect(health.stats).toBeDefined();
      expect(health.stats).toHaveProperty('queriesProcessed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single record', () => {
      const params = paginationService.parseParams({ limit: '10' });
      const result = paginationService.paginateArray(
        [mockRecords[0]],
        params
      );

      expect(result.items.length).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle empty array', () => {
      const params = paginationService.parseParams({ limit: '10' });
      const result = paginationService.paginateArray([], params);

      expect(result.items.length).toBe(0);
      expect(result.pagination.totalRecords).toBe(0);
    });

    it('should handle large limit', () => {
      const params = paginationService.parseParams({ limit: '1000' });
      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items.length).toBe(5);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle negative offset gracefully', () => {
      const params = paginationService.parseParams({ offset: '-10' });

      expect(params.offset).toBe(0);
    });

    it('should handle records without id', () => {
      const recordsWithoutId = [
        { ...mockRecords[0], id: undefined, _id: 'custom_1' },
      ];

      const params = paginationService.parseParams({ limit: '10' });
      const result = paginationService.paginateArray(recordsWithoutId, params);

      expect(result.items.length).toBe(1);
    });

    it('should handle null filters', () => {
      const params = {
        limit: 10,
        offset: 0,
        cursor: null,
        sortBy: 'id',
        sortOrder: 'asc',
        filters: null,
      };

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items.length).toBe(5);
    });
  });

  describe('Complex Filtering', () => {
    it('should combine multiple filters', () => {
      const params = paginationService.parseParams({
        limit: '10',
        status: 'completed',
        minPrice: '50',
        maxPrice: '200',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items.every(r => r.status === 'completed')).toBe(true);
      expect(result.items.every(r => r.price >= 50)).toBe(true);
      expect(result.items.every(r => r.price <= 200)).toBe(true);
    });

    it('should filter with search and status', () => {
      const params = paginationService.parseParams({
        limit: '10',
        search: 'order',
        status: 'pending',
      });

      const result = paginationService.paginateArray(mockRecords, params);

      expect(result.items.every(r => r.status === 'pending')).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should paginate large dataset quickly', () => {
      // Simular 10k records
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: String(i),
        title: `Order ${i}`,
        description: `Description ${i}`,
        status: ['completed', 'pending', 'cancelled'][i % 3],
        price: Math.random() * 1000,
        userId: `user_${i % 100}`,
        createdAt: new Date(2024, 0, 1 + (i % 365)),
      }));

      const start = performance.now();

      const params = paginationService.parseParams({
        limit: '50',
        offset: '0',
        status: 'completed',
      });

      const result = paginationService.paginateArray(largeDataset, params);

      const duration = performance.now() - start;

      expect(result.items.length).toBe(50);
      expect(duration < 500).toBe(true);  // Debería ser < 500ms
    });

    it('should cursor pagination scale well', () => {
      const params = paginationService.parseParams({ limit: '20' });
      const result1 = paginationService.paginateArray(mockRecords, params);

      const start = performance.now();

      const params2 = paginationService.parseParams({
        limit: '20',
        cursor: result1.pagination.nextCursor,
      });
      paginationService.paginateArray(mockRecords, params2);

      const duration = performance.now() - start;

      expect(duration < 100).toBe(true);
    });
  });
});
