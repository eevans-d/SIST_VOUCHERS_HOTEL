// CryptoService REAL Coverage Tests con ES Modules
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock de dependencias antes de importar CryptoService
jest.unstable_mockModule('crypto', () => ({
  default: {
    createHmac: jest.fn(),
    timingSafeEqual: jest.fn()
  }
}));

jest.unstable_mockModule('../../../src/config/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.unstable_mockModule('../../../src/config/environment.js', () => ({
  default: {
    VOUCHER_SECRET: 'test-secret-key',
    HOTEL_CODE: 'HPN'
  }
}));

describe('CryptoService - Real Coverage Tests', () => {
  let cryptoService, crypto, logger, config;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import mocked modules
    crypto = (await import('crypto')).default;
    const loggerModule = await import('../../../src/config/logger.js');
    logger = loggerModule.logger;
    config = (await import('../../../src/config/environment.js')).default;

    // Setup crypto mocks
    const mockHmac = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-hmac-signature')
    };
    crypto.createHmac.mockReturnValue(mockHmac);
    crypto.timingSafeEqual.mockReturnValue(true);

    // Import CryptoService after mocks are setup
    const cryptoModule = await import('../../../src/services/cryptoService.js');
    cryptoService = cryptoModule.cryptoService;
  });

  describe('generateVoucherHMAC', () => {
    it('debería generar HMAC correctamente', () => {
      const voucherCode = 'HPN-2024-0001';
      const validFrom = '2024-01-01';
      const validUntil = '2024-01-31';
      const stayId = 123;

      const result = cryptoService.generateVoucherHMAC(
        voucherCode,
        validFrom,
        validUntil,
        stayId
      );

      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', 'test-secret-key');
      expect(result).toBe('mock-hmac-signature');
      expect(logger.debug).toHaveBeenCalled();
    });

    it('debería combinar datos en formato correcto', () => {
      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hmac-result')
      };
      crypto.createHmac.mockReturnValue(mockHmac);

      cryptoService.generateVoucherHMAC('CODE', '2024-01-01', '2024-01-31', 456);

      expect(mockHmac.update).toHaveBeenCalledWith('CODE|2024-01-01|2024-01-31|456');
      expect(mockHmac.digest).toHaveBeenCalledWith('hex');
    });
  });

  describe('verifyVoucherHMAC', () => {
    it('debería verificar HMAC válido', () => {
      crypto.timingSafeEqual.mockReturnValue(true);

      const result = cryptoService.verifyVoucherHMAC(
        'HPN-2024-0001',
        '2024-01-01',
        '2024-01-31',
        123,
        'mock-hmac-signature'
      );

      expect(result).toBe(true);
      expect(crypto.timingSafeEqual).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'hmac_verification',
          valid: true
        })
      );
    });

    it('debería rechazar HMAC inválido', () => {
      crypto.timingSafeEqual.mockReturnValue(false);

      const result = cryptoService.verifyVoucherHMAC(
        'HPN-2024-0001',
        '2024-01-01',
        '2024-01-31',
        123,
        'wrong-hmac'
      );

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'hmac_verification',
          valid: false
        })
      );
    });

    it('debería manejar errores de comparación', () => {
      crypto.timingSafeEqual.mockImplementation(() => {
        throw new Error('Buffer length mismatch');
      });

      const result = cryptoService.verifyVoucherHMAC(
        'HPN-2024-0001',
        '2024-01-01',
        '2024-01-31',
        123,
        'invalid'
      );

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'hmac_verification_failed'
        })
      );
    });
  });

  describe('generateVoucherCode', () => {
    it('debería generar código con formato correcto', () => {
      const result = cryptoService.generateVoucherCode(1);

      const year = new Date().getFullYear();
      expect(result).toBe(`HPN-${year}-0001`);
    });

    it('debería agregar padding a números pequeños', () => {
      const result = cryptoService.generateVoucherCode(42);

      const year = new Date().getFullYear();
      expect(result).toBe(`HPN-${year}-0042`);
    });

    it('debería manejar números grandes sin truncar', () => {
      const result = cryptoService.generateVoucherCode(12345);

      const year = new Date().getFullYear();
      expect(result).toBe(`HPN-${year}-12345`);
    });
  });

  describe('parseQRData', () => {
    it('debería parsear datos de QR válidos', () => {
      const qrData = 'HPN-2024-0001|mock-hmac|2024-01-31';

      const result = cryptoService.parseQRData(qrData);

      expect(result).toEqual({
        code: 'HPN-2024-0001',
        hmac: 'mock-hmac',
        validUntil: '2024-01-31'
      });
    });

    it('debería fallar con formato inválido', () => {
      const qrData = 'invalid-format';

      expect(() => {
        cryptoService.parseQRData(qrData);
      }).toThrow('INVALID_QR_DATA');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'qr_parse_failed'
        })
      );
    });

    it('debería fallar con datos incompletos', () => {
      const qrData = 'CODE|HMAC'; // Solo 2 partes en lugar de 3

      expect(() => {
        cryptoService.parseQRData(qrData);
      }).toThrow('INVALID_QR_DATA');
    });

    it('debería fallar con datos extras', () => {
      const qrData = 'CODE|HMAC|DATE|EXTRA'; // 4 partes en lugar de 3

      expect(() => {
        cryptoService.parseQRData(qrData);
      }).toThrow('INVALID_QR_DATA');
    });
  });
});
