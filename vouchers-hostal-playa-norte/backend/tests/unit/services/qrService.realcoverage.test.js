/**
 * @fileoverview Tests de Cobertura Real para QRService
 *
 * OBJETIVO: 90%+ coverage del servicio de generación de códigos QR
 *
 * COBERTURA:
 * - generateVoucherQR: generación exitosa, manejo de errores
 * - validateQRFormat: validación exitosa, formatos inválidos (código, fecha, HMAC, parsing)
 */

import { jest } from '@jest/globals';

// ===================================================================
// MOCKS - DEBEN definirse ANTES de los imports
// ===================================================================

// Mock QRCode library
const mockToDataURL = jest.fn();
await jest.unstable_mockModule('qrcode', () => ({
  default: {
    toDataURL: mockToDataURL
  }
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

// Mock CryptoService
await jest.unstable_mockModule('../../../src/services/cryptoService.js', () => ({
  cryptoService: {
    parseQRData: jest.fn()
  },
  CryptoService: class {}
}));

// ===================================================================
// IMPORTS - Después de definir mocks
// ===================================================================

const { qrService } = await import('../../../src/services/qrService.js');
const { logger } = await import('../../../src/config/logger.js');
const { cryptoService } = await import('../../../src/services/cryptoService.js');
const QRCode = (await import('qrcode')).default;

// ===================================================================
// TEST SUITE
// ===================================================================

describe('QRService - Cobertura Real', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =================================================================
  // GRUPO 1: generateVoucherQR - Generación exitosa
  // =================================================================

  describe('generateVoucherQR', () => {

    test('debe generar QR exitosamente con datos válidos', async () => {
      // Arrange
      const voucher = {
        code: 'HOTEL-2025-0001',
        hmac_signature: 'abc123def456789012345678901234567890123456789012345678901234',
        valid_until: '2025-12-31'
      };

      const mockQRImage = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
      mockToDataURL.mockResolvedValue(mockQRImage);

      // Act
      const result = await qrService.generateVoucherQR(voucher);

      // Assert
      expect(result).toEqual({
        qr_data: 'HOTEL-2025-0001|abc123def456789012345678901234567890123456789012345678901234|2025-12-31',
        qr_image: mockQRImage
      });

      // Verificar configuración del QR
      expect(mockToDataURL).toHaveBeenCalledWith(
        'HOTEL-2025-0001|abc123def456789012345678901234567890123456789012345678901234|2025-12-31',
        {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        }
      );

      // Verificar logging
      expect(logger.debug).toHaveBeenCalledWith({
        event: 'qr_generated',
        voucher_code: 'HOTEL-2025-0001',
        data_length: 87
      });
    });

    test('debe manejar error en generación de QR', async () => {
      // Arrange
      const voucher = {
        code: 'HOTEL-2025-0002',
        hmac_signature: 'xyz789',
        valid_until: '2025-11-30'
      };

      const qrError = new Error('QRCode library error');
      mockToDataURL.mockRejectedValue(qrError);

      // Act & Assert
      await expect(qrService.generateVoucherQR(voucher))
        .rejects.toThrow('QR_GENERATION_FAILED');

      // Verificar error logging
      expect(logger.error).toHaveBeenCalledWith({
        event: 'qr_generation_failed',
        voucher_code: 'HOTEL-2025-0002',
        error: 'QRCode library error'
      });
    });

  });

  // =================================================================
  // GRUPO 2: validateQRFormat - Validación exitosa
  // =================================================================

  describe('validateQRFormat - casos válidos', () => {

    test('debe validar QR con formato correcto', () => {
      // Arrange - HMAC debe tener exactamente 64 caracteres hexadecimales
      const validHmac = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
      const qrData = `HOTEL-2025-0001|${validHmac}|2025-12-31`;

      cryptoService.parseQRData.mockReturnValue({
        code: 'HOTEL-2025-0001',
        hmac: validHmac,
        validUntil: '2025-12-31'
      });      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual({
        code: 'HOTEL-2025-0001',
        hmac: validHmac,
        validUntil: '2025-12-31'
      });
      expect(cryptoService.parseQRData).toHaveBeenCalledWith(qrData);
    });

  });

  // =================================================================
  // GRUPO 3: validateQRFormat - Formatos inválidos
  // =================================================================

  describe('validateQRFormat - casos inválidos', () => {

    test('debe rechazar código con formato inválido', () => {
      // Arrange
      const validHmac = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
      const qrData = `INVALID_CODE|${validHmac}|2025-12-31`;

      cryptoService.parseQRData.mockReturnValue({
        code: 'INVALID_CODE',  // No cumple patrón [A-Z]+-\d{4}-\d{4}
        hmac: validHmac,
        validUntil: '2025-12-31'
      });      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_CODE_FORMAT');
    });

    test('debe rechazar fecha con formato inválido', () => {
      // Arrange
      const validHmac = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
      const qrData = `HOTEL-2025-0001|${validHmac}|31/12/2025`;

      cryptoService.parseQRData.mockReturnValue({
        code: 'HOTEL-2025-0001',
        hmac: validHmac,
        validUntil: '31/12/2025'  // Formato incorrecto (debe ser YYYY-MM-DD)
      });      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_DATE_FORMAT');
    });

    test('debe rechazar HMAC con formato inválido', () => {
      // Arrange
      const qrData = 'HOTEL-2025-0001|INVALID_HMAC|2025-12-31';

      cryptoService.parseQRData.mockReturnValue({
        code: 'HOTEL-2025-0001',
        hmac: 'INVALID_HMAC',  // No es hexadecimal de 64 caracteres
        validUntil: '2025-12-31'
      });

      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_HMAC_FORMAT');
    });

    test('debe manejar error en parsing de QR', () => {
      // Arrange
      const qrData = 'MALFORMED_QR_DATA';

      cryptoService.parseQRData.mockImplementation(() => {
        throw new Error('INVALID_QR_FORMAT');
      });

      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_QR_FORMAT');
    });

  });

  // =================================================================
  // GRUPO 4: Edge Cases y Validación de Regex
  // =================================================================

  describe('validateQRFormat - edge cases', () => {

    test('debe validar código con diferentes prefijos', () => {
      // Arrange
      const validHmac = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
      const qrData = `PROMO-2025-9999|${validHmac}|2025-12-31`;

      cryptoService.parseQRData.mockReturnValue({
        code: 'PROMO-2025-9999',
        hmac: validHmac,
        validUntil: '2025-12-31'
      });      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(true);
    });

    test('debe rechazar código con números incorrectos', () => {
      // Arrange
      const validHmac = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
      const qrData = `HOTEL-2025-001|${validHmac}|2025-12-31`;  // Solo 3 dígitos en lugar de 4

      cryptoService.parseQRData.mockReturnValue({
        code: 'HOTEL-2025-001',
        hmac: validHmac,
        validUntil: '2025-12-31'
      });      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_CODE_FORMAT');
    });

    test('debe rechazar HMAC con longitud incorrecta', () => {
      // Arrange
      const qrData = 'HOTEL-2025-0001|abc123|2025-12-31';

      cryptoService.parseQRData.mockReturnValue({
        code: 'HOTEL-2025-0001',
        hmac: 'abc123',  // Solo 6 caracteres en lugar de 64
        validUntil: '2025-12-31'
      });

      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_HMAC_FORMAT');
    });

    test('debe rechazar HMAC con caracteres no hexadecimales', () => {
      // Arrange
      const invalidHmac = 'GGGG123def456789012345678901234567890123456789012345678901234';  // 'G' no es hex
      const qrData = `HOTEL-2025-0001|${invalidHmac}|2025-12-31`;

      cryptoService.parseQRData.mockReturnValue({
        code: 'HOTEL-2025-0001',
        hmac: invalidHmac,
        validUntil: '2025-12-31'
      });      // Act
      const result = qrService.validateQRFormat(qrData);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_HMAC_FORMAT');
    });

  });

});
