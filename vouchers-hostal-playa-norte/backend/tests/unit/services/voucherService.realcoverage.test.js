// VoucherService REAL Coverage Tests con ES Modules
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock de dependencias antes de importar VoucherService
jest.unstable_mockModule('../../../src/config/database.js', () => ({
  getDb: jest.fn()
}));

jest.unstable_mockModule('../../../src/config/logger.js', () => ({
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

jest.unstable_mockModule('../../../src/services/cryptoService.js', () => ({
  CryptoService: {
    generateVoucherHMAC: jest.fn(),
    verifyVoucherHMAC: jest.fn(),
    generateVoucherCode: jest.fn()
  }
}));

jest.unstable_mockModule('../../../src/services/qrService.js', () => ({
  QRService: {
    generateQR: jest.fn(),
    generateVoucherQR: jest.fn()
  }
}));

jest.unstable_mockModule('../../../src/middleware/errorHandler.js', () => ({
  ValidationError: class ValidationError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  ConflictError: class ConflictError extends Error {}
}));

describe('VoucherService - Real Coverage Tests', () => {
  let VoucherService, voucherService;
  let mockDb, mockGetDb, mockLogger, mockAuditLogger, mockCryptoService, mockQRService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mock implementations
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn(),
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
        all: jest.fn().mockReturnValue([])
      }),
      transaction: jest.fn().mockImplementation((fn) => {
        // transaction() retorna una función que cuando se ejecuta, ejecuta el callback
        return () => fn();
      })
    };

    // Import mocked modules
    const { getDb } = await import('../../../src/config/database.js');
    const { logger, auditLogger } = await import('../../../src/config/logger.js');
    const { CryptoService } = await import('../../../src/services/cryptoService.js');
    const { QRService } = await import('../../../src/services/qrService.js');

    mockGetDb = getDb;
    mockLogger = logger;
    mockAuditLogger = auditLogger;
    mockCryptoService = CryptoService;
    mockQRService = QRService;

    mockGetDb.mockReturnValue(mockDb);
    mockCryptoService.generateVoucherHMAC.mockResolvedValue('mock-hmac');
    mockCryptoService.verifyVoucherHMAC.mockReturnValue(true);
    mockCryptoService.generateVoucherCode.mockReturnValue('TEST-VOUCHER-CODE');
    mockQRService.generateQR.mockResolvedValue('mock-qr-base64');
    mockQRService.generateVoucherQR.mockResolvedValue('mock-qr-voucher-base64');

    // Import VoucherService after mocks are setup
    const voucherModule = await import('../../../src/services/voucherService.js');
    VoucherService = voucherModule.VoucherService;
    voucherService = voucherModule.voucherService;
  });

  describe('emitVouchers', () => {
    it('debería emitir vouchers exitosamente', async () => {
      // Arrange
      const mockStay = {
        id: 1,
        hotel_id: 1,
        total_nights: 3,
        check_in: '2024-01-01',
        check_out: '2024-01-04'
      };

      // Mock de las queries en orden: getStay, checkExisting, count x3 (por cada voucher)
      mockDb.prepare().get
        .mockReturnValueOnce(mockStay) // getStay query
        .mockReturnValueOnce({ count: 0 }) // checkExistingVouchers query
        .mockReturnValueOnce({ count: 100 }) // COUNT query para voucher 1
        .mockReturnValueOnce({ count: 101 }) // COUNT query para voucher 2
        .mockReturnValueOnce({ count: 102 }); // COUNT query para voucher 3

      const request = {
        stay_id: 1,
        valid_from: '2024-01-01',
        valid_until: '2024-01-04',
        breakfast_count: 3,
        correlation_id: 'test-corr-id',
        user_id: 'test-user'
      };

      // Act
      const result = await voucherService.emitVouchers(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.vouchers).toHaveLength(3);
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('debería validar stay_id requerido', async () => {
      const request = {
        valid_from: '2024-01-01',
        valid_until: '2024-01-04',
        breakfast_count: 3,
        correlation_id: 'test-corr',
        user_id: 'test-user'
      };

      await expect(voucherService.emitVouchers(request))
        .rejects.toThrow();
    });

    it('debería fallar si la estadía no existe', async () => {
      mockDb.prepare().get.mockReturnValue(null);

      const request = {
        stay_id: 999,
        valid_from: '2024-01-01',
        valid_until: '2024-01-04',
        breakfast_count: 3,
        correlation_id: 'test-corr',
        user_id: 'test-user'
      };

      await expect(voucherService.emitVouchers(request))
        .rejects.toThrow();
    });
  });

  describe('getVoucher', () => {
    it('debería obtener un voucher por código', async () => {
      const mockVoucher = {
        id: 1,
        code: 'TEST001',
        stay_id: 1,
        status: 'active'
      };

      mockDb.prepare().get
        .mockReturnValueOnce(mockVoucher) // voucher query
        .mockReturnValueOnce(null); // redemption query

      const result = await voucherService.getVoucher('TEST001', 'test-corr');

      expect(result.code).toBe('TEST001');
      expect(result.is_redeemed).toBe(false);
    });

    it('debería fallar si el voucher no existe', async () => {
      mockDb.prepare().get.mockReturnValue(null);

      await expect(voucherService.getVoucher('INVALID', 'test-corr'))
        .rejects.toThrow();
    });
  });

  describe('validateVoucher', () => {
    it('debería validar voucher exitosamente', async () => {
      const mockVoucher = {
        id: 1,
        code: 'TEST001',
        status: 'active',
        valid_from: '2024-01-01',
        valid_until: '2025-12-31',  // Fecha futura para que sea válido
        stay_id: 1,
        is_redeemed: false,
        guest_name: 'Test Guest',
        room_number: '101'
      };

      // Mock para getVoucher (2 queries)
      mockDb.prepare().get
        .mockReturnValueOnce(mockVoucher) // voucher query
        .mockReturnValueOnce(null); // redemption query

      mockCryptoService.verifyVoucherHMAC.mockReturnValue(true);

      const result = await voucherService.validateVoucher({
        code: 'TEST001',
        hmac: 'valid-hmac',
        correlation_id: 'test-corr'
      });

      expect(result.valid).toBe(true);
      expect(result.voucher).toBeDefined();
      expect(result.voucher.code).toBe('TEST001');
    });

    it('debería fallar con HMAC inválido', async () => {
      const mockVoucher = {
        id: 1,
        code: 'TEST001',
        status: 'active',
        valid_from: '2024-01-01',
        valid_until: '2024-12-31',
        stay_id: 1,
        is_redeemed: false
      };

      // Mock para getVoucher
      mockDb.prepare().get
        .mockReturnValueOnce(mockVoucher) // voucher query
        .mockReturnValueOnce(null); // redemption query

      mockCryptoService.verifyVoucherHMAC.mockReturnValue(false);

      await expect(voucherService.validateVoucher({
        code: 'TEST001',
        hmac: 'wrong-hmac',
        correlation_id: 'test-corr'
      })).rejects.toThrow('Firma HMAC inválida');
    });
  });

  describe('redeemVoucher', () => {
    it('debería canjear voucher exitosamente', async () => {
      const mockVoucher = {
        id: 1,
        code: 'TEST001',
        status: 'active',
        valid_from: '2024-01-01',
        valid_until: '2025-12-31',
        guest_name: 'Test Guest',
        room_number: '101'
      };

      // Mock para la query dentro de transaction
      mockDb.prepare().get.mockReturnValue(mockVoucher);

      const result = await voucherService.redeemVoucher({
        code: 'TEST001',
        cafeteria_id: 1,
        device_id: 'dev-001',
        redeemed_by: 'test-user',
        correlation_id: 'test-corr'
      });

      expect(result.success).toBe(true);
      expect(result.redemption).toBeDefined();
    });

    it('debería fallar al canjear voucher ya canjeado', async () => {
      const mockVoucher = {
        id: 1,
        code: 'TEST001',
        status: 'active',
        valid_from: '2024-01-01',
        valid_until: '2025-12-31',
        guest_name: 'Test Guest',
        room_number: '101'
      };

      // Mock de la query SELECT para obtener voucher dentro de transaction
      mockDb.prepare().get.mockReturnValue(mockVoucher);

      // Simular error UNIQUE constraint al intentar insertar redemption
      const constraintError = new Error('UNIQUE constraint failed');
      constraintError.code = 'SQLITE_CONSTRAINT_UNIQUE';

      mockDb.prepare().run.mockImplementation(() => {
        throw constraintError;
      });

      await expect(voucherService.redeemVoucher({
        code: 'TEST001',
        cafeteria_id: 1,
        device_id: 'dev-001',
        redeemed_by: 'test-user',
        correlation_id: 'test-corr'
      })).rejects.toThrow();
    });
  });

  describe('cancelVoucher', () => {
    it('debería cancelar voucher exitosamente', async () => {
      const mockVoucher = {
        id: 1,
        code: 'TEST001',
        status: 'active',
        is_redeemed: false
      };

      // Mock para getVoucher (2 queries: voucher + redemption)
      mockDb.prepare().get
        .mockReturnValueOnce(mockVoucher) // voucher query
        .mockReturnValueOnce(null); // redemption query (no redemption)

      const result = await voucherService.cancelVoucher({
        code: 'TEST001',
        reason: 'test reason',
        user_id: 'test-user',
        correlation_id: 'test-corr'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Voucher cancelado exitosamente');
    });

    it('debería fallar al cancelar voucher ya canjeado', async () => {
      const mockVoucher = {
        id: 1,
        code: 'TEST001',
        status: 'active'
      };

      const mockRedemption = {
        id: 1,
        voucher_id: 1,
        cafeteria_id: 1
      };

      // Mock para getVoucher - con redemption significa is_redeemed=true
      mockDb.prepare().get
        .mockReturnValueOnce(mockVoucher) // voucher query
        .mockReturnValueOnce(mockRedemption); // redemption query

      await expect(voucherService.cancelVoucher({
        code: 'TEST001',
        reason: 'test reason',
        user_id: 'test-user',
        correlation_id: 'test-corr'
      })).rejects.toThrow();
    });
  });

  // =================================================================
  // GRUPO 5: Tests adicionales para cubrir branches faltantes
  // =================================================================

  describe('emitVouchers - Validaciones adicionales', () => {

    it('debe rechazar fechas de voucher fuera del período de estadía (before checkin)', async () => {
      // Arrange
      const stay_id = 1;
      const quantity = 1;
      const valid_from = '2025-10-01'; // Antes del checkin
      const valid_until = '2025-11-15';

      const mockStay = {
        id: 1,
        guest_name: 'John Doe',
        room_number: '101',
        checkin_date: '2025-11-05', // Checkin posterior a valid_from
        checkout_date: '2025-11-20',
        status: 'active'
      };

      mockDb.prepare().get.mockReturnValue(mockStay);

      // Act & Assert
      await expect(voucherService.emitVouchers({
        stay_id,
        quantity,
        valid_from,
        valid_until,
        correlation_id: 'test-123'
      })).rejects.toThrow('Las fechas del voucher deben estar dentro del período de estadía');
    });

    it('debe rechazar fechas de voucher fuera del período de estadía (after checkout)', async () => {
      // Arrange
      const stay_id = 1;
      const quantity = 1;
      const valid_from = '2025-11-05';
      const valid_until = '2025-11-25'; // Después del checkout

      const mockStay = {
        id: 1,
        guest_name: 'John Doe',
        room_number: '101',
        checkin_date: '2025-11-05',
        checkout_date: '2025-11-20', // Checkout anterior a valid_until
        status: 'active'
      };

      mockDb.prepare().get.mockReturnValue(mockStay);

      // Act & Assert
      await expect(voucherService.emitVouchers({
        stay_id,
        quantity,
        valid_from,
        valid_until,
        correlation_id: 'test-124'
      })).rejects.toThrow('Las fechas del voucher deben estar dentro del período de estadía');
    });

    it('debe rechazar valid_from posterior a valid_until', async () => {
      // Arrange
      const stay_id = 1;
      const quantity = 1;
      const valid_from = '2025-11-20';
      const valid_until = '2025-11-10'; // Anterior a valid_from

      const mockStay = {
        id: 1,
        guest_name: 'John Doe',
        room_number: '101',
        checkin_date: '2025-11-05',
        checkout_date: '2025-11-25',
        status: 'active'
      };

      mockDb.prepare().get.mockReturnValue(mockStay);

      // Act & Assert
      await expect(voucherService.emitVouchers({
        stay_id,
        quantity,
        valid_from,
        valid_until,
        correlation_id: 'test-125'
      })).rejects.toThrow('La fecha de inicio debe ser anterior a la fecha de fin');
    });
  });

  describe('validateVoucher - Estados adicionales', () => {

    it('debe rechazar voucher en estado cancelled', async () => {
      // Arrange
      const code = 'HOTEL-2025-0001';

      const mockVoucher = {
        id: 1,
        code: 'HOTEL-2025-0001',
        stay_id: 1,
        status: 'cancelled',
        valid_from: '2025-11-01',
        valid_until: '2025-12-31',
        guest_name: 'John Doe',
        room_number: '101',
        is_redeemed: false
      };

      mockDb.prepare().get.mockReturnValue(mockVoucher);

      // Act
      const result = await voucherService.validateVoucher(code, 'test-126');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('VOUCHER_CANCELLED');
      expect(result.voucher.status).toBe('cancelled');
    });

    it('debe rechazar voucher en estado expired', async () => {
      // Arrange
      const code = 'HOTEL-2025-0002';

      const mockVoucher = {
        id: 2,
        code: 'HOTEL-2025-0002',
        stay_id: 1,
        status: 'expired',
        valid_from: '2025-10-01',
        valid_until: '2025-10-31',
        guest_name: 'Jane Smith',
        room_number: '102',
        is_redeemed: false
      };

      mockDb.prepare().get.mockReturnValue(mockVoucher);

      // Act
      const result = await voucherService.validateVoucher(code, 'test-127');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('VOUCHER_EXPIRED');
      expect(result.voucher.status).toBe('expired');
    });

    it('debe rechazar voucher not yet valid (antes de valid_from)', async () => {
      // Arrange
      const code = 'HOTEL-2025-0003';

      const mockVoucher = {
        id: 3,
        code: 'HOTEL-2025-0003',
        stay_id: 1,
        status: 'active',
        valid_from: '2025-12-01', // Fecha futura
        valid_until: '2025-12-31',
        guest_name: 'Bob Johnson',
        room_number: '103',
        is_redeemed: false
      };

      mockDb.prepare().get.mockReturnValue(mockVoucher);

      // Act
      const result = await voucherService.validateVoucher(code, 'test-128');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('VOUCHER_NOT_YET_VALID');
      expect(result.valid_from).toBe('2025-12-01');
    });
  });

  describe('redeemVoucher - Validaciones adicionales', () => {

    it('debe rechazar voucher en estado cancelled al intentar canjear', async () => {
      // Arrange
      const mockVoucher = {
        id: 1,
        code: 'HOTEL-2025-0001',
        stay_id: 1,
        status: 'cancelled',
        valid_from: '2025-11-01',
        valid_until: '2025-12-31',
        guest_name: 'John Doe',
        room_number: '101'
      };

      mockDb.prepare().get.mockReturnValue(mockVoucher);

      // Act & Assert
      await expect(voucherService.redeemVoucher({
        code: 'HOTEL-2025-0001',
        cafeteria_id: 1,
        user_id: 'user-123',
        device_id: 'device-001',
        correlation_id: 'test-129'
      })).rejects.toThrow('Voucher en estado: cancelled');
    });

    it('debe rechazar voucher not yet valid al intentar canjear', async () => {
      // Arrange
      const mockVoucher = {
        id: 1,
        code: 'HOTEL-2025-0001',
        stay_id: 1,
        status: 'active',
        valid_from: '2025-12-01', // Fecha futura
        valid_until: '2025-12-31',
        guest_name: 'John Doe',
        room_number: '101'
      };

      mockDb.prepare().get.mockReturnValue(mockVoucher);

      // Act & Assert
      await expect(voucherService.redeemVoucher({
        code: 'HOTEL-2025-0001',
        cafeteria_id: 1,
        user_id: 'user-123',
        device_id: 'device-001',
        correlation_id: 'test-130'
      })).rejects.toThrow('Voucher aún no es válido');
    });

    it('debe auto-expirar y rechazar voucher expirado al intentar canjear', async () => {
      // Arrange
      const mockVoucher = {
        id: 1,
        code: 'HOTEL-2025-0001',
        stay_id: 1,
        status: 'active',
        valid_from: '2025-10-01',
        valid_until: '2025-10-31', // Fecha pasada
        guest_name: 'John Doe',
        room_number: '101'
      };

      mockDb.prepare().get.mockReturnValue(mockVoucher);
      mockDb.prepare().run.mockReturnValue({ changes: 1 });

      // Act & Assert
      await expect(voucherService.redeemVoucher({
        code: 'HOTEL-2025-0001',
        cafeteria_id: 1,
        user_id: 'user-123',
        device_id: 'device-001',
        correlation_id: 'test-131'
      })).rejects.toThrow('Voucher expirado');

      // Verificar que se actualizó el estado
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE vouchers SET status = ? WHERE id = ?'
      );
      expect(mockDb.prepare().run).toHaveBeenCalledWith('expired', 1);
    });
  });

  describe('cancelVoucher - Validación de estado cancelled', () => {

    it('debe rechazar cancelación de voucher ya cancelado', async () => {
      // Arrange
      const mockVoucher = {
        id: 1,
        code: 'HOTEL-2025-0001',
        stay_id: 1,
        status: 'cancelled', // Ya está cancelado
        valid_from: '2025-11-01',
        valid_until: '2025-12-31',
        guest_name: 'John Doe',
        room_number: '101',
        is_redeemed: false
      };

      mockDb.prepare().get
        .mockReturnValueOnce(mockVoucher) // Primera query del voucher
        .mockReturnValueOnce(null); // Segunda query de redemption

      // Act & Assert
      await expect(voucherService.cancelVoucher({
        code: 'HOTEL-2025-0001',
        reason: 'duplicate cancel',
        user_id: 'user-123',
        correlation_id: 'test-132'
      })).rejects.toThrow('Voucher ya está cancelado');
    });
  });
});
