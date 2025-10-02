module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      sourceMap: false,
      tsconfig: 'tsconfig.test.json'
    }]
  },
  
  testMatch: [
    '**/tests/e2e/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  
  // Ignore problematic directories
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/ai-behavior/',
    'tests/test-.*\\.ts$',
    '\\.broken\\.'
  ],
  
  // No setup files for component tests
  setupFilesAfterEnv: [],
  globalSetup: undefined,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  testTimeout: 30000, // Increased for service initialization
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  verbose: false,
  
  // Memory and performance optimization
  maxWorkers: 1,
  workerIdleMemoryLimit: '256MB', // Higher for e2e tests
  logHeapUsage: false,
  detectOpenHandles: true, // Enable to identify async leaks
  forceExit: false, // Disable to ensure proper cleanup
  maxConcurrency: 1,
  cache: true, // Enable cache for faster runs
  collectCoverage: false,
  
  // Error handling
  bail: false,
  errorOnDeprecated: false
};
