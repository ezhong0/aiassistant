/**
 * Service Locator - Compatibility Shim for DI Container
 * 
 * This provides backward compatibility for code using serviceManager
 * while we transition to full constructor injection.
 * 
 * DO NOT USE IN NEW CODE - Use container.resolve() directly or constructor injection instead.
 * 
 * @deprecated Use DI container directly
 */

import type { AppContainer } from '../di';

/**
 * Global container reference for backward compatibility
 * Set by application bootstrap during initialization
 */
let globalContainer: AppContainer | null = null;

export function setGlobalServiceContainer(container: AppContainer): void {
  globalContainer = container;
}

/**
 * Compatibility service manager that resolves from DI container
 * @deprecated Use container.resolve() or constructor injection instead
 */
export class ServiceLocator {
  static getService<T = any>(serviceName: string): T | null {
    if (!globalContainer) {
      throw new Error('DI Container not initialized. Call setGlobalServiceContainer() first.');
    }
    
    try {
      return globalContainer.resolve<T>(serviceName as any);
    } catch (error) {
      console.error(`Failed to resolve service: ${serviceName}`, error);
      return null;
    }
  }

  static hasService(serviceName: string): boolean {
    if (!globalContainer) {
      return false;
    }
    
    try {
      globalContainer.resolve(serviceName as any);
      return true;
    } catch {
      return false;
    }
  }
}

// Export as serviceManager for backward compatibility
export const serviceManager = ServiceLocator;
