import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
        region: process.env.AWS_REGION || 'us-east-1',
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
      console.log('✅ Secrets Manager initialized successfully');
      return this.secrets;
    } catch (error) {
      console.error('❌ Failed to initialize Secrets Manager:', error);
      
      // Fallback to .env in development
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Falling back to .env file');
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
        console.debug('✓ Using cached secrets');
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
    const secretName = process.env.AWS_SECRETS_NAME || 'hotel-vouchers/production';
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const command = new GetSecretValueCommand({
          SecretId: secretName,
        });

        const response = await this.client.send(command);

        // Parse secret (JSON or plain text)
        let secretData;
        if (response.SecretString) {
          try {
            secretData = JSON.parse(response.SecretString);
          } catch {
            // Handle as plain string
            secretData = { value: response.SecretString };
          }
        } else if (response.SecretBinary) {
          // Handle binary secrets
          const buff = Buffer.from(response.SecretBinary, 'base64');
          secretData = JSON.parse(buff.toString('utf-8'));
        }

        // Merge with environment variables (env vars take precedence)
        this.secrets = {
          ...secretData,
          ...this._getEnvironmentSecrets(),
        };

        this.lastLoadTime = Date.now();

        console.log(`✅ Secrets loaded from AWS (attempt ${attempt}/${this.retryAttempts})`);
        return this.secrets;
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt}/${this.retryAttempts} failed:`, error.message);

        if (attempt < this.retryAttempts) {
          // Exponential backoff
          const delayMs = this.retryDelayMs * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${delayMs}ms...`);
          await this._sleep(delayMs);
        }
      }
    }

    throw new Error(
      `Failed to load secrets from AWS after ${this.retryAttempts} attempts: ${lastError.message}`
    );
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
        console.warn('⚠️ Error loading .env file:', result.error.message);
      }

      this.secrets = this._getEnvironmentSecrets();
      this.lastLoadTime = Date.now();
      
      console.log('✅ Secrets loaded from .env file');
    } catch (error) {
      console.error('❌ Error loading .env file:', error);
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
      'SENDGRID_API_KEY',
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
      console.warn(`⚠️ Secrets not initialized. Returning default for ${key}`);
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
      console.warn('⚠️ Secrets not initialized');
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
    console.log('🔄 Rotating secrets...');
    this.lastLoadTime = null; // Invalidate cache
    
    try {
      await this.loadSecrets();
      console.log('✅ Secrets rotated successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to rotate secrets:', error);
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
      console.error('❌ Missing required secrets:', missing);
      return false;
    }

    console.log('✅ All required secrets present');
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
