/**
 * Jest setup file - minimal and isolated to prevent memory leaks
 * Supports both JavaScript and TypeScript tests
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
process.env.TAVILY_API_KEY = 'test-tavily-key';

// Reduce console output during tests for cleaner output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(async () => {
  // Suppress non-critical console output
  console.error = (message, ...args) => {
    // Only show actual test failures and critical errors
    if (typeof message === 'string' && (
      message.includes('FAIL') || 
      message.includes('Error:') ||
      message.includes('FATAL')
    )) {
      originalError(message, ...args);
    }
  };
  
  console.warn = (message, ...args) => {
    // Suppress warnings unless they're test-critical
    if (typeof message === 'string' && message.includes('CRITICAL')) {
      originalWarn(message, ...args);
    }
  };
});

afterAll(async () => {
  // Restore console methods
  console.error = originalError;
  console.warn = originalWarn;
  
  // Give time for final cleanup
  await new Promise(resolve => setTimeout(resolve, 50));
});

// Cleanup after each test to prevent memory leaks
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  jest.clearAllTimers();
  
  // Force garbage collection between tests if available
  if (global.gc) {
    global.gc();
  }
  
  // Small delay to allow async cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 10));
});

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
