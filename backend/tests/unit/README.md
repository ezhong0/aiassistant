# Unit Tests

This directory contains unit tests for the application. Unit tests focus on testing individual components in isolation with mocked dependencies.

## Structure

```
tests/unit/
├── services/           # Service layer tests
│   └── crypto.util.test.ts
├── middleware/         # Middleware tests
│   └── rate-limiting.middleware.test.ts
├── utils/             # Utility function tests
├── agents/            # Agent tests
└── README.md          # This file
```

## Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npm run test -- tests/unit/services/crypto.util.test.ts

# Run tests in watch mode
npm run test:watch -- tests/unit

# Run tests with coverage
npm run test:coverage -- tests/unit
```

## Test Examples

### 1. CryptoUtil Tests (`services/crypto.util.test.ts`)
- Tests encryption/decryption functionality
- Validates data integrity through round-trip operations
- Tests error handling for invalid inputs
- Verifies key management behavior

### 2. Rate Limiting Middleware Tests (`middleware/rate-limiting.middleware.test.ts`)
- Tests rate limiting logic and thresholds
- Validates header generation
- Tests error handling and edge cases
- Verifies different IP address handling

## Testing Guidelines

### Mocking Strategy
- Mock external dependencies (database, cache, APIs)
- Use Jest mocks for consistent behavior
- Reset mocks between tests for isolation

### Test Structure
- Use `describe` blocks to group related tests
- Use `it` blocks for individual test cases
- Follow AAA pattern: Arrange, Act, Assert

### Assertions
- Use specific assertions (`toBe`, `toEqual`, `toHaveBeenCalledWith`)
- Test both success and error scenarios
- Verify side effects and state changes

### Coverage Goals
- Aim for 80%+ code coverage on critical paths
- Focus on business logic and error handling
- Don't test implementation details

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clarity**: Test names should describe the behavior being tested
3. **Completeness**: Test both happy path and error scenarios
4. **Performance**: Keep tests fast and focused
5. **Maintainability**: Use helper functions for common setup

## Common Patterns

### Service Testing
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: jest.Mocked<DependencyType>;

  beforeEach(() => {
    mockDependency = new DependencyType() as jest.Mocked<DependencyType>;
    service = new ServiceName(mockDependency);
  });

  it('should perform expected behavior', async () => {
    // Arrange
    mockDependency.method.mockResolvedValue(expectedValue);

    // Act
    const result = await service.method();

    // Assert
    expect(result).toEqual(expectedValue);
    expect(mockDependency.method).toHaveBeenCalledWith(expectedArgs);
  });
});
```

### Middleware Testing
```typescript
describe('MiddlewareName', () => {
  let middleware: (req: Request, res: Response, next: NextFunction) => void;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = createMiddleware();
    mockRequest = { /* test data */ };
    mockResponse = { /* test data */ };
    mockNext = jest.fn();
  });

  it('should handle request correctly', () => {
    middleware(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(expectedStatus);
  });
});
```
