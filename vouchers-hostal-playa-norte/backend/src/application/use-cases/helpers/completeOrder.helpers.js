/**
 * Helpers para CompleteOrder: logging y formateo de respuestas
 */

export function logCompletion(logger, order) {
  logger.info('Orden completada', {
    orderId: order.id,
    stayId: order.stayId,
    itemsCount: order.items.length,
    subtotal: order.total,
    discountApplied: order.discountAmount,
    finalTotal: order.finalTotal,
    vouchersUsed: order.vouchersUsed.length
  });
}

export function logCancellation(logger, order, reason) {
  logger.info('Orden cancelada', {
    orderId: order.id,
    stayId: order.stayId,
    reason: reason || '(sin motivo)'
  });
}

export function formatCompletionResponse(order) {
  return {
    id: order.id,
    status: order.status,
    summary: order.getSummary
      ? order.getSummary()
      : {
        itemCount: order.items.length,
        subtotal: order.total,
        discount: order.discountAmount,
        finalTotal: order.finalTotal
      },
    vouchersApplied: order.vouchersUsed.length,
    message: 'Orden completada exitosamente'
  };
}

export function formatCancellationResponse(order) {
  return {
    id: order.id,
    status: order.status,
    message: 'Orden cancelada exitosamente'
  };
}
