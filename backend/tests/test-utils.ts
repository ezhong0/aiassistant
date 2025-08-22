/**
 * Minimal test utilities - isolated to prevent memory leaks
 * Only provides basic helpers without importing main codebase
 */

/**
 * Simple test utilities that don't import from main codebase
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
   * Run a test with automatic cleanup
   */
  static async runWithCleanup<T>(
    testFn: () => Promise<T>,
    options: { useServices?: boolean } = {}
  ): Promise<T> {
    try {
      const result = await testFn();
      
      // Small delay for cleanup
      await this.waitForAsyncOperations(25);
      
      return result;
    } finally {
      // Force cleanup
      this.forceGC();
    }
  }
}

/**
 * Test mocks that don't require main codebase imports
 */
export class TestMocks {
  /**
   * Create a mock agent factory for testing
   */
  static createMockAgentFactory(): void {
    // This would be implemented if needed, but for now just a placeholder
    // to avoid importing from main codebase
  }
}

/**
 * Test assertions that don't require main codebase imports
 */
export class TestAssertions {
  /**
   * Assert that Think tool is included in tool calls
   */
  static assertThinkToolIncluded(toolCalls: any[]): void {
    const toolNames = toolCalls.map(call => call.name || call);
    expect(toolNames).toContain('Think');
  }
}