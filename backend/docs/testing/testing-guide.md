# Testing Guide

This guide covers testing strategies and running tests for the AI Assistant Application.

## Test Structure

Tests are organized to mirror the source structure:

```
tests/
├── unit/                # Unit tests (mirrors src/)
│   ├── services/
│   └── middleware/
├── integration/         # Integration tests
├── e2e/                 # End-to-end tests
│   ├── scenarios/
│   ├── generators/
│   └── evaluators/
└── utils/               # Test utilities
```

## Running Tests

### Backend Tests

```bash
cd backend

# All tests
npm test

# Specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Test coverage
npm run test:coverage
```

### Frontend Tests

```bash
cd frontend/ChatbotApp

# Jest tests
npm test

# Test with coverage
npm test -- --coverage
```

## Test Types

### Unit Tests
- Test individual functions and classes in isolation
- Mock external dependencies
- Fast execution (< 100ms per test)
- High coverage target (90%+)

### Integration Tests
- Test service interactions
- Use real database connections
- Test API endpoints
- Medium execution time (< 1s per test)

### End-to-End Tests
- Test complete user workflows
- Use real external APIs (with test accounts)
- Validate 3-layer architecture
- Longer execution time (< 10s per test)

## E2E Testing System

The E2E testing system validates the 3-layer architecture:

### Test Flow
1. **Generate Test Inbox** - Create realistic email scenarios
2. **Generate Queries** - Create natural language queries
3. **Run Chatbot** - Process queries through 3-layer system
4. **Evaluate Results** - Validate responses against ground truth

### Running E2E Tests

```bash
# Generate test inbox
npm run e2e:generate-inbox quick-test

# Run evaluation tests
npm test tests/e2e/suites/

# Run specific test
npm test tests/e2e/suites/01-inbox-triage-3layer.test.ts
```

### Test Scenarios

**Core Scenarios:**
- Inbox triage (urgent emails, VIP detection)
- Dropped ball detection (unanswered emails)
- Commitment tracking (promises made)
- Search and retrieval (by person, topic, time)
- Calendar management (schedule, availability)

**Test Data:**
- Realistic email templates
- Ground truth labels (urgency, sender type, etc.)
- Persona-aware noise categorization
- Complex scenarios (escalations, follow-ups)

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from '@jest/globals';
import { EmailDomainService } from '@/services/domain';

describe('EmailDomainService', () => {
  it('should search emails successfully', async () => {
    // Arrange
    const service = new EmailDomainService();
    
    // Act
    const result = await service.searchEmails({ query: 'test' });
    
    // Assert
    expect(result.success).toBe(true);
  });
});
```

### Integration Test Example

```typescript
describe('Chat API Integration', () => {
  it('should process chat message end-to-end', async () => {
    const response = await request(app)
      .post('/api/chat/message')
      .send({
        message: 'Show me urgent emails',
        context: { conversationHistory: [] }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBeDefined();
  });
});
```

## Test Configuration

### Jest Configuration

**Backend** (`jest.config.js`):
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ]
};
```

**Frontend** (`jest.config.js`):
```javascript
module.exports = {
  preset: 'react-native',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
```

## Test Data Management

### Mock Data
- Use consistent mock data across tests
- Store in `tests/mocks/` directory
- Include realistic edge cases

### Test Database
- Use separate test database
- Reset between test runs
- Use transactions for isolation

### External APIs
- Use test accounts for external services
- Mock responses for unit tests
- Use real APIs for integration tests

## Performance Testing

### Response Time Targets
- Unit tests: < 100ms
- Integration tests: < 1s
- E2E tests: < 10s
- API endpoints: < 3s

### Load Testing
```bash
# Run load tests
npm run test:load

# Performance benchmarks
npm run test:performance
```

## Debugging Tests

### Common Issues

**Test Timeouts:**
```typescript
// Increase timeout for slow tests
it('should handle complex query', async () => {
  // test code
}, 10000); // 10 second timeout
```

**Async Issues:**
```typescript
// Always await async operations
it('should process async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

**Mock Issues:**
```typescript
// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Continuous Integration

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

### Test Reports
- Coverage reports in `coverage/` directory
- Test results in `test-results/` directory
- E2E evaluation reports in `tests/e2e/reports/`

## Best Practices

1. **Write tests first** - TDD approach
2. **Keep tests simple** - One assertion per test
3. **Use descriptive names** - Clear test purpose
4. **Mock external dependencies** - Isolate units
5. **Test edge cases** - Error conditions, empty data
6. **Maintain test data** - Keep mocks realistic
7. **Run tests frequently** - Before every commit
8. **Monitor coverage** - Aim for 90%+ coverage

## Troubleshooting

### Common Problems

**Tests failing randomly:**
- Check for race conditions
- Use proper async/await
- Reset state between tests

**Slow test execution:**
- Optimize database queries
- Use parallel execution
- Mock expensive operations

**Memory leaks:**
- Clean up resources
- Close database connections
- Clear event listeners

### Getting Help

- Check test output for specific errors
- Review test logs in `logs/` directory
- Ask team members for guidance
- Open issue for persistent problems
