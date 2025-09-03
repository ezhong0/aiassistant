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
    '**/tests/**/*.(test|spec).(ts|tsx|js|jsx)',
    '**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  verbose: false,
  
  // Memory optimization
  maxWorkers: 1,
  workerIdleMemoryLimit: '128MB',
  logHeapUsage: false,
  detectOpenHandles: true,
  forceExit: true,
  maxConcurrency: 1,
  cache: false,
  collectCoverage: false
};