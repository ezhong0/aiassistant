import { setTimeout as delay } from 'timers/promises';

/**
 * Service lifecycle states for dependency injection and lifecycle management
 * 
 * Services progress through these states during their lifecycle:
 * - INITIALIZING: Service is being set up and dependencies are being resolved
 * - READY: Service is fully initialized and ready to handle requests
 * - ERROR: Service failed to initialize or encountered a critical error
 * - SHUTTING_DOWN: Service is being gracefully shut down
 * - DESTROYED: Service has been completely cleaned up and is no longer available
 * 
 * @enum {string}
 */
export enum ServiceState {
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

/**
 * Service interface that all services must implement for dependency injection
 * 
 * This interface defines the contract for all services in the application,
 * ensuring consistent lifecycle management, health monitoring, and
 * dependency resolution across the service-oriented architecture.
 * 
 * @interface IService
 */
export interface IService {
  /** 
   * Unique service name for identification and dependency resolution
   * @readonly
   */
  readonly name: string;
  
  /** 
   * Current service state in the lifecycle
   * @readonly
   */
  readonly state: ServiceState;
  
  /** 
   * Initialize the service and resolve dependencies
   * @returns Promise that resolves when service is ready
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;
  
  /** 
   * Check if service is ready to handle requests
   * @returns true if service is ready, false otherwise
   */
  isReady(): boolean;
  
  /** 
   * Cleanup and destroy the service gracefully
   * @returns Promise that resolves when cleanup is complete
   * @throws Error if cleanup fails
   */
  destroy(): Promise<void>;
  
  /** 
   * Get service health status for monitoring
   * @returns Health status with details about service state
   */
  getHealth(): { healthy: boolean; details?: any };
}

/**
 * Service registration information for dependency injection container
 * 
 * Contains all metadata needed to register and manage a service
 * within the ServiceManager's dependency injection system.
 * 
 * @interface ServiceRegistration
 */
export interface ServiceRegistration {
  /** The service instance implementing IService */
  service: IService;
  
  /** 
   * Array of service names that this service depends on
   * Services will be initialized in dependency order
   */
  dependencies: string[];
  
  /** 
   * Priority for initialization order (lower numbers = higher priority)
   * Services with lower priority numbers are initialized first
   */
  priority: number;
  
  /** 
   * Whether to automatically start this service during system initialization
   * If false, service must be manually started
   */
  autoStart: boolean;
}

/**
 * Enhanced service manager for dependency injection and lifecycle management
 * 
 * The ServiceManager is the central dependency injection container that handles:
 * - Service registration with dependency metadata
 * - Automatic dependency resolution and topological sorting
 * - Service lifecycle management (initialization, health monitoring, graceful shutdown)
 * - Service discovery and retrieval
 * - Graceful shutdown with proper cleanup order
 * 
 * This implements a sophisticated service-oriented architecture pattern where
 * services are registered with their dependencies and automatically initialized
 * in the correct order. The manager handles 26+ services with complex dependency
 * graphs and ensures proper initialization and cleanup.
 * 
 * @example
 * ```typescript
 * const serviceManager = ServiceManager.getInstance();
 * 
 * // Register a service with dependencies
 * serviceManager.registerService('myService', new MyService(), {
 *   dependencies: ['databaseService', 'cacheService'],
 *   priority: 10,
 *   autoStart: true
 * });
 * 
 * // Initialize all services
 * await serviceManager.initializeAllServices();
 * 
 * // Get a service instance
 * const myService = serviceManager.getService<MyService>('myService');
 * ```
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

  /**
   * Get the singleton instance of ServiceManager
   * 
   * ServiceManager uses the singleton pattern to ensure there's only one
   * dependency injection container throughout the application lifecycle.
   * 
   * @returns The singleton ServiceManager instance
   * 
   * @example
   * ```typescript
   * const serviceManager = ServiceManager.getInstance();
   * ```
   */
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Register a service with dependency injection support
   * 
   * Registers a service with the dependency injection container, including
   * metadata about dependencies, initialization priority, and auto-start behavior.
   * Services are automatically initialized in dependency order during system startup.
   * 
   * @param name - Unique name for the service (used for dependency resolution)
   * @param service - Service instance implementing IService interface
   * @param options - Registration options including dependencies and priority
   * @param options.dependencies - Array of service names this service depends on
   * @param options.priority - Initialization priority (lower = higher priority)
   * @param options.autoStart - Whether to auto-start during system initialization
   * 
   * @throws Error if service registration fails or dependencies are invalid
   * 
   * @example
   * ```typescript
   * // Register a service with dependencies
   * serviceManager.registerService('emailService', new EmailService(), {
   *   dependencies: ['databaseService', 'cacheService'],
   *   priority: 20,
   *   autoStart: true
   * });
   * 
   * // Register a high-priority core service
   * serviceManager.registerService('configService', new ConfigService(), {
   *   priority: 1,
   *   autoStart: true
   * });
   * ```
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
      
      return;
    }

    if (this.services.has(name)) {
      
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


    // Note: Auto-start is disabled during registration to ensure proper initialization order
    // Services will be initialized in dependency order by initializeAllServices()
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
        
      });
    }

    this.services.delete(name);
    this.serviceInstances.delete(name);
    
    // Remove from initialization order
    const index = this.initializationOrder.indexOf(name);
    if (index > -1) {
      this.initializationOrder.splice(index, 1);
    }

    
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

    
    

    // Calculate initialization order based on dependencies
    this.calculateInitializationOrder();
    // Initialization order calculated

    // Initialize services in order
    for (const serviceName of this.initializationOrder) {
      // Starting initialization of service
      try {
        await this.initializeService(serviceName);
        // Service initialization complete
      } catch (error) {
        // In development, allow database service to fail gracefully
        if (serviceName === 'databaseService' && process.env.NODE_ENV === 'development') {
          
          // Mark the service as failed but continue with other services
          const registration = this.services.get(serviceName);
          if (registration) {
            (registration.service as any)._initializationFailed = true;
          }
          continue;
        }
        // For other services or in production, re-throw the error
        throw error;
      }
    }

    
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
      return;
    }

    if (registration.service.state === ServiceState.INITIALIZING && registration.service.isReady()) {
      return;
    }

    // Initialize dependencies first
    for (const depName of registration.dependencies) {
      const depRegistration = this.services.get(depName);
      if (!depRegistration) {
        throw new Error(`Dependency ${depName} not found for service ${name}`);
      }
      
      const depService = depRegistration.service;
      const dependencyFailed = (depService as any)._initializationFailed;
      
      // Skip failed dependencies in development if they're optional (like database)
      if (dependencyFailed && depName === 'databaseService' && process.env.NODE_ENV === 'development') {
        
        continue;
      }
      
      if (!depService.isReady() && !dependencyFailed) {
        await this.initializeService(depName);
      }
    }

    // Initialize the service
    try {
      
      await registration.service.initialize();
      
      // Wait a moment and verify the service is actually ready
      await delay(10);
      
      if (!registration.service.isReady()) {
        // Check if this is a service that can be partially ready (like OpenAI with invalid API key)
        const baseService = registration.service as any;
        if (baseService.state === ServiceState.READY && baseService.initialized) {
          
        } else {
          throw new Error(`Service ${name} failed to transition to READY state after initialization. Current state: ${registration.service.state}`);
        }
      }
      
      // Service initialization complete
    } catch (error) {
      
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
      if (!visited.has(name)) {
        visit(name);
      }
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
        
        return;
      }

      this.isShuttingDown = true;
      

      // Shutdown services in reverse initialization order
      const shutdownOrder = [...this.initializationOrder].reverse();
      
      let cleanedCount = 0;
      for (const serviceName of shutdownOrder) {
        const service = this.serviceInstances.get(serviceName);
        if (service && service.state !== ServiceState.DESTROYED) {
          try {
            await service.destroy();
            cleanedCount++;
            
          } catch (error) {
            
          }
        }
      }

      
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    
  }


  /**
   * Get all registered services
   */
  getAllServices(): Map<string, IService> {
    return new Map(this.serviceInstances);
  }

  /**
   * Check if all services are healthy
   */
  areAllServicesHealthy(): boolean {
    const health = this.getAllServicesHealth();
    return Object.values(health).every(service => service.health?.healthy);
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
    const health = this.getAllServicesHealth();
    const services = Object.values(health);

    return {
      totalServices: services.length,
      healthyServices: services.filter(s => s.health?.healthy).length,
      unhealthyServices: services.filter(s => !s.health?.healthy).length,
      readyServices: services.filter(s => s.state === 'ready').length,
      initializingServices: services.filter(s => s.state === 'initializing').length,
      errorServices: services.filter(s => s.state === 'error').length
    };
  }

  /**
   * Force cleanup of all services (for testing)
   */
  async forceCleanup(): Promise<void> {
    
    
    for (const [name, service] of this.serviceInstances) {
      try {
        if (service.state !== ServiceState.DESTROYED) {
          await service.destroy();
        }
      } catch (error) {
        
      }
    }
    
    this.services.clear();
    this.serviceInstances.clear();
    this.initializationOrder = [];
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();

// Convenience functions for easier consumption
export const initializeServices = async (): Promise<void> => {
  const { initializeAllCoreServices } = await import('./service-initialization');
  return initializeAllCoreServices();
}

export const getService = <T extends IService>(name: string): T | undefined => {
  return serviceManager.getService<T>(name);
}

export const getServicesHealth = (): Record<string, any> => {
  return serviceManager.getAllServicesHealth();
}
