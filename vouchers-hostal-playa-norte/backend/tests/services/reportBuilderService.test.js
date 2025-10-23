import { describe, it, expect, beforeEach, vi } from 'vitest';
import ReportBuilderService from '../../src/services/reportBuilderService.js';

describe('ReportBuilderService', () => {
  let service;

  beforeEach(() => {
    service = new ReportBuilderService();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(service.config.maxReportSize).toBe(10000);
      expect(service.config.defaultFormat).toBe('pdf');
    });

    it('should initialize with custom config', () => {
      const custom = new ReportBuilderService({ defaultFormat: 'excel' });
      expect(custom.config.defaultFormat).toBe('excel');
    });

    it('should initialize filters', () => {
      const filters = service.getAvailableFilters();
      expect(Object.keys(filters).length).toBeGreaterThan(15);
    });
  });

  describe('Report Creation', () => {
    it('should create report', () => {
      const report = service.createReport({
        name: 'Test Report',
        description: 'Test description',
        userId: 'user123'
      });

      expect(report.name).toBe('Test Report');
      expect(report.id).toBeDefined();
    });

    it('should set default values', () => {
      const report = service.createReport({ name: 'Test' });
      expect(report.format).toBe('pdf');
      expect(report.sections).toEqual([]);
    });

    it('should get report by ID', () => {
      const report = service.createReport({ name: 'Test' });
      const retrieved = service.getReport(report.id);
      expect(retrieved.name).toBe('Test');
    });

    it('should list all reports', () => {
      service.createReport({ name: 'Report 1' });
      service.createReport({ name: 'Report 2' });
      const reports = service.listReports();
      expect(reports.length).toBe(2);
    });

    it('should filter reports by userId', () => {
      service.createReport({ name: 'R1', userId: 'user1' });
      service.createReport({ name: 'R2', userId: 'user2' });
      const filtered = service.listReports({ userId: 'user1' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('R1');
    });

    it('should delete report', () => {
      const report = service.createReport({ name: 'Test' });
      const deleted = service.deleteReport(report.id);
      expect(deleted).toBe(true);
      expect(service.getReport(report.id)).toBeUndefined();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data', async () => {
      const data = await service.fetchData({}, { limit: 10 });
      expect(data.length).toBe(10);
    });

    it('should apply date filter', async () => {
      const data = await service.fetchData({
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      });
      expect(Array.isArray(data)).toBe(true);
    });

    it('should apply select filter', async () => {
      const data = await service.fetchData({
        roomType: 'suite'
      });
      data.forEach(item => {
        if (item.roomType) expect(item.roomType).toBe('suite');
      });
    });

    it('should apply range filter', async () => {
      const data = await service.fetchData({
        priceRange: { min: 100, max: 200 }
      });
      data.forEach(item => {
        if (item.price) {
          expect(item.price).toBeGreaterThanOrEqual(100);
          expect(item.price).toBeLessThanOrEqual(200);
        }
      });
    });
  });

  describe('Filters', () => {
    it('should filter by text', () => {
      const data = [
        { city: 'New York' },
        { city: 'Los Angeles' },
        { city: 'New Orleans' }
      ];
      const filtered = service.applyFilter(data, 'city', 'new');
      expect(filtered.length).toBe(2);
    });

    it('should filter by number', () => {
      const data = [
        { guestCount: 2 },
        { guestCount: 4 },
        { guestCount: 2 }
      ];
      const filtered = service.applyFilter(data, 'guestCount', 2);
      expect(filtered.length).toBe(2);
    });

    it('should filter by multiselect', () => {
      const data = [
        { amenities: 'wifi' },
        { amenities: 'pool' },
        { amenities: 'wifi' }
      ];
      const filtered = service.applyFilter(data, 'amenities', ['wifi', 'pool']);
      expect(filtered.length).toBe(3);
    });

    it('should filter by boolean', () => {
      const data = [
        { specialRequests: true },
        { specialRequests: false },
        { specialRequests: true }
      ];
      const filtered = service.applyFilter(data, 'specialRequests', true);
      expect(filtered.length).toBe(2);
    });
  });

  describe('Sorting', () => {
    it('should sort ascending', () => {
      const data = [
        { price: 100 },
        { price: 50 },
        { price: 75 }
      ];
      const sorted = service.applySorting(data, { column: 'price', order: 'asc' });
      expect(sorted[0].price).toBe(50);
      expect(sorted[2].price).toBe(100);
    });

    it('should sort descending', () => {
      const data = [
        { price: 100 },
        { price: 50 },
        { price: 75 }
      ];
      const sorted = service.applySorting(data, { column: 'price', order: 'desc' });
      expect(sorted[0].price).toBe(100);
      expect(sorted[2].price).toBe(50);
    });

    it('should handle missing sorting config', () => {
      const data = [{ a: 1 }, { a: 2 }];
      const sorted = service.applySorting(data, null);
      expect(sorted).toEqual(data);
    });
  });

  describe('Grouping', () => {
    it('should group by column', () => {
      const data = [
        { roomType: 'suite', price: 100 },
        { roomType: 'deluxe', price: 150 },
        { roomType: 'suite', price: 120 }
      ];
      const grouped = service.applyGrouping(data, 'roomType');
      expect(grouped.suite.length).toBe(2);
      expect(grouped.deluxe.length).toBe(1);
    });

    it('should handle missing values', () => {
      const data = [
        { roomType: 'suite' },
        { price: 100 }
      ];
      const grouped = service.applyGrouping(data, 'roomType');
      expect(grouped.Other).toBeDefined();
    });
  });

  describe('Aggregations', () => {
    it('should calculate sum', () => {
      const data = [{ price: 100 }, { price: 200 }, { price: 300 }];
      const result = service.applyAggregations(data, [
        { column: 'price', function: 'sum' }
      ]);
      expect(result.aggregations.price_sum).toBe(600);
    });

    it('should calculate average', () => {
      const data = [{ price: 100 }, { price: 200 }, { price: 300 }];
      const result = service.applyAggregations(data, [
        { column: 'price', function: 'avg' }
      ]);
      expect(result.aggregations.price_avg).toBe(200);
    });

    it('should count records', () => {
      const data = [{ price: 100 }, { price: 200 }];
      const result = service.applyAggregations(data, [
        { column: 'price', function: 'count' }
      ]);
      expect(result.aggregations.price_count).toBe(2);
    });

    it('should find min value', () => {
      const data = [{ price: 100 }, { price: 50 }, { price: 200 }];
      const result = service.applyAggregations(data, [
        { column: 'price', function: 'min' }
      ]);
      expect(result.aggregations.price_min).toBe(50);
    });

    it('should find max value', () => {
      const data = [{ price: 100 }, { price: 50 }, { price: 200 }];
      const result = service.applyAggregations(data, [
        { column: 'price', function: 'max' }
      ]);
      expect(result.aggregations.price_max).toBe(200);
    });
  });

  describe('Column Selection', () => {
    it('should select specific columns', () => {
      const data = [
        { id: 1, name: 'A', price: 100 },
        { id: 2, name: 'B', price: 200 }
      ];
      const selected = service.selectColumns(data, ['id', 'price']);
      expect(selected[0]).toEqual({ id: 1, price: 100 });
      expect(selected[0].name).toBeUndefined();
    });

    it('should handle no columns', () => {
      const data = [{ id: 1 }];
      const selected = service.selectColumns(data, []);
      expect(selected).toEqual(data);
    });
  });

  describe('Report Building', () => {
    it('should build complete report', async () => {
      const report = service.createReport({
        name: 'Test Report',
        filters: { roomType: 'suite' },
        columns: ['id', 'price'],
        sorting: { column: 'price', order: 'asc' },
        format: 'json'
      });

      const result = await service.buildReport(report.id, { limit: 10 });
      expect(result.reportId).toBe(report.id);
      expect(result.format).toBe('json');
      expect(result.output).toBeDefined();
    });

    it('should throw error for missing report', async () => {
      await expect(service.buildReport('invalid_id')).rejects.toThrow();
    });
  });

  describe('Output Generation', () => {
    it('should generate PDF', async () => {
      const sections = [{ title: 'Test', type: 'table', data: [] }];
      const report = { name: 'Test' };
      const output = await service.generatePDF(sections, report);
      
      expect(output.type).toBe('buffer');
      expect(output.mimeType).toBe('application/pdf');
      expect(output.filename).toContain('.pdf');
    });

    it('should generate Excel', async () => {
      const sections = [{ title: 'Test', type: 'table', data: [] }];
      const report = { name: 'Test' };
      const output = await service.generateExcel(sections, report);
      
      expect(output.type).toBe('buffer');
      expect(output.filename).toContain('.xlsx');
    });

    it('should generate CSV', async () => {
      const sections = [{ 
        title: 'Test', 
        type: 'table', 
        data: [{ id: 1, name: 'Test' }] 
      }];
      const report = { name: 'Test' };
      const output = await service.generateCSV(sections, report);
      
      expect(output.type).toBe('text');
      expect(output.mimeType).toBe('text/csv');
      expect(output.content).toContain('id,name');
    });

    it('should generate JSON', async () => {
      const sections = [{ title: 'Test', data: [] }];
      const report = { name: 'Test' };
      const output = await service.generateJSON(sections, report);
      
      expect(output.type).toBe('json');
      expect(() => JSON.parse(output.content)).not.toThrow();
    });

    it('should generate HTML', async () => {
      const sections = [{ 
        title: 'Test', 
        type: 'table',
        data: [{ id: 1, name: 'Test' }] 
      }];
      const report = { name: 'Test' };
      const output = await service.generateHTML(sections, report);
      
      expect(output.type).toBe('text');
      expect(output.mimeType).toBe('text/html');
      expect(output.content).toContain('<table>');
    });
  });

  describe('Templates', () => {
    it('should create template', () => {
      const template = service.createTemplate({
        name: 'Monthly Report',
        description: 'Standard monthly report',
        sections: [{ title: 'Revenue' }]
      });

      expect(template.name).toBe('Monthly Report');
      expect(template.id).toBeDefined();
    });

    it('should get template', () => {
      const template = service.createTemplate({ name: 'Test' });
      const retrieved = service.getTemplate(template.id);
      expect(retrieved.name).toBe('Test');
    });

    it('should list templates', () => {
      service.createTemplate({ name: 'T1' });
      service.createTemplate({ name: 'T2' });
      const templates = service.listTemplates();
      expect(templates.length).toBe(2);
    });
  });

  describe('Scheduling', () => {
    it('should schedule report', () => {
      const report = service.createReport({ name: 'Test' });
      const schedule = service.scheduleReport(report.id, {
        frequency: 'daily',
        time: '08:00',
        recipients: ['user@example.com'],
        format: 'pdf'
      });

      expect(schedule.reportId).toBe(report.id);
      expect(schedule.frequency).toBe('daily');
      expect(schedule.enabled).toBe(true);
    });

    it('should check daily schedule', () => {
      const schedule = {
        frequency: 'daily',
        lastExecuted: new Date(Date.now() - 25 * 60 * 60 * 1000)
      };
      const should = service.shouldExecuteSchedule(schedule, new Date());
      expect(should).toBe(true);
    });

    it('should check weekly schedule', () => {
      const schedule = {
        frequency: 'weekly',
        lastExecuted: new Date(Date.now() - 169 * 60 * 60 * 1000)
      };
      const should = service.shouldExecuteSchedule(schedule, new Date());
      expect(should).toBe(true);
    });

    it('should check monthly schedule', () => {
      const schedule = {
        frequency: 'monthly',
        lastExecuted: new Date(Date.now() - 721 * 60 * 60 * 1000)
      };
      const should = service.shouldExecuteSchedule(schedule, new Date());
      expect(should).toBe(true);
    });

    it('should not execute too soon', () => {
      const schedule = {
        frequency: 'daily',
        lastExecuted: new Date(Date.now() - 1 * 60 * 60 * 1000)
      };
      const should = service.shouldExecuteSchedule(schedule, new Date());
      expect(should).toBe(false);
    });
  });

  describe('Data Formatting', () => {
    it('should format table data', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const formatted = service.formatTableData(data);
      expect(formatted).toEqual(data);
    });

    it('should format chart data', () => {
      const data = [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 }
      ];
      const formatted = service.formatChartData(data, 'bar');
      expect(formatted.labels).toEqual(['A', 'B']);
      expect(formatted.datasets[0].data).toEqual([10, 20]);
    });

    it('should format summary data', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const formatted = service.formatSummaryData(data);
      expect(formatted.totalRecords).toBe(3);
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      service.createReport({ name: 'R1' });
      service.createReport({ name: 'R2' });
      service.createTemplate({ name: 'T1' });

      const stats = service.getStatistics();
      expect(stats.totalReports).toBe(2);
      expect(stats.totalTemplates).toBe(1);
      expect(stats.availableFilters).toBeGreaterThan(15);
    });
  });

  describe('Utilities', () => {
    it('should generate unique IDs', () => {
      const id1 = service.generateId();
      const id2 = service.generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate colors', () => {
      const colors = service.generateColors(3);
      expect(colors.length).toBe(3);
      colors.forEach(c => {
        expect(c).toMatch(/^hsl\(/);
      });
    });

    it('should generate sample data', () => {
      const data = service.generateSampleData(100);
      expect(data.length).toBe(100);
      expect(data[0]).toHaveProperty('roomType');
      expect(data[0]).toHaveProperty('price');
    });
  });
});
