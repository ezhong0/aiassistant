/**
 * DI Container Helper for Scripts
 *
 * Provides easy access to DI container for utility scripts.
 * Replaces the deprecated ServiceManager pattern.
 */

import { createAppContainer } from '../../src/di/container';
import { registerAllServices } from '../../src/di/registrations';
import type { Cradle } from '../../src/di/container';

/**
 * Script container singleton
 */
class ScriptContainer {
  private container: ReturnType<typeof createAppContainer> | null = null;

  /**
   * Initialize the DI container
   */
  async initialize(): Promise<void> {
    if (!this.container) {
      this.container = createAppContainer();
      registerAllServices(this.container);
    }
  }

  /**
   * Get a service from the container
   */
  resolve<K extends keyof Cradle>(serviceName: K): Cradle[K] {
    if (!this.container) {
      throw new Error('Container not initialized. Call initialize() first.');
    }
    return this.container.resolve(serviceName);
  }

  /**
   * Get the raw container
   */
  getContainer() {
    return this.container;
  }

  /**
   * Cleanup and reset
   */
  async cleanup(): Promise<void> {
    if (this.container) {
      await this.container.dispose();
      this.container = null;
    }
  }
}

// Export singleton instance for scripts
export const scriptContainer = new ScriptContainer();

// Convenience function for scripts
export async function initializeContainer() {
  await scriptContainer.initialize();
  return scriptContainer;
}
