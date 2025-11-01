const QRCode = require('qrcode');
const { logger } = require('../config/logger');
const { CryptoService } = require('./cryptoService');

class QRService {
  /**
   * Genera imagen QR para voucher
   */
  async generateVoucherQR(voucher) {
    try {
      // Formato: code|hmac|valid_until
      const qrData = `${voucher.code}|${voucher.hmac_signature}|${voucher.valid_until}`;

      const qrImage = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      logger.debug({
        event: 'qr_generated',
        voucher_code: voucher.code,
        data_length: qrData.length
      });

      return {
        qr_data: qrData,
        qr_image: qrImage
      };
    } catch (error) {
      logger.error({
        event: 'qr_generation_failed',
        voucher_code: voucher.code,
        error: error.message
      });
      throw new Error('QR_GENERATION_FAILED');
    }
  }

  /**
   * Valida formato de QR
   */
  validateQRFormat(qrData) {
    try {
      const parsed = CryptoService.parseQRData(qrData);

      // Validar formato de código
      const codeRegex = /^[A-Z]+-\d{4}-\d{4}$/;
      if (!codeRegex.test(parsed.code)) {
        return { valid: false, error: 'INVALID_CODE_FORMAT' };
      }

      // Validar formato de fecha
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(parsed.validUntil)) {
        return { valid: false, error: 'INVALID_DATE_FORMAT' };
      }

      // Validar formato de HMAC
      const hmacRegex = /^[a-f0-9]{64}$/;
      if (!hmacRegex.test(parsed.hmac)) {
        return { valid: false, error: 'INVALID_HMAC_FORMAT' };
      }

      return { valid: true, parsed };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = { QRService: new QRService() };
