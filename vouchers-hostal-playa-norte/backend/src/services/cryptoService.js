const crypto = require('crypto');
const config = require('../config/environment');
const { logger } = require('../config/logger');

class CryptoService {
  /**
   * Genera firma HMAC para voucher
   */
  generateVoucherHMAC(voucherCode, validFrom, validUntil, stayId) {
    const data = `${voucherCode}|${validFrom}|${validUntil}|${stayId}`;
    
    const hmac = crypto
      .createHmac('sha256', config.VOUCHER_SECRET)
      .update(data)
      .digest('hex');
    
    logger.debug({
      event: 'hmac_generated',
      voucher_code: voucherCode,
      data_length: data.length
    });
    
    return hmac;
  }

  /**
   * Verifica firma HMAC (timing-safe)
   */
  verifyVoucherHMAC(voucherCode, validFrom, validUntil, stayId, receivedHmac) {
    const expectedHmac = this.generateVoucherHMAC(
      voucherCode, 
      validFrom, 
      validUntil, 
      stayId
    );
    
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedHmac, 'hex'),
        Buffer.from(receivedHmac, 'hex')
      );
      
      logger.debug({
        event: 'hmac_verification',
        voucher_code: voucherCode,
        valid: isValid
      });
      
      return isValid;
    } catch (error) {
      logger.warn({
        event: 'hmac_verification_failed',
        voucher_code: voucherCode,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Genera código único de voucher
   */
  generateVoucherCode(sequenceNumber) {
    const year = new Date().getFullYear();
    const paddedNumber = String(sequenceNumber).padStart(4, '0');
    return `${config.HOTEL_CODE}-${year}-${paddedNumber}`;
  }

  /**
   * Parsea datos del QR
   */
  parseQRData(qrData) {
    try {
      const parts = qrData.split('|');
      
      if (parts.length !== 3) {
        throw new Error('INVALID_QR_FORMAT');
      }
      
      return {
        code: parts[0],
        hmac: parts[1],
        validUntil: parts[2]
      };
    } catch (error) {
      logger.warn({
        event: 'qr_parse_failed',
        error: error.message
      });
      throw new Error('INVALID_QR_DATA');
    }
  }
}

module.exports = { CryptoService: new CryptoService() };