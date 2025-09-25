import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';
import { IService, ServiceState } from "./service-manager";

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
 * ConfigurationManager - Single Responsibility: Configuration Loading & Validation
 *
 * Handles all configuration management including loading, validation,
 * watching for changes, and providing typed configuration access.
 * Extracted from ServiceManager to follow SRP.
 */
export class ConfigurationManager implements IService {
  readonly name = 'configurationManager';
  private _state: ServiceState = ServiceState.CREATED;
  private configCache: Map<string, any> = new Map();
  private configWatchers: Map<string, ConfigWatcher> = new Map();
  private watchInterval: NodeJS.Timeout | null = null;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  get state(): ServiceState {
    return this._state;
  }

  async initialize(): Promise<void> {
    this._state = ServiceState.READY;
  }

  isReady(): boolean {
    return this._state === ServiceState.READY;
  }

  async destroy(): Promise<void> {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.configWatchers.clear();
    this.configCache.clear();
    this._state = ServiceState.DESTROYED;
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady(),
      details: {
        cachedConfigs: this.configCache.size,
        activeWatchers: this.configWatchers.size,
        watcherActive: this.watchInterval !== null
      }
    };
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
        correlationId: `config-manager-${Date.now()}`,
        operation: 'config_load',
        metadata: { path: configPath, keys: Object.keys(configData || {}).length }
      });

      return configData as T;

    } catch (error) {
      logger.error(`Failed to load configuration: ${configPath}`, {
        correlationId: `config-manager-${Date.now()}`,
        operation: 'config_load_error',
        metadata: {
          path: configPath,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
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
        correlationId: `config-manager-${Date.now()}`,
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
      correlationId: `config-manager-${Date.now()}`,
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
        correlationId: `config-manager-${Date.now()}`,
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
      correlationId: `config-manager-${Date.now()}`,
      operation: 'cache_clear',
      metadata: { clearedEntries: cacheSize }
    });
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
      correlationId: `config-manager-${Date.now()}`,
      operation: 'config_watcher_start',
      metadata: { watchingCount: this.configWatchers.size }
    });
  }

}