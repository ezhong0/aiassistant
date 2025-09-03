# Contributing Guidelines

Guidelines for contributing to the Assistant App Backend project.

## Getting Started

### Prerequisites

1. **Development Environment:**
   - Node.js 18.x or higher
   - npm 8.x or higher
   - Git
   - Code editor (VS Code recommended)

2. **Project Setup:**
   ```bash
   # Fork and clone the repository
   git clone https://github.com/your-username/assistantapp.git
   cd assistantapp/backend
   
   # Install dependencies
   npm install
   
   # Set up environment
   cp .env.example .env
   # Edit .env with your configuration
   
   # Run tests to verify setup
   npm test
   ```

3. **Development Tools:**
   - **ESLint** - Code linting
   - **Prettier** - Code formatting
   - **Husky** - Git hooks
   - **TypeScript** - Type checking

## Code Standards

### TypeScript Guidelines

```typescript
// ✅ Good: Use specific types
interface UserRequest {
  userId: string;
  email: string;
  preferences?: UserPreferences;
}

// ❌ Bad: Avoid 'any' type
interface UserRequest {
  data: any;
}

// ✅ Good: Use proper error handling
async function processUser(userId: string): Promise<UserResult> {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  try {
    return await userService.getUser(userId);
  } catch (error) {
    logger.error('Failed to process user', { userId, error });
    throw error;
  }
}

// ✅ Good: Use JSDoc for public APIs
/**
 * Processes a user request and returns formatted result
 * @param userId - Unique user identifier
 * @param options - Processing options
 * @returns Promise resolving to processed user data
 * @throws {ValidationError} When userId is invalid
 */
export async function processUserRequest(
  userId: string, 
  options: ProcessOptions = {}
): Promise<UserResult> {
  // Implementation
}
```

### Code Style

- **Naming Conventions:**
  - Use `camelCase` for variables and functions
  - Use `PascalCase` for classes and interfaces
  - Use `UPPER_SNAKE_CASE` for constants
  - Use descriptive names that explain intent

- **File Organization:**
  - One class/interface per file
  - Group related functions in modules
  - Use index.ts for barrel exports
  - Keep files under 300 lines when possible

- **Import/Export:**
  ```typescript
  // ✅ Good: Use explicit imports
  import { UserService, DatabaseService } from '../services';
  import { Logger } from 'winston';
  
  // ✅ Good: Use named exports
  export class EmailAgent extends BaseAgent {
    // Implementation
  }
  
  export const EMAIL_CONFIG = {
    timeout: 30000
  };
  
  // ❌ Bad: Avoid default exports for most cases
  export default class EmailAgent {
    // Implementation
  }
  ```

### Error Handling

```typescript
// ✅ Good: Create typed errors with context
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ✅ Good: Use error codes and structured data
throw new ValidationError(
  'Email address is required',
  'email',
  providedEmail
);

// ✅ Good: Log errors with context
try {
  await processEmail(params);
} catch (error) {
  logger.error('Email processing failed', {
    userId: params.userId,
    operation: 'send',
    error: error.message,
    stack: error.stack
  });
  throw error;
}
```

### Testing Standards

```typescript
// ✅ Good: Descriptive test names
describe('EmailAgent', () => {
  describe('when sending emails', () => {
    it('should successfully send email with valid parameters', async () => {
      // Arrange
      const params = {
        to: 'user@example.com',
        subject: 'Test Email',
        body: 'Test content'
      };
      
      // Act
      const result = await emailAgent.execute(params, mockContext);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.result.messageId).toBeDefined();
    });
    
    it('should reject emails with invalid recipient format', async () => {
      const params = {
        to: 'invalid-email',
        subject: 'Test',
        body: 'Content'
      };
      
      const result = await emailAgent.execute(params, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email format');
    });
  });
});

// ✅ Good: Use proper mocking
const mockGmailService = {
  users: {
    messages: {
      send: jest.fn().mockResolvedValue({
        data: { id: 'test-message-id' }
      })
    }
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});
```

## Development Workflow

### 1. Branch Management

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Create bug fix branch
git checkout -b fix/issue-description

# Create documentation branch
git checkout -b docs/update-api-docs
```

### 2. Making Changes

```bash
# Make your changes
# Write tests for new functionality
# Ensure existing tests pass

# Run quality checks
npm run lint           # Check code style
npm run typecheck      # Verify TypeScript
npm test              # Run test suite
npm run format        # Format code
```

### 3. Commit Standards

Use conventional commits format:

```bash
# Format: type(scope): description
git commit -m "feat(agents): add weather agent with OpenWeatherMap integration"
git commit -m "fix(auth): resolve JWT token expiration handling"
git commit -m "docs(api): update authentication endpoint documentation"
git commit -m "test(email): add unit tests for email validation"
git commit -m "refactor(services): extract common database operations"
```

**Commit Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `test` - Test additions or changes
- `refactor` - Code refactoring
- `style` - Code style changes (formatting, etc.)
- `chore` - Maintenance tasks

### 4. Pull Request Process

1. **Before Creating PR:**
   ```bash
   # Ensure branch is up to date
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   
   # Run full test suite
   npm run lint
   npm run typecheck
   npm test
   ```

2. **Create Pull Request:**
   - Use descriptive title
   - Include detailed description
   - Reference related issues
   - Add screenshots if UI changes
   - List breaking changes if any

3. **PR Template:**
   ```markdown
   ## Description
   Brief description of changes made.
   
   ## Type of Change
   - [ ] Bug fix (non-breaking change which fixes an issue)
   - [ ] New feature (non-breaking change which adds functionality)
   - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   
   ## Screenshots
   If applicable, add screenshots to help explain your changes.
   
   ## Additional Notes
   Any additional information, configuration changes, or migration notes.
   ```

## Code Review Guidelines

### For Authors

- **Keep PRs Small:** Aim for < 400 lines of changes
- **Self-Review First:** Review your own PR before requesting review
- **Write Good Descriptions:** Explain what, why, and how
- **Respond Promptly:** Address feedback quickly
- **Test Thoroughly:** Include comprehensive tests

### For Reviewers

- **Be Constructive:** Provide helpful suggestions, not just criticism
- **Focus on Important Issues:** Don't nitpick minor style issues
- **Ask Questions:** If something is unclear, ask for clarification
- **Approve When Ready:** Don't hold up good code for minor improvements
- **Consider Performance:** Review for potential performance impacts

### Review Checklist

- [ ] Code follows project conventions
- [ ] Adequate test coverage
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Documentation updated if needed
- [ ] Breaking changes properly marked
- [ ] Error handling appropriate
- [ ] Logging added where needed

## Adding New Features

### 1. Creating New Agents

```typescript
// 1. Create agent class
export class WeatherAgent extends BaseAgent<WeatherParams, WeatherResult> {
  constructor() {
    super({
      name: 'weatherAgent',
      description: 'Provides weather information',
      enabled: true,
      timeout: 15000,
      retryCount: 2
    });
  }
  
  protected async processQuery(params: WeatherParams, context: ToolExecutionContext): Promise<WeatherResult> {
    // Implementation
  }
}

// 2. Register with AgentFactory
AgentFactory.registerAgentClass('weatherAgent', WeatherAgent);

// 3. Add to type definitions
export interface WeatherParams {
  location: string;
  units?: 'metric' | 'imperial';
}

export interface WeatherResult {
  temperature: number;
  condition: string;
  forecast: string;
}

// 4. Write tests
describe('WeatherAgent', () => {
  // Comprehensive test suite
});
```

### 2. Adding New Services

```typescript
// 1. Create service class extending BaseService
export class WeatherService extends BaseService {
  constructor() {
    super('WeatherService');
  }
  
  protected async onInitialize(): Promise<void> {
    // Service initialization
  }
  
  protected async onDestroy(): Promise<void> {
    // Cleanup
  }
}

// 2. Register with ServiceManager
serviceManager.registerService('weatherService', new WeatherService(), {
  dependencies: ['configService'],
  priority: 100
});
```

### 3. Adding New API Endpoints

```typescript
// 1. Add route handler
router.post('/weather', 
  authenticateToken,
  userRateLimit(20, 15 * 60 * 1000),
  validate({ body: weatherRequestSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    // Implementation
  }
);

// 2. Add validation schema
const weatherRequestSchema = z.object({
  location: z.string().min(1, 'Location is required'),
  units: z.enum(['metric', 'imperial']).optional()
});

// 3. Add tests
describe('Weather API', () => {
  // API integration tests
});

// 4. Update documentation
```

## Documentation Standards

### Code Documentation

```typescript
/**
 * Processes weather requests and returns formatted weather data
 * 
 * @param location - Geographic location for weather query
 * @param options - Configuration options for the request
 * @param options.units - Temperature units (metric or imperial)
 * @param options.includeHourly - Whether to include hourly forecast
 * @returns Promise resolving to weather data
 * @throws {ValidationError} When location format is invalid
 * @throws {ApiError} When weather service is unavailable
 * 
 * @example
 * ```typescript
 * const weather = await getWeatherData('New York', { 
 *   units: 'metric',
 *   includeHourly: true 
 * });
 * console.log(`Temperature: ${weather.temperature}°C`);
 * ```
 */
export async function getWeatherData(
  location: string,
  options: WeatherOptions = {}
): Promise<WeatherData> {
  // Implementation
}
```

### API Documentation

When adding new endpoints, update the [API Reference](./api-reference.md):

```markdown
### `POST /api/weather`

Get weather information for a location.

**Authentication:** Required

**Request Body:**
```json
{
  "location": "New York, NY",
  "units": "metric"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "temperature": 22,
    "condition": "sunny",
    "forecast": "Clear skies expected"
  }
}
```
```

## Testing Contributions

### Writing Tests

```typescript
// Unit test example
describe('WeatherService', () => {
  let weatherService: WeatherService;
  
  beforeEach(() => {
    weatherService = new WeatherService();
  });
  
  describe('getWeather', () => {
    it('should return weather data for valid location', async () => {
      const mockResponse = { temp: 22, condition: 'sunny' };
      jest.spyOn(weatherService, 'fetchWeatherData').mockResolvedValue(mockResponse);
      
      const result = await weatherService.getWeather('New York');
      
      expect(result).toEqual(expect.objectContaining({
        temperature: 22,
        condition: 'sunny'
      }));
    });
  });
});

// Integration test example
describe('Weather API Integration', () => {
  it('should return weather data from API endpoint', async () => {
    const response = await request(app)
      .post('/api/weather')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ location: 'New York' })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('temperature');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- weather.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run integration tests
npm run test:integration
```

## Performance Guidelines

### Best Practices

1. **Async/Await:** Use proper async patterns
```typescript
// ✅ Good: Parallel execution when possible
const [user, permissions, preferences] = await Promise.all([
  userService.getUser(userId),
  authService.getUserPermissions(userId),
  userService.getPreferences(userId)
]);

// ❌ Bad: Sequential when parallel is possible
const user = await userService.getUser(userId);
const permissions = await authService.getUserPermissions(userId);
const preferences = await userService.getPreferences(userId);
```

2. **Database Queries:** Optimize queries
```typescript
// ✅ Good: Use connection pooling
const client = await this.getClient();
try {
  const result = await client.query(sql, params);
  return result.rows;
} finally {
  client.release();
}

// ✅ Good: Use prepared statements
const result = await client.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

3. **Memory Management:** Avoid memory leaks
```typescript
// ✅ Good: Clean up resources
export class ServiceWithTimer {
  private timer: NodeJS.Timer | null = null;
  
  start() {
    this.timer = setInterval(() => {
      // Work
    }, 1000);
  }
  
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
```

## Security Considerations

### Input Validation

```typescript
// ✅ Good: Validate all inputs
const userInput = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
  preferences: z.object({
    newsletter: z.boolean(),
    language: z.enum(['en', 'es', 'fr'])
  }).optional()
}).parse(req.body);
```

### Secrets Management

```typescript
// ✅ Good: Never log sensitive data
logger.info('User authenticated', {
  userId: user.id,
  email: user.email,
  // Never log: password, tokens, etc.
});

// ✅ Good: Sanitize for logging
protected sanitizeForLogging(params: any): any {
  return {
    ...params,
    password: '[REDACTED]',
    accessToken: params.accessToken ? '[PRESENT]' : undefined,
    apiKey: '[REDACTED]'
  };
}
```

### SQL Injection Prevention

```typescript
// ✅ Good: Use parameterized queries
const users = await client.query(
  'SELECT * FROM users WHERE name = $1 AND status = $2',
  [userName, 'active']
);

// ❌ Bad: String concatenation
const users = await client.query(
  `SELECT * FROM users WHERE name = '${userName}'`
);
```

## Release Process

### Version Management

We use semantic versioning (semver):
- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

### Pre-release Checklist

- [ ] All tests passing
- [ ] Code coverage maintained
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migration scripts prepared (if needed)
- [ ] Performance regression tests
- [ ] Security review completed

## Getting Help

### Resources

- **Documentation:** [docs/](./README.md)
- **Architecture:** [architecture.md](./architecture.md)
- **API Reference:** [api-reference.md](./api-reference.md)
- **Troubleshooting:** [troubleshooting.md](./troubleshooting.md)

### Support Channels

- **GitHub Issues:** For bugs and feature requests
- **GitHub Discussions:** For questions and general discussion
- **Code Review:** For technical guidance during development

### Common Questions

**Q: How do I add a new external API integration?**
A: See the Agent Development guide and follow the patterns used by existing agents like EmailAgent or TavilyAgent.

**Q: How do I handle database migrations?**
A: Database schema changes should be made in the `initializeSchema()` method of DatabaseService. For production, create migration scripts.

**Q: How do I add new configuration options?**
A: Add to the Zod schema in `config.service.ts` and corresponding environment variables.

Thank you for contributing to the Assistant App Backend! 🚀