import crypto from 'crypto';
import pino from 'pino';

const logger = pino();

/**
 * Event Sourcing Service - Almacenamiento y reconstrucción de eventos
 *
 * Características:
 * - Almacenamiento inmutable de eventos
 * - Reconstrucción de estado desde eventos
 * - Snapshots para optimización
 * - Audit trail completo
 * - Temporal queries
 * - CQRS pattern support
 */
class EventSourcingService {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      snapshotInterval: config.snapshotInterval || 100,
      maxEventsPerQuery: config.maxEventsPerQuery || 1000,
      ...config
    };

    this.eventStore = new Map(); // Map<aggregateId, Array<event>>
    this.snapshots = new Map(); // Map<aggregateId, snapshot>
    this.projections = new Map(); // Map<projectionName, projectionData>
    this.subscribers = new Map(); // Map<eventType, Set<callback>>

    this.stats = {
      eventsStored: 0,
      eventsReplayed: 0,
      snapshotsCreated: 0,
      projectionsUpdated: 0,
      aggregatesCreated: 0
    };
  }

  /**
   * Publicar evento
   */
  publishEvent(aggregateId, aggregateType, eventType, payload, metadata = {}) {
    if (!aggregateId || !aggregateType || !eventType) {
      throw new Error('aggregateId, aggregateType, and eventType are required');
    }

    const event = {
      id: crypto.randomBytes(16).toString('hex'),
      aggregateId,
      aggregateType,
      eventType,
      version: this.getAggregateVersion(aggregateId) + 1,
      payload,
      metadata: {
        ...metadata,
        timestamp: new Date(),
        userId: metadata.userId || 'system',
        source: metadata.source || 'api'
      }
    };

    // Almacenar evento
    if (!this.eventStore.has(aggregateId)) {
      this.eventStore.set(aggregateId, []);
      this.stats.aggregatesCreated++;
    }

    this.eventStore.get(aggregateId).push(event);
    this.stats.eventsStored++;

    // Persistir en DB
    try {
      this.db
        .prepare(
          `
        INSERT INTO events (id, aggregate_id, aggregate_type, event_type, version, payload, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          event.id,
          aggregateId,
          aggregateType,
          eventType,
          event.version,
          JSON.stringify(payload),
          JSON.stringify(event.metadata),
          event.metadata.timestamp.toISOString()
        );
    } catch (error) {
      logger.error('Error storing event:', error);
    }

    // Notificar subscribers
    this.notifySubscribers(eventType, event);

    // Crear snapshot si es necesario
    if (event.version % this.config.snapshotInterval === 0) {
      this.createSnapshot(aggregateId, aggregateType);
    }

    return event;
  }

  /**
   * Reconstruir agregado desde eventos
   */
  rebuildAggregate(aggregateId, toVersion = null) {
    const events = this.getEvents(aggregateId, toVersion);

    if (events.length === 0) {
      return null;
    }

    let aggregate = {
      id: aggregateId,
      type: events[0].aggregateType,
      version: 0,
      state: {},
      createdAt: events[0].metadata.timestamp
    };

    // Aplicar cada evento en orden
    for (const event of events) {
      aggregate = this.applyEvent(aggregate, event);
      this.stats.eventsReplayed++;
    }

    return aggregate;
  }

  /**
   * Obtener eventos de un agregado
   */
  getEvents(aggregateId, toVersion = null) {
    const events = this.eventStore.get(aggregateId) || [];

    if (toVersion !== null) {
      return events.filter((e) => e.version <= toVersion);
    }

    return events;
  }

  /**
   * Obtener estado actual del agregado
   */
  getAggregateState(aggregateId) {
    const aggregate = this.rebuildAggregate(aggregateId);
    return aggregate ? aggregate.state : null;
  }

  /**
   * Obtener versión actual del agregado
   */
  getAggregateVersion(aggregateId) {
    const events = this.eventStore.get(aggregateId);
    return events && events.length > 0 ? events[events.length - 1].version : 0;
  }

  /**
   * Aplicar evento al estado (reducir)
   */
  applyEvent(aggregate, event) {
    aggregate.version = event.version;
    aggregate.lastEventId = event.id;
    aggregate.lastEventAt = event.metadata.timestamp;

    // Aplicar cambios específicos del evento
    switch (event.eventType) {
    case 'aggregate.created':
      aggregate.state = event.payload;
      aggregate.createdAt = event.metadata.timestamp;
      break;

    case 'aggregate.updated':
      aggregate.state = { ...aggregate.state, ...event.payload };
      break;

    case 'aggregate.deleted':
      aggregate.state = null;
      aggregate.deletedAt = event.metadata.timestamp;
      break;

    default:
      // Aplicar payload como delta
      aggregate.state = { ...aggregate.state, ...event.payload };
    }

    return aggregate;
  }

  /**
   * Crear snapshot
   */
  createSnapshot(aggregateId, aggregateType) {
    const aggregate = this.rebuildAggregate(aggregateId);

    if (!aggregate) {
      return null;
    }

    const snapshot = {
      aggregateId,
      aggregateType,
      version: aggregate.version,
      state: aggregate.state,
      createdAt: new Date()
    };

    this.snapshots.set(aggregateId, snapshot);
    this.stats.snapshotsCreated++;

    // Persistir en DB
    try {
      this.db
        .prepare(
          `
        INSERT INTO snapshots (aggregate_id, aggregate_type, version, state, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(aggregate_id) DO UPDATE SET
          version = excluded.version,
          state = excluded.state,
          created_at = excluded.created_at
      `
        )
        .run(
          aggregateId,
          aggregateType,
          snapshot.version,
          JSON.stringify(snapshot.state),
          snapshot.createdAt.toISOString()
        );
    } catch (error) {
      logger.error('Error storing snapshot:', error);
    }

    return snapshot;
  }

  /**
   * Obtener snapshot
   */
  getSnapshot(aggregateId) {
    return this.snapshots.get(aggregateId) || null;
  }

  /**
   * Cargar agregado desde snapshot (optimizado)
   */
  rebuildAggregateFromSnapshot(aggregateId) {
    const snapshot = this.getSnapshot(aggregateId);

    if (!snapshot) {
      return this.rebuildAggregate(aggregateId);
    }

    // Obtener eventos posteriores al snapshot
    const laterEvents = this.getEvents(aggregateId).filter(
      (e) => e.version > snapshot.version
    );

    let aggregate = {
      id: aggregateId,
      type: snapshot.aggregateType,
      version: snapshot.version,
      state: snapshot.state,
      createdAt: new Date(snapshot.createdAt)
    };

    // Aplicar eventos posteriores
    for (const event of laterEvents) {
      aggregate = this.applyEvent(aggregate, event);
      this.stats.eventsReplayed++;
    }

    return aggregate;
  }

  /**
   * Registrar suscriptor a eventos
   */
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    this.subscribers.get(eventType).add(callback);

    return () => {
      this.subscribers.get(eventType).delete(callback);
    };
  }

  /**
   * Notificar subscribers
   */
  notifySubscribers(eventType, event) {
    const callbacks = this.subscribers.get(eventType) || new Set();

    for (const callback of callbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error(`Error notifying subscriber for ${eventType}:`, error);
      }
    }

    // También notificar a wildcard
    const wildcardCallbacks = this.subscribers.get('*') || new Set();
    for (const callback of wildcardCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error('Error notifying wildcard subscriber:', error);
      }
    }
  }

  /**
   * Crear projection (lectura optimizada)
   */
  createProjection(name, handler) {
    const projection = {
      name,
      handler,
      data: new Map(),
      version: 0,
      lastUpdate: new Date()
    };

    this.projections.set(name, projection);

    // Procesar eventos históricos
    this.rebuildProjection(name);

    return projection;
  }

  /**
   * Reconstruir projection desde eventos
   */
  rebuildProjection(projectionName) {
    const projection = this.projections.get(projectionName);

    if (!projection) {
      return;
    }

    projection.data.clear();

    // Procesar todos los eventos
    for (const [aggregateId, events] of this.eventStore) {
      for (const event of events) {
        projection.handler(projection.data, event);
      }
    }

    projection.lastUpdate = new Date();
    this.stats.projectionsUpdated++;
  }

  /**
   * Consultar projection
   */
  queryProjection(projectionName, query = {}) {
    const projection = this.projections.get(projectionName);

    if (!projection) {
      return null;
    }

    let results = Array.from(projection.data.values());

    // Filtrar por criterios
    if (query.filter) {
      results = results.filter(query.filter);
    }

    // Ordenar
    if (query.sort) {
      results.sort(query.sort);
    }

    // Paginar
    if (query.limit || query.offset) {
      const offset = query.offset || 0;
      const limit = query.limit || 50;
      results = results.slice(offset, offset + limit);
    }

    return results;
  }

  /**
   * Audit trail - Historial completo
   */
  getAuditTrail(aggregateId, limit = 100) {
    const events = this.getEvents(aggregateId).slice(-limit);

    return events.map((event) => ({
      id: event.id,
      type: event.eventType,
      timestamp: event.metadata.timestamp,
      userId: event.metadata.userId,
      source: event.metadata.source,
      version: event.version,
      changes: event.payload
    }));
  }

  /**
   * Temporal query - Estado en momento específico
   */
  getStateAtTime(aggregateId, timestamp) {
    const eventsUntilTime = this.getEvents(aggregateId).filter(
      (e) => new Date(e.metadata.timestamp) <= new Date(timestamp)
    );

    if (eventsUntilTime.length === 0) {
      return null;
    }

    let aggregate = {
      id: aggregateId,
      version: 0,
      state: {}
    };

    for (const event of eventsUntilTime) {
      aggregate = this.applyEvent(aggregate, event);
    }

    return aggregate;
  }

  /**
   * Temporal range - Historial de cambios en período
   */
  getHistoryInRange(aggregateId, startTime, endTime) {
    const events = this.getEvents(aggregateId).filter((e) => {
      const time = new Date(e.metadata.timestamp);
      return time >= new Date(startTime) && time <= new Date(endTime);
    });

    return events.map((event) => ({
      timestamp: event.metadata.timestamp,
      eventType: event.eventType,
      version: event.version,
      payload: event.payload
    }));
  }

  /**
   * Replay eventos para debugging
   */
  replayEvents(aggregateId, fromVersion = 1, toVersion = null) {
    const events = this.getEvents(aggregateId, toVersion).filter(
      (e) => e.version >= fromVersion
    );

    return {
      aggregateId,
      eventCount: events.length,
      events: events.map((e) => ({
        version: e.version,
        type: e.eventType,
        timestamp: e.metadata.timestamp,
        payload: e.payload
      }))
    };
  }

  /**
   * Corregir evento (agregar corrección)
   */
  correctEvent(aggregateId, aggregateType, correction) {
    return this.publishEvent(
      aggregateId,
      aggregateType,
      'event.corrected',
      {
        ...correction,
        correctedAt: new Date()
      },
      { source: 'admin' }
    );
  }

  /**
   * Obtener eventos de múltiples agregados
   */
  getEventsForType(aggregateType, limit = 1000) {
    let allEvents = [];

    for (const events of this.eventStore.values()) {
      if (events.length > 0 && events[0].aggregateType === aggregateType) {
        allEvents = allEvents.concat(events);
      }
    }

    return allEvents
      .slice(-limit)
      .sort(
        (a, b) =>
          new Date(a.metadata.timestamp) - new Date(b.metadata.timestamp)
      );
  }

  /**
   * Estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      totalAggregates: this.eventStore.size,
      totalEvents: Array.from(this.eventStore.values()).reduce(
        (sum, events) => sum + events.length,
        0
      ),
      totalSnapshots: this.snapshots.size,
      totalProjections: this.projections.size,
      subscriberCount: this.subscribers.size,
      timestamp: new Date()
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      healthy: true,
      aggregates: this.eventStore.size,
      events: Array.from(this.eventStore.values()).reduce(
        (sum, events) => sum + events.length,
        0
      ),
      snapshots: this.snapshots.size,
      projections: this.projections.size,
      timestamp: new Date()
    };
  }

  /**
   * Limpiar eventos antiguos (archiving)
   */
  archiveEvents(beforeDate, archiveDestination = null) {
    const cutoff = new Date(beforeDate);
    let archivedCount = 0;

    for (const [aggregateId, events] of this.eventStore) {
      const oldEvents = events.filter(
        (e) => new Date(e.metadata.timestamp) < cutoff
      );

      if (oldEvents.length > 0) {
        archivedCount += oldEvents.length;

        // Opcional: guardar en archivo/DB de archivo
        if (archiveDestination) {
          logger.info(
            `Archiving ${oldEvents.length} events for ${aggregateId}`
          );
        }

        // Mantener en memoria para queries recientes
        // En producción, archivar a storage frío
      }
    }

    return archivedCount;
  }
}

/**
 * Funciones helper
 */
export function publishDomainEvent(
  eventService,
  aggregateId,
  aggregateType,
  eventType,
  payload,
  metadata
) {
  return eventService.publishEvent(
    aggregateId,
    aggregateType,
    eventType,
    payload,
    metadata
  );
}

export function rebuildAggregateState(eventService, aggregateId) {
  const aggregate = eventService.rebuildAggregate(aggregateId);
  return aggregate ? aggregate.state : null;
}

export function createEventProjection(eventService, projectionName, handler) {
  return eventService.createProjection(projectionName, handler);
}

export function queryEventProjection(eventService, projectionName, query) {
  return eventService.queryProjection(projectionName, query);
}

export default EventSourcingService;
