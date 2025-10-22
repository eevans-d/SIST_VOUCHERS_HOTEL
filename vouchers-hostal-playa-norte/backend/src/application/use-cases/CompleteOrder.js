/**
 * CompleteOrder - Use Case para completar y cancelar órdenes
 */
export class CompleteOrder {
  constructor({ orderRepository, voucherRepository, logger }) {
    this.orderRepository = orderRepository;
    this.voucherRepository = voucherRepository;
    this.logger = logger;
  }

  /**
   * Ejecutar: Completar orden aplicando vouchers como descuentos
   */
  async execute({ orderId, voucherCodes = [] }) {
    try {
      // 1. Buscar orden
      const order = this.orderRepository.findById(orderId);
      if (!order) {
        throw new AppError('Orden no encontrada', 404);
      }

      // 2. Validar que está abierta
      if (order.status !== 'open') {
        throw new AppError(`Orden no está abierta (estado: ${order.status})`, 400);
      }

      // 3. Validar que tiene items
      if (order.items.length === 0) {
        throw new AppError('Orden debe tener items', 400);
      }

      // 4. Procesar vouchers
      if (voucherCodes.length > 0) {
        let totalDiscount = 0;
        const appliedVouchers = [];

        for (const code of voucherCodes) {
          try {
            // Validar y canjear voucher
            const result = this.voucherRepository.validateAndRedeem(code, `Canjeado en orden: ${orderId}`);
            appliedVouchers.push(result.voucherId);
            totalDiscount += 10; // Descuento por defecto por voucher
          } catch (error) {
            this.logger.warn(`Voucher no válido: ${code}`, { orderId });
            // Continuar con otros vouchers
          }
        }

        // Aplicar descuentos
        if (appliedVouchers.length > 0) {
          order.vouchersUsed = appliedVouchers;
          order.discountAmount = totalDiscount;
        }
      }

      // 5. Completar orden
      order.complete();

      // 6. Guardar en BD
      this.orderRepository.update(order);

      this.logger.info(`Orden completada: ${orderId}`, {
        stayId: order.stayId,
        finalTotal: order.finalTotal,
        discountApplied: order.discountAmount,
      });

      return {
        id: order.id,
        status: order.status,
        total: order.total,
        discount: order.discountAmount,
        finalTotal: order.finalTotal,
        vouchersApplied: order.vouchersUsed.length,
        message: 'Orden completada exitosamente',
      };
    } catch (error) {
      this.logger.error('Error completando orden', { error, orderId });
      throw error;
    }
  }

  /**
   * Ejecutar: Cancelar orden
   */
  async cancel({ orderId, reason = '' }) {
    try {
      // 1. Buscar orden
      const order = this.orderRepository.findById(orderId);
      if (!order) {
        throw new AppError('Orden no encontrada', 404);
      }

      // 2. Validar que puede cancelarse
      if (!['open', 'completed'].includes(order.status)) {
        throw new AppError(
          `Orden no puede cancelarse (estado: ${order.status})`,
          400
        );
      }

      // 3. Cancelar
      order.cancel(reason);

      // 4. Guardar en BD
      this.orderRepository.update(order);

      this.logger.info(`Orden cancelada: ${orderId}`, {
        stayId: order.stayId,
        reason,
      });

      return {
        id: order.id,
        status: order.status,
        message: 'Orden cancelada',
      };
    } catch (error) {
      this.logger.error('Error cancelando orden', { error, orderId });
      throw error;
    }
  }
}
