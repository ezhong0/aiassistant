import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';
import { BaseService } from './base-service';
import { ServiceState } from './service-manager';

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  
  // Google OAuth (optional in development)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_WEB_CLIENT_ID: z.string().optional(),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security').default('development_jwt_secret_key_at_least_32_characters_long_for_security'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_ISSUER: z.string().default('assistantapp'),
  JWT_AUDIENCE: z.string().default('assistantapp-client'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('100'),
  
  // Security
  BCRYPT_SALT_ROUNDS: z.string().regex(/^\d+$/).transform(Number).default('12'),
  
  // Database (for future use)
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  
  // External APIs
  OPENAI_API_KEY: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration schema definition
 */
export interface ConfigSchema {
  required: string[];
  optional: string[];
  types: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
  defaults: Record<string, any>;
  validators?: Record<string, (value: any) => boolean>;
}

/**
 * Configuration watch callback
 */
export type ConfigWatchCallback<T = any> = (config: T, error?: Error) => void;

/**
 * Configuration watch entry
 */
interface ConfigWatcher {
  path: string;
  callback: ConfigWatchCallback;
  lastModified: number;
}

/**
 * Configuration Service
 * 
 * This service provides comprehensive configuration management including
 * environment variables, file-based configuration, validation, and watching.
 * 
 * Features:
 * - Environment variable validation with Zod
 * - File-based configuration loading
 * - Configuration validation and schema support
 * - File watching for configuration changes
 * - Caching for performance
 * - Type-safe configuration access
 */
export class ConfigService extends BaseService {
  private config: Config;
  private configCache: Map<string, any> = new Map();
  private configWatchers: Map<string, ConfigWatcher> = new Map();
  private watchInterval: NodeJS.Timeout | null = null;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super('configService');
    this.config = this.loadAndValidateConfig();
    this.logConfigSummary();
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // Configuration is already loaded in constructor
    // No additional initialization needed
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.configWatchers.clear();
    this.configCache.clear();
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const healthy = this.isReady();
    return {
      healthy,
      details: {
        nodeEnv: this.config.NODE_ENV,
        port: this.config.PORT,
        logLevel: this.config.LOG_LEVEL,
        cachedConfigs: this.configCache.size,
        activeWatchers: this.configWatchers.size,
        // Never include sensitive values in health checks
        googleClientIdSet: !!this.config.GOOGLE_CLIENT_ID,
        googleClientSecretSet: !!this.config.GOOGLE_CLIENT_SECRET,
        jwtSecretSet: !!this.config.JWT_SECRET,
        openaiApiKeySet: !!this.config.OPENAI_API_KEY,
        slackClientIdSet: !!this.config.SLACK_CLIENT_ID,
      }
    };
  }

  /**
   * Load and validate environment configuration
   */
  private loadAndValidateConfig(): Config {
    try {
      const result = envSchema.safeParse(process.env);
      
      if (!result.success) {
        const errors = result.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        ).join('\n');
        
        throw new Error(`Configuration validation failed:\n${errors}`);
      }
      
      return result.data;
    } catch (error) {
      logger.error('Failed to load environment configuration', error as Error, {
        correlationId: `config-load-${Date.now()}`,
        operation: 'env_config_load'
      });
      throw error;
    }
  }

  /**
   * Log configuration summary (without sensitive data)
   */
  private logConfigSummary(): void {
    logger.info('Configuration loaded successfully', {
      correlationId: `config-summary-${Date.now()}`,
      operation: 'config_summary',
      metadata: {
        nodeEnv: this.config.NODE_ENV,
        port: this.config.PORT,
        logLevel: this.config.LOG_LEVEL,
        corsOrigin: this.config.CORS_ORIGIN,
        rateLimitWindowMs: this.config.RATE_LIMIT_WINDOW_MS,
        rateLimitMaxRequests: this.config.RATE_LIMIT_MAX_REQUESTS,
        bcryptSaltRounds: this.config.BCRYPT_SALT_ROUNDS,
        // Boolean flags for sensitive data
        googleOAuthConfigured: !!(this.config.GOOGLE_CLIENT_ID && this.config.GOOGLE_CLIENT_SECRET),
        jwtConfigured: !!this.config.JWT_SECRET,
        databaseConfigured: !!this.config.DATABASE_URL,
        redisConfigured: !!this.config.REDIS_URL,
        openaiConfigured: !!this.config.OPENAI_API_KEY,
        slackConfigured: !!(this.config.SLACK_CLIENT_ID && this.config.SLACK_CLIENT_SECRET)
      }
    });
  }

  /**
   * Load configuration from a file path
   */
  async loadConfig<T = any>(configPath: string): Promise<T> {
    const absolutePath = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);

    // Check cache first
    const cached = this.getCachedConfig<T>(absolutePath);
    if (cached) {
      return cached;
    }

    try {
      const configData = await this.readConfigFile(absolutePath);
      this.configCache.set(absolutePath, {
        data: configData,
        timestamp: Date.now()
      });

      logger.debug(`Configuration loaded: ${configPath}`, {
        correlationId: `config-load-${Date.now()}`,
        operation: 'config_load',
        metadata: { path: configPath, keys: Object.keys(configData || {}).length }
      });

      return configData as T;

    } catch (error) {
      logger.error(`Failed to load configuration: ${configPath}`, error as Error, {
        correlationId: `config-load-${Date.now()}`,
        operation: 'config_load_error',
        metadata: { path: configPath }
      });
      throw error;
    }
  }

  /**
   * Load configuration with validation
   */
  async loadConfigWithValidation<T = any>(
    configPath: string,
    schema: ConfigSchema
  ): Promise<T> {
    const config = await this.loadConfig<T>(configPath);
    const validation = this.validateConfig(config, schema);

    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      logger.warn(`Configuration warnings for ${configPath}`, {
        correlationId: `config-validation-${Date.now()}`,
        operation: 'config_validation_warnings',
        metadata: { path: configPath, warnings: validation.warnings }
      });
    }

    return this.applyDefaults(config, schema) as T;
  }

  /**
   * Validate configuration against schema
   */
  validateConfig<T = any>(config: T, schema: ConfigSchema): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    const configObj = config as Record<string, any>;

    // Check required fields
    for (const requiredField of schema.required) {
      if (!(requiredField in configObj) || configObj[requiredField] == null) {
        result.errors.push(`Missing required field: ${requiredField}`);
        result.valid = false;
      }
    }

    // Check types
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (field in configObj && configObj[field] != null) {
        const actualType = Array.isArray(configObj[field])
          ? 'array'
          : typeof configObj[field];

        if (actualType !== expectedType) {
          result.errors.push(`Invalid type for ${field}: expected ${expectedType}, got ${actualType}`);
          result.valid = false;
        }
      }
    }

    // Run custom validators
    if (schema.validators) {
      for (const [field, validator] of Object.entries(schema.validators)) {
        if (field in configObj && configObj[field] != null) {
          try {
            if (!validator(configObj[field])) {
              result.errors.push(`Validation failed for field: ${field}`);
              result.valid = false;
            }
          } catch (error) {
            result.errors.push(`Validator error for ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            result.valid = false;
          }
        }
      }
    }

    // Check for unexpected fields
    const allExpectedFields = [...schema.required, ...schema.optional];
    for (const field of Object.keys(configObj)) {
      if (!allExpectedFields.includes(field)) {
        result.warnings.push(`Unexpected field: ${field}`);
      }
    }

    return result;
  }

  /**
   * Watch configuration file for changes
   */
  watchConfigChanges<T = any>(configPath: string, callback: ConfigWatchCallback<T>): void {
    const absolutePath = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);

    this.configWatchers.set(absolutePath, {
      path: absolutePath,
      callback: callback as ConfigWatchCallback,
      lastModified: 0
    });

    // Start watching if not already started
    if (!this.watchInterval) {
      this.startConfigWatcher();
    }

    logger.debug(`Configuration watcher added: ${configPath}`, {
      correlationId: `config-watch-${Date.now()}`,
      operation: 'config_watcher_add',
      metadata: { path: configPath }
    });
  }

  /**
   * Stop watching a configuration file
   */
  stopWatching(configPath: string): boolean {
    const absolutePath = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);

    const removed = this.configWatchers.delete(absolutePath);

    if (this.configWatchers.size === 0 && this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }

    return removed;
  }

  /**
   * Get environment-specific configuration
   */
  async loadEnvironmentConfig<T = any>(
    basePath: string,
    environment: string = process.env.NODE_ENV || 'development'
  ): Promise<T> {
    const envConfigPath = basePath.replace(/(\.[^.]+)$/, `.${environment}$1`);

    try {
      // Try environment-specific config first
      return await this.loadConfig<T>(envConfigPath);
    } catch (error) {
      // Fallback to base config
      logger.warn(`Environment-specific config not found, using base config`, {
        correlationId: `config-env-${Date.now()}`,
        operation: 'env_config_fallback',
        metadata: { envPath: envConfigPath, basePath }
      });
      return await this.loadConfig<T>(basePath);
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    const cacheSize = this.configCache.size;
    this.configCache.clear();

    logger.debug('Configuration cache cleared', {
      correlationId: `config-cache-${Date.now()}`,
      operation: 'cache_clear',
      metadata: { clearedEntries: cacheSize }
    });
  }

  // Environment configuration getters
  get nodeEnv(): string { return this.config.NODE_ENV; }
  get port(): number { return this.config.PORT; }
  get isDevelopment(): boolean { return this.config.NODE_ENV === 'development'; }
  get isProduction(): boolean { return this.config.NODE_ENV === 'production'; }
  get isTest(): boolean { return this.config.NODE_ENV === 'test'; }
  
  // Google OAuth
  get googleClientId(): string | undefined { return this.config.GOOGLE_CLIENT_ID; }
  get googleClientSecret(): string | undefined { return this.config.GOOGLE_CLIENT_SECRET; }
  get googleRedirectUri(): string | undefined { return this.config.GOOGLE_REDIRECT_URI; }
  get googleWebClientId(): string | undefined { return this.config.GOOGLE_WEB_CLIENT_ID; }
  
  // JWT
  get jwtSecret(): string { return this.config.JWT_SECRET; }
  get jwtExpiresIn(): string { return this.config.JWT_EXPIRES_IN; }
  get jwtIssuer(): string { return this.config.JWT_ISSUER; }
  get jwtAudience(): string { return this.config.JWT_AUDIENCE; }
  
  // Logging
  get logLevel(): string { return this.config.LOG_LEVEL; }
  get logFilePath(): string { return this.config.LOG_FILE_PATH; }
  
  // CORS
  get corsOrigin(): string { return this.config.CORS_ORIGIN; }
  
  // Rate Limiting
  get rateLimitWindowMs(): number { return this.config.RATE_LIMIT_WINDOW_MS; }
  get rateLimitMaxRequests(): number { return this.config.RATE_LIMIT_MAX_REQUESTS; }
  
  // Security
  get bcryptSaltRounds(): number { return this.config.BCRYPT_SALT_ROUNDS; }
  
  // Database
  get databaseUrl(): string | undefined { return this.config.DATABASE_URL; }
  get redisUrl(): string | undefined { return this.config.REDIS_URL; }
  
  // External APIs
  get openaiApiKey(): string | undefined { return this.config.OPENAI_API_KEY; }
  get slackClientId(): string | undefined { return this.config.SLACK_CLIENT_ID; }
  get slackClientSecret(): string | undefined { return this.config.SLACK_CLIENT_SECRET; }
  get slackSigningSecret(): string | undefined { return this.config.SLACK_SIGNING_SECRET; }
  
  // Get full config object (use with caution)
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Get cached configuration if valid
   */
  private getCachedConfig<T>(path: string): T | null {
    const cached = this.configCache.get(path);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.configCache.delete(path);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Read configuration file with proper parsing
   */
  private async readConfigFile(filePath: string): Promise<any> {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        return JSON.parse(fileContent);
      case '.js':
      case '.ts':
        // For JS/TS files, use dynamic import
        return await import(filePath);
      default:
        // Try JSON parse as default
        try {
          return JSON.parse(fileContent);
        } catch {
          // Return as plain text if not JSON
          return fileContent;
        }
    }
  }

  /**
   * Apply default values from schema
   */
  private applyDefaults<T>(config: T, schema: ConfigSchema): T {
    const configObj = { ...config as Record<string, any> };

    for (const [field, defaultValue] of Object.entries(schema.defaults)) {
      if (!(field in configObj) || configObj[field] == null) {
        configObj[field] = defaultValue;
      }
    }

    return configObj as T;
  }

  /**
   * Start configuration file watcher
   */
  private startConfigWatcher(): void {
    this.watchInterval = setInterval(async () => {
      for (const [path, watcher] of this.configWatchers.entries()) {
        try {
          const stats = await fs.stat(path);
          const lastModified = stats.mtime.getTime();

          if (lastModified > watcher.lastModified) {
            watcher.lastModified = lastModified;

            // Clear cache and reload
            this.configCache.delete(path);

            try {
              const newConfig = await this.loadConfig(path);
              watcher.callback(newConfig);
            } catch (error) {
              watcher.callback(null, error as Error);
            }
          }
        } catch (error) {
          // File might not exist or be inaccessible
          watcher.callback(null, error as Error);
        }
      }
    }, 5000); // Check every 5 seconds

    logger.debug('Configuration watcher started', {
      correlationId: `config-watch-${Date.now()}`,
      operation: 'config_watcher_start',
      metadata: { watchingCount: this.configWatchers.size }
    });
  }
}

// Export singleton instance
export const configService = new ConfigService();
