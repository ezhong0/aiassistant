import { ServiceConfigSchema, ServiceConfig } from './config-schema';

/**
 * Configuration loader with environment variable support
 * Supports layered configuration: defaults → env vars → runtime overrides
 */
export class ConfigLoader {
  private static instance: ServiceConfig | null = null;

  /**
   * Load configuration from environment variables
   */
  static load(): ServiceConfig {
    if (this.instance) {
      return this.instance;
    }

    const rawConfig = {
      env: process.env.NODE_ENV as any,
      apiClient: {
        timeout: this.getEnvNumber('API_CLIENT_TIMEOUT'),
        retry: {
          maxAttempts: this.getEnvNumber('API_CLIENT_RETRY_MAX_ATTEMPTS'),
          baseDelay: this.getEnvNumber('API_CLIENT_RETRY_BASE_DELAY'),
          maxDelay: this.getEnvNumber('API_CLIENT_RETRY_MAX_DELAY'),
          backoffMultiplier: this.getEnvNumber('API_CLIENT_RETRY_BACKOFF_MULTIPLIER'),
          jitter: this.getEnvBoolean('API_CLIENT_RETRY_JITTER'),
        },
        circuitBreaker: {
          failureThreshold: this.getEnvNumber('CIRCUIT_BREAKER_FAILURE_THRESHOLD'),
          recoveryTimeout: this.getEnvNumber('CIRCUIT_BREAKER_RECOVERY_TIMEOUT'),
          successThreshold: this.getEnvNumber('CIRCUIT_BREAKER_SUCCESS_THRESHOLD'),
          timeout: this.getEnvNumber('CIRCUIT_BREAKER_TIMEOUT'),
        },
      },
      logging: {
        level: process.env.LOG_LEVEL as any,
        maxBodyLength: this.getEnvNumber('LOG_MAX_BODY_LENGTH'),
        enableRequestLogging: this.getEnvBoolean('LOG_ENABLE_REQUEST'),
        enableResponseLogging: this.getEnvBoolean('LOG_ENABLE_RESPONSE'),
        enableSlowQueryLogging: this.getEnvBoolean('LOG_ENABLE_SLOW_QUERY'),
        slowQueryThreshold: this.getEnvNumber('LOG_SLOW_QUERY_THRESHOLD'),
      },
      rateLimiting: {
        enabled: this.getEnvBoolean('RATE_LIMIT_ENABLED'),
        windowMs: this.getEnvNumber('RATE_LIMIT_WINDOW_MS'),
        maxRequests: this.getEnvNumber('RATE_LIMIT_MAX_REQUESTS'),
      },
      cache: {
        enabled: this.getEnvBoolean('CACHE_ENABLED'),
        ttl: this.getEnvNumber('CACHE_TTL'),
        maxSize: this.getEnvNumber('CACHE_MAX_SIZE'),
      },
      email: {
        batchSize: this.getEnvNumber('EMAIL_BATCH_SIZE'),
        maxSearchResults: this.getEnvNumber('EMAIL_MAX_SEARCH_RESULTS'),
        enableDataLoader: this.getEnvBoolean('EMAIL_ENABLE_DATA_LOADER'),
      },
    };

    // Validate and apply defaults
    const result = ServiceConfigSchema.safeParse(rawConfig);

    if (!result.success) {
      console.error('Configuration validation failed:', result.error.format());
      throw new Error('Invalid configuration');
    }

    this.instance = result.data;
    return this.instance;
  }

  /**
   * Override configuration at runtime (useful for testing)
   */
  static override(overrides: Partial<ServiceConfig>): void {
    const current = this.instance || this.load();
    const merged = {
      ...current,
      ...overrides,
    };

    const result = ServiceConfigSchema.safeParse(merged);
    if (!result.success) {
      throw new Error('Invalid configuration overrides');
    }

    this.instance = result.data;
  }

  /**
   * Reset to defaults
   */
  static reset(): void {
    this.instance = ServiceConfigSchema.parse({});
  }

  // Helper methods
  private static getEnvNumber(key: string): number | undefined {
    const value = process.env[key];
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }

  private static getEnvBoolean(key: string): boolean | undefined {
    const value = process.env[key];
    if (!value) return undefined;
    return value.toLowerCase() === 'true';
  }
}
