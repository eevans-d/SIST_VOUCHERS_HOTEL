/* eslint-disable indent, max-lines */
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * SecretsManager Service
 *
 * Manages application secrets using AWS Secrets Manager.
 * Provides caching, fallback to .env, and rotation support.
 *
 * Features:
 * - Fetch secrets from AWS Secrets Manager
 * - Cache in memory for performance
 * - Fallback to .env in development
 * - Retry logic with exponential backoff
 * - Error tracking and logging
 * - Support for secret rotation
 *
 * @class
 */
export class SecretsManager {
  constructor() {
    this.secrets = null;
    this.lastLoadTime = null;
    this.cacheMaxAge = 60 * 60 * 1000; // 1 hour cache
    this.retryAttempts = 3;
    this.retryDelayMs = 1000;
    this.isInitialized = false;

    // Initialize AWS SDK only in production
    if (process.env.NODE_ENV === 'production') {
      this.client = new SecretsManagerClient({
        region: process.env.AWS_REGION || 'us-east-1'
      });
    } else {
      this.client = null;
    }
  }

  /**
   * Initialize and load secrets
   * Called once at application startup
   */
  async initialize() {
    if (this.isInitialized) {
      return this.secrets;
    }

    try {
      await this.loadSecrets();
      this.isInitialized = true;
  logger.info({ event: 'secrets_initialized' });
      return this.secrets;
    } catch (error) {
  logger.error({ event: 'secrets_init_failed', error: error.message, stack: error.stack });

      // Fallback to .env in development
      if (process.env.NODE_ENV !== 'production') {
  logger.warn({ event: 'secrets_fallback_env' });
        this._loadFromEnvFile();
        return this.secrets;
      }

      throw new Error('Failed to load secrets and no .env fallback available');
    }
  }

  /**
   * Load secrets from AWS Secrets Manager with retry logic
   * @private
   */
  async loadSecrets() {
    // Check cache validity
    if (this.secrets && this.lastLoadTime) {
      const cacheAge = Date.now() - this.lastLoadTime;
      if (cacheAge < this.cacheMaxAge) {
  logger.debug({ event: 'secrets_cache_used' });
        return this.secrets;
      }
    }

    // Load from AWS in production
    if (process.env.NODE_ENV === 'production') {
      return await this._loadFromAWS();
    }

    // Load from .env in development
    this._loadFromEnvFile();
    return this.secrets;
  }

  /**
   * Fetch secrets from AWS Secrets Manager with retry
   * @private
   */
  async _loadFromAWS() {
    const secretName =
      process.env.AWS_SECRETS_NAME || 'hotel-vouchers/production';
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this._fetchSecretFromAWS(secretName);
        const secretData = this._parseSecretResponse(response);
        this._mergeWithEnv(secretData);
        this.lastLoadTime = Date.now();
        logger.info({
          event: 'secrets_loaded_aws',
          attempt,
          retryAttempts: this.retryAttempts
        });
        return this.secrets;
      } catch (error) {
        lastError = error;
        this._handleAwsAttemptError(attempt, error);
        if (attempt < this.retryAttempts) {
          const delayMs = this.retryDelayMs * Math.pow(2, attempt - 1);
          logger.warn({ event: 'secrets_retry_wait', attempt, delayMs });
          await this._sleep(delayMs);
        }
      }
    }

    throw new Error(
      `Failed to load secrets from AWS after ${this.retryAttempts} attempts: ${lastError.message}`
    );
  }

  _buildGetSecretCommand(secretName) {
    return new GetSecretValueCommand({ SecretId: secretName });
  }

  async _fetchSecretFromAWS(secretName) {
    const command = this._buildGetSecretCommand(secretName);
    return this.client.send(command);
  }

  _parseSecretResponse(response) {
    if (response.SecretString) {
      try {
        return JSON.parse(response.SecretString);
      } catch {
        return { value: response.SecretString };
      }
    }
    if (response.SecretBinary) {
      const buff = Buffer.from(response.SecretBinary, 'base64');
      return JSON.parse(buff.toString('utf-8'));
    }
    return {};
  }

  _mergeWithEnv(secretData) {
    this.secrets = {
      ...secretData,
      ...this._getEnvironmentSecrets()
    };
  }

  _handleAwsAttemptError(attempt, error) {
    logger.error({
      event: 'secrets_aws_attempt_failed',
      attempt,
      retryAttempts: this.retryAttempts,
      error: error.message,
      stack: error.stack
    });
  }

  /**
   * Load secrets from .env file (development)
   * @private
   */
  _loadFromEnvFile() {
    const envPath = path.join(__dirname, '../../.env');

    try {
      const result = dotenv.config({ path: envPath });

      if (result.error && result.error.code !== 'ENOENT') {
  logger.warn({ event: 'secrets_env_load_warning', error: result.error.message });
      }

      this.secrets = this._getEnvironmentSecrets();
      this.lastLoadTime = Date.now();

  logger.info({ event: 'secrets_loaded_env_file' });
    } catch (error) {
  logger.error({ event: 'secrets_env_load_error', error: error.message, stack: error.stack });
      this.secrets = this._getEnvironmentSecrets();
    }
  }

  /**
   * Extract secrets from environment variables
   * @private
   */
  _getEnvironmentSecrets() {
    const secrets = {};
    const secretKeys = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'REFRESH_TOKEN_SECRET',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'S3_BUCKET_NAME',
      'SMTP_PASSWORD',
      'STRIPE_SECRET_KEY',
      'SENDGRID_API_KEY'
    ];

    secretKeys.forEach((key) => {
      if (process.env[key]) {
        secrets[key] = process.env[key];
      }
    });

    return secrets;
  }

  /**
   * Get a specific secret value
   * @param {string} key - Secret key
   * @param {*} defaultValue - Default if not found
   * @returns {*} Secret value or default
   */
  get(key, defaultValue = null) {
    if (!this.isInitialized) {
  logger.warn({ event: 'secrets_get_uninitialized', key });
      return defaultValue;
    }

    return this.secrets[key] || defaultValue;
  }

  /**
   * Get all secrets
   * @returns {Object} All secrets
   */
  getAll() {
    if (!this.isInitialized) {
  logger.warn({ event: 'secrets_get_all_uninitialized' });
      return {};
    }

    return { ...this.secrets };
  }

  /**
   * Check if secret exists
   * @param {string} key - Secret key
   * @returns {boolean} True if exists
   */
  has(key) {
    return this.isInitialized && key in this.secrets;
  }

  /**
   * Rotate secrets (refresh cache)
   * Useful for manual secret rotation without restart
   */
  async rotate() {
  logger.info({ event: 'secrets_rotation_start' });
    this.lastLoadTime = null; // Invalidate cache

    try {
      await this.loadSecrets();
  logger.info({ event: 'secrets_rotation_success' });
      return true;
    } catch (error) {
  logger.error({ event: 'secrets_rotation_failed', error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Validate required secrets
   * @param {string[]} requiredKeys - List of required secret keys
   * @returns {boolean} True if all required secrets present
   */
  validateRequired(requiredKeys) {
    const missing = requiredKeys.filter((key) => !this.has(key));

    if (missing.length > 0) {
  logger.error({ event: 'secrets_missing_required', missing });
      return false;
    }

  logger.info({ event: 'secrets_required_present' });
    return true;
  }

  /**
   * Sleep utility for delays
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Create singleton instance
export const secretsManager = new SecretsManager();

export default secretsManager;
