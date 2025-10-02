/**
 * Test Service Initialization
 *
 * Initializes services for testing environments with appropriate mocks and configurations.
 */

import { serviceManager } from './service-manager';

/**
 * Initialize test services with mocked dependencies where appropriate
 */
export function initializeTestServices(): void {
  // Ensure test environment
  if (process.env.NODE_ENV !== 'test' && process.env.E2E_TESTING !== 'true') {
    console.warn('initializeTestServices called outside test environment');
  }

  // Initialize the service manager
  serviceManager.initialize();

  console.log('Test services initialized successfully');
}

/**
 * Clean up test services
 */
export function cleanupTestServices(): void {
  serviceManager.reset();
  console.log('Test services cleaned up');
}
