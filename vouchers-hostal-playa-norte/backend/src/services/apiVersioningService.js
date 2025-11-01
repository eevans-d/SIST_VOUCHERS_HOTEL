import express from 'express';
import semver from 'semver';
import pino from 'pino';

const logger = pino();

/**
 * API Versioning Service - Gestión de múltiples versiones
 *
 * Características:
 * - Versionado semantic (v1, v2, v3)
 * - Deprecation warnings
 * - Backward compatibility
 * - Migration helpers
 * - Version-specific routing
 */
class APIVersioningService {
  constructor(config = {}) {
    this.config = {
      currentVersion: config.currentVersion || '2.0.0',
      supportedVersions: config.supportedVersions || ['1.0.0', '2.0.0'],
      deprecationWarningDays: config.deprecationWarningDays || 90,
      retirementDate: config.retirementDate || {},
      ...config
    };

    this.versionRegistry = new Map(); // Map<version, handlers>
    this.migrations = new Map(); // Map<'v1->v2', migrationFn>
    this.deprecations = new Map(); // Map<version, { date, reason }>

    this.stats = {
      requestsV1: 0,
      requestsV2: 0,
      deprecationWarningsSent: 0,
      migrationsPerformed: 0
    };
  }

  /**
   * Registrar versión
   */
  registerVersion(version, handlers) {
    if (!semver.valid(version)) {
      throw new Error(`Invalid semantic version: ${version}`);
    }

    this.versionRegistry.set(version, {
      version,
      endpoints: handlers || {},
      createdAt: new Date()
    });

    return this;
  }

  /**
   * Registrar deprecación
   */
  deprecateVersion(version, retirementDate, reason) {
    this.deprecations.set(version, {
      version,
      retirementDate: new Date(retirementDate),
      reason,
      deprecatedAt: new Date()
    });

    logger.info(`Version ${version} deprecated: ${reason}`);
    return this;
  }

  /**
   * Obtener versión actual
   */
  getCurrentVersion() {
    return this.config.currentVersion;
  }

  /**
   * Validar versión soportada
   */
  isVersionSupported(version) {
    if (!semver.valid(version)) {
      return false;
    }

    return this.config.supportedVersions.some((v) =>
      semver.satisfies(version, v)
    );
  }

  /**
   * Validar versión deprecada
   */
  isVersionDeprecated(version) {
    return this.deprecations.has(version);
  }

  /**
   * Resolver versión (v1, v1.0, v1.0.0 → 1.0.0)
   */
  resolveVersion(versionString) {
    if (!versionString) {
      return this.config.currentVersion;
    }

    // Limpiar prefix 'v' si existe
    const cleanVersion = versionString.toLowerCase().replace(/^v/, '');

    // Si es range semver (^1.0 o ~1.0), resolver a última
    if (semver.validRange(cleanVersion)) {
      const supported = this.config.supportedVersions.filter((v) =>
        semver.satisfies(v, cleanVersion)
      );

      if (supported.length > 0) {
        return supported[supported.length - 1]; // Última versión en rango
      }
    }

    // Si es versión válida
    if (semver.valid(cleanVersion)) {
      return cleanVersion;
    }

    // Default a versión actual
    return this.config.currentVersion;
  }

  /**
   * Middleware para detección de versión
   */
  versionDetectionMiddleware() {
    return (req, res, next) => {
      // Detectar versión de:
      // 1. Header Accept-Version
      // 2. URL path (/api/v1/...)
      // 3. Query parameter (?version=2)
      // 4. Header User-Agent

      let version = null;

      // 1. Accept-Version header
      if (req.headers['accept-version']) {
        version = req.headers['accept-version'];
      }

      // 2. URL path
      const pathMatch = req.path.match(/\/api\/v(\d+(?:\.\d+)*)/);
      if (pathMatch) {
        version = `${pathMatch[1]}`;
      }

      // 3. Query parameter
      if (req.query.version) {
        version = String(req.query.version);
      }

      // Resolver versión
      req.apiVersion = this.resolveVersion(version);
      req.requestedVersion = version;

      // Añadir headers de respuesta
      res.setHeader('API-Version', req.apiVersion);

      // Verificar deprecación
      if (this.isVersionDeprecated(req.apiVersion)) {
        const deprecation = this.deprecations.get(req.apiVersion);
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', deprecation.retirementDate.toUTCString());
        res.setHeader(
          'Warning',
          `299 - "API version ${req.apiVersion} is deprecated. ` +
            `Will be retired on ${deprecation.retirementDate.toDateString()}. ` +
            `Reason: ${deprecation.reason}"`
        );

        this.stats.deprecationWarningsSent++;
      }

      next();
    };
  }

  /**
   * Middleware para reescritura de versión
   */
  versionRewriteMiddleware(fromVersion, toVersion, migrationFn) {
    const key = `${fromVersion}->${toVersion}`;
    this.migrations.set(key, migrationFn);

    return (req, res, next) => {
      if (req.apiVersion === fromVersion) {
        // Aplicar migración antes de procesar
        if (req.body && typeof req.body === 'object') {
          try {
            req.body = migrationFn(req.body);
            this.stats.migrationsPerformed++;
          } catch (error) {
            logger.error('Migration error:', error);
            return res.status(400).json({
              error: 'Invalid request for version migration',
              details: error.message
            });
          }
        }
      }

      next();
    };
  }

  /**
   * Middleware para normalización de respuesta
   */
  responseNormalizerMiddleware(fromVersion, toVersion, transformFn) {
    return (req, res, next) => {
      if (req.apiVersion === toVersion) {
        const originalJson = res.json.bind(res);

        res.json = function (data) {
          try {
            const transformed = transformFn(data);
            return originalJson(transformed);
          } catch (error) {
            logger.error('Response transform error:', error);
            return originalJson(data);
          }
        };
      }

      next();
    };
  }

  /**
   * Router versioned - Retorna router con rutas versionadas
   */
  createVersionedRouter() {
    const router = express.Router();

    // Aplicar middleware de detección
    router.use(this.versionDetectionMiddleware());

    return router;
  }

  /**
   * Registrar endpoint versionado
   */
  registerEndpoint(version, method, path, handler) {
    const key = `${method} ${path}`;

    if (!this.versionRegistry.has(version)) {
      this.registerVersion(version, {});
    }

    const versionData = this.versionRegistry.get(version);
    versionData.endpoints[key] = handler;

    return this;
  }

  /**
   * Obtener handler para endpoint y versión
   */
  getEndpointHandler(version, method, path) {
    const key = `${method} ${path}`;

    if (this.versionRegistry.has(version)) {
      const handlers = this.versionRegistry.get(version).endpoints;
      if (handlers[key]) {
        return handlers[key];
      }
    }

    // Buscar en versiones anteriores (backward compatibility)
    for (const [v, data] of this.versionRegistry) {
      if (semver.lt(v, version) && data.endpoints[key]) {
        return data.endpoints[key];
      }
    }

    return null;
  }

  /**
   * Wrapper para handler versionado
   */
  versionedHandler(handlers = {}) {
    return (req, res, next) => {
      const version = req.apiVersion;
      const handler = handlers[version] || handlers['default'];

      if (!handler) {
        return res.status(501).json({
          error: 'Not implemented for this API version',
          version
        });
      }

      handler(req, res, next);
    };
  }

  /**
   * Migración de request v1 → v2
   */
  migrateRequestV1toV2(body) {
    // Ejemplo: mapear campos antiguos a nuevos
    const migrated = { ...body };

    // v1: { user_id } → v2: { userId }
    if (migrated.user_id) {
      migrated.userId = migrated.user_id;
      delete migrated.user_id;
    }

    // v1: { order_date } → v2: { orderDate }
    if (migrated.order_date) {
      migrated.orderDate = migrated.order_date;
      delete migrated.order_date;
    }

    // v1: { price_usd } → v2: { price: { amount, currency } }
    if (migrated.price_usd) {
      migrated.price = {
        amount: migrated.price_usd,
        currency: 'USD'
      };
      delete migrated.price_usd;
    }

    return migrated;
  }

  /**
   * Migración de response v2 → v1
   */
  migrateResponseV2toV1(data) {
    const migrated = { ...data };

    // v2: { userId } → v1: { user_id }
    if (migrated.userId) {
      migrated.user_id = migrated.userId;
      delete migrated.userId;
    }

    // v2: { orderDate } → v1: { order_date }
    if (migrated.orderDate) {
      migrated.order_date = migrated.orderDate;
      delete migrated.orderDate;
    }

    // v2: { price: { amount, currency } } → v1: { price_usd }
    if (migrated.price && typeof migrated.price === 'object') {
      migrated.price_usd = migrated.price.amount;
      delete migrated.price;
    }

    return migrated;
  }

  /**
   * Changelog
   */
  getChangelog() {
    return {
      current: this.config.currentVersion,
      supported: this.config.supportedVersions,
      deprecated: Array.from(this.deprecations.values()).map((d) => ({
        version: d.version,
        reason: d.reason,
        retirementDate: d.retirementDate,
        deprecatedAt: d.deprecatedAt
      })),
      versions: Array.from(this.versionRegistry.values()).map((v) => ({
        version: v.version,
        createdAt: v.createdAt,
        status: this.isVersionDeprecated(v.version) ? 'deprecated' : 'active',
        deprecation: this.deprecations.get(v.version)
      }))
    };
  }

  /**
   * Estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      registeredVersions: this.versionRegistry.size,
      deprecatedVersions: this.deprecations.size,
      migrationsRegistered: this.migrations.size,
      currentVersion: this.config.currentVersion
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      healthy: true,
      currentVersion: this.config.currentVersion,
      supportedVersions: this.config.supportedVersions,
      timestamp: new Date()
    };
  }
}

/**
 * Funciones helper
 */
export function createVersionedEndpoint(versioningService, versions = {}) {
  return versioningService.versionedHandler(versions);
}

export function migrateRequest(
  versioningService,
  fromVersion,
  toVersion,
  body
) {
  const key = `${fromVersion}->${toVersion}`;
  const migration = versioningService.migrations.get(key);

  if (!migration) {
    throw new Error(`No migration found: ${key}`);
  }

  return migration(body);
}

export function checkVersionSupport(versioningService, version) {
  return versioningService.isVersionSupported(version);
}

export default APIVersioningService;
