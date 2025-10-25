import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import EventSourcingService, {
  publishDomainEvent,
  rebuildAggregateState,
  createEventProjection,
  queryEventProjection,
} from '../services/eventSourcingService.js';

describe('EventSourcingService', () => {
  let eventService;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      prepare: jest.fn().mockReturnThis(),
      run: jest.fn().mockReturnThis(),
    };

    eventService = new EventSourcingService(mockDb);
  });

  describe('Event Publishing', () => {
    it('should publish event', () => {
      const event = eventService.publishEvent(
        'order-123',
        'Order',
        'order.created',
        { customerId: 'cust-1', total: 99.99 }
      );

      expect(event.id).toBeDefined();
      expect(event.aggregateId).toBe('order-123');
      expect(event.eventType).toBe('order.created');
      expect(event.version).toBe(1);
    });

    it('should require aggregateId', () => {
      expect(() => {
        eventService.publishEvent(null, 'Order', 'order.created', {});
      }).toThrow('aggregateId, aggregateType, and eventType are required');
    });

    it('should require aggregateType', () => {
      expect(() => {
        eventService.publishEvent('order-1', null, 'order.created', {});
      }).toThrow('aggregateId, aggregateType, and eventType are required');
    });

    it('should require eventType', () => {
      expect(() => {
        eventService.publishEvent('order-1', 'Order', null, {});
      }).toThrow('aggregateId, aggregateType, and eventType are required');
    });

    it('should increment version', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      const event2 = eventService.publishEvent('order-1', 'Order', 'order.updated', {});

      expect(event2.version).toBe(2);
    });

    it('should track event stats', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      expect(eventService.stats.eventsStored).toBe(1);
    });

    it('should track aggregate creation', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      expect(eventService.stats.aggregatesCreated).toBe(1);

      eventService.publishEvent('order-1', 'Order', 'order.updated', {});
      expect(eventService.stats.aggregatesCreated).toBe(1); // No incrementa
    });

    it('should include metadata', () => {
      const event = eventService.publishEvent(
        'order-1',
        'Order',
        'order.created',
        {},
        { userId: 'user-123', source: 'api' }
      );

      expect(event.metadata.userId).toBe('user-123');
      expect(event.metadata.source).toBe('api');
      expect(event.metadata.timestamp).toBeDefined();
    });

    it('should default metadata values', () => {
      const event = eventService.publishEvent('order-1', 'Order', 'order.created', {});

      expect(event.metadata.userId).toBe('system');
      expect(event.metadata.source).toBe('api');
    });
  });

  describe('Event Retrieval', () => {
    beforeEach(() => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-1', 'Order', 'order.updated', {});
      eventService.publishEvent('order-1', 'Order', 'order.completed', {});
    });

    it('should get events for aggregate', () => {
      const events = eventService.getEvents('order-1');
      expect(events.length).toBe(3);
    });

    it('should get events up to version', () => {
      const events = eventService.getEvents('order-1', 2);
      expect(events.length).toBe(2);
    });

    it('should return empty array for unknown aggregate', () => {
      const events = eventService.getEvents('unknown-order');
      expect(events.length).toBe(0);
    });

    it('should return events in order', () => {
      const events = eventService.getEvents('order-1');
      expect(events[0].version).toBe(1);
      expect(events[1].version).toBe(2);
      expect(events[2].version).toBe(3);
    });
  });

  describe('Aggregate Reconstruction', () => {
    beforeEach(() => {
      eventService.publishEvent('order-1', 'Order', 'aggregate.created', {
        customerId: 'cust-1',
        total: 0,
      });

      eventService.publishEvent('order-1', 'Order', 'aggregate.updated', {
        total: 99.99,
      });
    });

    it('should rebuild aggregate', () => {
      const aggregate = eventService.rebuildAggregate('order-1');

      expect(aggregate.id).toBe('order-1');
      expect(aggregate.version).toBe(2);
      expect(aggregate.state.customerId).toBe('cust-1');
      expect(aggregate.state.total).toBe(99.99);
    });

    it('should track replay stats', () => {
      eventService.rebuildAggregate('order-1');
      expect(eventService.stats.eventsReplayed).toBe(2);
    });

    it('should return null for unknown aggregate', () => {
      const aggregate = eventService.rebuildAggregate('unknown-order');
      expect(aggregate).toBeNull();
    });

    it('should rebuild to specific version', () => {
      const aggregate = eventService.rebuildAggregate('order-1', 1);

      expect(aggregate.version).toBe(1);
      expect(aggregate.state.total).toBe(0); // No incluye segundo evento
    });
  });

  describe('Aggregate State', () => {
    it('should get current state', () => {
      eventService.publishEvent('order-1', 'Order', 'aggregate.created', {
        status: 'created',
      });

      eventService.publishEvent('order-1', 'Order', 'aggregate.updated', {
        status: 'processing',
      });

      const state = eventService.getAggregateState('order-1');
      expect(state.status).toBe('processing');
    });

    it('should get version', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-1', 'Order', 'order.updated', {});

      const version = eventService.getAggregateVersion('order-1');
      expect(version).toBe(2);
    });

    it('should return 0 version for unknown', () => {
      const version = eventService.getAggregateVersion('unknown');
      expect(version).toBe(0);
    });
  });

  describe('Event Application', () => {
    it('should apply created event', () => {
      const aggregate = eventService.rebuildAggregate('order-1');
      expect(aggregate).toBeNull(); // Sin eventos

      eventService.publishEvent('order-1', 'Order', 'aggregate.created', {
        status: 'created',
      });

      const rebuilt = eventService.rebuildAggregate('order-1');
      expect(rebuilt.state.status).toBe('created');
    });

    it('should apply updated event', () => {
      eventService.publishEvent('order-1', 'Order', 'aggregate.created', {
        status: 'created',
        items: 1,
      });

      eventService.publishEvent('order-1', 'Order', 'aggregate.updated', {
        status: 'processing',
      });

      const aggregate = eventService.rebuildAggregate('order-1');
      expect(aggregate.state.status).toBe('processing');
      expect(aggregate.state.items).toBe(1); // Mantiene anterior
    });

    it('should apply deleted event', () => {
      eventService.publishEvent('order-1', 'Order', 'aggregate.created', {
        status: 'active',
      });

      eventService.publishEvent('order-1', 'Order', 'aggregate.deleted', {});

      const aggregate = eventService.rebuildAggregate('order-1');
      expect(aggregate.state).toBeNull();
    });

    it('should apply custom event types', () => {
      eventService.publishEvent('order-1', 'Order', 'aggregate.created', {
        count: 0,
      });

      eventService.publishEvent('order-1', 'Order', 'custom.increment', {
        count: 1,
      });

      const aggregate = eventService.rebuildAggregate('order-1');
      expect(aggregate.state.count).toBe(1);
    });
  });

  describe('Snapshots', () => {
    beforeEach(() => {
      const service = new EventSourcingService(mockDb, { snapshotInterval: 3 });
      
      service.publishEvent('order-1', 'Order', 'aggregate.created', {});
      service.publishEvent('order-1', 'Order', 'aggregate.updated', {});
      service.publishEvent('order-1', 'Order', 'aggregate.updated', {}); // Trigger snapshot
      
      eventService = service;
    });

    it('should create snapshot at interval', () => {
      expect(eventService.stats.snapshotsCreated).toBeGreaterThan(0);
    });

    it('should get snapshot', () => {
      const snapshot = eventService.getSnapshot('order-1');
      expect(snapshot).toBeDefined();
      expect(snapshot.version).toBe(3);
    });

    it('should rebuild from snapshot', () => {
      eventService.publishEvent('order-1', 'Order', 'aggregate.updated', {});

      const aggregate = eventService.rebuildAggregateFromSnapshot('order-1');
      expect(aggregate.version).toBe(4);
    });

    it('should optimize with snapshot', () => {
      const statsBefore = eventService.stats.eventsReplayed;

      eventService.rebuildAggregateFromSnapshot('order-1');
      
      const statsAfter = eventService.stats.eventsReplayed;
      // Debe ser menos que replaying todos desde el inicio
      expect(statsAfter - statsBefore).toBeLessThanOrEqual(1);
    });
  });

  describe('Subscriptions', () => {
    it('should subscribe to event type', (done) => {
      let received = null;

      eventService.subscribe('order.created', (event) => {
        received = event;
      });

      eventService.publishEvent('order-1', 'Order', 'order.created', {
        customerId: 'cust-1',
      });

      expect(received).toBeDefined();
      expect(received.eventType).toBe('order.created');
      done();
    });

    it('should not receive unsubscribed events', (done) => {
      let received = null;

      eventService.subscribe('order.created', (event) => {
        received = event;
      });

      eventService.publishEvent('order-1', 'Order', 'order.updated', {});

      setTimeout(() => {
        expect(received).toBeNull();
        done();
      }, 100);
    });

    it('should unsubscribe', () => {
      const unsubscribe = eventService.subscribe('order.created', jest.fn());
      unsubscribe();

      expect(eventService.subscribers.get('order.created').size).toBe(0);
    });

    it('should support wildcard subscription', (done) => {
      const events = [];

      eventService.subscribe('*', (event) => {
        events.push(event.eventType);
      });

      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-1', 'Order', 'order.updated', {});

      setTimeout(() => {
        expect(events).toContain('order.created');
        expect(events).toContain('order.updated');
        done();
      }, 100);
    });

    it('should support multiple subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      eventService.subscribe('order.created', callback1);
      eventService.subscribe('order.created', callback2);

      eventService.publishEvent('order-1', 'Order', 'order.created', {});

      expect(eventService.subscribers.get('order.created').size).toBe(2);
    });
  });

  describe('Projections', () => {
    it('should create projection', () => {
      const handler = (data, event) => {
        const orders = data.get('orders') || [];
        orders.push(event);
        data.set('orders', orders);
      };

      const projection = eventService.createProjection('OrderList', handler);

      expect(projection.name).toBe('OrderList');
      expect(projection.handler).toBeDefined();
    });

    it('should rebuild projection', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-2', 'Order', 'order.created', {});

      const handler = (data, event) => {
        const count = data.get('count') || 0;
        if (event.eventType === 'order.created') {
          data.set('count', count + 1);
        }
      };

      eventService.createProjection('OrderCount', handler);

      expect(eventService.stats.projectionsUpdated).toBeGreaterThan(0);
    });

    it('should query projection', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {
        status: 'completed',
      });

      const handler = (data, event) => {
        if (event.eventType === 'order.created') {
          data.set(event.aggregateId, event.payload);
        }
      };

      eventService.createProjection('Orders', handler);

      const results = eventService.queryProjection('Orders');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter projection results', () => {
      for (let i = 0; i < 5; i++) {
        eventService.publishEvent(`order-${i}`, 'Order', 'order.created', {
          total: i * 100,
        });
      }

      const handler = (data, event) => {
        data.set(event.aggregateId, event.payload);
      };

      eventService.createProjection('Orders', handler);

      const results = eventService.queryProjection('Orders', {
        filter: (item) => item.total > 200,
      });

      expect(results.every((r) => r.total > 200)).toBe(true);
    });

    it('should sort projection results', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {
        total: 100,
      });
      eventService.publishEvent('order-2', 'Order', 'order.created', {
        total: 50,
      });

      const handler = (data, event) => {
        data.set(event.aggregateId, event.payload);
      };

      eventService.createProjection('Orders', handler);

      const results = eventService.queryProjection('Orders', {
        sort: (a, b) => a.total - b.total,
      });

      expect(results[0].total).toBe(50);
      expect(results[1].total).toBe(100);
    });

    it('should paginate projection results', () => {
      for (let i = 0; i < 100; i++) {
        eventService.publishEvent(`order-${i}`, 'Order', 'order.created', {});
      }

      const handler = (data, event) => {
        data.set(event.aggregateId, {});
      };

      eventService.createProjection('Orders', handler);

      const page1 = eventService.queryProjection('Orders', {
        limit: 25,
        offset: 0,
      });

      const page2 = eventService.queryProjection('Orders', {
        limit: 25,
        offset: 25,
      });

      expect(page1.length).toBeLessThanOrEqual(25);
      expect(page2.length).toBeLessThanOrEqual(25);
    });
  });

  describe('Audit Trail', () => {
    it('should return audit trail', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-1', 'Order', 'order.updated', {});

      const trail = eventService.getAuditTrail('order-1');

      expect(trail.length).toBe(2);
      expect(trail[0].type).toBe('order.created');
      expect(trail[1].type).toBe('order.updated');
    });

    it('should include metadata in audit trail', () => {
      eventService.publishEvent(
        'order-1',
        'Order',
        'order.created',
        {},
        { userId: 'user-123' }
      );

      const trail = eventService.getAuditTrail('order-1');

      expect(trail[0].userId).toBe('user-123');
      expect(trail[0].timestamp).toBeDefined();
    });

    it('should limit audit trail results', () => {
      for (let i = 0; i < 200; i++) {
        eventService.publishEvent('order-1', 'Order', 'order.updated', {});
      }

      const trail = eventService.getAuditTrail('order-1', 50);

      expect(trail.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Temporal Queries', () => {
    it('should get state at time', (done) => {
      const time1 = new Date();
      eventService.publishEvent('order-1', 'Order', 'aggregate.created', {
        status: 'created',
      });

      setTimeout(() => {
        const time2 = new Date();
        eventService.publishEvent('order-1', 'Order', 'aggregate.updated', {
          status: 'processing',
        });

        const stateAtTime1 = eventService.getStateAtTime('order-1', time1);
        expect(stateAtTime1).toBeNull(); // Antes de primer evento

        const stateAtTime2 = eventService.getStateAtTime('order-1', time2);
        expect(stateAtTime2.state.status).toBe('created');

        done();
      }, 100);
    });

    it('should get history in range', (done) => {
      const start = new Date();

      eventService.publishEvent('order-1', 'Order', 'order.created', {});

      setTimeout(() => {
        eventService.publishEvent('order-1', 'Order', 'order.updated', {});

        const end = new Date();

        const history = eventService.getHistoryInRange(
          'order-1',
          start,
          end
        );

        expect(history.length).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe('Replay', () => {
    beforeEach(() => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-1', 'Order', 'order.updated', {});
      eventService.publishEvent('order-1', 'Order', 'order.completed', {});
    });

    it('should replay all events', () => {
      const replay = eventService.replayEvents('order-1');

      expect(replay.eventCount).toBe(3);
      expect(replay.events.length).toBe(3);
    });

    it('should replay from version', () => {
      const replay = eventService.replayEvents('order-1', 2);

      expect(replay.eventCount).toBe(2);
    });

    it('should replay to version', () => {
      const replay = eventService.replayEvents('order-1', 1, 2);

      expect(replay.eventCount).toBe(2);
    });
  });

  describe('Corrections', () => {
    it('should record correction', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {
        total: 100,
      });

      const event = eventService.correctEvent('order-1', 'Order', {
        total: 99.99,
      });

      expect(event.eventType).toBe('event.corrected');
    });

    it('should include correction in audit trail', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.correctEvent('order-1', 'Order', { note: 'Fixed typo' });

      const trail = eventService.getAuditTrail('order-1');

      expect(trail.some((e) => e.type === 'event.corrected')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return stats', () => {
      const stats = eventService.getStats();

      expect(stats.eventsStored).toBeDefined();
      expect(stats.eventsReplayed).toBeDefined();
      expect(stats.snapshotsCreated).toBeDefined();
      expect(stats.projectionsUpdated).toBeDefined();
    });

    it('should track aggregate count', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-2', 'Order', 'order.created', {});

      const stats = eventService.getStats();
      expect(stats.totalAggregates).toBe(2);
    });

    it('should track event count', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-1', 'Order', 'order.updated', {});

      const stats = eventService.getStats();
      expect(stats.totalEvents).toBe(2);
    });
  });

  describe('Health Check', () => {
    it('should report healthy', () => {
      const health = eventService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.aggregates).toBeDefined();
      expect(health.events).toBeDefined();
    });
  });

  describe('Helper Functions', () => {
    it('should publish domain event', () => {
      const event = publishDomainEvent(
        eventService,
        'order-1',
        'Order',
        'order.created',
        {}
      );

      expect(event.eventType).toBe('order.created');
    });

    it('should rebuild state', () => {
      eventService.publishEvent('order-1', 'Order', 'aggregate.created', {
        status: 'new',
      });

      const state = rebuildAggregateState(eventService, 'order-1');
      expect(state.status).toBe('new');
    });

    it('should create projection', () => {
      const handler = (data, event) => {};
      const proj = createEventProjection(eventService, 'Test', handler);

      expect(proj.name).toBe('Test');
    });

    it('should query projection', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});

      const handler = (data, event) => {
        data.set('orders', [event]);
      };

      createEventProjection(eventService, 'Orders', handler);

      const results = queryEventProjection(eventService, 'Orders');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty event store', () => {
      const events = eventService.getEvents('unknown');
      expect(events.length).toBe(0);
    });

    it('should handle duplicate publishes', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-1', 'Order', 'order.created', {});

      const events = eventService.getEvents('order-1');
      expect(events.length).toBe(2); // Ambos se almacenan
    });

    it('should handle null payload', () => {
      const event = eventService.publishEvent('order-1', 'Order', 'order.created', null);
      expect(event.payload).toBeNull();
    });

    it('should handle large payloads', () => {
      const largePayload = { data: 'x'.repeat(10000) };
      const event = eventService.publishEvent(
        'order-1',
        'Order',
        'order.created',
        largePayload
      );

      expect(event.payload).toEqual(largePayload);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent publishes', () => {
      for (let i = 0; i < 100; i++) {
        eventService.publishEvent(`order-${i}`, 'Order', 'order.created', {});
      }

      expect(eventService.eventStore.size).toBe(100);
    });

    it('should handle concurrent rebuilds', () => {
      eventService.publishEvent('order-1', 'Order', 'order.created', {});
      eventService.publishEvent('order-1', 'Order', 'order.updated', {});

      const agg1 = eventService.rebuildAggregate('order-1');
      const agg2 = eventService.rebuildAggregate('order-1');

      expect(agg1.version).toBe(agg2.version);
    });
  });
});
