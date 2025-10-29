/**
 * RedeemVoucher - Use Case
 * Canjea un voucher para consumo en cafetería
 * 
 * Responsabilidades:
 * - Validar que el voucher puede ser canjeado
 * - Realizar el canje de forma atómica
 * - Registrar notas del canje
 * - Crear registro de transacción (para auditoría)
 * - Retornar confirmación
 * 
 * Flujo:
 * 1. Validar código de voucher
 * 2. Verificar vigencia
 * 3. Verificar que estadía está activa
 * 4. Realizar canje (atomic)
 * 5. Registrar transacción
 * 6. Retornar confirmación
 * 
 * @class RedeemVoucher
 */
class RedeemVoucher {
  /**
   * @param {VoucherRepository} voucherRepository - Repositorio de vouchers
   * @param {StayRepository} stayRepository - Repositorio de estadías
   * @param {Logger} logger - Logger para auditoría
   */
  constructor(voucherRepository, stayRepository, logger) {
    this.voucherRepository = voucherRepository;
    this.stayRepository = stayRepository;
    this.logger = logger;
  }

  /**
   * Ejecuta el caso de uso
   * 
   * @param {Object} input - Datos de entrada
   * @param {string} input.code - Código del voucher
   * @param {string} [input.notes] - Notas del canje (ej: "2 cafés, 1 pastel")
   * @param {string} [input.redeemedBy] - Usuario que canjea
   * @returns {Object} {success: boolean, data?: Voucher, stay?: Stay, error?: string}
   * 
   * @example
   * const result = redeemVoucher.execute({
   *   code: 'VOC-ABC-1234',
   *   notes: '2 cafés',
   *   redeemedBy: 'barista1@cafe.com'
   * });
   * 
   * if (result.success) {
   *   console.log('Canjeado:', result.data.code);
   *   console.log('Huésped:', result.stay.guestName);
   * }
   */
  execute(input) {
    const { code, notes = null, redeemedBy = 'system' } = input;

    try {
      // Validar entrada
      if (!code || code.trim().length === 0) {
        throw new Error('Código de voucher es requerido');
      }

      // Usar el método atómico del repositorio
      // Este valida y canjea en una única transacción
      const voucher = this.voucherRepository.validateAndRedeem(
        code.trim().toUpperCase(),
        notes
      );

      // Obtener información de la estadía para retornar
      const stay = this.stayRepository.findById(voucher.stayId);

      // Log de auditoría
      this.logger.info('Voucher canjeado exitosamente', {
        voucherId: voucher.id,
        code: voucher.code,
        stayId: voucher.stayId,
        notes,
        redeemedBy,
        redemptionTime: voucher.redemptionDate.toISOString(),
      });

      return {
        success: true,
        data: voucher,
        stay,
      };
    } catch (error) {
      this.logger.error('Error canjeando voucher', {
        code,
        error: error.message,
        redeemedBy,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Canjea múltiples vouchers (para órdenes en lote)
   * Útil para operaciones como "combo de productos"
   * 
   * @param {Object} input - Datos de entrada
   * @param {string[]} input.codes - Array de códigos
   * @param {string} [input.notes] - Notas de la orden
   * @param {string} [input.redeemedBy] - Usuario que canjea
   * @returns {Object} {success: boolean, redeemed: Voucher[], failed: {code, error}[], total: number}
   * 
   * @example
   * const result = redeemVoucher.executeBatch({
   *   codes: ['VOC-ABC-1234', 'VOC-DEF-5678'],
   *   notes: 'Combo desayuno',
   *   redeemedBy: 'barista1@cafe.com'
   * });
   */
  executeBatch(input) {
    const { codes, notes = null, redeemedBy = 'system' } = input;
    const redeemed = [];
    const failed = [];

    for (const code of codes) {
      const result = this.execute({
        code,
        notes,
        redeemedBy,
      });

      if (result.success) {
        redeemed.push(result.data);
      } else {
        failed.push({ code, error: result.error });
      }
    }

    this.logger.info('Canje en lote completado', {
      total: codes.length,
      redeemed: redeemed.length,
      failed: failed.length,
      redeemedBy,
    });

    return {
      success: failed.length === 0,
      redeemed,
      failed,
      total: codes.length,
    };
  }

  /**
   * Verifica si un voucher puede ser canjeado (sin ejecutar el canje)
   * 
   * @param {string} code - Código a verificar
   * @returns {Object} {canRedeem: boolean, reason?: string, daysRemaining?: number}
   */
  canRedeem(code) {
    try {
      const voucher = this.voucherRepository.findByCode(code);

      if (!voucher) {
        return { canRedeem: false, reason: 'Voucher no encontrado' };
      }

      if (voucher.status !== 'active') {
        return { canRedeem: false, reason: `Estado: ${voucher.status}` };
      }

      if (voucher.isExpired()) {
        return { canRedeem: false, reason: 'Expirado' };
      }

      // Verificar que stay está activo
      const stay = this.stayRepository.findById(voucher.stayId);
      if (!stay || stay.status !== 'active') {
        return { canRedeem: false, reason: 'Estadía no está activa' };
      }

      return {
        canRedeem: true,
        daysRemaining: voucher.getDaysRemaining(),
      };
    } catch (error) {
      return { canRedeem: false, reason: `Error: ${error.message}` };
    }
  }
}

module.exports = RedeemVoucher;
