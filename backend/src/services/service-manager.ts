import logger from '../utils/logger';
// import { BaseService } from './base-service';
import { ServiceState, IService } from '../types/service.types';

// Re-export types and values for external use
export type { IService };
export { ServiceState };

/**
 * Simplified Service Registration System
 * 
 * This replaces the complex dependency injection system with a simple,
 * straightforward service registration approach that follows the
 * principle of simplicity over complexity.
 */

export interface SimpleService extends IService {
  // Additional methods can be added here if needed
  [key: string]: any;
}

/**
 * Service registration entry
 */
interface ServiceEntry {
  service: SimpleService;
  dependencies: string[];
  initialized: boolean;
}

/**
 * Service Manager
 * 
 * This provides a clean, straightforward service registration and management system
 * that focuses on essential functionality without over-engineering.
 */
export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, ServiceEntry> = new Map();
  private isShuttingDown = false;

  private constructor() {
    this.setupGracefulShutdown();
    logger.info('ServiceManager initialized', {
      correlationId: `service-manager-${Date.now()}`,
      operation: 'service_manager_init',
      metadata: { architecture: 'simplified' }
    });
  }

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Register a service with optional dependencies
   */
  registerService<T extends SimpleService>(
    name: string,
    service: T,
    dependencies: string[] = []
  ): void {
    if (this.isShuttingDown) {
      logger.warn('Cannot register service during shutdown', {
        correlationId: `simple-service-manager-${Date.now()}`,
        operation: 'register_during_shutdown',
        metadata: { serviceName: name }
      });
      return;
    }

    this.services.set(name, {
      service,
      dependencies,
      initialized: false
    });

    logger.debug(`Service registered: ${name}`, {
      correlationId: `simple-service-manager-${Date.now()}`,
      operation: 'service_registration',
      metadata: { serviceName: name, dependencies: dependencies.length }
    });
  }

  /**
   * Get a service by name
   */
  getService<T extends SimpleService>(name: string): T | undefined {
    const entry = this.services.get(name);
    
    if (entry) {
      logger.debug('Service accessed', {
        correlationId: `service-access-${Date.now()}`,
        operation: 'service_access',
        metadata: {
          serviceName: name,
          isInitialized: entry.initialized,
          serviceState: entry.service.state
        }
      });
      return entry.service as T;
    } else {
      logger.warn('Service not found', {
        correlationId: `service-not-found-${Date.now()}`,
        operation: 'service_not_found',
        metadata: {
          requestedService: name,
          availableServices: Array.from(this.services.keys())
        }
      });
      return undefined;
    }
  }

  /**
   * Initialize all services in dependency order
   */
  async initializeAllServices(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Cannot initialize services - system is shutting down');
    }

    logger.info('Starting service initialization', {
      correlationId: `simple-service-manager-${Date.now()}`,
      operation: 'initialization_start',
      metadata: { serviceCount: this.services.size }
    });

    try {
      // Simple initialization order: services with no dependencies first
      const initializationOrder = this.calculateInitializationOrder();
      
      for (const serviceName of initializationOrder) {
        await this.initializeService(serviceName);
      }

      logger.info('All services initialized successfully', {
        correlationId: `simple-service-manager-${Date.now()}`,
        operation: 'initialization_complete',
        metadata: { initializedServices: this.services.size }
      });

    } catch (error) {
      logger.error('Service initialization failed', error as Error, {
        correlationId: `simple-service-manager-${Date.now()}`,
        operation: 'initialization_error'
      });
      throw error;
    }
  }

  /**
   * Calculate initialization order based on dependencies
   */
  private calculateInitializationOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (serviceName: string) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }
      
      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);
      
      const entry = this.services.get(serviceName);
      if (entry) {
        // Visit dependencies first
        for (const dep of entry.dependencies) {
          visit(dep);
        }
      }
      
      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    // Visit all services
    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }

    return order;
  }

  /**
   * Initialize a single service
   */
  private async initializeService(serviceName: string): Promise<void> {
    const entry = this.services.get(serviceName);
    if (!entry || entry.initialized) {
      return;
    }

    try {
      logger.debug(`Initializing service: ${serviceName}`, {
        correlationId: `simple-service-manager-${Date.now()}`,
        operation: 'service_initialization',
        metadata: { serviceName, dependencies: entry.dependencies.length }
      });

      await entry.service.initialize();
      entry.initialized = true;

      logger.debug(`Service initialized: ${serviceName}`, {
        correlationId: `simple-service-manager-${Date.now()}`,
        operation: 'service_initialized',
        metadata: { serviceName }
      });

    } catch (error) {
      logger.error(`Failed to initialize service: ${serviceName}`, error as Error, {
        correlationId: `simple-service-manager-${Date.now()}`,
        operation: 'service_initialization_error',
        metadata: { serviceName }
      });
      throw error;
    }
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get ready service names
   */
  getReadyServices(): string[] {
    return Array.from(this.services.values())
      .filter(entry => entry.initialized && entry.service.isReady())
      .map(entry => entry.service.name);
  }

  /**
   * Get service count
   */
  getServiceCount(): number {
    return this.services.size;
  }

  /**
   * Get health status of all services
   */
  getAllServicesHealth(): Record<string, any> {
    const health: Record<string, any> = {};

    for (const [name, entry] of this.services.entries()) {
      health[name] = {
        state: entry.service.state,
        ready: entry.service.isReady(),
        initialized: entry.initialized,
        health: entry.service.getHealth()
      };
    }

    return health;
  }

  /**
   * Check if all services are healthy
   */
  areAllServicesHealthy(): boolean {
    for (const entry of this.services.values()) {
      if (!entry.initialized || !entry.service.isReady()) {
        return false;
      }
      const health = entry.service.getHealth();
      if (!health.healthy) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    totalServices: number;
    readyServices: number;
    initializingServices: number;
    errorServices: number;
  } {
    let readyServices = 0;
    let initializingServices = 0;
    let errorServices = 0;

    for (const entry of this.services.values()) {
      if (entry.initialized && entry.service.isReady()) {
        readyServices++;
      } else if (entry.service.state === ServiceState.INITIALIZING) {
        initializingServices++;
      } else if (entry.service.state === ServiceState.ERROR) {
        errorServices++;
      }
    }

    return {
      totalServices: this.services.size,
      readyServices,
      initializingServices,
      errorServices
    };
  }

  /**
   * Force cleanup (for testing)
   */
  async forceCleanup(): Promise<void> {
    logger.info('Starting force cleanup', {
      correlationId: `simple-service-manager-${Date.now()}`,
      operation: 'force_cleanup_start'
    });

    // Destroy all services in reverse order
    const serviceNames = Array.from(this.services.keys()).reverse();
    
    for (const serviceName of serviceNames) {
      const entry = this.services.get(serviceName);
      if (entry && entry.initialized) {
        try {
          await entry.service.destroy();
        } catch (error) {
          logger.warn(`Error destroying service: ${serviceName}`, {
            correlationId: `simple-service-manager-${Date.now()}`,
            operation: 'service_destruction_error',
            metadata: { serviceName, error: error instanceof Error ? error.message : 'Unknown error' }
          });
        }
      }
    }

    this.services.clear();

    logger.info('Force cleanup completed', {
      correlationId: `simple-service-manager-${Date.now()}`,
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
          correlationId: `simple-service-manager-${Date.now()}`,
          operation: 'shutdown_already_in_progress',
          metadata: { signal }
        });
        return;
      }

      this.isShuttingDown = true;

      logger.info('Starting graceful shutdown', {
        correlationId: `simple-service-manager-${Date.now()}`,
        operation: 'shutdown_start',
        metadata: { signal, serviceCount: this.services.size }
      });

      // Destroy all services in reverse order
      const serviceNames = Array.from(this.services.keys()).reverse();
      let cleanedCount = 0;

      for (const serviceName of serviceNames) {
        const entry = this.services.get(serviceName);
        if (entry && entry.initialized) {
          try {
            await entry.service.destroy();
            cleanedCount++;
          } catch (error) {
            logger.error(`Error destroying service: ${serviceName}`, error as Error, {
              correlationId: `simple-service-manager-${Date.now()}`,
              operation: 'service_destruction_error',
              metadata: { serviceName }
            });
          }
        }
      }

      logger.info('Graceful shutdown completed', {
        correlationId: `simple-service-manager-${Date.now()}`,
        operation: 'shutdown_complete',
        metadata: { cleanedServices: cleanedCount, totalServices: serviceNames.length }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.debug('Graceful shutdown handlers registered', {
      correlationId: `simple-service-manager-${Date.now()}`,
      operation: 'shutdown_handlers_registered'
    });
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();

// Convenience functions for backward compatibility
export const getService = <T extends SimpleService>(name: string): T | undefined => {
  return serviceManager.getService<T>(name);
};

export const getServicesHealth = (): Record<string, any> => {
  return serviceManager.getAllServicesHealth();
};

export const initializeServices = async (): Promise<void> => {
  return serviceManager.initializeAllServices();
};
