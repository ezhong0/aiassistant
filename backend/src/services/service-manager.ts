import logger from '../utils/logger';

/**
 * Service manager for handling graceful shutdown of services
 * Ensures all intervals and timers are properly cleaned up
 */
export class ServiceManager {
  private static instance: ServiceManager;
  private services: Set<{ destroy: () => void }> = new Set();
  private isShuttingDown = false;

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
   * Register a service for graceful shutdown
   */
  registerService(service: { destroy: () => void }): void {
    if (this.isShuttingDown) {
      logger.warn('Cannot register service - system is shutting down');
      return;
    }
    
    this.services.add(service);
    logger.debug(`Service registered for graceful shutdown: ${service.constructor.name}`);
  }

  /**
   * Unregister a service
   */
  unregisterService(service: { destroy: () => void }): void {
    this.services.delete(service);
    logger.debug(`Service unregistered from graceful shutdown: ${service.constructor.name}`);
  }

  /**
   * Get count of registered services
   */
  getServiceCount(): number {
    return this.services.size;
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn(`Shutdown signal ${signal} received but already shutting down`);
        return;
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}. Starting graceful shutdown of ${this.services.size} services...`);

      // Clean up all registered services
      let cleanedCount = 0;
      for (const service of this.services) {
        try {
          service.destroy();
          cleanedCount++;
          logger.debug(`Service cleaned up successfully: ${service.constructor.name}`);
        } catch (error) {
          logger.error(`Error cleaning up service ${service.constructor.name}:`, error);
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
  forceCleanup(): void {
    logger.warn('Force cleanup of all services requested');
    for (const service of this.services) {
      try {
        service.destroy();
      } catch (error) {
        logger.error(`Error during force cleanup of ${service.constructor.name}:`, error);
      }
    }
    this.services.clear();
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();
