const { v4: uuidv4 } = require('uuid');
const Order = require('../../domain/entities/Order');

/**
 * CreateOrder - Use Case
 * Crea una nueva orden de consumo en cafetería
 * 
 * Responsabilidades:
 * - Validar que la estadía existe y está activa
 * - Crear orden
 * - Agregar items iniciales (opcional)
 * - Persistir en BD
 * 
 * @class CreateOrder
 */
class CreateOrder {
  /**
   * @param {StayRepository} stayRepository - Repositorio de estadías
   * @param {OrderRepository} orderRepository - Repositorio de órdenes
   * @param {Logger} logger - Logger
   */
  constructor(stayRepository, orderRepository, logger) {
    this.stayRepository = stayRepository;
    this.orderRepository = orderRepository;
    this.logger = logger;
  }

  /**
   * Ejecuta el caso de uso
   * 
   * @param {Object} input - Datos de entrada
   * @param {string} input.stayId - ID de la estadía
   * @param {Array} [input.items] - Items iniciales
   * @param {string} [input.notes] - Notas
   * @param {string} [input.createdBy] - Usuario que crea (para auditoría)
   * @returns {Object} {success: boolean, data: Order, error?: string}
   * 
   * @example
   * const result = createOrder.execute({
   *   stayId: '123e4567-e89b-12d3-a456-426614174000',
   *   items: [{productCode: 'CAFE', productName: 'Café', quantity: 2, unitPrice: 3.50}],
   *   createdBy: 'barista@hotel.com'
   * });
   */
  execute(input) {
    const { stayId, items = [], notes, createdBy = 'system' } = input;

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

      // Validar que la estadía está activa
      if (stay.status !== 'active') {
        throw new Error(
          `No se puede crear orden para estadía en estado '${stay.status}'. Solo 'active' es válido.`
        );
      }

      // Crear orden
      const order = Order.create({ stayId });
      order.id = uuidv4();
      order.notes = notes || null;

      // Agregar items si se proporcionan
      if (items && items.length > 0) {
        for (const item of items) {
          order.addItem({
            productCode: item.productCode,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          });
        }
      }

      // Guardar en BD
      this.orderRepository.save(order);

      // Log auditoría
      this.logger.info('Orden creada', {
        orderId: order.id,
        stayId: order.stayId,
        itemCount: order.items.length,
        createdBy,
      });

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error('Error creando orden', {
        error: error.message,
        stayId,
        createdBy,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = CreateOrder;
