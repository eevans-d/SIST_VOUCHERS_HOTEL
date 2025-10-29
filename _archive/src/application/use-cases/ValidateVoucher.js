/**
 * ValidateVoucher - Use Case
 * Valida que un voucher sea canjeable
 * 
 * Responsabilidades:
 * - Buscar voucher por código
 * - Verificar estado y vigencia
 * - Validar que la estadía existe y es válida
 * - Retornar estado de validación
 * 
 * Flujo:
 * 1. Buscar voucher por código
 * 2. Verificar que existe
 * 3. Validar estado (active)
 * 4. Validar fecha de expiración
 * 5. Validar que la estadía existe y está activa
 * 6. Retornar resultado
 * 
 * @class ValidateVoucher
 */
class ValidateVoucher {
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
   * @param {string} [input.validatedBy] - Usuario que valida (para auditoría)
   * @returns {Object} {valid: boolean, voucher?: Voucher, stay?: Stay, errors?: string[]}
   * 
   * @example
   * const result = validateVoucher.execute({
   *   code: 'VOC-ABC-1234',
   *   validatedBy: 'cafe@hotel.com'
   * });
   * 
   * if (result.valid) {
   *   console.log('Voucher válido:', result.voucher.code);
   *   console.log('Huésped:', result.stay.guestName);
   * } else {
   *   console.log('Errores:', result.errors);
   * }
   */
  execute(input) {
    const { code, validatedBy = 'system' } = input;
    const errors = [];

    try {
      // Validar entrada
      if (!code || code.trim().length === 0) {
        errors.push('Código de voucher es requerido');
        return { valid: false, errors };
      }

      // Buscar voucher
      const voucher = this.voucherRepository.findByCode(code.trim().toUpperCase());

      if (!voucher) {
        errors.push(`Voucher '${code}' no encontrado`);
        return { valid: false, errors };
      }

      // Validar estado
      if (voucher.status !== 'active') {
        errors.push(
          `Voucher no es válido. Estado: '${voucher.status}'. Solo 'active' puede canjearse.`
        );
      }

      // Validar expiración
      if (voucher.isExpired()) {
        errors.push(
          `Voucher expirado. Fecha límite: ${voucher.expiryDate.toISOString()}`
        );
      }

      // Si hay errores, no continuar validación de stay
      if (errors.length > 0) {
        this.logger.warn('Validación de voucher fallida', {
          code,
          status: voucher.status,
          errors,
          validatedBy,
        });

        return { valid: false, errors, voucher };
      }

      // Validar que la estadía existe y está activa
      const stay = this.stayRepository.findById(voucher.stayId);

      if (!stay) {
        errors.push(`Estadía '${voucher.stayId}' no encontrada`);
        return { valid: false, errors };
      }

      if (stay.status !== 'active') {
        errors.push(
          `Estadía no está activa. Estado: '${stay.status}'`
        );
        return { valid: false, errors };
      }

      // Log auditoría - validación exitosa
      this.logger.info('Voucher validado exitosamente', {
        code,
        voucherId: voucher.id,
        stayId: stay.id,
        validatedBy,
      });

      return {
        valid: true,
        voucher,
        stay,
      };
    } catch (error) {
      errors.push(`Error interno: ${error.message}`);

      this.logger.error('Error validando voucher', {
        code,
        error: error.message,
        validatedBy,
      });

      return {
        valid: false,
        errors,
      };
    }
  }

  /**
   * Validación simplificada (solo verifica que el código existe y está activo)
   * Útil para validación rápida sin verificar stay
   * 
   * @param {string} code - Código a validar
   * @returns {boolean} true si es válido
   */
  isQuickValid(code) {
    const voucher = this.voucherRepository.findByCode(code);
    return voucher && voucher.isValid();
  }
}

module.exports = ValidateVoucher;
