/**
 * Global Test Setup
 *
 * This file runs once before all tests across all test files.
 * Use for global configuration, mocks, and environment setup.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Global timeout for all tests (can be overridden per test)
jest.setTimeout(30000);

// Suppress console output during tests (optional - comment out if you need logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: console.error, // Keep errors visible
// };

// Track active timers and intervals for cleanup
const activeTimers = new Set<NodeJS.Timeout>();
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

// Wrap setTimeout to track timers
global.setTimeout = ((fn: any, ms?: number, ...args: any[]) => {
  const timer = originalSetTimeout(fn, ms, ...args);
  activeTimers.add(timer);
  return timer;
}) as typeof setTimeout;

// Wrap setInterval to track intervals
global.setInterval = ((fn: any, ms?: number, ...args: any[]) => {
  const timer = originalSetInterval(fn, ms, ...args);
  activeTimers.add(timer);
  return timer;
}) as typeof setInterval;

// Wrap clearTimeout to untrack timers
global.clearTimeout = ((timer: NodeJS.Timeout) => {
  activeTimers.delete(timer);
  return originalClearTimeout(timer);
}) as typeof clearTimeout;

// Wrap clearInterval to untrack intervals
global.clearInterval = ((timer: NodeJS.Timeout) => {
  activeTimers.delete(timer);
  return originalClearInterval(timer);
}) as typeof clearInterval;

// Global afterEach to clean up any remaining timers
afterEach(() => {
  // Clear all active timers
  activeTimers.forEach((timer) => {
    originalClearTimeout(timer);
  });
  activeTimers.clear();

  // Clear all mocks
  jest.clearAllMocks();
});

// Global afterAll to ensure complete cleanup
afterAll(async () => {
  // Final cleanup of any remaining timers
  activeTimers.forEach((timer) => {
    originalClearTimeout(timer);
  });
  activeTimers.clear();

  // Give async operations time to complete
  await new Promise((resolve) => originalSetTimeout(resolve, 100));
});

// Export cleanup utilities for use in tests
export const cleanup = {
  clearAllTimers: () => {
    activeTimers.forEach((timer) => {
      originalClearTimeout(timer);
    });
    activeTimers.clear();
  },
  getActiveTimerCount: () => activeTimers.size,
};
