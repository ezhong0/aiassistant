/**
 * Global test setup and teardown
 * Configures environment and services for testing
 */

import dotenv from 'dotenv';
import path from 'path';
import { TestUtils } from './test-utils';

// Load test environment variables FIRST
const envPath = path.resolve(__dirname, '../.env.test');
const fallbackEnvPath = path.resolve(__dirname, '../.env');

// Set test environment before loading any configs
process.env.NODE_ENV = 'test';

try {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.log('⚠️ .env.test not found, using fallback .env');
    dotenv.config({ path: fallbackEnvPath });
  }
} catch {
  // Fallback to main .env if test env doesn't exist
  dotenv.config({ path: fallbackEnvPath });
}

// Global test configuration
export const TEST_CONFIG = {
  TIMEOUT: 30000, // 30 seconds default timeout
  SERVICE_INIT_TIMEOUT: 10000, // 10 seconds for service initialization
  MEMORY_CLEANUP_DELAY: 100, // 100ms cleanup delay
  MOCK_TEAM_ID: 'T123456789',
  MOCK_USER_ID: 'U123456789'
};

/**
 * Setup function called before all tests
 */
export default async function globalSetup(): Promise<void> {
  console.log('🧪 Setting up global test environment...');
  
  // Environment variables are already set above
  process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
  
  // Initialize memory monitoring if available
  if (typeof process.memoryUsage === 'function') {
    console.log('📊 Initial memory usage:');
    TestUtils.getMemoryUsage();
  }
  
  console.log('✅ Global test setup complete');
}

/**
 * Teardown function called after all tests
 */
export async function globalTeardown(): Promise<void> {
  console.log('🧹 Cleaning up global test environment...');
  
  try {
    // Force cleanup of any remaining services
    await TestUtils.cleanupServices();
    
    // Final memory cleanup
    TestUtils.forceGC();
    
    // Wait for cleanup to complete
    await TestUtils.waitForAsyncOperations(TEST_CONFIG.MEMORY_CLEANUP_DELAY);
    
    if (typeof process.memoryUsage === 'function') {
      console.log('📊 Final memory usage:');
      TestUtils.getMemoryUsage();
    }
    
  } catch (error) {
    console.warn('⚠️ Warning during global teardown:', error);
  }
  
  console.log('✅ Global test teardown complete');
}

/**
 * Individual test setup helper
 */
export async function testSetup(options: { useServices?: boolean } = {}): Promise<void> {
  if (options.useServices) {
    await TestUtils.initializeServices();
  }
}

/**
 * Individual test teardown helper
 */
export async function testTeardown(options: { useServices?: boolean } = {}): Promise<void> {
  if (options.useServices) {
    await TestUtils.cleanupServices();
  }
  
  // Force garbage collection after each test
  TestUtils.forceGC();
  await TestUtils.waitForAsyncOperations(10);
}