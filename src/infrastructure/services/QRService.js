/**
 * QRService - Genera y gestiona códigos QR para vouchers
 * 
 * Formato del QR:
 * - Texto: VOC|{voucherId}|{code}|{stayId}
 * - Ejemplo: VOC|123e4567-e89b-12d3|VOC-ABC-1234|456e7890-f12g-34h5
 * 
 * Nota: Se usa qrcode library cuando esté disponible.
 * Por ahora genera un URL/DataURL compatible.
 * 
 * @class QRService
 */
class QRService {
  /**
   * @param {Object} [options] - Opciones de configuración
   * @param {string} [options.errorCorrection='M'] - Nivel de corrección (L, M, Q, H)
   * @param {number} [options.size=200] - Tamaño de la imagen (px)
   * @param {string} [options.margin=10] - Margen alrededor del QR
   */
  constructor(options = {}) {
    this.options = {
      errorCorrection: options.errorCorrection || 'M',
      size: options.size || 200,
      margin: options.margin || 10,
    };
  }

  /**
   * Genera el texto a codificar en el QR
   * 
   * @param {Object} data - Datos del voucher
   * @param {string} data.id - ID del voucher
   * @param {string} data.code - Código del voucher
   * @param {string} data.stayId - ID de la estadía
   * @returns {string} Texto a codificar
   * @example
   * const text = qrService.generateQRText({
   *   id: '123e4567',
   *   code: 'VOC-ABC-1234',
   *   stayId: '456e7890'
   * });
   * // Returns: 'VOC|123e4567|VOC-ABC-1234|456e7890'
   */
  generateQRText(data) {
    return `VOC|${data.id}|${data.code}|${data.stayId}`;
  }

  /**
   * Genera una URL para visualizar el QR (usando servicio público)
   * Usa Google Charts QR Code API (gratuito, sin dependencias)
   * 
   * @param {string} text - Texto a codificar
   * @returns {string} URL que genera QR
   * @example
   * const url = qrService.generateQRUrl('VOC|...');
   * // Returns: 'https://chart.googleapis.com/chart?cht=qr&chs=...'
   */
  generateQRUrl(text) {
    const encoded = encodeURIComponent(text);
    return `https://chart.googleapis.com/chart?cht=qr&chs=${this.options.size}x${this.options.size}&chld=${this.options.errorCorrection}|${this.options.margin}&chl=${encoded}`;
  }

  /**
   * Genera un Data URL de SVG simple para el QR (minimal)
   * Esto es un placeholder que podría reemplazarse con qrcode.js
   * 
   * @param {string} text - Texto a codificar
   * @returns {string} Data URL SVG
   */
  generateQRDataUrl(text) {
    // Placeholder: retorna URL de Google Charts que es funcional
    // En producción, usar librería qrcode.js para generar SVG/PNG localmente
    return this.generateQRUrl(text);
  }

  /**
   * Crea el QR completo para un voucher
   * 
   * @param {Voucher} voucher - Instancia de Voucher
   * @returns {Object} {text: string, url: string, dataUrl: string}
   */
  generateQR(voucher) {
    const text = this.generateQRText({
      id: voucher.id,
      code: voucher.code,
      stayId: voucher.stayId,
    });

    return {
      text,
      url: this.generateQRUrl(text),
      dataUrl: this.generateQRDataUrl(text),
    };
  }

  /**
   * Decodifica un texto QR y valida su formato
   * 
   * @param {string} qrText - Texto decodificado del QR
   * @returns {Object|null} {id, code, stayId} o null si es inválido
   * @example
   * const data = qrService.parseQRText('VOC|123e4567|VOC-ABC|456e7890');
   * // Returns: {id: '123e4567', code: 'VOC-ABC', stayId: '456e7890'}
   */
  parseQRText(qrText) {
    const parts = qrText.split('|');

    if (parts.length !== 4 || parts[0] !== 'VOC') {
      return null;
    }

    return {
      id: parts[1],
      code: parts[2],
      stayId: parts[3],
    };
  }

  /**
   * Valida que un QR sea válido (formato correcto)
   * 
   * @param {string} qrText - Texto a validar
   * @returns {boolean} true si es válido
   */
  isValidQRFormat(qrText) {
    return this.parseQRText(qrText) !== null;
  }

  /**
   * Genera un código QR simple basado en UUID (sin librería externa)
   * Útil para testing o caso donde no hay qrcode disponible
   * 
   * @param {string} text - Texto a codificar
   * @returns {string} Representación simplificada del QR
   */
  generateSimpleQRBase64(text) {
    // Genera un pseudo-QR usando caracteres
    // En producción, usar librería QR real
    const encoded = Buffer.from(text).toString('base64');
    return `qr:${encoded}`;
  }

  /**
   * Crea metadata completa del QR incluyendo instrucciones de validación
   * 
   * @param {Voucher} voucher - Voucher a codificar
   * @param {Stay} stay - Estadía asociada (opcional, para incluir info)
   * @returns {Object} Metadata completa del QR
   */
  generateQRWithMetadata(voucher, stay = null) {
    const qr = this.generateQR(voucher);

    return {
      qrCode: qr,
      metadata: {
        voucherId: voucher.id,
        voucherCode: voucher.code,
        stayId: voucher.stayId,
        status: voucher.status,
        expiryDate: voucher.expiryDate.toISOString(),
        stayInfo: stay ? {
          roomNumber: stay.roomNumber,
          hotelCode: stay.hotelCode,
          guestName: stay.guestName,
        } : null,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Genera múltiples QRs (por ejemplo, para reportes)
   * 
   * @param {Voucher[]} vouchers - Array de vouchers
   * @returns {Array} Array de QRs generados
   */
  generateMultipleQRs(vouchers) {
    return vouchers.map((v) => this.generateQR(v));
  }
}

module.exports = QRService;
