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
      await serviceManager.getInstance().shutdown();
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
}
