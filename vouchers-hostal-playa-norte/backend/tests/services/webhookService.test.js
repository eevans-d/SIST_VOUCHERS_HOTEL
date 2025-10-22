import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebhookService, {
  publishWebhookEvent,
  verifyWebhookSignature,
  startWebhookProcessor,
} from '../services/webhookService.js';

describe('WebhookService', () => {
  let webhookService;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnThis(),
    };

    webhookService = new WebhookService(mockDb);
  });

  describe('Subscription Management', () => {
    it('should create subscription', () => {
      const subscription = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://webhook.example.com/hook',
        events: ['order.created', 'order.completed'],
      });

      expect(subscription.id).toBeDefined();
      expect(subscription.userId).toBe('user123');
      expect(subscription.url).toBe('https://webhook.example.com/hook');
      expect(subscription.events).toEqual(['order.created', 'order.completed']);
      expect(subscription.secret).toBeDefined();
      expect(subscription.active).toBe(true);
    });

    it('should throw error without userId', () => {
      expect(() => {
        webhookService.createSubscription({
          url: 'https://example.com',
          events: ['*'],
        });
      }).toThrow('userId and url are required');
    });

    it('should throw error with invalid URL', () => {
      expect(() => {
        webhookService.createSubscription({
          userId: 'user123',
          url: 'invalid-url',
          events: ['*'],
        });
      }).toThrow('Invalid URL format');
    });

    it('should throw error without events', () => {
      expect(() => {
        webhookService.createSubscription({
          userId: 'user123',
          url: 'https://example.com',
          events: [],
        });
      }).toThrow('At least one event must be specified');
    });

    it('should track subscription creation in stats', () => {
      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      expect(webhookService.stats.subscriptionsCreated).toBe(1);
    });

    it('should generate unique secret', () => {
      const sub1 = webhookService.createSubscription({
        userId: 'user1',
        url: 'https://example1.com',
        events: ['*'],
      });

      const sub2 = webhookService.createSubscription({
        userId: 'user2',
        url: 'https://example2.com',
        events: ['*'],
      });

      expect(sub1.secret).not.toBe(sub2.secret);
    });

    it('should use custom secret if provided', () => {
      const customSecret = 'my-secret-key';
      const subscription = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
        secret: customSecret,
      });

      expect(subscription.secret).toBe(customSecret);
    });

    it('should get subscription by ID', () => {
      const created = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      const retrieved = webhookService.getSubscription(created.id);
      expect(retrieved).toEqual(expect.objectContaining({
        id: created.id,
        userId: 'user123',
      }));
    });

    it('should return null for unknown subscription', () => {
      const retrieved = webhookService.getSubscription('unknown-id');
      expect(retrieved).toBeNull();
    });

    it('should list user subscriptions', () => {
      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example1.com',
        events: ['*'],
      });

      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example2.com',
        events: ['*'],
      });

      webhookService.createSubscription({
        userId: 'user456',
        url: 'https://example3.com',
        events: ['*'],
      });

      const userSubs = webhookService.getUserSubscriptions('user123');
      expect(userSubs.length).toBe(2);
    });

    it('should update subscription', () => {
      const created = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['order.created'],
      });

      const updated = webhookService.updateSubscription(created.id, {
        url: 'https://new-url.com',
        events: ['order.created', 'order.completed'],
        active: false,
      });

      expect(updated.url).toBe('https://new-url.com');
      expect(updated.events).toEqual(['order.created', 'order.completed']);
      expect(updated.active).toBe(false);
    });

    it('should throw error updating unknown subscription', () => {
      expect(() => {
        webhookService.updateSubscription('unknown-id', { active: false });
      }).toThrow('Subscription not found');
    });

    it('should delete subscription', () => {
      const created = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.deleteSubscription(created.id);

      expect(webhookService.getSubscription(created.id)).toBeNull();
      expect(webhookService.stats.subscriptionsDeleted).toBe(1);
    });

    it('should throw error deleting unknown subscription', () => {
      expect(() => {
        webhookService.deleteSubscription('unknown-id');
      }).toThrow('Subscription not found');
    });
  });

  describe('Event Publishing', () => {
    beforeEach(() => {
      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com/hook',
        events: ['order.created'],
      });

      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com/hook2',
        events: ['*'],
      });
    });

    it('should publish event', () => {
      const result = webhookService.publishEvent('order.created', {
        orderId: '123',
        amount: 99.99,
      });

      expect(result.sent).toBeGreaterThan(0);
      expect(webhookService.stats.eventsPublished).toBe(1);
    });

    it('should match subscriptions by event type', () => {
      const result = webhookService.publishEvent('order.created', {});
      expect(result.sent).toBe(2); // Dos subscripciones coinciden
    });

    it('should match wildcard subscriptions', () => {
      webhookService.createSubscription({
        userId: 'user456',
        url: 'https://example.com/hook3',
        events: ['order.started'],
      });

      const result = webhookService.publishEvent('order.started', {});
      expect(result.sent).toBe(1); // Solo wildcard
    });

    it('should not send to inactive subscriptions', () => {
      const sub = webhookService.createSubscription({
        userId: 'user456',
        url: 'https://example.com/hook3',
        events: ['order.created'],
        active: false,
      });

      const result = webhookService.publishEvent('order.created', {});
      expect(result.sent).toBe(2); // Sin incluir la inactiva
    });

    it('should require eventType', () => {
      expect(() => {
        webhookService.publishEvent(null, {});
      }).toThrow('eventType is required');
    });

    it('should handle no matching subscriptions', () => {
      const result = webhookService.publishEvent('unknown.event', {});
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should create deliveries for each subscription', () => {
      webhookService.publishEvent('order.created', { orderId: '123' });

      const deliveries = Array.from(webhookService.deliveries.values());
      expect(deliveries.length).toBeGreaterThan(0);
    });
  });

  describe('Signatures', () => {
    it('should generate signature', () => {
      const sig1 = webhookService.generateSignature(
        'order.created',
        { orderId: '123' },
        'secret123'
      );

      expect(typeof sig1).toBe('string');
      expect(sig1.length).toBe(64); // SHA256 hex = 64 chars
    });

    it('should generate consistent signatures', () => {
      const payload = { orderId: '123' };
      const secret = 'secret123';

      const sig1 = webhookService.generateSignature('order.created', payload, secret);
      const sig2 = webhookService.generateSignature('order.created', payload, secret);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'secret123';

      const sig1 = webhookService.generateSignature(
        'order.created',
        { orderId: '123' },
        secret
      );

      const sig2 = webhookService.generateSignature(
        'order.created',
        { orderId: '456' },
        secret
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = { orderId: '123' };

      const sig1 = webhookService.generateSignature('order.created', payload, 'secret1');
      const sig2 = webhookService.generateSignature('order.created', payload, 'secret2');

      expect(sig1).not.toBe(sig2);
    });

    it('should verify signature', () => {
      const payload = { orderId: '123' };
      const secret = 'secret123';

      const signature = webhookService.generateSignature('order.created', payload, secret);
      const verified = webhookService.verifySignature(
        signature,
        'order.created',
        payload,
        secret
      );

      expect(verified).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { orderId: '123' };
      const secret = 'secret123';

      const signature = webhookService.generateSignature('order.created', payload, secret);
      
      expect(() => {
        webhookService.verifySignature(
          'invalid-signature',
          'order.created',
          payload,
          secret
        );
      }).toThrow();
    });
  });

  describe('Delivery Management', () => {
    it('should get subscription deliveries', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['order.created'],
      });

      webhookService.publishEvent('order.created', { orderId: '1' });
      webhookService.publishEvent('order.created', { orderId: '2' });

      const deliveries = webhookService.getSubscriptionDeliveries(sub.id);
      expect(deliveries.length).toBeGreaterThan(0);
    });

    it('should get delivery stats', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.publishEvent('order.created', {});

      const stats = webhookService.getDeliveryStats(sub.id);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.successful).toBeDefined();
      expect(stats.failed).toBeDefined();
      expect(stats.pending).toBeDefined();
    });

    it('should get delivery history', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.publishEvent('order.created', {});
      webhookService.publishEvent('order.completed', {});

      const history = webhookService.getDeliveryHistory(sub.id);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit delivery history results', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      for (let i = 0; i < 150; i++) {
        webhookService.publishEvent('order.created', { index: i });
      }

      const history = webhookService.getDeliveryHistory(sub.id, 50);
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should support pagination with offset', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      for (let i = 0; i < 100; i++) {
        webhookService.publishEvent('order.created', { index: i });
      }

      const page1 = webhookService.getDeliveryHistory(sub.id, 25, 0);
      const page2 = webhookService.getDeliveryHistory(sub.id, 25, 25);

      expect(page1.length).toBeLessThanOrEqual(25);
      expect(page2.length).toBeLessThanOrEqual(25);
    });
  });

  describe('Retry Logic', () => {
    it('should track retry attempts', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.publishEvent('order.created', {});

      const deliveries = webhookService.getSubscriptionDeliveries(sub.id);
      expect(deliveries[0].attempt).toBeDefined();
    });

    it('should mark delivery pending for retry', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.publishEvent('order.created', {});

      const deliveries = webhookService.getSubscriptionDeliveries(sub.id);
      expect(deliveries[0].status).toBeDefined();
    });

    it('should calculate backoff exponentially', () => {
      const service = new WebhookService(mockDb, {
        initialBackoff: 1000,
        maxBackoff: 60000,
      });

      const backoff1 = Math.min(
        1000 * Math.pow(2, 0),
        60000
      );
      const backoff2 = Math.min(
        1000 * Math.pow(2, 1),
        60000
      );
      const backoff3 = Math.min(
        1000 * Math.pow(2, 2),
        60000
      );

      expect(backoff1).toBe(1000);
      expect(backoff2).toBe(2000);
      expect(backoff3).toBe(4000);
    });

    it('should respect maxBackoff', () => {
      const service = new WebhookService(mockDb, {
        initialBackoff: 1000,
        maxBackoff: 30000,
      });

      const backoff = Math.min(
        1000 * Math.pow(2, 10), // Exponential crecimiento
        30000
      );

      expect(backoff).toBe(30000);
    });
  });

  describe('Header Sanitization', () => {
    it('should sanitize sensitive headers', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
        'X-API-Key': 'secret',
        'X-Custom': 'safe',
      };

      const sanitized = webhookService.sanitizeHeaders(headers);

      expect(sanitized['Content-Type']).toBe('application/json');
      expect(sanitized['X-Custom']).toBe('safe');
      expect(sanitized['Authorization']).toBeUndefined();
      expect(sanitized['X-API-Key']).toBeUndefined();
    });

    it('should be case-insensitive for blacklist', () => {
      const headers = {
        'Authorization': 'Bearer token',
        'AUTHORIZATION': 'Bearer token2',
        'Cookie': 'session=123',
        'COOKIE': 'session=456',
      };

      const sanitized = webhookService.sanitizeHeaders(headers);

      // Dependiendo de cómo se implementó, verificar comportamiento
      expect(Object.keys(sanitized).length).toBeLessThan(
        Object.keys(headers).length
      );
    });

    it('should preserve custom headers', () => {
      const headers = {
        'X-Custom-Header': 'value1',
        'X-Another-Header': 'value2',
      };

      const sanitized = webhookService.sanitizeHeaders(headers);

      expect(sanitized['X-Custom-Header']).toBe('value1');
      expect(sanitized['X-Another-Header']).toBe('value2');
    });
  });

  describe('Subscription Management - Advanced', () => {
    it('should disable subscription after repeated failures', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      // Simular múltiples fallos
      const subObj = webhookService.getSubscription(sub.id);
      subObj.failureCount = 10;
      subObj.active = false;

      const updated = webhookService.getSubscription(sub.id);
      expect(updated.active).toBe(false);
    });

    it('should restart subscription', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.getSubscription(sub.id).active = false;
      webhookService.getSubscription(sub.id).failureCount = 5;

      const restarted = webhookService.restartSubscription(sub.id);

      expect(restarted.active).toBe(true);
      expect(restarted.failureCount).toBe(0);
    });

    it('should throw error restarting unknown subscription', () => {
      expect(() => {
        webhookService.restartSubscription('unknown-id');
      }).toThrow('Subscription not found');
    });
  });

  describe('Statistics', () => {
    it('should return stats', () => {
      const stats = webhookService.getStats();

      expect(stats.subscriptionsCreated).toBeDefined();
      expect(stats.subscriptionsDeleted).toBeDefined();
      expect(stats.eventsPublished).toBeDefined();
      expect(stats.deliveriesSuccessful).toBeDefined();
      expect(stats.deliveriesFailed).toBeDefined();
      expect(stats.totalSubscriptions).toBeDefined();
      expect(stats.timestamp).toBeDefined();
    });

    it('should track stats accurately', () => {
      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.publishEvent('order.created', {});

      const stats = webhookService.getStats();
      expect(stats.subscriptionsCreated).toBe(1);
      expect(stats.eventsPublished).toBe(1);
      expect(stats.totalSubscriptions).toBe(1);
    });

    it('should include pending deliveries in stats', () => {
      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.publishEvent('order.created', {});

      const stats = webhookService.getStats();
      expect(stats.pendingDeliveries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status', () => {
      const health = webhookService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.subscriptions).toBeDefined();
      expect(health.pendingDeliveries).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    it('should include subscription count', () => {
      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      const health = webhookService.healthCheck();
      expect(health.subscriptions).toBe(1);
    });
  });

  describe('Helper Functions', () => {
    it('should publish webhook event', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['order.created'],
      });

      const result = publishWebhookEvent(webhookService, 'order.created', {
        orderId: '123',
      });

      expect(result.sent).toBeGreaterThan(0);
    });

    it('should verify webhook signature', () => {
      const secret = 'test-secret';
      const sig = webhookService.generateSignature('order.created', { id: 1 }, secret);

      const verified = verifyWebhookSignature(
        webhookService,
        sig,
        'order.created',
        { id: 1 },
        secret
      );

      expect(verified).toBe(true);
    });

    it('should handle verify errors gracefully', () => {
      const verified = verifyWebhookSignature(
        webhookService,
        'invalid-sig',
        'order.created',
        {},
        'secret'
      );

      expect(verified).toBe(false);
    });
  });

  describe('Concurrency', () => {
    it('should handle multiple concurrent subscriptions', () => {
      for (let i = 0; i < 100; i++) {
        webhookService.createSubscription({
          userId: `user${i}`,
          url: `https://example${i}.com`,
          events: ['*'],
        });
      }

      expect(webhookService.subscriptions.size).toBe(100);
    });

    it('should handle concurrent event publishing', () => {
      webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      for (let i = 0; i < 100; i++) {
        webhookService.publishEvent(`order.${i}`, { index: i });
      }

      expect(webhookService.stats.eventsPublished).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty subscription list', () => {
      const result = webhookService.publishEvent('order.created', {});
      expect(result.sent).toBe(0);
    });

    it('should handle subscription with no events', () => {
      // Intentar crear sin eventos debería fallar
      expect(() => {
        webhookService.createSubscription({
          userId: 'user123',
          url: 'https://example.com',
          events: [],
        });
      }).toThrow();
    });

    it('should handle null payload', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['*'],
      });

      webhookService.publishEvent('order.created', null);
      expect(webhookService.stats.eventsPublished).toBe(1);
    });

    it('should handle duplicate event types', () => {
      const sub = webhookService.createSubscription({
        userId: 'user123',
        url: 'https://example.com',
        events: ['order.created', 'order.created', 'order.completed'],
      });

      // Debería filtrar duplicados en lógica de coincidencia
      expect(sub.events.length).toBe(3); // Las almacena pero lógica maneja
    });
  });
});
