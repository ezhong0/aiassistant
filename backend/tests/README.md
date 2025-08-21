# Testing Infrastructure

This directory contains the complete testing setup for the assistant application backend.

## Structure

```
tests/
├── unit/
│   ├── agents/           # Unit tests for agent classes
│   ├── services/         # Unit tests for service classes  
│   ├── utils/            # Unit tests for utility functions
│   └── example.test.ts   # Example test demonstrating Jest setup
├── integration/          # Integration tests testing multiple components
├── fixtures/             # Test data and mock files
├── setup.ts             # Global test setup and configuration
└── README.md           # This file
```

## Test Types

### Unit Tests (`tests/unit/`)
- Test individual components in isolation
- Mock external dependencies
- Fast execution
- High test coverage

### Integration Tests (`tests/integration/`)
- Test component interactions
- Test complete workflows
- May use real services in test mode
- Slower but more comprehensive

### Fixtures (`tests/fixtures/`)
- Test data files
- Mock responses
- Configuration samples

## Available Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run specific test files
npm run test:example          # Example test
npm run test:master           # Master agent tests
npm run test:comprehensive    # Comprehensive integration tests
```

## Configuration

Tests are configured using:
- **`jest.config.js`** - Main Jest configuration
- **`tests/setup.ts`** - Global test setup
- **`package.json`** - Test scripts and dependencies

### Key Configuration Features
- TypeScript support via `ts-jest`
- 30 second test timeout
- Automatic mock clearing between tests
- Test environment variables
- Module path mapping support

## Writing Tests

### Basic Test Structure
```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Component Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  describe('Feature group', () => {
    it('should do something specific', () => {
      // Test implementation
      expect(actualValue).toBe(expectedValue);
    });

    it('should handle async operations', async () => {
      const result = await someAsyncFunction();
      expect(result).toBeDefined();
    });
  });
});
```

### Test Environment
- `NODE_ENV` is set to `'test'`
- Rate limiting is disabled
- Mocks are automatically cleared between tests
- All Jest globals are available

### Best Practices
1. **Descriptive test names** - Clearly state what is being tested
2. **Arrange-Act-Assert** - Set up, execute, verify
3. **One assertion per test** - Keep tests focused
4. **Use descriptive expects** - `expect(users).toHaveLength(3)` vs `expect(users.length).toBe(3)`
5. **Mock external dependencies** - Keep unit tests isolated
6. **Test error cases** - Don't just test the happy path

## Examples

See the following files for examples:
- `tests/unit/example.test.ts` - Basic Jest functionality
- `tests/unit/agents/master-agent.test.ts` - Agent unit tests
- `tests/integration/comprehensive.test.ts` - Integration tests

## Coverage

Generate coverage reports with:
```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory with:
- Terminal output
- HTML report (`coverage/lcov-report/index.html`)
- LCOV format for CI integration

## Debugging Tests

### Running Individual Tests
```bash
# Run specific test file
npm test -- tests/unit/agents/master-agent.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="Email"

# Run with verbose output
npm test -- --verbose
```

### Debug Mode
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Continuous Integration

Tests are designed to run in CI environments:
- No external service dependencies in unit tests
- Configurable timeouts
- Proper exit codes
- Coverage reporting support

## Migration from Old Tests

Old test files have been migrated:
- `test-master-agent.ts` → `tests/unit/agents/master-agent.test.ts`
- `test-comprehensive.ts` → `tests/integration/comprehensive.test.ts`
- Updated to use Jest syntax and patterns
- Maintained original test logic and expectations