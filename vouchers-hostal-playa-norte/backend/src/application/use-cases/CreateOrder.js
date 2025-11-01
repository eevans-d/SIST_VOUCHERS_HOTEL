import { Order } from '../../domain/entities/Order.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * CreateOrder - Use Case para crear órdenes
 */
export class CreateOrder {
  constructor({ orderRepository, stayRepository, logger }) {
    this.orderRepository = orderRepository;
    this.stayRepository = stayRepository;
    this.logger = logger;
  }

  /**
   * Ejecutar: Crear nueva orden
   */
  async execute({ stayId, items = [] }) {
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

      // 3. Crear orden
      const order = Order.create({ stayId, items: [] });

      // 4. Agregar items si se proporcionan
      for (const item of items) {
        order.addItem({
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        });
      }

      // 5. Guardar en BD
      const orderId = this.orderRepository.save(order);

      this.logger.info(`Orden creada: ${orderId}`, {
        stayId,
        itemCount: items.length,
        total: order.total
      });

      return {
        id: order.id,
        stayId: order.stayId,
        status: order.status,
        itemCount: order.items.length,
        total: order.total,
        finalTotal: order.finalTotal,
        message: 'Orden creada exitosamente'
      };
    } catch (error) {
      this.logger.error('Error creando orden', { error, stayId });
      throw error;
    }
  }
}
