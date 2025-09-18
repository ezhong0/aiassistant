import { ServiceState, IService } from './service-manager';
import { BaseError, ServiceError, ServiceDependencyError, ErrorFactory, ErrorCategory } from '../errors/error-types';
import { retryManager, RetryConfig } from '../errors/retry-manager';
import logger from '../utils/logger';

/**
 * Base service class that provides common functionality and lifecycle management
 * 
 * All services in the application should extend this class to ensure consistency
 * in lifecycle management, error handling, logging, and health monitoring.
 * 
 * This abstract class implements the IService interface and provides:
 * - Standardized initialization and cleanup lifecycle
 * - State management with proper state transitions
 * - Error handling and logging integration
 * - Health monitoring capabilities
 * - Protection against double initialization/destruction
 * 
 * Services extending this class must implement:
 * - `onInitialize()`: Service-specific initialization logic
 * - `onDestroy()`: Service-specific cleanup logic
 * 
 * @abstract
 * @implements {IService}
 * 
 * @example
 * ```typescript
 * export class MyService extends BaseService {
 *   constructor() {
 *     super('myService');
 *   }
 * 
 *   protected async onInitialize(): Promise<void> {
 *     // Service-specific initialization
 *     this.logInfo('MyService initialized');
 *   }
 * 
 *   protected async onDestroy(): Promise<void> {
 *     // Service-specific cleanup
 *     this.logInfo('MyService destroyed');
 *   }
 * }
 * ```
 */
export abstract class BaseService implements IService {
  public readonly name: string;
  protected _state: ServiceState = ServiceState.INITIALIZING;
  public initialized = false;
  public destroyed = false;

  /**
   * Create a new BaseService instance
   * 
   * @param name - Unique name for the service (used for identification and logging)
   * 
   * @example
   * ```typescript
   * constructor() {
   *   super('myService');
   * }
   * ```
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Get current service state
   * 
   * @returns Current service state in the lifecycle
   * 
   * @example
   * ```typescript
   * if (this.state === ServiceState.READY) {
   *   // Service is ready to handle requests
   * }
   * ```
   */
  get state(): ServiceState {
    return this._state;
  }

  /**
   * Check if service is ready to handle requests
   * 
   * A service is considered ready when it's in the READY state,
   * has been initialized, and hasn't been destroyed.
   * 
   * @returns true if service is ready, false otherwise
   * 
   * @example
   * ```typescript
   * if (this.isReady()) {
   *   // Safe to call service methods
   * }
   * ```
   */
  isReady(): boolean {
    return this._state === ServiceState.READY && this.initialized && !this.destroyed;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug(`Service ${this.name} already initialized`);
      return;
    }

    if (this.destroyed) {
      throw new Error(`Cannot initialize destroyed service: ${this.name}`);
    }

    try {
      this._state = ServiceState.INITIALIZING;
      logger.debug(`Initializing service: ${this.name}`);

      // Call the abstract initialization method
      await this.onInitialize();

      this.initialized = true;
      this._state = ServiceState.READY;
      logger.debug(`Service initialized successfully: ${this.name}`);
    } catch (error) {
      this._state = ServiceState.ERROR;
      logger.error(`Failed to initialize service ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Destroy the service
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      logger.debug(`Service ${this.name} already destroyed`);
      return;
    }

    try {
      this._state = ServiceState.SHUTTING_DOWN;
      logger.debug(`Destroying service: ${this.name}`);

      // Call the abstract cleanup method
      await this.onDestroy();

      this.destroyed = true;
      this._state = ServiceState.DESTROYED;
      logger.info(`Service destroyed successfully: ${this.name}`);
    } catch (error) {
      logger.error(`Error destroying service ${this.name}:`, error);
      // Still mark as destroyed even if cleanup failed
      this.destroyed = true;
      this._state = ServiceState.DESTROYED;
      throw error;
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    const healthy = this.isReady();
    const details = {
      state: this._state,
      initialized: this.initialized,
      destroyed: this.destroyed,
      timestamp: new Date().toISOString()
    };

    return { healthy, details };
  }

  /**
   * Abstract method for service-specific initialization
   * Override this in subclasses to implement custom initialization logic
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Abstract method for service-specific cleanup
   * Override this in subclasses to implement custom cleanup logic
   */
  protected abstract onDestroy(): Promise<void>;

  /**
   * Helper method to check if service is in a valid state for operations
   */
  protected assertReady(): void {
    if (!this.isReady()) {
      throw new Error(`Service ${this.name} is not ready. Current state: ${this._state}`);
    }
  }

  /**
   * Helper method to check if service is not destroyed
   */
  protected assertNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error(`Service ${this.name} has been destroyed`);
    }
  }

  /**
   * Enhanced error handling with structured error classification
   */
  protected handleError(error: Error | unknown, operation: string): never {
    let structuredError: BaseError;

    if (error instanceof BaseError) {
      structuredError = error;
    } else {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      structuredError = ErrorFactory.wrapError(errorInstance, ErrorCategory.SERVICE, this.name, operation);
    }

    // Set context
    structuredError.setContext(this.name, operation);

    // Log with appropriate severity
    this.logStructuredError(structuredError);

    throw structuredError;
  }

  /**
   * Handle non-fatal errors with graceful degradation
   */
  protected handleNonFatalError(error: Error | unknown, operation: string): BaseError {
    let structuredError: BaseError;

    if (error instanceof BaseError) {
      structuredError = error;
    } else {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      structuredError = ErrorFactory.wrapError(errorInstance, ErrorCategory.SERVICE, this.name, operation);
    }

    structuredError.setContext(this.name, operation);
    this.logStructuredError(structuredError);

    return structuredError;
  }

  /**
   * Execute operation with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const result = await retryManager.execute(
      operation,
      retryConfig,
      { service: this.name, operation: operationName }
    );

    if (!result.success) {
      const error = this.handleNonFatalError(result.error!, operationName);
      error.addDetails('attempts', result.attempts);
      error.addDetails('totalTime', result.totalTime);
      throw error;
    }

    return result.result!;
  }

  /**
   * Execute operation with fallback
   */
  protected async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    operationName: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const result = await retryManager.executeWithFallback(
      primaryOperation,
      fallbackOperation,
      retryConfig,
      { service: this.name, operation: operationName }
    );

    if (!result.success) {
      const error = this.handleNonFatalError(result.error!, operationName);
      error.addDetails('attempts', result.attempts);
      error.addDetails('totalTime', result.totalTime);
      throw error;
    }

    return result.result!;
  }

  /**
   * Check if dependency service is available
   */
  protected checkDependency(serviceName: string, required: boolean = true): boolean {
    // This would integrate with service manager to check dependencies
    // For now, we'll implement a basic check
    try {
      const service = require('./service-manager').serviceManager.getService(serviceName);
      return service !== null && service !== undefined;
    } catch {
      if (required) {
        const error = new ServiceDependencyError(`Required dependency '${serviceName}' is not available`);
        error.setContext(this.name, 'checkDependency');
        throw error;
      }
      return false;
    }
  }

  /**
   * Log structured error with appropriate level
   */
  private logStructuredError(error: BaseError): void {
    const logData = {
      ...error.toJSON(),
      serviceState: this._state
    };

    switch (error.severity) {
      case 'critical':
        logger.error('CRITICAL SERVICE ERROR', logData);
        break;
      case 'high':
        logger.error('HIGH SEVERITY SERVICE ERROR', logData);
        break;
      case 'medium':
        logger.warn('MEDIUM SEVERITY SERVICE ERROR', logData);
        break;
      case 'low':
        logger.info('LOW SEVERITY SERVICE ERROR', logData);
        break;
      default:
        logger.debug('SERVICE ERROR', logData);
    }
  }

  /**
   * Helper method for consistent logging
   */
  protected logInfo(message: string, meta?: Record<string, unknown>): void {
    logger.info(message, { service: this.name, ...meta });
  }

  /**
   * Helper method for consistent debug logging
   */
  protected logDebug(message: string, meta?: Record<string, unknown>): void {
    logger.debug(message, { service: this.name, ...meta });
  }

  /**
   * Helper method for consistent warning logging
   */
  protected logWarn(message: string, meta?: Record<string, unknown>): void {
    logger.warn(message, { service: this.name, ...meta });
  }

  /**
   * Helper method for consistent error logging
   */
  protected logError(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    logger.error(message, { 
      service: this.name, 
      error: error instanceof Error ? error.stack : error,
      ...meta 
    });
  }
}
