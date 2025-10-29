/**
 * CompleteOrder - Use Case
 * Completa una orden (la cierra para que no se agreguen más items)
 * 
 * Responsabilidades:
 * - Validar que la orden existe
 * - Validar que tiene items
 * - Marcar como completada
 * - Persistir cambios
 * 
 * @class CompleteOrder
 */
class CompleteOrder {
  /**
   * @param {OrderRepository} orderRepository - Repositorio de órdenes
   * @param {VoucherRepository} voucherRepository - Repositorio de vouchers
   * @param {Logger} logger - Logger
   */
  constructor(orderRepository, voucherRepository, logger) {
    this.orderRepository = orderRepository;
    this.voucherRepository = voucherRepository;
    this.logger = logger;
  }

  /**
   * Ejecuta el caso de uso
   * 
   * @param {Object} input - Datos de entrada
   * @param {string} input.orderId - ID de la orden
   * @param {string[]} [input.voucherCodes] - Códigos de vouchers a aplicar
   * @param {string} [input.completedBy] - Usuario que completa
   * @returns {Object} {success: boolean, data: Order, error?: string}
   * 
   * @example
   * const result = completeOrder.execute({
   *   orderId: 'order-123',
   *   voucherCodes: ['VOC-ABC-1234'],
   *   completedBy: 'barista@hotel.com'
   * });
   */
  execute(input) {
    const { orderId, voucherCodes = [], completedBy = 'system' } = input;

    try {
      // Validar entrada
      if (!orderId) {
        throw new Error('orderId es requerido');
      }

      // Obtener orden
      const order = this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error(`Orden '${orderId}' no encontrada`);
      }

      // Validar que está abierta
      if (order.status !== 'open') {
        throw new Error(
          `No se puede completar una orden en estado '${order.status}'. Solo 'open' puede completarse.`
        );
      }

      // Aplicar vouchers si se proporcionan
      if (voucherCodes && voucherCodes.length > 0) {
        const voucherIds = [];

        for (const code of voucherCodes) {
          const voucher = this.voucherRepository.findByCode(code);

          if (!voucher) {
            throw new Error(`Voucher '${code}' no encontrado`);
          }

          if (!voucher.isValid()) {
            throw new Error(
              `Voucher '${code}' no es válido. Estado: ${voucher.status}`
            );
          }

          voucherIds.push(voucher.id);
        }

        // Asumir que cada voucher es igual al total de la orden (o configurar en BD)
        // Por ahora: cada voucher cubre toda la orden
        order.applyVouchers(voucherIds, order.finalTotal / voucherIds.length);
      }

      // Completar orden
      order.complete();

      // Guardar cambios
      this.orderRepository.update(order);

      // Log auditoría
      this.logger.info('Orden completada', {
        orderId: order.id,
        stayId: order.stayId,
        finalTotal: order.finalTotal,
        vouchersUsed: order.vouchersUsed.length,
        completedBy,
      });

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error('Error completando orden', {
        error: error.message,
        orderId,
        completedBy,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancela una orden
   * 
   * @param {Object} input - Datos de entrada
   * @param {string} input.orderId - ID de la orden
   * @param {string} [input.reason] - Razón de la cancelación
   * @param {string} [input.cancelledBy] - Usuario que cancela
   * @returns {Object} {success: boolean, data: Order, error?: string}
   */
  cancel(input) {
    const { orderId, reason = '', cancelledBy = 'system' } = input;

    try {
      const order = this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error(`Orden '${orderId}' no encontrada`);
      }

      if (order.status === 'completed' || order.status === 'cancelled') {
        throw new Error(
          `No se puede cancelar una orden en estado '${order.status}'`
        );
      }

      order.notes = reason || order.notes;
      order.cancel();

      this.orderRepository.update(order);

      this.logger.info('Orden cancelada', {
        orderId: order.id,
        reason,
        cancelledBy,
      });

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error('Error cancelando orden', {
        error: error.message,
        orderId,
        cancelledBy,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = CompleteOrder;
