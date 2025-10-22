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
      // 1. Buscar voucher por código
      const voucher = this.voucherRepository.findByCode(voucherCode);
      if (!voucher) {
        return {
          valid: false,
          error: 'Voucher no encontrado',
          code: voucherCode,
        };
      }

      // 2. Validar estado
      if (voucher.status !== 'active') {
        return {
          valid: false,
          error: `Voucher no está activo (estado: ${voucher.status})`,
          code: voucherCode,
          status: voucher.status,
        };
      }

      // 3. Validar expiración
      if (voucher.isExpired()) {
        return {
          valid: false,
          error: 'Voucher expirado',
          code: voucherCode,
          expiryDate: voucher.expiryDate,
        };
      }

      // 4. Validar que la estadía existe y está activa
      const stay = this.stayRepository.findById(voucher.stayId);
      if (!stay) {
        return {
          valid: false,
          error: 'Estadía asociada no encontrada',
          code: voucherCode,
        };
      }

      if (stay.status !== 'active') {
        return {
          valid: false,
          error: `Estadía no está activa (estado: ${stay.status})`,
          code: voucherCode,
          stayStatus: stay.status,
        };
      }

      this.logger.info(`Voucher validado: ${voucherCode}`, {
        voucherId: voucher.id,
        stayId: voucher.stayId,
      });

      return {
        valid: true,
        voucherId: voucher.id,
        code: voucher.code,
        stayId: voucher.stayId,
        status: voucher.status,
        daysRemaining: voucher.getDaysRemaining(),
        expiryDate: voucher.expiryDate,
        message: 'Voucher válido para canjear',
      };
    } catch (error) {
      this.logger.error('Error validando voucher', { error, voucherCode });
      throw error;
    }
  }
}
