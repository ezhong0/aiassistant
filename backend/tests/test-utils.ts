/**
 * Consolidated test utilities for all testing needs
 * Memory-efficient helpers for unit and integration tests
 */

import { initializeAllCoreServices } from '../src/services/service-initialization';
import { serviceManager } from '../src/services/service-manager';

let servicesInitialized = false;

/**
 * Unified test utilities combining all test helper functions
 */
export class TestUtils {
  /**
   * Create a unique test session ID
   */
  static createTestSessionId(prefix: string = 'test'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Wait for async operations to complete
   */
  static async waitForAsyncOperations(ms: number = 10): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Force garbage collection if available
   */
  static forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get current memory usage (if available)
   */
  static getMemoryUsage(): void {
    if (process.memoryUsage) {
      const usage = process.memoryUsage();
      console.log('Memory usage:', {
        rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(usage.external / 1024 / 1024)} MB`
      });
    }
  }

  /**
   * Run a test with automatic cleanup and optional service initialization
   */
  static async runWithCleanup<T>(
    testFn: () => Promise<T>,
    options: { useServices?: boolean } = {}
  ): Promise<T> {
    try {
      // Initialize services if requested
      if (options.useServices) {
        await TestHelper.initializeServices();
      }
      
      const result = await testFn();
      
      // Small delay for cleanup
      await this.waitForAsyncOperations(25);
      
      return result;
    } finally {
      // Cleanup services if they were initialized
      if (options.useServices) {
        await TestHelper.cleanupServices();
      }
      
      // Force cleanup
      this.forceGC();
    }
  }

  /**
   * Initialize services for tests that need them
   */
  static async initializeServices(): Promise<void> {
    if (servicesInitialized) {
      return;
    }

    try {
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
      await serviceManager.forceCleanup();
      servicesInitialized = false;
      console.log('✅ Services cleaned up after test');
    } catch (error) {
      console.error('❌ Failed to cleanup services after test:', error);
    }
  }

  /**
   * Get a service from the ServiceManager
   */
  static async getService<T>(serviceName: string): Promise<T | undefined> {
    if (!servicesInitialized) {
      await this.initializeServices();
    }

    return serviceManager.getService(serviceName) as T;
  }
}

/**
 * Consolidated test helper class with service management
 */
export class TestHelper {
  /**
   * Initialize services for tests
   */
  static async initializeServices(): Promise<void> {
    return TestUtils.initializeServices();
  }

  /**
   * Cleanup services after tests
   */
  static async cleanupServices(): Promise<void> {
    return TestUtils.cleanupServices();
  }

  /**
   * Get a service from the ServiceManager
   */
  static async getService<T>(serviceName: string): Promise<T | undefined> {
    return TestUtils.getService<T>(serviceName);
  }

  /**
   * Check if services are initialized
   */
  static areServicesInitialized(): boolean {
    return servicesInitialized;
  }

  /**
   * Reset service states for testing
   */
  static async resetServices(): Promise<void> {
    if (!servicesInitialized) {
      return;
    }

    try {
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

/**
 * Test mocks for isolated testing
 */
export class TestMocks {
  /**
   * Create a mock OAuth tokens object
   */
  static createMockOAuthTokens() {
    return {
      google: {
        access_token: 'mock_access_token_123',
        refresh_token: 'mock_refresh_token_456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.send',
        expiry_date: Date.now() + (3600 * 1000)
      },
      slack: {
        team_id: 'T123456789',
        user_id: 'U123456789'
      }
    };
  }

  /**
   * Create a mock session for testing
   */
  static createMockSession(teamId: string = 'T123456789', userId: string = 'U123456789') {
    return {
      sessionId: `user:${teamId}:${userId}`,
      userId,
      teamId,
      createdAt: new Date(),
      lastActivity: new Date(),
      oauthTokens: this.createMockOAuthTokens()
    };
  }
}

/**
 * Custom test assertions for domain-specific testing
 */
export class TestAssertions {
  /**
   * Assert that Think tool is included in tool calls
   */
  static assertThinkToolIncluded(toolCalls: any[]): void {
    const toolNames = toolCalls.map(call => call.name || call);
    expect(toolNames).toContain('Think');
  }

  /**
   * Assert that OAuth tokens are valid
   */
  static assertValidOAuthTokens(tokens: any): void {
    expect(tokens).toBeDefined();
    expect(tokens.google).toBeDefined();
    expect(tokens.google.access_token).toBeDefined();
    expect(typeof tokens.google.access_token).toBe('string');
    expect(tokens.google.access_token.length).toBeGreaterThan(0);
  }

  /**
   * Assert that session has proper structure
   */
  static assertValidSession(session: any): void {
    expect(session).toBeDefined();
    expect(session.sessionId).toBeDefined();
    expect(session.userId).toBeDefined();
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.lastActivity).toBeInstanceOf(Date);
  }

  /**
   * Assert that service is properly initialized
   */
  static assertServiceReady(service: any): void {
    expect(service).toBeDefined();
    expect(service.state).toBe('ready');
    expect(service.isReady()).toBe(true);
  }
}