import { ConfigLoader } from './config-loader';

/**
 * Centralized configuration export
 * Use this throughout the application for type-safe configuration access
 *
 * @example
 * import { Config } from './config/service-config';
 *
 * const timeout = Config.apiClient.timeout;
 * const logLevel = Config.logging.level;
 */

// Load configuration once at module initialization
const config = ConfigLoader.load();

/**
 * Type-safe configuration accessor
 */
export const Config = {
  get env() {
    return config.env;
  },
  get apiClient() {
    return config.apiClient;
  },
  get logging() {
    return config.logging;
  },
  get rateLimiting() {
    return config.rateLimiting;
  },
  get cache() {
    return config.cache;
  },
  get email() {
    return config.email;
  },
} as const;

// Export config loader for testing
export { ConfigLoader };
