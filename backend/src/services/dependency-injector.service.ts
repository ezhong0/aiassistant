import { setTimeout as delay } from 'timers/promises';
import logger from '../utils/logger';
import { IService, ServiceState } from './service-manager';
import { ServiceRegistry, ServiceInfo } from './service-registry.service';

/**
 * Dependency resolution result
 */
export interface DependencyResolution {
  initializationOrder: string[];
  dependencyGraph: Map<string, string[]>;
  circularDependencies: string[];
}

/**
 * Injection context for service initialization
 */
export interface InjectionContext {
  serviceName: string;
  dependencies: string[];
  retryCount: number;
  startTime: Date;
}

/**
 * DependencyInjector - Single Responsibility: Dependency Resolution & Injection
 *
 * Handles all dependency injection logic, dependency graph analysis,
 * and service initialization ordering. Extracted from ServiceManager
 * to follow SRP and provide focused dependency management.
 */
export class DependencyInjector implements IService {
  readonly name = 'dependencyInjector';
  private _state: ServiceState = ServiceState.INITIALIZING;
  private initializationOrder: string[] = [];
  private dependencyGraph: Map<string, string[]> = new Map();
  private initializationAttempts: Map<string, number> = new Map();
  private readonly maxRetries = 3;

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
    this.reset();
    this._state = ServiceState.DESTROYED;
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady(),
      details: {
        initializationOrder: this.initializationOrder.length,
        dependencyGraphSize: this.dependencyGraph.size,
        hasCircularDependencies: this.hasCircularDependencies()
      }
    };
  }

  constructor(private serviceRegistry: ServiceRegistry) {}

  /**
   * Resolve dependencies and calculate initialization order
   */
  resolveDependencies(): DependencyResolution {
    const services = this.serviceRegistry.listServices();
    const visited = new Set<string>();
    const tempVisited = new Set<string>();
    const circularDependencies: string[] = [];

    this.initializationOrder = [];
    this.dependencyGraph.clear();

    // Build dependency graph
    for (const service of services) {
      this.dependencyGraph.set(service.name, service.dependencies);
    }

    const visit = (serviceName: string, path: string[] = []) => {
      if (tempVisited.has(serviceName)) {
        const circularPath = [...path, serviceName];
        const cycleStart = circularPath.indexOf(serviceName);
        const cycle = circularPath.slice(cycleStart);
        circularDependencies.push(cycle.join(' -> '));
        return;
      }

      if (visited.has(serviceName)) {
        return;
      }

      tempVisited.add(serviceName);
      const dependencies = this.dependencyGraph.get(serviceName) || [];

      for (const dep of dependencies) {
        if (this.serviceRegistry.has(dep)) {
          visit(dep, [...path, serviceName]);
        } else {
          logger.warn(`Dependency ${dep} not found for service ${serviceName}`, {
            correlationId: `dependency-injector-${Date.now()}`,
            operation: 'missing_dependency',
            metadata: { serviceName, missingDependency: dep }
          });
        }
      }

      tempVisited.delete(serviceName);
      visited.add(serviceName);
      this.initializationOrder.push(serviceName);
    };

    // Sort services by priority first, then resolve dependencies
    const sortedServices = services
      .sort((a, b) => a.priority - b.priority)
      .filter(service => service.autoStart);

    for (const service of sortedServices) {
      if (!visited.has(service.name)) {
        visit(service.name);
      }
    }

    const resolution: DependencyResolution = {
      initializationOrder: this.initializationOrder,
      dependencyGraph: new Map(this.dependencyGraph),
      circularDependencies
    };

    logger.debug('Dependencies resolved', {
      correlationId: `dependency-injector-${Date.now()}`,
      operation: 'dependency_resolution',
      metadata: {
        serviceCount: services.length,
        initializationOrder: this.initializationOrder,
        circularDependencies: circularDependencies.length
      }
    });

    return resolution;
  }

  /**
   * Initialize all services in dependency order
   */
  async initializeServices(): Promise<void> {
    const resolution = this.resolveDependencies();

    if (resolution.circularDependencies.length > 0) {
      throw new Error(`Circular dependencies detected: ${resolution.circularDependencies.join(', ')}`);
    }

    logger.info('Starting service initialization', {
      correlationId: `dependency-injector-${Date.now()}`,
      operation: 'initialization_start',
      metadata: {
        serviceCount: resolution.initializationOrder.length,
        order: resolution.initializationOrder
      }
    });

    for (const serviceName of resolution.initializationOrder) {
      const context: InjectionContext = {
        serviceName,
        dependencies: resolution.dependencyGraph.get(serviceName) || [],
        retryCount: 0,
        startTime: new Date()
      };

      await this.injectAndInitialize(context);
    }

    logger.info('All services initialized successfully', {
      correlationId: `dependency-injector-${Date.now()}`,
      operation: 'initialization_complete',
      metadata: { initializedCount: resolution.initializationOrder.length }
    });
  }

  /**
   * Initialize a specific service with dependency injection
   */
  async injectAndInitialize(context: InjectionContext): Promise<void> {
    const service = this.serviceRegistry.get(context.serviceName);
    if (!service) {
      throw new Error(`Service ${context.serviceName} not found in registry`);
    }

    if (service.isReady()) {
      return;
    }

    // Check if service is already initializing
    if (service.state === ServiceState.INITIALIZING) {
      await this.waitForServiceReady(service, context.serviceName);
      return;
    }

    // Verify dependencies are ready
    await this.verifyDependencies(context);

    try {
      logger.debug(`Initializing service: ${context.serviceName}`, {
        correlationId: `dependency-injector-${Date.now()}`,
        operation: 'service_initialization',
        metadata: {
          serviceName: context.serviceName,
          dependencies: context.dependencies,
          retryCount: context.retryCount
        }
      });

      await service.initialize();
      await delay(10); // Allow state transition

      if (!service.isReady()) {
        // Handle partially ready services (like OpenAI with invalid keys)
        if (service.state === ServiceState.READY) {
          logger.warn(`Service ${context.serviceName} in READY state but isReady() returns false`, {
            correlationId: `dependency-injector-${Date.now()}`,
            operation: 'partial_service_ready',
            metadata: { serviceName: context.serviceName }
          });
          return;
        }

        throw new Error(`Service ${context.serviceName} failed to become ready. State: ${service.state}`);
      }

      logger.debug(`Service initialized successfully: ${context.serviceName}`, {
        correlationId: `dependency-injector-${Date.now()}`,
        operation: 'service_initialization_success',
        metadata: { serviceName: context.serviceName }
      });

    } catch (error) {
      await this.handleInitializationError(context, error as Error);
    }
  }

  /**
   * Verify that all dependencies are ready
   */
  private async verifyDependencies(context: InjectionContext): Promise<void> {
    for (const depName of context.dependencies) {
      const depService = this.serviceRegistry.get(depName);

      if (!depService) {
        throw new Error(`Dependency ${depName} not found for service ${context.serviceName}`);
      }

      // Handle development mode graceful degradation
      if (depName === 'databaseService' && process.env.NODE_ENV === 'development') {
        const hasInitFailed = (depService as any)._initializationFailed;
        if (hasInitFailed) {
          logger.warn(`Continuing without ${depName} in development mode`, {
            correlationId: `dependency-injector-${Date.now()}`,
            operation: 'dependency_graceful_degradation',
            metadata: { serviceName: context.serviceName, dependency: depName }
          });
          continue;
        }
      }

      if (!depService.isReady() && depService.state !== ServiceState.ERROR) {
        const depContext: InjectionContext = {
          serviceName: depName,
          dependencies: this.dependencyGraph.get(depName) || [],
          retryCount: 0,
          startTime: new Date()
        };
        await this.injectAndInitialize(depContext);
      }
    }
  }

  /**
   * Wait for a service to become ready
   */
  private async waitForServiceReady(service: IService, serviceName: string, timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();

    while (!service.isReady() && Date.now() - startTime < timeoutMs) {
      await delay(100);

      if (service.state === ServiceState.ERROR) {
        throw new Error(`Service ${serviceName} failed during initialization`);
      }
    }

    if (!service.isReady()) {
      throw new Error(`Service ${serviceName} initialization timeout after ${timeoutMs}ms`);
    }
  }

  /**
   * Handle initialization errors with retry logic
   */
  private async handleInitializationError(context: InjectionContext, error: Error): Promise<void> {
    const attempts = this.initializationAttempts.get(context.serviceName) || 0;
    this.initializationAttempts.set(context.serviceName, attempts + 1);

    // Handle development mode graceful failures
    if (context.serviceName === 'databaseService' && process.env.NODE_ENV === 'development') {
      logger.warn(`Database service failed in development mode, marking as failed`, {
        correlationId: `dependency-injector-${Date.now()}`,
        operation: 'service_graceful_failure',
        metadata: { serviceName: context.serviceName, error: error.message }
      });

      const service = this.serviceRegistry.get(context.serviceName);
      if (service) {
        (service as any)._initializationFailed = true;
      }
      return;
    }

    // Retry logic for other services
    if (attempts < this.maxRetries) {
      logger.warn(`Service initialization failed, retrying (${attempts + 1}/${this.maxRetries}): ${context.serviceName}`, {
        correlationId: `dependency-injector-${Date.now()}`,
        operation: 'service_initialization_retry',
        metadata: { serviceName: context.serviceName, attempt: attempts + 1, error: error.message }
      });

      await delay(1000 * Math.pow(2, attempts)); // Exponential backoff

      const retryContext = { ...context, retryCount: attempts + 1 };
      await this.injectAndInitialize(retryContext);
    } else {
      logger.error(`Service initialization failed after ${this.maxRetries} attempts: ${context.serviceName}`, {
        correlationId: `dependency-injector-${Date.now()}`,
        operation: 'service_initialization_failure',
        metadata: { serviceName: context.serviceName, error: error.message }
      });
      throw error;
    }
  }

  /**
   * Get initialization order
   */
  getInitializationOrder(): string[] {
    return [...this.initializationOrder];
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): Map<string, string[]> {
    return new Map(this.dependencyGraph);
  }

  /**
   * Check for circular dependencies
   */
  hasCircularDependencies(): boolean {
    const resolution = this.resolveDependencies();
    return resolution.circularDependencies.length > 0;
  }

  /**
   * Reset injection state (for testing)
   */
  reset(): void {
    this.initializationOrder = [];
    this.dependencyGraph.clear();
    this.initializationAttempts.clear();
  }
}