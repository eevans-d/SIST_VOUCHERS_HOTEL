/**
 * QRService - Servicio para generar códigos QR
 * Utiliza Google Charts API - sin dependencias externas
 */
export class QRService {
  constructor(config = {}) {
    this.size = config.qrSize || 200;
    this.errorCorrectionLevel = config.errorCorrection || 'H';
    this.encoding = config.encoding || 'UTF-8';
  }

  /**
   * Generar URL de QR desde Google Charts
   * Formato: https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=DATA
   */
  generateQRUrl(text) {
    if (!text) {
      throw new Error('Se requiere texto para generar QR');
    }

    const encodedText = encodeURIComponent(text);
    const size = `${this.size}x${this.size}`;

    return `https://chart.googleapis.com/chart?cht=qr&chs=${size}&choe=${this.encoding}&chld=${this.errorCorrectionLevel}&chl=${encodedText}`;
  }

  /**
   * Generar texto para QR con formato estándar
   * Formato: VOC|id|code|stayId
   */
  generateQRText(voucherId, voucherCode, stayId) {
    if (!voucherId || !voucherCode || !stayId) {
      throw new Error('Se requieren voucherId, voucherCode y stayId');
    }

    return `VOC|${voucherId}|${voucherCode}|${stayId}`;
  }

  /**
   * Parsear texto de QR
   */
  parseQRText(qrText) {
    const parts = qrText.split('|');

    if (parts.length !== 4 || parts[0] !== 'VOC') {
      throw new Error('Formato de QR inválido');
    }

    return {
      type: parts[0],
      voucherId: parts[1],
      voucherCode: parts[2],
      stayId: parts[3]
    };
  }

  /**
   * Validar formato de QR
   */
  isValidQRFormat(qrText) {
    try {
      this.parseQRText(qrText);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generar QR completo con URL
   */
  generateQRWithMetadata(voucherId, voucherCode, stayId) {
    const qrText = this.generateQRText(voucherId, voucherCode, stayId);
    const qrUrl = this.generateQRUrl(qrText);

    return {
      text: qrText,
      url: qrUrl,
      voucherId,
      voucherCode,
      stayId,
      size: this.size,
      errorCorrection: this.errorCorrectionLevel
    };
  }

  /**
   * Generar múltiples QRs en lote
   */
  generateBatch(vouchersData) {
    return vouchersData.map(({ voucherId, voucherCode, stayId }) =>
      this.generateQRWithMetadata(voucherId, voucherCode, stayId)
    );
  }
}
