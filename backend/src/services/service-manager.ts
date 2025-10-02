/**
 * Service Manager
 *
 * Simple wrapper around the DI container for backward compatibility with tests.
 * Provides a service locator pattern for test environments.
 *
 * Note: This is primarily for tests. Production code should use proper DI.
 */

import { createAppContainer, type Cradle } from '../di/container';
import { registerAllServices } from '../di/registrations';
import { ErrorFactory } from '../errors/error-factory';

class ServiceManager {
  private container: ReturnType<typeof createAppContainer> | null = null;

  /**
   * Initialize the service container
   */
  initialize(): void {
    if (!this.container) {
      this.container = createAppContainer();
      registerAllServices(this.container);
    }
  }

  /**
   * Get a service from the container
   */
  getService<K extends keyof Cradle>(serviceName: K): Cradle[K] | undefined {
    if (!this.container) {
      throw ErrorFactory.domain.serviceError('ServiceManager', 'ServiceManager not initialized. Call initialize() first.');
    }

    try {
      return this.container.resolve(serviceName);
    } catch (error) {
      console.error(`Failed to resolve service: ${String(serviceName)}`, error);
      return undefined;
    }
  }

  /**
   * Check if a service is available
   */
  hasService(serviceName: keyof Cradle): boolean {
    if (!this.container) {
      return false;
    }

    try {
      return this.container.hasRegistration(serviceName as string);
    } catch {
      return false;
    }
  }

  /**
   * Get the raw container (for advanced usage)
   */
  getContainer() {
    return this.container;
  }

  /**
   * Reset the container (useful for tests)
   */
  reset(): void {
    if (this.container) {
      void this.container.dispose();
      this.container = null;
    }
  }
}

// Export singleton instance
// eslint-disable-next-line custom-rules/enforce-dependency-injection
export const serviceManager = new ServiceManager();
