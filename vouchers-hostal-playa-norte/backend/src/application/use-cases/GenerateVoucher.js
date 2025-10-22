import { Voucher } from '../../domain/entities/Voucher.js';

/**
 * GenerateVoucher - Use Case para generar nuevos vouchers
 * Genera código único, QR y persiste en BD
 */
export class GenerateVoucher {
  constructor({ voucherRepository, stayRepository, qrService, logger }) {
    this.voucherRepository = voucherRepository;
    this.stayRepository = stayRepository;
    this.qrService = qrService;
    this.logger = logger;
  }

  /**
   * Ejecutar: Generar nuevo voucher
   */
  async execute({ stayId, expiryDays = 30 }) {
    try {
      // 1. Validar que la estadía existe
      const stay = this.stayRepository.findById(stayId);
      if (!stay) {
        throw new AppError('Estadía no encontrada', 404);
      }

      // 2. Validar que la estadía está activa
      if (stay.status !== 'active') {
        throw new AppError('Estadía debe estar activa', 400);
      }

      // 3. Generar código único
      const voucherCode = this.generateUniqueCode();

      // 4. Calcular fecha de expiración
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      // 5. Crear voucher
      const voucher = Voucher.create({
        stayId,
        code: voucherCode,
        qrCode: '', // Se generará después
        expiryDate,
      });

      // 6. Generar QR
      const qrData = this.qrService.generateQRWithMetadata(
        voucher.id,
        voucher.code,
        stayId
      );
      voucher.qrCode = qrData.url;

      // 7. Activar voucher
      voucher.activate();

      // 8. Guardar en BD
      const voucherId = this.voucherRepository.save(voucher);

      this.logger.info(`Voucher generado: ${voucherId}`, {
        stayId,
        code: voucherCode,
        expiryDate,
      });

      return {
        id: voucher.id,
        code: voucher.code,
        qrCode: voucher.qrCode,
        status: voucher.status,
        expiryDate: voucher.expiryDate,
        message: 'Voucher generado exitosamente',
      };
    } catch (error) {
      this.logger.error('Error generando voucher', { error, stayId });
      throw error;
    }
  }

  /**
   * Generar código único alfanumérico
   */
  generateUniqueCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < 10; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  }
}
