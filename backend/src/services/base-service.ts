import { ServiceState, IService } from './service-manager';
import logger from '../utils/logger';

/**
 * Base service class that provides common functionality and lifecycle management
 * All services should extend this class to ensure consistency
 */
export abstract class BaseService implements IService {
  public readonly name: string;
  protected _state: ServiceState = ServiceState.INITIALIZING;
  public initialized = false;
  public destroyed = false;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Get current service state
   */
  get state(): ServiceState {
    return this._state;
  }

  /**
   * Check if service is ready
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
  getHealth(): { healthy: boolean; details?: any } {
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
   * Helper method for consistent error handling
   */
  protected handleError(error: any, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `Error in ${this.name}.${operation}: ${errorMessage}`;
    
    logger.error(fullMessage, {
      service: this.name,
      operation,
      error: error instanceof Error ? error.stack : error,
      state: this._state
    });

    throw new Error(fullMessage);
  }

  /**
   * Helper method for consistent logging
   */
  protected logInfo(message: string, meta?: any): void {
    logger.info(message, { service: this.name, ...meta });
  }

  /**
   * Helper method for consistent debug logging
   */
  protected logDebug(message: string, meta?: any): void {
    logger.debug(message, { service: this.name, ...meta });
  }

  /**
   * Helper method for consistent warning logging
   */
  protected logWarn(message: string, meta?: any): void {
    logger.warn(message, { service: this.name, ...meta });
  }

  /**
   * Helper method for consistent error logging
   */
  protected logError(message: string, error?: any, meta?: any): void {
    logger.error(message, { 
      service: this.name, 
      error: error instanceof Error ? error.stack : error,
      ...meta 
    });
  }
}
