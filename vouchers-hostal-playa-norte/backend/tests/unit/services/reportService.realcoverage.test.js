/**
 * @fileoverview Tests de Cobertura Real para ReportService
 *
 * OBJETIVO: 80%+ coverage del servicio de generación de reportes
 *
 * COBERTURA:
 * - generateRedemptionsCSV: generación exitosa, filtros (fechas, cafetería), validaciones
 * - getReconciliationReport: reporte de conciliación con estadísticas diarias y resumen
 * - getOperationalMetrics: métricas operativas del sistema
 */

import { jest } from '@jest/globals';

// ===================================================================
// MOCKS - DEBEN definirse ANTES de los imports
// ===================================================================

// Mock database
const mockPrepare = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn();
const mockGetDb = jest.fn();

await jest.unstable_mockModule('../../../src/config/database.js', () => ({
  getDb: mockGetDb
}));

// Mock logger
await jest.unstable_mockModule('../../../src/config/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  auditLogger: {
    info: jest.fn()
  }
}));

// Mock errorHandler
await jest.unstable_mockModule('../../../src/middleware/errorHandler.js', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  NotFoundError: class NotFoundError extends Error {},
  ConflictError: class ConflictError extends Error {}
}));

// ===================================================================
// IMPORTS - Después de definir mocks
// ===================================================================

const { reportService } = await import('../../../src/services/reportService.js');
const { logger } = await import('../../../src/config/logger.js');
const { ValidationError } = await import('../../../src/middleware/errorHandler.js');

// ===================================================================
// TEST SUITE
// ===================================================================

describe('ReportService - Cobertura Real', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default database mock behavior
    mockGetDb.mockReturnValue({
      prepare: mockPrepare
    });

    mockPrepare.mockReturnValue({
      all: mockAll,
      get: mockGet
    });
  });

  // =================================================================
  // GRUPO 1: generateRedemptionsCSV - Generación exitosa
  // =================================================================

  describe('generateRedemptionsCSV', () => {

    test('debe generar CSV sin filtros exitosamente', async () => {
      // Arrange
      const params = {
        correlation_id: 'test-123'
      };

      const mockRedemptions = [
        {
          code: 'HOTEL-2025-0001',
          guest_name: 'Juan Pérez',
          room: '101',
          redeemed_at: '2025-11-01 08:30:00',
          cafeteria: 'Cafetería Principal',
          device_id: 'device-001',
          origin: 'online'
        },
        {
          code: 'HOTEL-2025-0002',
          guest_name: 'María García',
          room: '102',
          redeemed_at: '2025-11-01 09:15:00',
          cafeteria: 'Cafetería Terraza',
          device_id: 'device-002',
          origin: 'offline'
        }
      ];

      mockAll.mockReturnValue(mockRedemptions);

      // Act
      const result = await reportService.generateRedemptionsCSV(params);

      // Assert
      expect(result.csv).toContain('code,guest_name,room,redeemed_at,cafeteria,device_id,origin');
      expect(result.csv).toContain('HOTEL-2025-0001,Juan Pérez,101');
      expect(result.csv).toContain('HOTEL-2025-0002,María García,102');
      expect(result.metadata.total_redemptions).toBe(2);
      expect(result.metadata.generated_at).toBeDefined();

      // Verificar logging
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'generate_csv_start',
          correlation_id: 'test-123'
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'generate_csv_complete',
          correlation_id: 'test-123',
          row_count: 2
        })
      );
    });

    test('debe generar CSV con filtro de fechas', async () => {
      // Arrange
      const params = {
        from_date: '2025-11-01',
        to_date: '2025-11-30',
        correlation_id: 'test-124'
      };

      const mockRedemptions = [
        {
          code: 'HOTEL-2025-0003',
          guest_name: 'Pedro López',
          room: '201',
          redeemed_at: '2025-11-15 10:00:00',
          cafeteria: 'Cafetería Principal',
          device_id: 'device-003',
          origin: 'online'
        }
      ];

      mockAll.mockReturnValue(mockRedemptions);

      // Act
      const result = await reportService.generateRedemptionsCSV(params);

      // Assert
      expect(result.metadata.total_redemptions).toBe(1);
      expect(result.metadata.period).toEqual({
        from: '2025-11-01',
        to: '2025-11-30'
      });

      // Verificar que se llamó con parámetros de fecha
      expect(mockAll).toHaveBeenCalledWith('2025-11-01', '2025-11-30');
    });

    test('debe generar CSV con filtro de cafetería', async () => {
      // Arrange
      const params = {
        cafeteria_id: 1,
        correlation_id: 'test-125'
      };

      const mockRedemptions = [];
      mockAll.mockReturnValue(mockRedemptions);

      // Act
      const result = await reportService.generateRedemptionsCSV(params);

      // Assert
      expect(result.metadata.total_redemptions).toBe(0);
      expect(result.csv).toBe('code,guest_name,room,redeemed_at,cafeteria,device_id,origin\n');

      // Verificar que se llamó con parámetro de cafetería
      expect(mockAll).toHaveBeenCalledWith(1);
    });

    test('debe generar CSV con todos los filtros', async () => {
      // Arrange
      const params = {
        from_date: '2025-11-01',
        to_date: '2025-11-30',
        cafeteria_id: 2,
        correlation_id: 'test-126'
      };

      const mockRedemptions = [
        {
          code: 'HOTEL-2025-0004',
          guest_name: 'Ana Martínez',
          room: '301',
          redeemed_at: '2025-11-20 12:00:00',
          cafeteria: 'Cafetería Terraza',
          device_id: 'device-004',
          origin: 'offline'
        }
      ];

      mockAll.mockReturnValue(mockRedemptions);

      // Act
      const result = await reportService.generateRedemptionsCSV(params);

      // Assert
      expect(result.metadata.total_redemptions).toBe(1);
      expect(result.csv).toContain('HOTEL-2025-0004');

      // Verificar que se llamó con todos los parámetros
      expect(mockAll).toHaveBeenCalledWith('2025-11-01', '2025-11-30', 2);
    });

    test('debe rechazar fechas inválidas (from > to)', async () => {
      // Arrange
      const params = {
        from_date: '2025-11-30',
        to_date: '2025-11-01',
        correlation_id: 'test-127'
      };

      // Act & Assert
      await expect(reportService.generateRedemptionsCSV(params))
        .rejects.toThrow(ValidationError);

      await expect(reportService.generateRedemptionsCSV(params))
        .rejects.toThrow('La fecha de inicio debe ser anterior a la fecha de fin');
    });

  });

  // =================================================================
  // GRUPO 2: getReconciliationReport - Reporte de conciliación
  // =================================================================

  describe('getReconciliationReport', () => {

    test('debe generar reporte de conciliación con estadísticas', async () => {
      // Arrange
      const params = {
        from_date: '2025-11-01',
        to_date: '2025-11-30',
        correlation_id: 'test-128'
      };

      const mockDailyStats = [
        {
          date: '2025-11-01',
          emitted: 10,
          redeemed: 8,
          expired: 1,
          cancelled: 1
        },
        {
          date: '2025-11-02',
          emitted: 15,
          redeemed: 12,
          expired: 2,
          cancelled: 0
        }
      ];

      const mockSummary = {
        total_emitted: 25,
        total_redeemed: 20,
        total_expired: 3,
        total_cancelled: 1,
        total_active: 1
      };

      // Primera llamada: daily stats, segunda llamada: summary
      mockAll.mockReturnValueOnce(mockDailyStats);
      mockGet.mockReturnValueOnce(mockSummary);

      // Act
      const result = await reportService.getReconciliationReport(params);

      // Assert
      expect(result.period).toEqual({
        from: '2025-11-01',
        to: '2025-11-30'
      });

      expect(result.summary).toEqual(mockSummary);
      expect(result.daily_stats).toEqual(mockDailyStats);
      expect(result.daily_stats).toHaveLength(2);

      // Verificar que se llamaron ambas queries
      expect(mockPrepare).toHaveBeenCalledTimes(2);
      expect(mockAll).toHaveBeenCalledWith('2025-11-01', '2025-11-30');
      expect(mockGet).toHaveBeenCalledWith('2025-11-01', '2025-11-30');
    });

    test('debe manejar periodo sin datos', async () => {
      // Arrange
      const params = {
        from_date: '2025-12-01',
        to_date: '2025-12-31',
        correlation_id: 'test-129'
      };

      mockAll.mockReturnValueOnce([]);
      mockGet.mockReturnValueOnce({
        total_emitted: 0,
        total_redeemed: 0,
        total_expired: 0,
        total_cancelled: 0,
        total_active: 0
      });

      // Act
      const result = await reportService.getReconciliationReport(params);

      // Assert
      expect(result.summary.total_emitted).toBe(0);
      expect(result.daily_stats).toEqual([]);
    });

  });

  // =================================================================
  // GRUPO 3: getOperationalMetrics - Métricas operativas
  // =================================================================

  describe('getOperationalMetrics', () => {

    test('debe obtener métricas operativas del sistema', async () => {
      // Arrange
      const params = {
        correlation_id: 'test-130'
      };

      const mockTodayStats = {
        vouchers_emitted: 20,
        vouchers_redeemed: 15,
        online_redemptions: 10,
        offline_redemptions: 5
      };

      const mockActiveVouchers = { count: 50 };
      const mockRecentConflicts = { count: 2 };
      const mockActiveDevices = { count: 3 };

      // Configurar mocks en orden de llamada
      mockGet
        .mockReturnValueOnce(mockTodayStats)
        .mockReturnValueOnce(mockActiveVouchers)
        .mockReturnValueOnce(mockRecentConflicts)
        .mockReturnValueOnce(mockActiveDevices);

      // Act
      const result = await reportService.getOperationalMetrics(params);

      // Assert
      expect(result.today).toEqual(mockTodayStats);
      expect(result.active_vouchers).toBe(50);
      expect(result.recent_conflicts).toBe(2);
      expect(result.active_devices).toBe(3);
      expect(result.timestamp).toBeDefined();

      // Verificar que se llamaron todas las queries
      expect(mockPrepare).toHaveBeenCalledTimes(4);
    });

    test('debe manejar sistema sin actividad', async () => {
      // Arrange
      const params = {
        correlation_id: 'test-131'
      };

      mockGet
        .mockReturnValueOnce({
          vouchers_emitted: 0,
          vouchers_redeemed: 0,
          online_redemptions: 0,
          offline_redemptions: 0
        })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 });

      // Act
      const result = await reportService.getOperationalMetrics(params);

      // Assert
      expect(result.today.vouchers_emitted).toBe(0);
      expect(result.active_vouchers).toBe(0);
      expect(result.recent_conflicts).toBe(0);
      expect(result.active_devices).toBe(0);
    });

  });

  // =================================================================
  // GRUPO 4: Edge Cases y Validaciones
  // =================================================================

  describe('Edge Cases', () => {

    test('generateRedemptionsCSV debe manejar caracteres especiales en CSV', async () => {
      // Arrange
      const params = { correlation_id: 'test-132' };

      const mockRedemptions = [
        {
          code: 'HOTEL-2025-0005',
          guest_name: 'José "Pepe" Gómez',
          room: '401',
          redeemed_at: '2025-11-01 14:00:00',
          cafeteria: "Cafetería D'Elia",
          device_id: 'device-005',
          origin: 'online'
        }
      ];

      mockAll.mockReturnValue(mockRedemptions);

      // Act
      const result = await reportService.generateRedemptionsCSV(params);

      // Assert
      expect(result.csv).toContain('José "Pepe" Gómez');
      expect(result.csv).toContain("Cafetería D'Elia");
    });

    test('generateRedemptionsCSV debe aceptar fechas iguales', async () => {
      // Arrange
      const params = {
        from_date: '2025-11-15',
        to_date: '2025-11-15',
        correlation_id: 'test-133'
      };

      mockAll.mockReturnValue([]);

      // Act
      const result = await reportService.generateRedemptionsCSV(params);

      // Assert
      expect(result.metadata.period).toEqual({
        from: '2025-11-15',
        to: '2025-11-15'
      });
    });

    test('getReconciliationReport debe manejar múltiples días con datos', async () => {
      // Arrange
      const params = {
        from_date: '2025-11-01',
        to_date: '2025-11-07',
        correlation_id: 'test-134'
      };

      const mockDailyStats = Array.from({ length: 7 }, (_, i) => ({
        date: `2025-11-0${i + 1}`,
        emitted: 10 + i,
        redeemed: 8 + i,
        expired: 1,
        cancelled: 0
      }));

      mockAll.mockReturnValueOnce(mockDailyStats);
      mockGet.mockReturnValueOnce({
        total_emitted: 70,
        total_redeemed: 56,
        total_expired: 7,
        total_cancelled: 0,
        total_active: 7
      });

      // Act
      const result = await reportService.getReconciliationReport(params);

      // Assert
      expect(result.daily_stats).toHaveLength(7);
      expect(result.summary.total_emitted).toBe(70);
    });

  });

});
