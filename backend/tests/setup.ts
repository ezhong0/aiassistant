/**
 * Jest setup file - runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for tests
process.env.DISABLE_RATE_LIMITING = 'true';

// Mock required environment variables for configuration validation
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';  
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// Mock console methods if needed for cleaner test output
// jest.spyOn(console, 'log').mockImplementation(() => {});
// jest.spyOn(console, 'info').mockImplementation(() => {});

// Global test setup
beforeAll(async () => {
  // Any global setup before all tests
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

afterAll(async () => {
  // Any global cleanup after all tests
  
  // Force garbage collection and cleanup
  if (global.gc) {
    global.gc();
  }
  
  // Give time for cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Force garbage collection between tests if available
  if (global.gc) {
    global.gc();
  }
});