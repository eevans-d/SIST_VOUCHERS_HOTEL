import crypto from 'crypto';
import axios from 'axios';
import pino from 'pino';

const logger = pino();

/**
 * Webhook Service - Gestión de suscripciones y entregas de eventos
 *
 * Características:
 * - Suscripciones a eventos
 * - Reintento exponencial
 * - Firmas digitales HMAC-SHA256
 * - Gestión de entregas
 * - Estadísticas
 */
class WebhookService {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      maxRetries: config.maxRetries || 5,
      initialBackoff: config.initialBackoff || 1000,
      maxBackoff: config.maxBackoff || 60000,
      timeout: config.timeout || 5000,
      batchSize: config.batchSize || 100,
      ...config
    };

    this.subscriptions = new Map(); // Map<subscriptionId, subscription>
    this.deliveries = new Map(); // Map<deliveryId, delivery>
    this.stats = {
      subscriptionsCreated: 0,
      subscriptionsDeleted: 0,
      eventsPublished: 0,
      deliveriesSuccessful: 0,
      deliveriesFailed: 0,
      deliveriesRetried: 0,
      totalRetries: 0
    };
  }

  /**
   * Crear suscripción de webhook
   */
  createSubscription(data) {
    const {
      userId,
      url,
      events = ['*'],
      secret,
      active = true,
      headers = {}
    } = data;

    if (!userId || !url) {
      throw new Error('userId and url are required');
    }

    // Validar URL
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    // Validar eventos
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('At least one event must be specified');
    }

    const subscriptionId = crypto.randomBytes(16).toString('hex');
    const generatedSecret = secret || crypto.randomBytes(32).toString('hex');

    const subscription = {
      id: subscriptionId,
      userId,
      url,
      events,
      secret: generatedSecret,
      active,
      headers: this.sanitizeHeaders(headers),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      failureCount: 0
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.stats.subscriptionsCreated++;

    // Persistir en DB
    try {
      this.db
        .prepare(
          `
        INSERT INTO webhooks (id, user_id, url, events, secret, active, headers, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          subscriptionId,
          userId,
          url,
          JSON.stringify(events),
          generatedSecret,
          active ? 1 : 0,
          JSON.stringify(headers),
          new Date().toISOString()
        );
    } catch (error) {
      logger.error('Error saving webhook to DB:', error);
    }

    return {
      ...subscription,
      secret: generatedSecret // Solo mostrar una vez
    };
  }

  /**
   * Obtener suscripción
   */
  getSubscription(subscriptionId) {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Listar suscripciones por usuario
   */
  getUserSubscriptions(userId) {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.userId === userId
    );
  }

  /**
   * Actualizar suscripción
   */
  updateSubscription(subscriptionId, data) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const updates = {};
    if (data.url) updates.url = data.url;
    if (data.events) updates.events = data.events;
    if (typeof data.active === 'boolean') updates.active = data.active;
    if (data.headers) updates.headers = this.sanitizeHeaders(data.headers);

    const updated = {
      ...subscription,
      ...updates,
      updatedAt: new Date()
    };

    this.subscriptions.set(subscriptionId, updated);

    // Actualizar en DB
    try {
      this.db
        .prepare(
          `
        UPDATE webhooks
        SET url = ?, events = ?, active = ?, headers = ?, updated_at = ?
        WHERE id = ?
      `
        )
        .run(
          updated.url,
          JSON.stringify(updated.events),
          updated.active ? 1 : 0,
          JSON.stringify(updated.headers),
          updated.updatedAt.toISOString(),
          subscriptionId
        );
    } catch (error) {
      logger.error('Error updating webhook in DB:', error);
    }

    return updated;
  }

  /**
   * Eliminar suscripción
   */
  deleteSubscription(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    this.subscriptions.delete(subscriptionId);
    this.stats.subscriptionsDeleted++;

    // Eliminar de DB
    try {
      this.db.prepare('DELETE FROM webhooks WHERE id = ?').run(subscriptionId);
    } catch (error) {
      logger.error('Error deleting webhook from DB:', error);
    }

    return true;
  }

  /**
   * Publicar evento a webhooks
   */
  async publishEvent(eventType, payload) {
    if (!eventType) {
      throw new Error('eventType is required');
    }

    this.stats.eventsPublished++;

    // Encontrar suscripciones coincidentes
    const matchingSubscriptions = Array.from(
      this.subscriptions.values()
    ).filter(
      (sub) =>
        sub.active &&
        (sub.events.includes('*') || sub.events.includes(eventType))
    );

    if (matchingSubscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Crear entregas
    const deliveries = matchingSubscriptions.map((subscription) => {
      const deliveryId = crypto.randomBytes(16).toString('hex');

      const delivery = {
        id: deliveryId,
        subscriptionId: subscription.id,
        eventType,
        payload,
        status: 'pending',
        attempt: 0,
        nextRetry: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        signature: this.generateSignature(
          eventType,
          payload,
          subscription.secret
        )
      };

      this.deliveries.set(deliveryId, delivery);

      // Persistir en DB
      try {
        this.db
          .prepare(
            `
          INSERT INTO webhook_deliveries (id, subscription_id, event_type, payload, status, attempt, next_retry, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            deliveryId,
            subscription.id,
            eventType,
            JSON.stringify(payload),
            'pending',
            0,
            new Date().toISOString(),
            new Date().toISOString()
          );
      } catch (error) {
        logger.error('Error saving delivery to DB:', error);
      }

      return delivery;
    });

    // Enviar entregas inmediatamente (sin esperar)
    deliveries.forEach((delivery) => {
      this.sendDelivery(delivery).catch((error) => {
        logger.error(`Error sending delivery ${delivery.id}:`, error);
      });
    });

    return {
      sent: deliveries.length,
      failed: 0
    };
  }

  /**
   * Enviar entrega con reintentos
   */
  async sendDelivery(delivery) {
    const subscription = this.subscriptions.get(delivery.subscriptionId);
    if (!subscription) {
      delivery.status = 'failed';
      return;
    }

    try {
      const response = await axios.post(
        subscription.url,
        {
          id: delivery.id,
          eventType: delivery.eventType,
          payload: delivery.payload,
          timestamp: delivery.createdAt
        },
        {
          timeout: this.config.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': delivery.signature,
            'X-Webhook-Delivery-Id': delivery.id,
            'X-Webhook-Event': delivery.eventType,
            ...subscription.headers
          }
        }
      );

      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'success';
        delivery.response = {
          status: response.status,
          headers: response.headers
        };
        this.stats.deliveriesSuccessful++;

        // Actualizar en DB
        try {
          this.db
            .prepare(
              `
            UPDATE webhook_deliveries
            SET status = ?, updated_at = ?
            WHERE id = ?
          `
            )
            .run('success', new Date().toISOString(), delivery.id);

          // Actualizar último trigger
          this.db
            .prepare(
              `
            UPDATE webhooks
            SET last_triggered_at = ?, failure_count = 0
            WHERE id = ?
          `
            )
            .run(new Date().toISOString(), delivery.subscriptionId);
        } catch (error) {
          logger.error('Error updating delivery in DB:', error);
        }

        return;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      logger.warn(
        `Delivery failed for ${delivery.subscriptionId}:`,
        error.message
      );
      delivery.attempt++;
      this.stats.deliveriesRetried++;

      if (delivery.attempt < this.config.maxRetries) {
        // Calcular próximo reintento con backoff exponencial
        const backoff = Math.min(
          this.config.initialBackoff * Math.pow(2, delivery.attempt - 1),
          this.config.maxBackoff
        );

        delivery.status = 'pending';
        delivery.nextRetry = new Date(Date.now() + backoff);
        delivery.error = error.message;
        this.stats.totalRetries++;

        // Actualizar en DB
        try {
          this.db
            .prepare(
              `
            UPDATE webhook_deliveries
            SET status = ?, attempt = ?, next_retry = ?, error = ?, updated_at = ?
            WHERE id = ?
          `
            )
            .run(
              'pending',
              delivery.attempt,
              delivery.nextRetry.toISOString(),
              error.message,
              new Date().toISOString(),
              delivery.id
            );
        } catch (error) {
          logger.error('Error updating retry in DB:', error);
        }

        // Reintentar después
        setTimeout(() => {
          this.sendDelivery(delivery).catch((error) => {
            logger.error(`Error retrying delivery ${delivery.id}:`, error);
          });
        }, backoff);
      } else {
        delivery.status = 'failed';
        delivery.error = error.message;
        this.stats.deliveriesFailed++;

        // Incrementar contador de fallos
        subscription.failureCount++;
        if (subscription.failureCount >= 10) {
          subscription.active = false;
          logger.warn(
            `Webhook ${subscription.id} disabled after ${subscription.failureCount} failures`
          );
        }

        // Actualizar en DB
        try {
          this.db
            .prepare(
              `
            UPDATE webhook_deliveries
            SET status = ?, error = ?, updated_at = ?
            WHERE id = ?
          `
            )
            .run(
              'failed',
              error.message,
              new Date().toISOString(),
              delivery.id
            );

          this.db
            .prepare(
              `
            UPDATE webhooks
            SET failure_count = failure_count + 1, active = ?
            WHERE id = ?
          `
            )
            .run(subscription.active ? 1 : 0, subscription.id);
        } catch (error) {
          logger.error('Error updating failed delivery in DB:', error);
        }
      }
    }
  }

  /**
   * Procesar reintentos pendientes
   */
  async processPendingRetries() {
    const now = new Date();
    const pending = Array.from(this.deliveries.values()).filter(
      (d) => d.status === 'pending' && d.nextRetry <= now
    );

    for (const delivery of pending) {
      await this.sendDelivery(delivery);
    }

    return pending.length;
  }

  /**
   * Obtener entregas de una suscripción
   */
  getSubscriptionDeliveries(subscriptionId, limit = 50) {
    return Array.from(this.deliveries.values())
      .filter((d) => d.subscriptionId === subscriptionId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Obtener estadísticas de entregas
   */
  getDeliveryStats(subscriptionId) {
    const deliveries = Array.from(this.deliveries.values()).filter(
      (d) => d.subscriptionId === subscriptionId
    );

    return {
      total: deliveries.length,
      successful: deliveries.filter((d) => d.status === 'success').length,
      failed: deliveries.filter((d) => d.status === 'failed').length,
      pending: deliveries.filter((d) => d.status === 'pending').length,
      averageAttempts:
        deliveries.length > 0
          ? deliveries.reduce((sum, d) => sum + d.attempt, 0) /
            deliveries.length
          : 0
    };
  }

  /**
   * Generar firma HMAC-SHA256
   */
  generateSignature(eventType, payload, secret) {
    const message = JSON.stringify({
      eventType,
      payload
    });

    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }

  /**
   * Verificar firma (para webhook handlers)
   */
  verifySignature(signature, eventType, payload, secret) {
    const expected = this.generateSignature(eventType, payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  /**
   * Sanitizar headers (remover sensibles)
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const blacklist = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-secret',
      'password'
    ];

    blacklist.forEach((key) => {
      delete sanitized[key.toLowerCase()];
    });

    return sanitized;
  }

  /**
   * Obtener estadísticas generales
   */
  getStats() {
    return {
      ...this.stats,
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(
        (s) => s.active
      ).length,
      pendingDeliveries: Array.from(this.deliveries.values()).filter(
        (d) => d.status === 'pending'
      ).length,
      timestamp: new Date()
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      healthy: true,
      subscriptions: this.subscriptions.size,
      pendingDeliveries: Array.from(this.deliveries.values()).filter(
        (d) => d.status === 'pending'
      ).length,
      timestamp: new Date()
    };
  }

  /**
   * Reiniciar suscripción (después de disablement)
   */
  restartSubscription(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.active = true;
    subscription.failureCount = 0;

    try {
      this.db
        .prepare(
          `
        UPDATE webhooks
        SET active = 1, failure_count = 0
        WHERE id = ?
      `
        )
        .run(subscriptionId);
    } catch (error) {
      logger.error('Error restarting webhook:', error);
    }

    return subscription;
  }

  /**
   * Obtener historial de entregas
   */
  getDeliveryHistory(subscriptionId, limit = 100, offset = 0) {
    return Array.from(this.deliveries.values())
      .filter((d) => d.subscriptionId === subscriptionId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(offset, offset + limit);
  }
}

/**
 * Funciones helper
 */
export function publishWebhookEvent(webhookService, eventType, payload) {
  return webhookService.publishEvent(eventType, payload);
}

export function verifyWebhookSignature(
  webhookService,
  signature,
  eventType,
  payload,
  secret
) {
  try {
    return webhookService.verifySignature(
      signature,
      eventType,
      payload,
      secret
    );
  } catch (error) {
    return false;
  }
}

export function startWebhookProcessor(webhookService, intervalMs = 30000) {
  return setInterval(() => {
    webhookService.processPendingRetries().catch((error) => {
      logger.error('Error processing webhook retries:', error);
    });
  }, intervalMs);
}

export default WebhookService;
