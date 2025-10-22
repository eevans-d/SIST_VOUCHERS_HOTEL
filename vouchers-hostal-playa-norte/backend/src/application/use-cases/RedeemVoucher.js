/**
 * RedeemVoucher - Use Case para redimir vouchers
 * Realiza redención atómica con validación
 */
export class RedeemVoucher {
  constructor({ voucherRepository, logger }) {
    this.voucherRepository = voucherRepository;
    this.logger = logger;
  }

  /**
   * Ejecutar: Canjear voucher
   */
  async execute({ voucherCode, notes = '' }) {
    try {
      // Usar operación atómica del repository
      const result = this.voucherRepository.validateAndRedeem(voucherCode, notes);

      this.logger.info(`Voucher canjeado: ${voucherCode}`, {
        voucherId: result.voucherId,
      });

      return {
        success: true,
        voucherId: result.voucherId,
        status: result.status,
        message: 'Voucher canjeado exitosamente',
      };
    } catch (error) {
      this.logger.warn(`Error canjeando voucher: ${voucherCode}`, {
        error: error.message,
      });

      throw new AppError(error.message, 400);
    }
  }

  /**
   * Ejecutar lote: Canjear múltiples vouchers
   */
  async executeBatch({ voucherCodes, notes = '' }) {
    try {
      const result = this.voucherRepository.validateAndRedeemBatch(
        voucherCodes,
        notes
      );

      const summary = {
        total: voucherCodes.length,
        successful: result.successful.length,
        failed: result.failed.length,
        successful_list: result.successful,
        failed_list: result.failed,
        message: `${result.successful.length} vouchers canjeados, ${result.failed.length} fallidos`,
      };

      this.logger.info('Lote de vouchers procesado', summary);

      return summary;
    } catch (error) {
      this.logger.error('Error procesando lote de vouchers', { error });
      throw error;
    }
  }

  /**
   * Validar si un voucher puede ser canjeado
   */
  async canRedeem(voucherCode) {
    try {
      const voucher = this.voucherRepository.findByCode(voucherCode);

      if (!voucher) {
        return { canRedeem: false, reason: 'Voucher no encontrado' };
      }

      if (voucher.status !== 'active') {
        return {
          canRedeem: false,
          reason: `Voucher no está activo (${voucher.status})`,
        };
      }

      if (voucher.isExpired()) {
        return { canRedeem: false, reason: 'Voucher expirado' };
      }

      return {
        canRedeem: true,
        voucherId: voucher.id,
        expiryDate: voucher.expiryDate,
      };
    } catch (error) {
      this.logger.error('Error validando redención', { error });
      throw error;
    }
  }
}
