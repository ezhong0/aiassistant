# 🚀 Development Workflow - AI Development Guide

## 🎯 **Development Vision**

This document establishes the **development workflow and guidelines** for AI-assisted development. The system follows the Strategic Framework principles of architecture-first development, continuous validation, and proactive quality management.

## 🏗️ **Development Architecture**

### **Development Workflow Overview**
```
Feature Request → Architecture Review → Implementation → Testing → Validation → Deployment
      ↓                ↓                ↓            ↓         ↓           ↓
   User Story    Architectural      AI-Assisted   Unit +    Quality     Production
   Definition    Boundaries        Development    Integration Gates    Release
```

### **Core Development Principles**
1. **Architecture-First**: Establish boundaries before implementation
2. **AI-Assisted Implementation**: Use AI within established patterns
3. **Continuous Validation**: Quality gates at every step
4. **Pattern Consistency**: Follow established interfaces and contracts
5. **Comprehensive Testing**: Validate both functionality and architecture

## 🔧 **Development Environment Setup**

### **Prerequisites**
```bash
# Required software
- Node.js 18+ and npm
- TypeScript 5.0+
- Xcode 15+ (for iOS development)
- Git with proper configuration
- VS Code or Cursor (recommended for AI development)
```

### **Environment Configuration**
```bash
# 1. Clone and setup
git clone <repository-url>
cd assistantapp

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment variables
cp ../.env.example .env
# Edit .env with your credentials

# 4. Install iOS dependencies
cd ../ios
open AssistantApp.xcodeproj
# Configure GoogleService-Info.plist
```

### **Development Scripts**
```bash
# Backend development
npm run dev          # Development server with hot reload
npm run build        # TypeScript compilation
npm run lint         # ESLint code quality check
npm run format       # Prettier code formatting
npm run test         # Run all tests
npm run test:watch   # Watch mode for tests

# iOS development
# Build: ⌘+B
# Run: ⌘+R
# Clean: ⌘+Shift+K
```

## 📋 **Feature Development Workflow**

### **1. Feature Planning Phase**

#### **Architecture Impact Analysis**
Before implementing any feature, conduct an architecture review:

```typescript
// Feature: Add Calendar Integration
const architectureImpact = {
  newComponents: [
    'CalendarAgent',
    'CalendarService', 
    'Calendar types and interfaces'
  ],
  existingComponentsToModify: [
    'MasterAgent (routing logic)',
    'AgentFactory (registration)',
    'Service initialization'
  ],
  interfaceChanges: [
    'Add calendar operations to ToolCall interface',
    'Extend ToolExecutionContext for calendar data'
  ],
  dataModelImpacts: [
    'Calendar event types',
    'Calendar context in sessions'
  ]
};
```

#### **Implementation Strategy**
```typescript
const implementationStrategy = {
  orderOfImplementation: [
    '1. Define calendar types and interfaces',
    '2. Implement CalendarService with Google Calendar API',
    '3. Create CalendarAgent extending BaseAgent',
    '4. Register with AgentFactory',
    '5. Update MasterAgent routing logic',
    '6. Add comprehensive tests'
  ],
  integrationPoints: [
    'Google Calendar API integration',
    'Agent routing system',
    'Service registry',
    'Session context management'
  ],
  testingStrategy: [
    'Unit tests for CalendarService',
    'Integration tests for CalendarAgent',
    'AI behavior tests for routing',
    'End-to-end calendar workflows'
  ]
};
```

### **2. Implementation Phase**

#### **AI-Assisted Development Pattern**
Use this pattern for AI collaboration:

```typescript
// Instead of: "Implement calendar integration"
// Use: "Given our existing architecture using BaseAgent pattern, implement calendar integration that:
// - Follows our established error handling patterns in BaseAgent
// - Integrates with our existing service registry system
// - Maintains separation of concerns between agent and service layers
// - Uses our established validation patterns from BaseAgent
// - Includes comprehensive tests following our testing conventions
// - Follows the IService interface for CalendarService
// - Registers properly with AgentFactory for discovery"
```

#### **Code Implementation Guidelines**
```typescript
// 1. Follow established patterns
export class CalendarAgent extends BaseAgent<CalendarAgentRequest, CalendarResult> {
  constructor() {
    super({
      name: 'calendarAgent',
      description: 'Create, update, and manage calendar events',
      enabled: true,
      timeout: 20000,
      retryCount: 2
    });
  }
  
  // 2. Implement required abstract methods
  protected async processQuery(params: CalendarAgentRequest, context: ToolExecutionContext): Promise<CalendarResult> {
    // Implementation follows established patterns
  }
  
  // 3. Use established error handling
  protected validateParams(params: CalendarAgentRequest): void {
    super.validateParams(params);
    
    if (!params.accessToken) {
      throw this.createError('Access token is required', 'MISSING_ACCESS_TOKEN');
    }
  }
}

// 4. Follow service interface contract
export class CalendarService implements IService {
  readonly name = 'calendarService';
  private state: ServiceState = ServiceState.INITIALIZING;
  
  async initialize(): Promise<void> {
    // Follow established initialization pattern
  }
  
  getHealth(): { healthy: boolean; details?: any } {
    // Provide health status
  }
}
```

### **3. Testing Phase**

#### **Testing Requirements**
Every feature must include:

```typescript
// 1. Unit Tests
describe('CalendarAgent', () => {
  it('should create calendar event with valid parameters', async () => {
    // Test individual agent functionality
  });
  
  it('should handle invalid access token gracefully', async () => {
    // Test error handling
  });
});

// 2. Integration Tests
describe('Calendar Integration', () => {
  it('should complete calendar workflow end-to-end', async () => {
    // Test service interactions
  });
});

// 3. AI Behavior Tests
describe('Calendar Agent Routing', () => {
  it('should route calendar requests to calendarAgent', async () => {
    // Test agent routing logic
  });
});
```

#### **Test Coverage Requirements**
- **Minimum Coverage**: 80% for new code
- **Critical Paths**: 100% coverage for authentication, routing, and data operations
- **Error Scenarios**: Comprehensive error handling tests
- **Integration Points**: Service interaction validation

## 🔍 **Code Quality Management**

### **1. Linting and Formatting**

#### **ESLint Configuration**
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    // Enforce architectural boundaries
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../services/*'],
            message: 'Services should be accessed through ServiceManager'
          },
          {
            group: ['../agents/*'],
            message: 'Agents should be accessed through AgentFactory'
          }
        ]
      }
    ],
    
    // Enforce consistent patterns
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-readonly': 'error'
  }
};
```

#### **Prettier Configuration**
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### **2. Type Safety**

#### **TypeScript Configuration**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

#### **Type Definition Requirements**
```typescript
// All public interfaces must be explicitly typed
export interface CalendarAgentRequest {
  query: string;
  accessToken: string;
  eventDetails?: CalendarEventDetails;
}

export interface CalendarResult {
  success: boolean;
  eventId?: string;
  error?: string;
  executionTime: number;
}

// Use branded types for critical identifiers
export type SessionId = string & { readonly __brand: 'SessionId' };
export type UserId = string & { readonly __brand: 'UserId' };
```

### **3. Error Handling Standards**

#### **Error Hierarchy**
```typescript
// All errors must extend BaseError
export class CalendarServiceError extends BaseError {
  constructor(message: string, cause?: Error) {
    super(message, 'CALENDAR_SERVICE_ERROR', 500, { cause });
  }
}

// Use specific error types
export class CalendarValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'CALENDAR_VALIDATION_ERROR', 400, details);
  }
}
```

#### **Error Handling Patterns**
```typescript
// Consistent error handling in all services
try {
  const result = await this.performCalendarOperation(params);
  return result;
} catch (error) {
  // Log with context
  this.logger.error('Calendar operation failed', {
    operation: 'createEvent',
    params: this.sanitizeForLogging(params),
    error: error instanceof Error ? error.message : 'Unknown error',
    sessionId: context.sessionId
  });
  
  // Re-throw with proper error type
  throw new CalendarServiceError('Failed to create calendar event', error as Error);
}
```

## 🧪 **Testing Strategy**

### **1. Test Structure**

#### **Test Organization**
```
tests/
├── unit/                    # Unit tests for individual components
│   ├── agents/             # Agent unit tests
│   ├── services/           # Service unit tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests for service interactions
├── ai-behavior/           # AI behavior validation tests
│   ├── context-continuity/    # Conversation context tests
│   ├── decision-quality/      # Agent decision validation
│   ├── error-recovery/        # Error handling tests
│   ├── intent-recognition/    # Intent understanding tests
│   └── workflow-validation/   # Multi-agent workflow tests
└── fixtures/               # Test data and mocks
```

#### **Test Naming Conventions**
```typescript
// Use descriptive test names that explain the scenario
describe('CalendarAgent', () => {
  describe('when creating a new calendar event', () => {
    it('should successfully create event with valid parameters', async () => {
      // Test implementation
    });
    
    it('should reject event creation with invalid date format', async () => {
      // Test implementation
    });
  });
  
  describe('when handling authentication errors', () => {
    it('should return proper error response for expired tokens', async () => {
      // Test implementation
    });
  });
});
```

### **2. Mocking Strategy**

#### **Service Mocking**
```typescript
// Create comprehensive mocks for external dependencies
export const createMockAuthService = (): jest.Mocked<AuthService> => ({
  validateAccessToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  exchangeMobileTokens: jest.fn(),
  name: 'authService',
  state: ServiceState.READY,
  initialize: jest.fn(),
  isReady: jest.fn(),
  destroy: jest.fn(),
  getHealth: jest.fn()
});

// Use mocks in tests
describe('CalendarService', () => {
  let calendarService: CalendarService;
  let mockAuthService: jest.Mocked<AuthService>;
  
  beforeEach(() => {
    mockAuthService = createMockAuthService();
    calendarService = new CalendarService(mockAuthService);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
});
```

#### **API Mocking**
```typescript
// Mock external APIs
jest.spyOn(google.calendar, 'v3').mockReturnValue({
  events: {
    insert: jest.fn().mockResolvedValue({
      data: { id: 'event123', htmlLink: 'https://calendar.google.com/event/123' }
    }),
    list: jest.fn().mockResolvedValue({
      data: { items: [] }
    })
  }
} as any);
```

### **3. Test Data Management**

#### **Test Fixtures**
```typescript
// Create reusable test data
export const createTestCalendarEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'test-event-123',
  summary: 'Test Meeting',
  description: 'Test meeting description',
  start: new Date('2024-01-15T10:00:00Z'),
  end: new Date('2024-01-15T11:00:00Z'),
  attendees: ['test@example.com'],
  ...overrides
});

export const createTestCalendarRequest = (overrides: Partial<CalendarAgentRequest> = {}): CalendarAgentRequest => ({
  query: 'Create a meeting tomorrow at 2pm',
  accessToken: 'test-access-token',
  ...overrides
});
```

## 🔄 **Continuous Integration**

### **1. Quality Gates**

#### **Pre-commit Hooks**
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:coverage"
    }
  },
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

#### **CI Pipeline Requirements**
```yaml
# .github/workflows/ci.yml
name: CI Pipeline
on: [push, pull_request]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type checking
        run: npm run typecheck
      
      - name: Linting
        run: npm run lint
      
      - name: Format checking
        run: npm run format:check
      
      - name: Unit tests
        run: npm run test:unit
      
      - name: Integration tests
        run: npm run test:integration
      
      - name: AI behavior tests
        run: npm run test:ai-behavior
      
      - name: Coverage report
        run: npm run test:coverage
```

### **2. Performance Monitoring**

#### **Performance Benchmarks**
```typescript
// Performance testing for critical paths
describe('Calendar Performance', () => {
  it('should create calendar event within 2 seconds', async () => {
    const startTime = Date.now();
    
    const result = await calendarAgent.execute(
      createTestCalendarRequest(),
      createTestContext()
    );
    
    const executionTime = Date.now() - startTime;
    expect(executionTime).toBeLessThan(2000); // 2 seconds
    expect(result.success).toBe(true);
  });
});
```

## 🔍 **Debugging and Troubleshooting**

### **1. Development Debugging**

#### **Structured Logging**
```typescript
// Use structured logging for debugging
logger.debug('Calendar operation started', {
  operation: 'createEvent',
  params: {
    summary: params.eventDetails?.summary,
    startTime: params.eventDetails?.start,
    attendees: params.eventDetails?.attendees?.length
  },
  sessionId: context.sessionId,
  userId: context.userId,
  timestamp: new Date().toISOString()
});
```

#### **Debug Endpoints**
```typescript
// Development-only debug endpoints
if (process.env.NODE_ENV === 'development') {
  app.get('/debug/services', (req, res) => {
    res.json({
      services: serviceManager.getHealthStatus(),
      agents: AgentFactory.getStats()
    });
  });
  
  app.get('/debug/sessions', (req, res) => {
    const sessionService = getService<SessionService>('sessionService');
    res.json({
      activeSessions: sessionService.getActiveSessions(),
      totalSessions: sessionService.getTotalSessions()
    });
  });
}
```

### **2. Production Monitoring**

#### **Health Check Endpoints**
```typescript
// Comprehensive health monitoring
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: configService.nodeEnv,
    services: await serviceManager.getHealthStatus(),
    agents: AgentFactory.getStats(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  };
  
  const isHealthy = health.services.every(service => service.healthy);
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## 🚀 **Deployment Workflow**

### **1. Environment Management**

#### **Environment Configuration**
```typescript
// Environment-based configuration
class ConfigService {
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }
  
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
  
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }
  
  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }
}
```

#### **Environment Variables**
```bash
# .env.example
NODE_ENV=development
PORT=3000

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# JWT
JWT_SECRET=your_jwt_secret

# Database (if applicable)
DATABASE_URL=your_database_url
```

### **2. Deployment Process**

#### **Production Deployment Checklist**
```markdown
## Pre-Deployment Checklist
- [ ] All tests passing (unit, integration, AI behavior)
- [ ] Code coverage above 80%
- [ ] Linting and formatting checks passed
- [ ] Type checking completed successfully
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Environment variables configured
- [ ] Database migrations ready (if applicable)

## Deployment Steps
1. Create release branch from main
2. Run full test suite
3. Update version in package.json
4. Create deployment package
5. Deploy to staging environment
6. Run integration tests in staging
7. Deploy to production
8. Monitor health endpoints
9. Verify functionality
10. Tag release in git
```

## 📚 **AI Development Best Practices**

### **1. AI Collaboration Guidelines**

#### **Context Management**
- **Reference Architecture**: Always reference `docs/ARCHITECTURE.md` for new features
- **Pattern Consistency**: Follow established patterns in existing code
- **Interface Contracts**: Respect established interfaces and contracts
- **Error Handling**: Use established error handling patterns

#### **AI Prompt Engineering**
```typescript
// Good AI prompt example
"Given our existing BaseAgent framework in backend/src/framework/base-agent.ts, 
implement a new WeatherAgent that:
- Extends BaseAgent with proper configuration
- Follows our established error handling patterns
- Integrates with our service registry system
- Includes comprehensive unit tests
- Follows our naming conventions
- Implements the IService interface properly"

// Bad AI prompt example
"Implement weather functionality"
```

### **2. Code Review Process**

#### **Review Checklist**
- [ ] **Architecture Compliance**: Follows established patterns
- [ ] **Type Safety**: Proper TypeScript usage
- [ ] **Error Handling**: Comprehensive error management
- [ ] **Testing**: Adequate test coverage
- [ ] **Documentation**: Code is self-documenting
- [ ] **Performance**: No obvious performance issues
- [ ] **Security**: No security vulnerabilities

#### **Review Guidelines**
```typescript
// Code review comments should reference architecture
// Instead of: "This could be better"
// Use: "This should follow our BaseAgent pattern from docs/ARCHITECTURE.md"

// Instead of: "Fix this error handling"
// Use: "Follow our error handling pattern from BaseAgent.createError()"
```

This development workflow ensures consistent, high-quality code while leveraging AI assistance effectively within established architectural boundaries.
