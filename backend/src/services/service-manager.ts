import logger from '../utils/logger';

/**
 * Service lifecycle states
 */
export enum ServiceState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
  DESTROYED = 'destroyed'
}

/**
 * Service interface that all services must implement
 */
export interface IService {
  /** Service name for identification */
  readonly name: string;
  
  /** Current service state */
  readonly state: ServiceState;
  
  /** Initialize the service */
  initialize(): Promise<void>;
  
  /** Check if service is ready */
  isReady(): boolean;
  
  /** Cleanup and destroy the service */
  destroy(): Promise<void>;
  
  /** Get service health status */
  getHealth(): { healthy: boolean; details?: any };
}

/**
 * Service registration information
 */
export interface ServiceRegistration {
  service: IService;
  dependencies: string[];
  priority: number; // Lower numbers = higher priority
  autoStart: boolean;
}

/**
 * Enhanced service manager for dependency injection and lifecycle management
 * Handles service registration, dependency resolution, initialization, and graceful shutdown
 */
export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, ServiceRegistration> = new Map();
  private serviceInstances: Map<string, IService> = new Map();
  private isShuttingDown = false;
  private initializationOrder: string[] = [];

  private constructor() {
    // Set up graceful shutdown handlers
    this.setupGracefulShutdown();
  }

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Register a service with dependency injection support
   */
  registerService(
    name: string, 
    service: IService, 
    options: {
      dependencies?: string[];
      priority?: number;
      autoStart?: boolean;
    } = {}
  ): void {
    if (this.isShuttingDown) {
      logger.warn(`Cannot register service ${name} - system is shutting down`);
      return;
    }

    if (this.services.has(name)) {
      logger.warn(`Service ${name} is already registered, replacing with new instance`);
      this.unregisterService(name);
    }

    const registration: ServiceRegistration = {
      service,
      dependencies: options.dependencies || [],
      priority: options.priority || 100,
      autoStart: options.autoStart !== false
    };

    this.services.set(name, registration);
    this.serviceInstances.set(name, service);

    logger.info(`Service registered: ${name}`, {
      dependencies: registration.dependencies,
      priority: registration.priority,
      autoStart: registration.autoStart
    });

    // Auto-start if enabled and no dependencies
    if (registration.autoStart && registration.dependencies.length === 0) {
      this.initializeService(name).catch(error => {
        logger.error(`Failed to auto-start service ${name}:`, error);
      });
    }
  }

  /**
   * Unregister a service
   */
  unregisterService(name: string): void {
    const registration = this.services.get(name);
    if (!registration) {
      return;
    }

    // Destroy the service if it's running
    if (registration.service.state !== ServiceState.DESTROYED) {
      registration.service.destroy().catch(error => {
        logger.error(`Error destroying service ${name}:`, error);
      });
    }

    this.services.delete(name);
    this.serviceInstances.delete(name);
    
    // Remove from initialization order
    const index = this.initializationOrder.indexOf(name);
    if (index > -1) {
      this.initializationOrder.splice(index, 1);
    }

    logger.debug(`Service unregistered: ${name}`);
  }

  /**
   * Get a service instance by name
   */
  getService<T extends IService>(name: string): T | undefined {
    return this.serviceInstances.get(name) as T | undefined;
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get all ready service names
   */
  getReadyServices(): string[] {
    return Array.from(this.serviceInstances.values())
      .filter(service => service.isReady())
      .map(service => service.name);
  }

  /**
   * Get service count
   */
  getServiceCount(): number {
    return this.services.size;
  }

  /**
   * Initialize all services in dependency order
   */
  async initializeAllServices(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Cannot initialize services - system is shutting down');
    }

    logger.info(`Initializing ${this.services.size} services...`);

    // Calculate initialization order based on dependencies
    this.calculateInitializationOrder();

    // Initialize services in order
    for (const serviceName of this.initializationOrder) {
      await this.initializeService(serviceName);
    }

    logger.info('All services initialized successfully');
  }

  /**
   * Initialize a specific service and its dependencies
   */
  async initializeService(name: string): Promise<void> {
    const registration = this.services.get(name);
    if (!registration) {
      throw new Error(`Service ${name} not found`);
    }

    if (registration.service.state === ServiceState.READY) {
      logger.debug(`Service ${name} already ready`);
      return;
    }

    if (registration.service.state === ServiceState.INITIALIZING) {
      logger.debug(`Service ${name} already initializing`);
      return;
    }

    // Initialize dependencies first
    for (const depName of registration.dependencies) {
      const depService = this.serviceInstances.get(depName);
      if (!depService) {
        throw new Error(`Dependency ${depName} not found for service ${name}`);
      }
      
      if (!depService.isReady()) {
        await this.initializeService(depName);
      }
    }

    // Initialize the service
    try {
      logger.debug(`Initializing service: ${name}`);
      await registration.service.initialize();
      logger.info(`Service initialized successfully: ${name}`);
    } catch (error) {
      logger.error(`Failed to initialize service ${name}:`, error);
      throw error;
    }
  }

  /**
   * Calculate initialization order based on dependencies
   */
  private calculateInitializationOrder(): void {
    this.initializationOrder = [];
    const visited = new Set<string>();
    const tempVisited = new Set<string>();

    const visit = (name: string) => {
      if (tempVisited.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }
      if (visited.has(name)) {
        return;
      }

      tempVisited.add(name);
      const registration = this.services.get(name);
      if (registration) {
        for (const dep of registration.dependencies) {
          visit(dep);
        }
      }
      tempVisited.delete(name);
      visited.add(name);
      this.initializationOrder.push(name);
    };

    // Sort by priority first, then visit
    const sortedServices = Array.from(this.services.entries())
      .sort(([, a], [, b]) => a.priority - b.priority);

    for (const [name] of sortedServices) {
      visit(name);
    }
  }

  /**
   * Get health status of all services
   */
  getAllServicesHealth(): Record<string, any> {
    const health: Record<string, any> = {};
    
    for (const [name, service] of this.serviceInstances) {
      try {
        health[name] = {
          state: service.state,
          ready: service.isReady(),
          health: service.getHealth()
        };
      } catch (error) {
        health[name] = {
          state: service.state,
          ready: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return health;
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn(`Shutdown signal ${signal} received but already shutting down`);
        return;
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}. Starting graceful shutdown of ${this.services.size} services...`);

      // Shutdown services in reverse initialization order
      const shutdownOrder = [...this.initializationOrder].reverse();
      
      let cleanedCount = 0;
      for (const serviceName of shutdownOrder) {
        const service = this.serviceInstances.get(serviceName);
        if (service && service.state !== ServiceState.DESTROYED) {
          try {
            await service.destroy();
            cleanedCount++;
            logger.debug(`Service shutdown successfully: ${serviceName}`);
          } catch (error) {
            logger.error(`Error shutting down service ${serviceName}:`, error);
          }
        }
      }

      logger.info(`Graceful shutdown completed. Cleaned up ${cleanedCount}/${this.services.size} services`);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.info('Service manager graceful shutdown handlers configured');
  }

  /**
   * Force cleanup of all services (for testing)
   */
  async forceCleanup(): Promise<void> {
    logger.warn('Force cleanup of all services requested');
    
    for (const [name, service] of this.serviceInstances) {
      try {
        if (service.state !== ServiceState.DESTROYED) {
          await service.destroy();
        }
      } catch (error) {
        logger.error(`Error during force cleanup of ${name}:`, error);
      }
    }
    
    this.services.clear();
    this.serviceInstances.clear();
    this.initializationOrder = [];
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();
