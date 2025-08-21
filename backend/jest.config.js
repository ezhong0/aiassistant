module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Coverage configuration
  collectCoverage: false, // Enable manually when needed
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Module path mapping (if needed)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // MEMORY AND PERFORMANCE OPTIMIZATIONS
  // Run tests sequentially to avoid memory issues
  maxWorkers: 1,
  
  // Force garbage collection between test suites
  logHeapUsage: true,
  
  // Detect open handles that prevent Jest from exiting
  detectOpenHandles: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Limit concurrent tests
  maxConcurrency: 1
};