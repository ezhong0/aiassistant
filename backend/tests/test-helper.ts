/**
 * Test helper for initializing services when needed
 */

let servicesInitialized = false;

export class TestHelper {
  /**
   * Initialize services for tests that need them
   */
  static async initializeServices(): Promise<void> {
    if (servicesInitialized) {
      return;
    }

    try {
      // Import and initialize services
      const { initializeAllCoreServices } = require('../src/services/service-initialization');
      await initializeAllCoreServices();
      servicesInitialized = true;
      console.log('✅ Services initialized for test');
    } catch (error) {
      console.error('❌ Failed to initialize services for test:', error);
      throw error;
    }
  }

  /**
   * Cleanup services after tests
   */
  static async cleanupServices(): Promise<void> {
    if (!servicesInitialized) {
      return;
    }

    try {
      const { serviceManager } = require('../src/services/service-manager');
      await serviceManager.forceCleanup();
      servicesInitialized = false;
      console.log('✅ Services cleaned up after test');
    } catch (error) {
      console.error('❌ Failed to cleanup services after test:', error);
    }
  }

  /**
   * Check if services are initialized
   */
  static areServicesInitialized(): boolean {
    return servicesInitialized;
  }

  /**
   * Get a service from the ServiceManager
   */
  static async getService<T>(serviceName: string): Promise<T | undefined> {
    if (!servicesInitialized) {
      await this.initializeServices();
    }

    const { serviceManager } = require('../src/services/service-manager');
    return serviceManager.getService(serviceName) as T;
  }

  /**
   * Get the ServiceManager instance
   */
  static async getServiceManager() {
    if (!servicesInitialized) {
      await this.initializeServices();
    }

    const { serviceManager } = require('../src/services/service-manager');
    return serviceManager;
  }

  /**
   * Reset service states for testing
   */
  static async resetServices(): Promise<void> {
    if (!servicesInitialized) {
      return;
    }

    try {
      const { serviceManager } = require('../src/services/service-manager');
      const manager = serviceManager;
      
      // Reset service states without full shutdown
      for (const serviceName of manager.getRegisteredServices()) {
        const service = manager.getService(serviceName);
        if (service && service.state !== 'destroyed') {
          // Reset to initial state if possible
          if (service.initialize && typeof service.initialize === 'function') {
            try {
              // Reset service state for next test
              if (service.state === 'error') {
                // Re-initialize errored services
                await service.initialize();
              }
            } catch (error) {
              // Ignore reset errors in tests
            }
          }
        }
      }
    } catch (error) {
      // Ignore service reset errors in tests
    }
  }
}
