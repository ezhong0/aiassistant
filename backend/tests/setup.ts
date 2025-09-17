/**
 * Jest setup file - minimal and isolated to prevent memory leaks
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for tests
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests

// Mock required environment variables for configuration validation
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';  
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-must-be-at-least-32-chars';

// Mock API keys for tests that might need them
process.env.OPENAI_API_KEY = 'test-openai-key';

// Import service initialization for tests (disabled by default to prevent Redis/DB connection issues)
let serviceInitialized = false;

beforeAll(async () => {
  // Only initialize services if explicitly requested via environment variable
  if (process.env.INIT_SERVICES === 'true' && !serviceInitialized) {
    try {
      const { initializeAllCoreServices } = await import('../src/services/service-initialization');
      await initializeAllCoreServices();
      serviceInitialized = true;
      console.log('✅ Services initialized for tests');
    } catch (error) {
      console.error('❌ Failed to initialize services for tests:', error);
      // Continue with tests even if services fail to initialize
    }
  }
});

afterAll(async () => {
  // Cleanup services if they were initialized
  if (serviceInitialized) {
    try {
      const { serviceManager } = await import('../src/services/service-manager');
      await serviceManager.forceCleanup();
      serviceInitialized = false;
      console.log('✅ Services cleaned up after tests');
    } catch (error) {
      console.error('❌ Failed to cleanup services after tests:', error);
    }
  }
  
  // Give time for final cleanup
  await new Promise(resolve => setTimeout(resolve, 50));
});

// Cleanup after each test to prevent memory leaks
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  jest.clearAllTimers();
  
  // Reset service state between tests if services are initialized
  if (serviceInitialized) {
    try {
      const { serviceManager } = await import('../src/services/service-manager');
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
});

// Global test utilities
(global as any).getService = async (serviceName: string) => {
  if (!serviceInitialized) {
    const { initializeAllCoreServices } = await import('../src/services/service-initialization');
    await initializeAllCoreServices();
    serviceInitialized = true;
  }
  
  const { serviceManager } = await import('../src/services/service-manager');
  return serviceManager.getService(serviceName);
};

(global as any).getServiceManager = async () => {
  if (!serviceInitialized) {
    const { initializeAllCoreServices } = await import('../src/services/service-initialization');
    await initializeAllCoreServices();
    serviceInitialized = true;
  }
  
  const { serviceManager } = await import('../src/services/service-manager');
  return serviceManager;
};

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  originalError('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in test environment, just log
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  originalError('Uncaught Exception:', error);
  // Don't exit in test environment, just log
});