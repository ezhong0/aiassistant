import logger from '../utils/logger';

// Import the focused service components
import { ServiceRegistry, ServiceInfo, ServiceRegistrationOptions } from './service-registry.service';
import { DependencyInjector, DependencyResolution } from './dependency-injector.service';
import { ConfigurationManager, ValidationResult, ConfigSchema } from './configuration-manager.service';
import { ServiceHealthMonitor, HealthReport, HealthStatus, AlertCallback } from './service-health-monitor.service';

// Define core service management types directly
export enum ServiceState {
  /** Service instance created but not yet initialized */
  CREATED = 'created',
  /** Service is being initialized and dependencies are being resolved */
  INITIALIZING = 'initializing',
  /** Service is fully initialized and ready to handle requests */
  READY = 'ready',
  /** Service failed to initialize or encountered a critical error */
  ERROR = 'error',
  /** Service is being gracefully shut down */
  SHUTTING_DOWN = 'shutting_down',
  /** Service has been completely cleaned up and is no longer available */
  DESTROYED = 'destroyed'
}

export interface IService {
  /** Unique service name for identification and dependency resolution */
  readonly name: string;
  /** Current service state in the lifecycle */
  readonly state: ServiceState;
  /** Initialize the service */
  initialize(): Promise<void>;
  /** Destroy the service */
  destroy(): Promise<void>;
  /** Check if service is ready */
  isReady(): boolean;
  /** Get service health status */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> };
}

export interface ServiceRegistration {
  service: IService;
  dependencies: string[];
  priority: number;
  autoStart: boolean;
}

/**
 * Simplified ServiceManager - Single Responsibility: Service Orchestration
 *
 * This refactored ServiceManager follows SRP by orchestrating the focused
 * service components rather than implementing all functionality directly.
 * It provides a clean facade over the decomposed service management architecture.
 *
 * Responsibilities:
 * - Orchestrate service registration, injection, configuration, and monitoring
 * - Provide backward-compatible API for existing code
 * - Handle graceful shutdown coordination
 * - Manage service lifecycle coordination
 */
export class ServiceManagerV2 {
  private static instance: ServiceManagerV2;

  private registry: ServiceRegistry;
  private injector: DependencyInjector;
  private configManager: ConfigurationManager;
  private healthMonitor: ServiceHealthMonitor;
  private isShuttingDown = false;

  private constructor() {
    // Initialize the focused components
    this.registry = new ServiceRegistry();
    this.injector = new DependencyInjector(this.registry);
    this.configManager = new ConfigurationManager();
    this.healthMonitor = new ServiceHealthMonitor(this.registry);

    this.setupGracefulShutdown();

    logger.info('ServiceManagerV2 initialized with decomposed architecture', {
      correlationId: `service-manager-v2-${Date.now()}`,
      operation: 'service_manager_init',
      metadata: { architecture: 'decomposed', components: 4 }
    });
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ServiceManagerV2 {
    if (!ServiceManagerV2.instance) {
      ServiceManagerV2.instance = new ServiceManagerV2();
    }
    return ServiceManagerV2.instance;
  }

  /**
   * Register a service with dependency injection support
   *
   * Backward-compatible method that orchestrates service registration
   * across the registry and health monitoring components.
   */
  registerService<T extends IService>(
    name: string,
    service: T,
    options: ServiceRegistrationOptions & {
      dependencies?: string[];
      priority?: number;
      autoStart?: boolean;
    } = {}
  ): void {
    if (this.isShuttingDown) {
      logger.warn('Cannot register service during shutdown', {
        correlationId: `service-manager-v2-${Date.now()}`,
        operation: 'register_during_shutdown',
        metadata: { serviceName: name }
      });
      return;
    }

    // Register with the service registry
    this.registry.register(name, service, options);

    logger.debug(`Service registered via ServiceManagerV2: ${name}`, {
      correlationId: `service-manager-v2-${Date.now()}`,
      operation: 'service_registration',
      metadata: { serviceName: name, dependencies: options.dependencies?.length || 0 }
    });
  }

  /**
   * Unregister a service
   */
  unregisterService(name: string): boolean {
    return this.registry.unregister(name);
  }

  /**
   * Get a service instance by name
   */
  getService<T extends IService>(name: string): T | undefined {
    return this.registry.get<T>(name);
  }

  /**
   * Initialize all services in dependency order
   */
  async initializeAllServices(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Cannot initialize services - system is shutting down');
    }

    logger.info('Starting service initialization with decomposed architecture', {
      correlationId: `service-manager-v2-${Date.now()}`,
      operation: 'initialization_start',
      metadata: { serviceCount: this.registry.getServiceCount() }
    });

    try {
      // Use the dependency injector to handle initialization
      await this.injector.initializeServices();

      // Start health monitoring after successful initialization
      this.healthMonitor.startMonitoring({
        enabled: true,
        interval: 30000, // 30 seconds
        timeout: 5000,
        retryCount: 3,
        alertThreshold: 2
      });

      logger.info('All services initialized successfully with ServiceManagerV2', {
        correlationId: `service-manager-v2-${Date.now()}`,
        operation: 'initialization_complete',
        metadata: {
          initializedServices: this.registry.getServiceCount(),
          healthMonitoringEnabled: true
        }
      });

    } catch (error) {
      logger.error('Service initialization failed', {
        correlationId: `service-manager-v2-${Date.now()}`,
        operation: 'initialization_error',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return this.registry.getServiceNames();
  }

  /**
   * Get ready service names
   */
  getReadyServices(): string[] {
    return this.registry.getReadyServices().map(info => info.name);
  }

  /**
   * Get service count
   */
  getServiceCount(): number {
    return this.registry.getServiceCount();
  }

  /**
   * Get health status of all services
   */
  getAllServicesHealth(): Record<string, any> {
    const healthReport = this.healthMonitor.getHealthStats();
    const serviceHealth: Record<string, any> = {};

    for (const serviceName of this.registry.getServiceNames()) {
      const health = this.healthMonitor.getCachedHealth(serviceName);
      if (health) {
        serviceHealth[serviceName] = {
          state: this.getService(serviceName)?.state || 'unknown',
          ready: this.getService(serviceName)?.isReady() || false,
          health: {
            healthy: health.healthy,
            status: health.status,
            details: health.details,
            lastCheck: health.lastCheck,
            responseTime: health.responseTime
          }
        };
      }
    }

    return serviceHealth;
  }

  /**
   * Check if all services are healthy
   */
  areAllServicesHealthy(): boolean {
    const stats = this.healthMonitor.getHealthStats();
    return stats.unhealthyServices === 0 && stats.degradedServices === 0;
  }

  /**
   * Get comprehensive health report
   */
  async getHealthReport(): Promise<HealthReport> {
    return await this.healthMonitor.monitorServices();
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    readyServices: number;
    initializingServices: number;
    errorServices: number;
  } {
    const services = this.registry.listServices();
    const healthStats = this.healthMonitor.getHealthStats();

    return {
      totalServices: services.length,
      healthyServices: healthStats.healthyServices,
      unhealthyServices: healthStats.unhealthyServices,
      readyServices: services.filter(s => s.ready).length,
      initializingServices: services.filter(s => s.state === 'initializing').length,
      errorServices: services.filter(s => s.state === 'error').length
    };
  }

  /**
   * Load configuration with validation
   */
  async loadConfig<T = any>(configPath: string, schema?: ConfigSchema): Promise<T> {
    if (schema) {
      return await this.configManager.loadConfigWithValidation<T>(configPath, schema);
    }
    return await this.configManager.loadConfig<T>(configPath);
  }

  /**
   * Watch configuration changes
   */
  watchConfigChanges<T = any>(configPath: string, callback: (config: T, error?: Error) => void): void {
    this.configManager.watchConfigChanges<T>(configPath, callback);
  }

  /**
   * Register health alert callback
   */
  alertOnFailure(serviceName: string, callback: AlertCallback): void {
    this.healthMonitor.alertOnFailure(serviceName, callback);
  }

  /**
   * Get dependency resolution information
   */
  getDependencyResolution(): DependencyResolution {
    return {
      initializationOrder: this.injector.getInitializationOrder(),
      dependencyGraph: this.injector.getDependencyGraph(),
      circularDependencies: this.injector.hasCircularDependencies() ? ['Circular dependencies detected'] : []
    };
  }

  /**
   * Get all services (backward compatibility)
   */
  getAllServices(): Map<string, IService> {
    const servicesMap = new Map<string, IService>();

    for (const serviceName of this.registry.getServiceNames()) {
      const service = this.registry.get(serviceName);
      if (service) {
        servicesMap.set(serviceName, service);
      }
    }

    return servicesMap;
  }

  /**
   * Force cleanup (for testing)
   */
  async forceCleanup(): Promise<void> {
    logger.info('Starting force cleanup with ServiceManagerV2', {
      correlationId: `service-manager-v2-${Date.now()}`,
      operation: 'force_cleanup_start'
    });

    // Stop health monitoring
    this.healthMonitor.destroy();

    // Clear registry (which handles service destruction)
    this.registry.clear();

    // Clean up configuration manager
    this.configManager.destroy();

    // Reset injector state
    this.injector.reset();

    logger.info('Force cleanup completed', {
      correlationId: `service-manager-v2-${Date.now()}`,
      operation: 'force_cleanup_complete'
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn('Shutdown already in progress', {
          correlationId: `service-manager-v2-${Date.now()}`,
          operation: 'shutdown_already_in_progress',
          metadata: { signal }
        });
        return;
      }

      this.isShuttingDown = true;

      logger.info('Starting graceful shutdown with ServiceManagerV2', {
        correlationId: `service-manager-v2-${Date.now()}`,
        operation: 'shutdown_start',
        metadata: { signal, serviceCount: this.registry.getServiceCount() }
      });

      // Get shutdown order (reverse of initialization order)
      const initOrder = this.injector.getInitializationOrder();
      const shutdownOrder = [...initOrder].reverse();

      let cleanedCount = 0;
      for (const serviceName of shutdownOrder) {
        const service = this.registry.get(serviceName);
        if (service && service.state !== ServiceState.DESTROYED) {
          try {
            await service.destroy();
            cleanedCount++;
          } catch (error) {
            logger.error(`Error destroying service ${serviceName}`, {
              correlationId: `service-manager-v2-${Date.now()}`,
              operation: 'service_destruction_error',
              metadata: { serviceName, error: error instanceof Error ? error.message : 'Unknown error' }
            });
          }
        }
      }

      // Cleanup components
      this.healthMonitor.destroy();
      this.configManager.destroy();

      logger.info('Graceful shutdown completed', {
        correlationId: `service-manager-v2-${Date.now()}`,
        operation: 'shutdown_complete',
        metadata: { cleanedServices: cleanedCount, totalServices: shutdownOrder.length }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.debug('Graceful shutdown handlers registered', {
      correlationId: `service-manager-v2-${Date.now()}`,
      operation: 'shutdown_handlers_registered'
    });
  }
}

// Export the class with legacy name for backward compatibility
export { ServiceManagerV2 as ServiceManager };

// Export singleton instance for backward compatibility
export const serviceManager = ServiceManagerV2.getInstance();

// Legacy export name
export const serviceManagerV2 = serviceManager;

// Convenience functions for backward compatibility
export const getService = <T extends IService>(name: string): T | undefined => {
  return serviceManager.getService<T>(name);
};

export const getServicesHealth = (): Record<string, any> => {
  return serviceManager.getAllServicesHealth();
};

export const initializeServices = async (): Promise<void> => {
  return serviceManager.initializeAllServices();
};