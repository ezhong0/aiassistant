# Custom ESLint Rules for Error Handling

This directory contains custom ESLint rules to enforce consistent error handling patterns using the ErrorFactory system.

## Rules

### `no-raw-error-throw`

Prevents throwing raw `Error` objects and enforces the use of `ErrorFactory` for consistent error handling.

**❌ Bad:**
```typescript
throw new Error('Service unavailable');
throw new TypeError('Invalid input');
throw Error('Something went wrong');
```

**✅ Good:**
```typescript
throw ErrorFactory.domain.serviceUnavailable('my-service');
throw ErrorFactory.validation.invalidInput('field', value);
throw ErrorFactory.api.badRequest('Invalid request');
```

## Configuration

The rule is configured in `eslint.config.js`:

```javascript
'custom-error-handling/no-raw-error-throw': ['error', {
  allowedFiles: [
    '**/errors/**',      // Error system files
    '**/types/**',       // Type definitions
    '**/*.test.ts',      // Test files
    '**/scripts/**',     // Build/utility scripts
  ],
}]
```

## Intelligent Suggestions

The rule analyzes error messages and suggests appropriate ErrorFactory methods:

| Error Message Contains | Suggested Method |
|------------------------|------------------|
| `unauthorized`, `authentication` | `ErrorFactory.api.unauthorized()` |
| `forbidden`, `permission` | `ErrorFactory.api.forbidden()` |
| `not found` | `ErrorFactory.api.notFound()` |
| `rate limit` | `ErrorFactory.api.rateLimited()` |
| `service unavailable` | `ErrorFactory.domain.serviceUnavailable()` |
| `timeout` | `ErrorFactory.domain.serviceTimeout()` |
| `validation`, `invalid` | `ErrorFactory.validation.fieldValidationFailed()` |
| `workflow`, `iteration` | `ErrorFactory.workflow.*()` |

## Usage

### Run linting on all files:
```bash
npm run lint
```

### Auto-fix issues (where possible):
```bash
npm run lint:fix
```

### Check specific file:
```bash
npx eslint src/services/my-service.ts
```

## Excluded Directories

The following directories are excluded from this rule:

- `errors/**` - Error system implementation
- `types/**` - Type definitions
- `*.test.ts`, `*.spec.ts` - Test files
- `scripts/**` - Build and utility scripts
- `dist/**`, `node_modules/**` - Build output and dependencies

## Examples

### Service Errors
```typescript
// ❌ Bad
throw new Error('Database service not available');

// ✅ Good
throw ErrorFactory.domain.serviceUnavailable('database', {
  operation: 'query',
  details: { query: 'SELECT * FROM users' }
});
```

### API Errors
```typescript
// ❌ Bad
throw new Error('User not authorized');

// ✅ Good
throw ErrorFactory.api.unauthorized('User authentication required');
```

### Validation Errors
```typescript
// ❌ Bad
throw new Error('Invalid email format');

// ✅ Good
throw ErrorFactory.validation.invalidInput('email', userEmail, 'valid email format');
```

## Benefits

1. **Consistency** - All errors follow the same pattern
2. **Type Safety** - TypeScript types for all error codes
3. **Context** - Errors include structured metadata
4. **Retryability** - Errors marked as retryable/non-retryable
5. **HTTP Status** - Automatic status code mapping
6. **Logging** - Better error tracking in Sentry/logs
7. **User Experience** - Consistent error messages

## Maintenance

To add new error detection patterns, edit `eslint-rules/no-raw-error-throw.js` and update the `suggestFactoryMethod()` function.
