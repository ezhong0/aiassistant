import logger from '../utils/logger';
import { IService, ServiceState } from "./service-manager";

/**
 * Service information for registry management
 */
export interface ServiceInfo {
  name: string;
  state: ServiceState;
  ready: boolean;
  dependencies: string[];
  priority: number;
  autoStart: boolean;
  registeredAt: Date;
}

/**
 * Service registration options
 */
export interface ServiceRegistrationOptions {
  dependencies?: string[];
  priority?: number;
  autoStart?: boolean;
}

/**
 * ServiceRegistry - Single Responsibility: Service Discovery & Registration
 *
 * Handles all service registration, discovery, and lookup operations.
 * Extracted from ServiceManager to follow SRP and provide a focused
 * interface for service management.
 */
export class ServiceRegistry implements IService {
  readonly name = 'serviceRegistry';
  private _state: ServiceState = ServiceState.CREATED;
  private services: Map<string, IService> = new Map();
  private serviceMetadata: Map<string, ServiceInfo> = new Map();
  private readonly maxServices = 100;

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
    this.clear();
    this._state = ServiceState.DESTROYED;
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady(),
      details: {
        serviceCount: this.services.size,
        maxServices: this.maxServices,
        readyServices: this.getReadyServices().length
      }
    };
  }

  /**
   * Register a service with the registry
   */
  register<T extends IService>(
    name: string,
    service: T,
    options: ServiceRegistrationOptions = {}
  ): void {
    if (this.services.has(name)) {
      logger.warn(`Service ${name} already registered, replacing`, {
        correlationId: `service-registry-${Date.now()}`,
        operation: 'service_replacement',
        metadata: { serviceName: name }
      });
      this.unregister(name);
    }

    if (this.services.size >= this.maxServices) {
      throw new Error(`Maximum service limit (${this.maxServices}) reached`);
    }

    this.services.set(name, service);

    const serviceInfo: ServiceInfo = {
      name,
      state: service.state,
      ready: service.isReady(),
      dependencies: options.dependencies || [],
      priority: options.priority || 100,
      autoStart: options.autoStart !== false,
      registeredAt: new Date()
    };

    this.serviceMetadata.set(name, serviceInfo);

    logger.debug(`Service registered: ${name}`, {
      correlationId: `service-registry-${Date.now()}`,
      operation: 'service_registration',
      metadata: { serviceName: name, dependencies: serviceInfo.dependencies, priority: serviceInfo.priority }
    });
  }

  /**
   * Unregister a service from the registry
   */
  unregister(name: string): boolean {
    const service = this.services.get(name);
    if (!service) {
      return false;
    }

    // Cleanup service if not already destroyed
    if (service.state !== ServiceState.DESTROYED) {
      service.destroy().catch(error => {
        logger.error(`Error destroying service during unregistration: ${name}`, {
          correlationId: `service-registry-${Date.now()}`,
          operation: 'service_destruction_error',
          metadata: { serviceName: name, error: error instanceof Error ? error.message : 'Unknown error' }
        });
      });
    }

    this.services.delete(name);
    this.serviceMetadata.delete(name);

    logger.debug(`Service unregistered: ${name}`, {
      correlationId: `service-registry-${Date.now()}`,
      operation: 'service_unregistration',
      metadata: { serviceName: name }
    });

    return true;
  }

  /**
   * Get a service by name
   */
  get<T extends IService>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * List all registered services
   */
  listServices(): ServiceInfo[] {
    const services: ServiceInfo[] = [];

    for (const [name, metadata] of this.serviceMetadata.entries()) {
      const service = this.services.get(name);
      if (service) {
        // Update current state
        const updatedInfo: ServiceInfo = {
          ...metadata,
          state: service.state,
          ready: service.isReady()
        };
        services.push(updatedInfo);
      }
    }

    return services.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get services by state
   */
  getServicesByState(state: ServiceState): ServiceInfo[] {
    return this.listServices().filter(info => info.state === state);
  }

  /**
   * Get ready services
   */
  getReadyServices(): ServiceInfo[] {
    return this.listServices().filter(info => info.ready);
  }

  /**
   * Get service metadata
   */
  getServiceInfo(name: string): ServiceInfo | undefined {
    const metadata = this.serviceMetadata.get(name);
    const service = this.services.get(name);

    if (!metadata || !service) {
      return undefined;
    }

    return {
      ...metadata,
      state: service.state,
      ready: service.isReady()
    };
  }

  /**
   * Get service count
   */
  getServiceCount(): number {
    return this.services.size;
  }

  /**
   * Get all service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all services (for testing/cleanup)
   */
  clear(): void {
    const serviceNames = Array.from(this.services.keys());

    for (const name of serviceNames) {
      this.unregister(name);
    }

    logger.debug('Service registry cleared', {
      correlationId: `service-registry-${Date.now()}`,
      operation: 'registry_clear',
      metadata: { clearedCount: serviceNames.length }
    });
  }
}