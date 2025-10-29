const { v4: uuidv4 } = require('uuid');
const Voucher = require('../../domain/entities/Voucher');

/**
 * GenerateVoucher - Use Case
 * Genera un nuevo voucher para una estadía
 * 
 * Responsabilidades:
 * - Validar que la estadía existe
 * - Generar código único de voucher
 * - Crear código QR
 * - Persistir en BD
 * - Retornar voucher con QR
 * 
 * Flujo:
 * 1. Verificar que stay existe y está en estado válido
 * 2. Crear instancia de Voucher con código único
 * 3. Generar código QR
 * 4. Guardar en BD
 * 5. Retornar voucher con QR
 * 
 * @class GenerateVoucher
 */
class GenerateVoucher {
  /**
   * @param {StayRepository} stayRepository - Repositorio de estadías
   * @param {VoucherRepository} voucherRepository - Repositorio de vouchers
   * @param {QRService} qrService - Servicio de generación de QR
   * @param {Logger} logger - Logger para auditoría
   */
  constructor(stayRepository, voucherRepository, qrService, logger) {
    this.stayRepository = stayRepository;
    this.voucherRepository = voucherRepository;
    this.qrService = qrService;
    this.logger = logger;
  }

  /**
   * Ejecuta el caso de uso
   * 
   * @param {Object} input - Datos de entrada
   * @param {string} input.stayId - ID de la estadía
   * @param {Date} [input.expiryDate] - Fecha de expiración (default: 30 días)
   * @param {string} [input.requestedBy] - Usuario que solicita (para auditoría)
   * @returns {Object} {success: boolean, data: Voucher, error?: string}
   * 
   * @example
   * const result = await generateVoucher.execute({
   *   stayId: '123e4567-e89b-12d3-a456-426614174000',
   *   expiryDate: new Date('2025-12-31'),
   *   requestedBy: 'admin@hotel.com'
   * });
   * 
   * if (result.success) {
   *   console.log('Voucher:', result.data.code);
   *   console.log('QR URL:', result.data.qrCode);
   * }
   */
  execute(input) {
    const { stayId, expiryDate, requestedBy = 'system' } = input;

    try {
      // Validar entrada
      if (!stayId) {
        throw new Error('stayId es requerido');
      }

      // Verificar que la estadía existe
      const stay = this.stayRepository.findById(stayId);
      if (!stay) {
        throw new Error(`Estadía '${stayId}' no encontrada`);
      }

      // Validar que la estadía está en estado válido para generar voucher
      if (!['pending', 'active'].includes(stay.status)) {
        throw new Error(
          `No se puede generar voucher para estadía en estado '${stay.status}'`
        );
      }

      // Crear voucher
      const voucher = Voucher.create({
        stayId,
        expiryDate: expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Asignar ID
      voucher.id = uuidv4();

      // Generar QR
      const qr = this.qrService.generateQR(voucher);
      voucher.qrCode = qr.url;

      // Guardar en BD
      this.voucherRepository.save(voucher);

      // Log auditoría
      this.logger.info('Voucher generado', {
        voucherId: voucher.id,
        stayId: voucher.stayId,
        code: voucher.code,
        requestedBy,
      });

      return {
        success: true,
        data: voucher,
      };
    } catch (error) {
      this.logger.error('Error generando voucher', {
        error: error.message,
        stayId,
        requestedBy,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = GenerateVoucher;
