# Linting System Documentation

## Overview

This project uses a comprehensive linting system that enforces:
- **Error Handling**: Consistent error patterns using ErrorFactory
- **Security**: Prevention of dangerous code patterns
- **Architecture**: Enforcement of service patterns and layer boundaries
- **Performance**: Detection of performance anti-patterns
- **Code Quality**: Maintainability standards
- **TypeScript**: Strict type safety

## Quick Start

```bash
# Run linting on all TypeScript files
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Development mode (relaxed rules)
npm run lint:dev

# Strict mode (all warnings as errors)
npm run lint:strict
```

## Custom Rules

### 1. Error Handling Rules

#### `no-raw-error-throw`
Enforces use of ErrorFactory instead of throwing raw Error objects.

**❌ Bad:**
```typescript
throw new Error('Service failed');
throw new TypeError('Invalid type');
```

**✅ Good:**
```typescript
throw ErrorFactory.domain.serviceError('myService', 'Service failed');
throw ErrorFactory.validation.invalidInput('field', value);
```

**Exceptions**: Allowed in:
- `**/errors/**` - Error system files
- `**/*.test.ts` - Test files
- `**/scripts/**` - Utility scripts

---

### 2. Security Rules

#### `no-dangerous-code`
Prevents dangerous code patterns that pose security risks.

**Detects:**
- `eval()` usage
- `new Function()` with strings
- `setTimeout/setInterval` with string arguments
- `process.exit()` outside main entry points
- Hardcoded secrets
- Deprecated `new Buffer()`

**❌ Bad:**
```typescript
eval(userInput);
new Function('return ' + code)();
setTimeout('doSomething()', 1000);
const apiKey = 'hardcoded_secret_123';
```

**✅ Good:**
```typescript
// Use proper parsing
JSON.parse(userInput);
// Use regular functions
setTimeout(() => doSomething(), 1000);
// Use environment variables
const apiKey = process.env.API_KEY;
```

#### `no-console-production`
Warns about console statements in production code. Use logger instead.

**❌ Bad:**
```typescript
console.log('User logged in');
console.error('Error occurred');
```

**✅ Good:**
```typescript
logger.info('User logged in');
logger.error('Error occurred');
```

---

### 3. Architecture Rules

#### `enforce-base-service`
Ensures all services extend BaseService for consistent lifecycle management.

**✅ Required Pattern:**
```typescript
export class MyService extends BaseService {
  constructor() {
    super('myService');
  }

  protected async onInitialize(): Promise<void> {
    // Initialization logic
  }

  protected async onDestroy(): Promise<void> {
    // Cleanup logic
  }
}
```

#### `enforce-layer-boundaries`
Prevents improper imports between architectural layers.

**Layer Rules:**
- **Routes**: Can import middleware, utils, types, errors, schemas, di
- **Routes**: Cannot import services or agents directly (use DI)
- **Services**: Can import utils, types, errors, schemas
- **Services**: Cannot import routes or middleware
- **Agents**: Can import utils, types, errors, schemas
- **Agents**: Cannot import services directly (use DI)

**❌ Bad:**
```typescript
// In a route
import { EmailService } from '../services/email.service';

// In an agent
import { CalendarDomainService } from '../services/domain/calendar-domain.service';
```

**✅ Good:**
```typescript
// In a route - use dependency injection
const container = await ServiceManager.getContainer();
const emailService = container.resolve<EmailService>('emailService');

// In an agent - services passed via constructor/DI
constructor(private calendarService: CalendarDomainService) {}
```

#### `enforce-dependency-injection`
Enforces using the DI container instead of direct service instantiation.

**❌ Bad:**
```typescript
const service = new EmailService();
```

**✅ Good:**
```typescript
// Register in DI container
container.register({
  emailService: asClass(EmailService).singleton(),
});

// Resolve from container
const service = container.resolve<EmailService>('emailService');
```

---

### 4. Performance Rules

#### `no-performance-antipatterns`
Detects common performance issues.

**Detects:**
- Floating promises (unhandled promises)
- Synchronous operations in async contexts
- Inefficient loop patterns

**❌ Bad:**
```typescript
async function process() {
  doAsyncOperation(); // Floating promise
  fs.readFileSync('file.txt'); // Sync in async
}

// Inefficient loop
for (let i = 0; i < array.length; i++) {
  result.push(transform(array[i]));
}
```

**✅ Good:**
```typescript
async function process() {
  await doAsyncOperation();
  await fs.promises.readFile('file.txt');
}

// Efficient
const result = array.map(transform);
```

---

### 5. Code Quality Rules

#### `enforce-code-quality`
Enforces maintainability standards.

**Limits:**
- **Cyclomatic Complexity**: Max 10
- **Function Length**: Max 50 lines
- **Parameters**: Max 4
- **Nesting Depth**: Max 4 levels
- **Method Chaining**: Max 3 calls

**Configuration:**
```javascript
{
  maxComplexity: 10,
  maxLines: 50,
  maxParams: 4,
  maxDepth: 4,
  maxChained: 3,
  allowedNumbers: [0, 1, -1, 2, 100, 1000],
}
```

**Example - Too Complex:**
```typescript
// ❌ Complexity: 15
function processData(data: Data) {
  if (data.type === 'A') {
    if (data.status === 'active') {
      if (data.priority === 'high') {
        // ... more nested conditions
      }
    }
  }
}
```

**✅ Better:**
```typescript
// Break down into smaller functions
function processData(data: Data) {
  if (!isValidData(data)) return;
  const processor = getProcessor(data.type);
  return processor.process(data);
}
```

---

## TypeScript Rules

### Strict Type Safety

- **`@typescript-eslint/no-explicit-any`**: Error on `any` usage
- **`@typescript-eslint/no-floating-promises`**: Require handling promises
- **`@typescript-eslint/await-thenable`**: Only await promises
- **`@typescript-eslint/prefer-nullish-coalescing`**: Use `??` over `||`
- **`@typescript-eslint/prefer-optional-chain`**: Use optional chaining

---

## Running Specific Checks

### Check Specific Categories

```bash
# Check error handling only
npm run lint:errors

# Check security only
npm run lint:security

# Check architecture only
npm run lint:architecture

# Check performance only
npm run lint:performance
```

### Environment-Specific Configs

**Development** (`.eslintrc.dev.js`):
- Relaxed code quality rules
- Warnings for architecture violations
- Errors for critical issues

**Production** (`eslint.config.strict.js`):
- All warnings as errors
- Maximum strictness
- Use for CI/CD pipelines

---

## Integration with Tools

### Pre-commit Hooks

Already configured via `lint-staged`:
```json
{
  "*.ts": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

### VS Code Settings

Add to `.vscode/settings.json`:
```json
{
  "eslint.enable": true,
  "eslint.validate": ["typescript"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### CI/CD Integration

```yaml
# In your CI pipeline
- name: Lint
  run: npm run lint:strict
```

---

## Fixing Common Issues

### Issue: Agent importing service directly

**Error:**
```
Invalid cross-layer import: agents cannot import from services
```

**Fix:**
Use dependency injection through constructor:
```typescript
// ❌ Before
import { EmailService } from '../services/email.service';

// ✅ After
export class EmailAgent {
  constructor(
    private emailService: IEmailService // Injected via DI
  ) {}
}
```

### Issue: Raw error throw

**Error:**
```
Use ErrorFactory.domain.serviceError() instead of throwing Error
```

**Fix:**
```typescript
// ❌ Before
throw new Error('Service failed');

// ✅ After
throw ErrorFactory.domain.serviceError(
  'myService',
  'Service failed',
  { context: 'additional info' }
);
```

### Issue: Console in production

**Error:**
```
Avoid console.log() in production code. Use logger.info() instead
```

**Fix:**
```typescript
// ❌ Before
console.log('Processing request');

// ✅ After
logger.info('Processing request', { userId });
```

### Issue: Floating promise

**Error:**
```
Promise returned from doAsync is not handled
```

**Fix:**
```typescript
// ❌ Before
doAsyncOperation();

// ✅ After
await doAsyncOperation();
// Or
doAsyncOperation().catch(error => logger.error(error));
```

### Issue: Magic number

**Error:**
```
Magic number 5000 detected. Use a named constant instead
```

**Fix:**
```typescript
// ❌ Before
setTimeout(callback, 5000);

// ✅ After
const TIMEOUT_MS = 5000;
setTimeout(callback, TIMEOUT_MS);
```

---

## Rule Configuration

### Disabling Rules

**For a single line:**
```typescript
// eslint-disable-next-line custom-rules/no-raw-error-throw
throw new Error('Special case');
```

**For a file:**
```typescript
/* eslint-disable custom-rules/enforce-base-service */
// File content
/* eslint-enable custom-rules/enforce-base-service */
```

**For a block:**
```typescript
/* eslint-disable custom-rules/enforce-code-quality */
function legacyCode() {
  // Complex legacy code
}
/* eslint-enable custom-rules/enforce-code-quality */
```

⚠️ **Warning**: Only disable rules when absolutely necessary and document why.

---

## Best Practices

1. **Fix errors before warnings**: Focus on `error` level issues first
2. **Use auto-fix**: Run `npm run lint:fix` to fix many issues automatically
3. **Check incrementally**: Use specific lint commands during development
4. **Review violations**: Don't blindly disable rules - understand why they exist
5. **Document exceptions**: When disabling rules, add comments explaining why
6. **Run in CI**: Always run `npm run lint:strict` in your CI pipeline
7. **Educate team**: Share this documentation with your team

---

## Architecture Rationale

### Why These Rules?

1. **Error Handling**: Consistent errors make debugging easier and enable better monitoring
2. **Security**: Prevents common vulnerabilities and code injection attacks
3. **Architecture**: Enforces separation of concerns and maintainability
4. **Performance**: Catches issues before they reach production
5. **Code Quality**: Keeps codebase maintainable as it grows

### Trade-offs

- **Development Speed**: Stricter rules may slow initial development
- **Learning Curve**: Team needs to learn patterns
- **Benefits**: Fewer bugs, easier maintenance, better code quality

---

## Troubleshooting

### Linter not running?
```bash
# Clear ESLint cache
rm -rf node_modules/.cache/eslint
npm run lint
```

### Rules not being applied?
1. Check `eslint.config.js` is being used
2. Verify custom rules are in `eslint-rules/`
3. Run `npm run lint -- --debug` for details

### Too many errors?
1. Start with `npm run lint:dev` (relaxed rules)
2. Fix critical errors first
3. Gradually enable stricter rules
4. Use `npm run lint:fix` for auto-fixes

---

## Contributing

### Adding New Rules

1. Create rule in `eslint-rules/my-new-rule.js`
2. Export from `eslint-rules/index.js`
3. Add to `eslint.config.js`
4. Document in this file
5. Test thoroughly

### Modifying Rules

1. Understand impact on existing code
2. Discuss with team
3. Update documentation
4. Consider gradual rollout (warn → error)

---

## Support

For issues or questions:
1. Check this documentation
2. Review error messages (they include helpful suggestions)
3. Check existing code for examples
4. Ask team members

---

## Summary

This linting system ensures:
- ✅ Consistent error handling
- ✅ Secure code practices
- ✅ Proper architecture adherence
- ✅ Good performance patterns
- ✅ Maintainable code quality
- ✅ Type safety

**Remember**: Linting rules are here to help, not hinder. They catch issues early and enforce best practices. When in doubt, follow the error messages - they include helpful suggestions!
