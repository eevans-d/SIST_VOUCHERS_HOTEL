/**
 * ValidateVoucher - Use Case para validar vouchers
 * Verifica que el voucher sea válido y pueda canjearse
 */
export class ValidateVoucher {
  constructor({ voucherRepository, stayRepository, logger }) {
    this.voucherRepository = voucherRepository;
    this.stayRepository = stayRepository;
    this.logger = logger;
  }

  /**
   * Ejecutar: Validar voucher
   */
  async execute({ voucherCode }) {
    try {
      const voucherResult = this._findVoucherOrResponse(voucherCode);
      if (voucherResult.response) return voucherResult.response;
      const { voucher } = voucherResult;

      const stateError = this._validateStatusOrResponse(voucher, voucherCode);
      if (stateError) return stateError;

      const expiryError = this._validateExpiryOrResponse(voucher, voucherCode);
      if (expiryError) return expiryError;

      const stayError = this._validateStayOrResponse(voucher, voucherCode);
      if (stayError) return stayError;

      this._logValidated(voucherCode, voucher);
      return this._formatValidResponse(voucher);
    } catch (error) {
      this.logger.error('Error validando voucher', { error, voucherCode });
      throw error;
    }
  }

  // Helpers privados extraídos para reducir tamaño de execute
  _findVoucherOrResponse(voucherCode) {
    const voucher = this.voucherRepository.findByCode(voucherCode);
    if (!voucher) {
      return { response: this._invalid({ voucherCode, error: 'Voucher no encontrado' }) };
    }
    return { voucher };
  }

  _validateStatusOrResponse(voucher, voucherCode) {
    if (voucher.status !== 'active') {
      return this._invalid({
        voucherCode,
        error: `Voucher no está activo (estado: ${voucher.status})`,
        extra: { status: voucher.status }
      });
    }
    return null;
  }

  _validateExpiryOrResponse(voucher, voucherCode) {
    if (voucher.isExpired()) {
      return this._invalid({
        voucherCode,
        error: 'Voucher expirado',
        extra: { expiryDate: voucher.expiryDate }
      });
    }
    return null;
  }

  _validateStayOrResponse(voucher, voucherCode) {
    const stay = this.stayRepository.findById(voucher.stayId);
    if (!stay) {
      return this._invalid({
        voucherCode,
        error: 'Estadía asociada no encontrada'
      });
    }
    if (stay.status !== 'active') {
      return this._invalid({
        voucherCode,
        error: `Estadía no está activa (estado: ${stay.status})`,
        extra: { stayStatus: stay.status }
      });
    }
    return null;
  }

  _logValidated(voucherCode, voucher) {
    this.logger.info(`Voucher validado: ${voucherCode}`, {
      voucherId: voucher.id,
      stayId: voucher.stayId
    });
  }

  _formatValidResponse(voucher) {
    return {
      valid: true,
      voucherId: voucher.id,
      code: voucher.code,
      stayId: voucher.stayId,
      status: voucher.status,
      daysRemaining: voucher.getDaysRemaining(),
      expiryDate: voucher.expiryDate,
      message: 'Voucher válido para canjear'
    };
  }

  _invalid({ voucherCode, error, extra = {} }) {
    return { valid: false, error, code: voucherCode, ...extra };
  }
}
