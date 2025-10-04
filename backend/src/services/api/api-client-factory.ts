import { BaseService } from '../base-service';
import { 
  APIClientFactoryConfig, 
  APIClientRegistration, 
  APIClientInstance,
  APIClientConfig,
  APIHealthStatus
} from '../../types/api/api-client.types';
import logger from '../../utils/logger';

/**
 * API Client Factory - Centralized creation and management of API clients
 * 
 * This factory provides a standardized way to create, configure, and manage
 * all third-party API clients in the application. It ensures consistent
 * configuration, proper initialization, and centralized health monitoring.
 * 
 * Features:
 * - Centralized client registration and creation
 * - Configuration management with defaults and overrides
 * - Health monitoring and status reporting
 * - Client lifecycle management
 * - Type-safe client access
 * 
 * @example
 * ```typescript
 * // Register a new API client
 * apiClientFactory.registerClient('google', GoogleAPIClient, {
 *   baseUrl: 'https://www.googleapis.com',
 *   timeout: 30000
 * });
 * 
 * // Create and get a client instance
 * const googleClient = await apiClientFactory.getClient('google');
 * 
 * // Check health status
 * const health = await apiClientFactory.getHealthStatus();
 * ```
 */
export class APIClientFactory extends BaseService {
  private clients: Map<string, APIClientInstance> = new Map();
  private registrations: Map<string, APIClientRegistration> = new Map();
  private config: APIClientFactoryConfig;

  constructor(config: APIClientFactoryConfig = {}) {
    super('APIClientFactory');
    this.config = {
      defaultConfig: {
        timeout: 30000,
        retry: {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          jitter: true,
          strategy: 'EXPONENTIAL_BACKOFF' as any
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTimeout: 60000,
          successThreshold: 3,
          timeout: 30000
        }
      },
      enableGlobalRateLimit: false,
      ...config
    };
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing API Client Factory', {
        defaultConfig: this.config.defaultConfig,
        enableGlobalRateLimit: this.config.enableGlobalRateLimit
      });

      // Initialize any pre-registered clients
      await this.initializeRegisteredClients();

      this.logInfo('API Client Factory initialized successfully', {
        registeredClients: this.registrations.size,
        initializedClients: this.clients.size
      });
    } catch (error) {
      this.logError('Failed to initialize API Client Factory', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying API Client Factory', {
        activeClients: this.clients.size
      });

      // Destroy all client instances
      for (const [name, instance] of this.clients) {
        try {
          if (instance.client && typeof instance.client.destroy === 'function') {
            await instance.client.destroy();
          }
          this.logDebug('Client destroyed', { clientName: name });
        } catch (error) {
          this.logError('Error destroying client', error, { clientName: name });
        }
      }

      this.clients.clear();
      this.registrations.clear();

      this.logInfo('API Client Factory destroyed successfully');
    } catch (error) {
      this.logError('Error destroying API Client Factory', error);
    }
  }

  /**
   * Register a new API client type
   */
  registerClient(
    name: string, 
    clientClass: new (config: APIClientConfig) => any, 
    defaultConfig: APIClientConfig
  ): void {
    this.logInfo('Registering API client', { 
      name, 
      clientClass: clientClass.name,
      baseUrl: defaultConfig.baseUrl 
    });

    const registration: APIClientRegistration = {
      name,
      clientClass,
      defaultConfig,
      enabled: true
    };

    this.registrations.set(name, registration);
  }

  /**
   * Create and get an API client instance
   */
  async getClient<T = any>(name: string, configOverride?: Partial<APIClientConfig>): Promise<T> {
    // Check if client is already created
    if (this.clients.has(name)) {
      const instance = this.clients.get(name)!;
      if (instance.initialized) {
        return instance.client as T;
      }
    }

    // Get registration
    const registration = this.registrations.get(name);
    if (!registration) {
      throw new Error(`API client '${name}' is not registered`);
    }

    if (!registration.enabled) {
      throw new Error(`API client '${name}' is disabled`);
    }

    try {
      this.logInfo('Creating API client instance', { 
        name, 
        clientClass: registration.clientClass.name 
      });

      // Merge configurations
      const finalConfig = this.mergeConfigurations(
        this.config.defaultConfig || {},
        registration.defaultConfig,
        this.config.serviceConfigs?.[name] || {},
        configOverride || {}
      );

      // Create client instance
      const client = new registration.clientClass(finalConfig);
      
      // Initialize client
      if (typeof client.initialize === 'function') {
        await client.initialize();
      }

      // Create instance record
      const instance: APIClientInstance = {
        name,
        client,
        config: finalConfig,
        initialized: true,
        healthy: true
      };

      // Store instance
      this.clients.set(name, instance);

      this.logInfo('API client instance created successfully', { 
        name, 
        baseUrl: finalConfig.baseUrl 
      });

      return client as T;
    } catch (error) {
      this.logError('Failed to create API client instance', error, { name });
      throw error;
    }
  }

  /**
   * Check if a client is registered
   */
  isClientRegistered(name: string): boolean {
    return this.registrations.has(name);
  }

  /**
   * Check if a client instance exists
   */
  hasClientInstance(name: string): boolean {
    return this.clients.has(name) && this.clients.get(name)!.initialized;
  }

  /**
   * Get client instance without creating it
   */
  getClientInstance(name: string): APIClientInstance | null {
    return this.clients.get(name) || null;
  }

  /**
   * Get all registered client names
   */
  getRegisteredClients(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Get all active client instances
   */
  getActiveClients(): APIClientInstance[] {
    return Array.from(this.clients.values()).filter(instance => instance.initialized);
  }

  /**
   * Enable or disable a client
   */
  setClientEnabled(name: string, enabled: boolean): void {
    const registration = this.registrations.get(name);
    if (registration) {
      registration.enabled = enabled;
      this.logInfo('Client enabled/disabled', { name, enabled });
    }
  }

  /**
   * Remove a client instance
   */
  async removeClient(name: string): Promise<void> {
    const instance = this.clients.get(name);
    if (instance) {
      try {
        if (instance.client && typeof instance.client.destroy === 'function') {
          await instance.client.destroy();
        }
        this.clients.delete(name);
        this.logInfo('Client instance removed', { name });
      } catch (error) {
        this.logError('Error removing client instance', error, { name });
      }
    }
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus(): Promise<APIHealthStatus> {
    const clientStatuses: Record<string, any> = {};
    let healthyClients = 0;
    let failedClients = 0;

    for (const [name, instance] of this.clients) {
      try {
        let healthy = false;
        let lastError: string | undefined;

        if (instance.client && typeof instance.client.getHealth === 'function') {
          const health = instance.client.getHealth();
          healthy = health.healthy;
        } else {
          healthy = instance.initialized;
        }

        if (healthy) {
          healthyClients++;
        } else {
          failedClients++;
          lastError = 'Health check failed';
        }

        clientStatuses[name] = {
          healthy,
          initialized: instance.initialized,
          authenticated: instance.client?.isAuthenticated?.() || false,
          lastError,
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        failedClients++;
        clientStatuses[name] = {
          healthy: false,
          initialized: instance.initialized,
          authenticated: false,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date().toISOString()
        };
      }
    }

    return {
      healthy: failedClients === 0,
      clients: clientStatuses,
      metrics: {
        totalClients: this.clients.size,
        healthyClients,
        failedClients,
        lastHealthCheck: new Date().toISOString()
      }
    };
  }

  /**
   * Test all client connections
   */
  async testAllConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, instance] of this.clients) {
      try {
        if (instance.client && typeof instance.client.testConnection === 'function') {
          results[name] = await instance.client.testConnection();
        } else {
          results[name] = instance.initialized;
        }
      } catch (error) {
        this.logError('Connection test failed', error, { clientName: name });
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Merge configuration objects with proper precedence
   */
  private mergeConfigurations(
    defaultConfig: Partial<APIClientConfig>,
    registrationConfig: APIClientConfig,
    serviceConfig: Partial<APIClientConfig>,
    overrideConfig: Partial<APIClientConfig>
  ): APIClientConfig {
    return {
      ...defaultConfig,
      ...registrationConfig,
      ...serviceConfig,
      ...overrideConfig,
      // Deep merge nested objects
      retry: {
        ...defaultConfig.retry,
        ...registrationConfig.retry,
        ...serviceConfig.retry,
        ...overrideConfig.retry
      },
      circuitBreaker: {
        ...defaultConfig.circuitBreaker,
        ...registrationConfig.circuitBreaker,
        ...serviceConfig.circuitBreaker,
        ...overrideConfig.circuitBreaker
      },
      rateLimit: {
        ...defaultConfig.rateLimit,
        ...registrationConfig.rateLimit,
        ...serviceConfig.rateLimit,
        ...overrideConfig.rateLimit
      },
      defaultHeaders: {
        ...defaultConfig.defaultHeaders,
        ...registrationConfig.defaultHeaders,
        ...serviceConfig.defaultHeaders,
        ...overrideConfig.defaultHeaders
      }
    } as APIClientConfig;
  }

  /**
   * Initialize pre-registered clients
   */
  private async initializeRegisteredClients(): Promise<void> {
    // This can be extended to auto-initialize certain clients
    // For now, clients are created on-demand
  }

  /**
   * Get factory configuration
   */
  getConfig(): APIClientFactoryConfig {
    return { ...this.config };
  }

  /**
   * Update factory configuration
   */
  updateConfig(newConfig: Partial<APIClientFactoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logInfo('Factory configuration updated', { newConfig });
  }
}
