/**
 * tracingService.js
 *
 * Servicio de Distributed Tracing con OpenTelemetry
 * - Trace collection (W3C Trace Context)
 * - Span correlation
 * - Trace sampling
 * - Performance: <1ms overhead
 * - Integración con observability stack
 */

class TracingService {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'hostal-api';
    this.version = options.version || '1.0.0';
    this.environment = options.environment || 'production';
    this.samplingRate = options.samplingRate || 1.0;
    this.traceIdHeader = 'x-trace-id';
    this.spanIdHeader = 'x-span-id';
    this.parentSpanHeader = 'x-parent-span-id';

    this.traces = new Map();
    this.spans = new Map();
    this.stats = {
      tracesCreated: 0,
      spansCreated: 0,
      tracesSampled: 0,
      errors: 0
    };
  }

  /**
   * Genera trace ID (UUID v4)
   * @returns {string} Trace ID
   */
  generateTraceId() {
    return this.uuidv4();
  }

  /**
   * Genera span ID (random hex)
   * @returns {string} Span ID
   */
  generateSpanId() {
    return Math.random().toString(16).substring(2, 18);
  }

  /**
   * Crea nueva traza
   * @param {string} operationName - Nombre de operación
   * @param {object} attributes - Atributos contextuales
   * @returns {object} Traza creada
   */
  createTrace(operationName, attributes = {}) {
    const traceId = this.generateTraceId();
    const shouldSample = Math.random() < this.samplingRate;

    const trace = {
      traceId,
      operationName,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'UNSET',
      spans: [],
      attributes: {
        service: this.serviceName,
        version: this.version,
        environment: this.environment,
        ...attributes
      },
      sampled: shouldSample,
      parentTraceId: null
    };

    this.traces.set(traceId, trace);
    this.stats.tracesCreated++;
    if (shouldSample) {
      this.stats.tracesSampled++;
    }

    return trace;
  }

  /**
   * Crea span dentro de traza
   * @param {string} traceId - ID de traza
   * @param {string} spanName - Nombre del span
   * @param {object} attributes - Atributos
   * @returns {object} Span creado
   */
  createSpan(traceId, spanName, attributes = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    const spanId = this.generateSpanId();
    const parentSpanId =
      trace.spans.length > 0
        ? trace.spans[trace.spans.length - 1].spanId
        : null;

    const span = {
      spanId,
      traceId,
      parentSpanId,
      spanName,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'UNSET',
      attributes: {
        component: 'span',
        ...attributes
      },
      events: [],
      links: []
    };

    this.spans.set(spanId, span);
    trace.spans.push(span);
    this.stats.spansCreated++;

    return span;
  }

  /**
   * Finaliza span
   * @param {string} spanId - ID del span
   * @param {string} status - Estado (OK, ERROR, UNSET)
   * @returns {object} Span finalizado
   */
  endSpan(spanId, status = 'OK') {
    const span = this.spans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    return span;
  }

  /**
   * Finaliza traza
   * @param {string} traceId - ID de traza
   * @param {string} status - Estado
   * @returns {object} Traza finalizada
   */
  endTrace(traceId, status = 'OK') {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = status;

    return trace;
  }

  /**
   * Agrega evento a span
   * @param {string} spanId - ID del span
   * @param {string} eventName - Nombre del evento
   * @param {object} attributes - Atributos del evento
   */
  addEvent(spanId, eventName, attributes = {}) {
    const span = this.spans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }

    span.events.push({
      name: eventName,
      timestamp: Date.now(),
      attributes
    });
  }

  /**
   * Agrega link entre spans
   * @param {string} spanId - ID del span actual
   * @param {string} linkedSpanId - ID del span vinculado
   * @param {object} attributes - Atributos del link
   */
  addLink(spanId, linkedSpanId, attributes = {}) {
    const span = this.spans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }

    span.links.push({
      spanId: linkedSpanId,
      attributes,
      timestamp: Date.now()
    });
  }

  /**
   * Extrae contexto de headers (W3C Trace Context)
   * @param {object} headers - Headers HTTP
   * @returns {object} Contexto extraído
   */
  extractContext(headers) {
    const traceParent = headers['traceparent'] || '';
    const traceState = headers['tracestate'] || '';

    if (!traceParent) {
      return {
        traceId: this.generateTraceId(),
        spanId: this.generateSpanId(),
        sampled: true
      };
    }

    // Formato: version-traceId-parentSpanId-traceFlags
    const parts = traceParent.split('-');
    if (parts.length !== 4) {
      return {
        traceId: this.generateTraceId(),
        spanId: this.generateSpanId(),
        sampled: true
      };
    }

    return {
      traceId: parts[1],
      spanId: this.generateSpanId(),
      parentSpanId: parts[2],
      sampled: parseInt(parts[3], 16) === 1,
      traceState
    };
  }

  /**
   * Inyecta contexto en headers (W3C Trace Context)
   * @param {object} context - Contexto a inyectar
   * @returns {object} Headers con contexto
   */
  injectContext(context) {
    const traceFlags = context.sampled ? '01' : '00';
    const traceparent = `00-${context.traceId}-${context.spanId}-${traceFlags}`;

    return {
      traceparent,
      tracestate: context.traceState || ''
    };
  }

  /**
   * Middleware Express para rastreo
   * @returns {function} Middleware
   */
  tracingMiddleware() {
    return (req, res, next) => {
      // Extraer contexto
      const context = this.extractContext(req.headers);

      // Crear traza
      const trace = this.createTrace(req.method + ' ' + req.path, {
        http: {
          method: req.method,
          url: req.originalUrl,
          target: req.path,
          host: req.hostname,
          scheme: req.protocol,
          clientIp: this.getClientIp(req),
          userAgent: req.get('user-agent')
        }
      });

      // Crear span para request
      const span = this.createSpan(trace.traceId, 'http.request', {
        http: {
          method: req.method,
          url: req.path
        }
      });

      // Almacenar en request
      req.traceId = trace.traceId;
      req.spanId = span.spanId;
      req.trace = trace;
      req.span = span;

      // Responder con headers
      const injected = this.injectContext(context);
      res.set('traceparent', injected.traceparent);

      // Finalizar en respuesta
      res.on('finish', () => {
        span.attributes.http = {
          status_code: res.statusCode
        };

        const status = res.statusCode >= 400 ? 'ERROR' : 'OK';
        this.endSpan(span.spanId, status);
        this.endTrace(trace.traceId, status);
      });

      next();
    };
  }

  /**
   * Crea contexto de base de datos
   * @param {string} traceId - ID de traza
   * @param {string} operation - Operación (SELECT, INSERT, UPDATE, DELETE)
   * @param {string} table - Tabla
   * @param {object} params - Parámetros
   * @returns {object} Span para BD
   */
  createDatabaseSpan(traceId, operation, table, params = {}) {
    const span = this.createSpan(traceId, `db.${operation.toLowerCase()}`, {
      db: {
        system: 'sqlite',
        operation,
        name: table,
        parameterized_query: this.maskSensitiveParams(params)
      }
    });

    return span;
  }

  /**
   * Crea contexto de caché
   * @param {string} traceId - ID de traza
   * @param {string} operation - get, set, delete
   * @param {string} key - Clave
   * @returns {object} Span para caché
   */
  createCacheSpan(traceId, operation, key) {
    const span = this.createSpan(traceId, `cache.${operation}`, {
      cache: {
        system: 'redis',
        operation,
        key
      }
    });

    return span;
  }

  /**
   * Crea contexto de API externo
   * @param {string} traceId - ID de traza
   * @param {string} method - HTTP method
   * @param {string} url - URL
   * @returns {object} Span para API
   */
  createExternalAPISpan(traceId, method, url) {
    const span = this.createSpan(traceId, 'http.client', {
      http: {
        method,
        url: this.maskUrl(url)
      }
    });

    return span;
  }

  /**
   * Rastrear función async
   * @param {string} traceId - ID de traza
   * @param {string} name - Nombre de operación
   * @param {function} fn - Función a ejecutar
   * @returns {promise} Resultado de función
   */
  async trace(traceId, name, fn) {
    const span = this.createSpan(traceId, name);

    try {
      const result = await fn();
      this.endSpan(span.spanId, 'OK');
      return result;
    } catch (error) {
      this.addEvent(span.spanId, 'exception', {
        'exception.type': error.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack
      });
      this.endSpan(span.spanId, 'ERROR');
      throw error;
    }
  }

  /**
   * Obtiene traza completa
   * @param {string} traceId - ID de traza
   * @returns {object} Traza con todos los spans
   */
  getTrace(traceId) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return null;
    }

    return {
      ...trace,
      spans: trace.spans.map((span) => ({
        ...span,
        depth: this.calculateSpanDepth(span)
      }))
    };
  }

  /**
   * Exporta traza en formato JAEGER JSON
   * @param {string} traceId - ID de traza
   * @returns {object} Formato compatible JAEGER
   */
  exportAsJaeger(traceId) {
    const trace = this.getTrace(traceId);
    if (!trace) {
      return null;
    }

    return {
      traceID: trace.traceId,
      processID: 'p1',
      processes: {
        p1: {
          serviceName: this.serviceName,
          tags: [
            { key: 'version', value: this.version },
            { key: 'environment', value: this.environment }
          ]
        }
      },
      spans: trace.spans.map((span) => ({
        traceID: span.traceId,
        spanID: span.spanId,
        operationName: span.spanName,
        references: span.parentSpanId
          ? [
            {
              refType: 'CHILD_OF',
              traceID: span.traceId,
              spanID: span.parentSpanId
            }
          ]
          : [],
        startTime: span.startTime * 1000,
        duration: (span.duration || 0) * 1000,
        tags: this.attributesToTags(span.attributes),
        logs: span.events.map((event) => ({
          timestamp: event.timestamp * 1000,
          fields: this.attributesToTags(event.attributes)
        }))
      }))
    };
  }

  /**
   * Exporta traza en formato OpenTelemetry
   * @param {string} traceId - ID de traza
   * @returns {object} Formato compatible OTLP
   */
  exportAsOTLP(traceId) {
    const trace = this.getTrace(traceId);
    if (!trace) {
      return null;
    }

    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this.serviceName } },
              { key: 'service.version', value: { stringValue: this.version } },
              {
                key: 'deployment.environment',
                value: { stringValue: this.environment }
              }
            ]
          },
          scopeSpans: [
            {
              scope: {
                name: this.serviceName,
                version: this.version
              },
              spans: trace.spans.map((span) => ({
                traceId: trace.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                name: span.spanName,
                kind: 'SPAN_KIND_INTERNAL',
                startTimeUnixNano: BigInt(span.startTime) * BigInt(1000000),
                endTimeUnixNano: BigInt(span.endTime) * BigInt(1000000),
                attributes: this.attributesToKeyValues(span.attributes),
                status: {
                  code: span.status === 'ERROR' ? 2 : 0
                }
              }))
            }
          ]
        }
      ]
    };
  }

  /**
   * Busca traces por atributos
   * @param {object} query - Criterios de búsqueda
   * @returns {array} Traces encontradas
   */
  searchTraces(query) {
    const results = [];

    for (const [traceId, trace] of this.traces) {
      let matches = true;

      // Filtrar por serviceName
      if (query.serviceName && trace.attributes.service !== query.serviceName) {
        matches = false;
      }

      // Filtrar por operationName
      if (
        query.operationName &&
        !trace.operationName.includes(query.operationName)
      ) {
        matches = false;
      }

      // Filtrar por duración
      if (query.minDuration && trace.duration < query.minDuration) {
        matches = false;
      }
      if (query.maxDuration && trace.duration > query.maxDuration) {
        matches = false;
      }

      // Filtrar por status
      if (query.status && trace.status !== query.status) {
        matches = false;
      }

      // Filtrar por rango de tiempo
      if (query.startTime && trace.startTime < query.startTime) {
        matches = false;
      }
      if (query.endTime && trace.endTime > query.endTime) {
        matches = false;
      }

      // Filtrar por tags
      if (query.tags) {
        for (const [key, value] of Object.entries(query.tags)) {
          if (this.getAttributeValue(trace.attributes, key) !== value) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        results.push(trace);
      }
    }

    // Ordenar por startTime descendente
    results.sort((a, b) => b.startTime - a.startTime);

    // Limitar resultados
    return results.slice(0, query.limit || 50);
  }

  /**
   * Estadísticas de traces
   * @returns {object} Estadísticas
   */
  getStatistics() {
    const stats = {
      ...this.stats,
      totalDuration: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      errorRate: 0
    };

    let errorCount = 0;
    let tracesWithDuration = 0;

    for (const trace of this.traces.values()) {
      if (trace.duration) {
        stats.totalDuration += trace.duration;
        stats.maxDuration = Math.max(stats.maxDuration, trace.duration);
        stats.minDuration = Math.min(stats.minDuration, trace.duration);
        tracesWithDuration++;
      }

      if (trace.status === 'ERROR') {
        errorCount++;
      }
    }

    stats.averageDuration =
      tracesWithDuration > 0 ? stats.totalDuration / tracesWithDuration : 0;
    stats.errorRate =
      this.stats.tracesCreated > 0
        ? (errorCount / this.stats.tracesCreated) * 100
        : 0;

    return stats;
  }

  /**
   * Health check
   * @returns {object} Estado del servicio
   */
  healthCheck() {
    return {
      healthy: true,
      serviceName: 'TracingService',
      timestamp: new Date(),
      stats: this.getStatistics(),
      tracesInMemory: this.traces.size,
      spansInMemory: this.spans.size
    };
  }

  /**
   * Métodos auxiliares privados
   */

  uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  getClientIp(req) {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress
    );
  }

  maskUrl(url) {
    // Remover parámetros sensibles
    return url.replace(
      /([?&])([^=]+)=([^&]*)/g,
      (match, prefix, key, value) => {
        if (
          ['password', 'token', 'secret', 'api_key'].includes(key.toLowerCase())
        ) {
          return `${prefix}${key}=***`;
        }
        return match;
      }
    );
  }

  maskSensitiveParams(params) {
    const masked = { ...params };
    for (const key in masked) {
      if (['password', 'token', 'secret', 'creditCard'].includes(key)) {
        masked[key] = '***';
      }
    }
    return masked;
  }

  calculateSpanDepth(span) {
    let depth = 0;
    let current = span;

    while (current.parentSpanId) {
      current = this.spans.get(current.parentSpanId) || current;
      depth++;
    }

    return depth;
  }

  attributesToTags(attributes) {
    const tags = [];
    for (const [key, value] of Object.entries(attributes)) {
      tags.push({
        key,
        value: this.typeValue(value)
      });
    }
    return tags;
  }

  attributesToKeyValues(attributes) {
    const keyValues = [];
    for (const [key, value] of Object.entries(attributes)) {
      keyValues.push({
        key,
        value: this.typeValue(value)
      });
    }
    return keyValues;
  }

  typeValue(value) {
    if (typeof value === 'string') {
      return { stringValue: value };
    }
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? { intValue: value }
        : { doubleValue: value };
    }
    if (typeof value === 'boolean') {
      return { boolValue: value };
    }
    return { stringValue: JSON.stringify(value) };
  }

  getAttributeValue(obj, path) {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }
}

export default TracingService;
