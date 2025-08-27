# 🏗️ System Architecture - AI Development Guide

## 🎯 **Architecture Vision**

This document establishes the **architectural boundaries** that AI development must respect. The system follows **Clean Architecture principles** with clear separation of concerns, dependency injection, and plugin-based extensibility.

## 🏗️ **System Architecture Overview**

### **High-Level Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Slack Client  │    │  Backend API    │    │ External APIs   │
│                 │    │                 │    │                 │
│ • SwiftUI       │◄──►│ • Express       │◄──►│ • Google APIs   │
│ • Speech        │    │ • TypeScript    │    │ • OpenAI API    │
│ • MVVM          │    │ • Middleware    │    │ • Tavily API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Multi-Agent     │
                       │ Orchestration   │
                       │                 │
                       │ • Master Agent  │
                       │ • Specialized   │
                       │   Agents        │
                       │ • Tool Executor │
                       └─────────────────┘
```

### **Core Architectural Layers**

#### **1. Presentation Layer (Slack)**
- **Responsibility**: User interface and interaction
- **Technology**: SwiftUI + MVVM pattern
- **Boundaries**: No business logic, only UI state management

#### **2. API Layer (Backend)**
- **Responsibility**: HTTP interface and request handling
- **Technology**: Express.js with TypeScript
- **Boundaries**: Request validation, routing, response formatting

#### **3. Business Logic Layer**
- **Responsibility**: Core application logic and workflows
- **Technology**: Service classes with dependency injection
- **Boundaries**: Business rules, external API integration

#### **4. Agent Layer**
- **Responsibility**: AI-powered task execution and routing
- **Technology**: Plugin-based agent system
- **Boundaries**: Tool execution, context management, workflow orchestration

## 🔧 **Core Components**

### **1. Service Registry & Dependency Injection**

#### **Service Manager Architecture**
```typescript
// Centralized service lifecycle management
export class ServiceManager {
  private services: Map<string, ServiceRegistration> = new Map();
  private serviceInstances: Map<string, IService> = new Map();
  
  // Dependency resolution and initialization
  async initializeAllServices(): Promise<void>
  
  // Service retrieval with type safety
  getService<T extends IService>(name: string): T | undefined
}
```

#### **Service Lifecycle States**
```typescript
export enum ServiceState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
  DESTROYED = 'destroyed'
}
```

#### **Dependency Injection Pattern**
```typescript
// Services declare their dependencies
serviceManager.registerService('gmailService', gmailService, {
  dependencies: ['authService'],  // Must initialize after authService
  priority: 50,                  // Lower number = higher priority
  autoStart: true                // Start automatically
});
```

### **2. Multi-Agent System**

#### **Agent Factory Architecture**
```typescript
export class AgentFactory {
  private static agents = new Map<string, BaseAgent>();
  private static toolMetadata = new Map<string, ToolMetadata>();
  
  // Plugin-based agent registration
  static registerAgentClass<TParams, TResult>(
    name: string, 
    AgentClass: new () => BaseAgent<TParams, TResult>
  ): void
  
  // Tool discovery and routing
  static findMatchingTools(userInput: string): ToolMetadata[]
}
```

#### **Base Agent Framework**
```typescript
export abstract class BaseAgent<TParams = any, TResult = any> {
  // Template method pattern for consistent execution
  async execute(params: TParams, context: ToolExecutionContext): Promise<ToolResult> {
    await this.beforeExecution(params, context);
    this.validateParams(params);
    const result = await this.processQuery(params, context);
    await this.afterExecution(result, context);
    return this.createSuccessResult(result, executionTime);
  }
  
  // Abstract methods for subclasses
  protected abstract processQuery(params: TParams, context: ToolExecutionContext): Promise<TResult>;
  
  // Optional hooks for customization
  protected async beforeExecution(params: TParams, context: ToolExecutionContext): Promise<void>
  protected async afterExecution(result: TResult, context: ToolExecutionContext): Promise<void>
}
```

#### **Agent Orchestration Flow**
```typescript
// Master Agent determines workflow
const toolCalls = [
  {
    name: 'contactAgent',
    parameters: { query: 'get contact information for John' }
  },
  {
    name: 'emailAgent', 
    parameters: { query: 'send email to John about quarterly review meeting' }
  },
  {
    name: 'Think',
    parameters: { query: 'Verify correct steps were taken' }
  }
];

// Tool Executor runs agents sequentially
const results = await toolExecutor.executeToolCalls(toolCalls, context);
```

### **3. Middleware Architecture**

#### **Middleware Stack Order**
```typescript
// Security first, then business logic
app.use(requestTimeout(30000));           // Request timeout
app.use(corsMiddleware);                  // CORS handling
app.use(securityHeaders);                 // Security headers
app.use(compressionMiddleware);           // Response compression
app.use(requestSizeLimiter);              // Request size limits
app.use(apiRateLimit);                    // Rate limiting
app.use(requestLogger);                   // Request logging
app.use(sanitizeRequest);                 // Input sanitization

// Business routes
app.use('/auth', authRoutes);
app.use('/api/assistant', assistantRoutes);

// Error handling (must be last)
app.use(errorHandler);
```

#### **Custom Middleware Pattern**
```typescript
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
```

## 📊 **Data Flow Patterns**

### **1. Request Flow**
```
User Input → Slack Bot → Backend API → Middleware Stack → Route Handler → Service → Agent → External API
```

### **2. Response Flow**
```
External API → Agent → Service → Route Handler → Middleware Stack → Backend API → Slack Bot → User
```

### **3. Error Flow**
```
Error → Agent/Service → Route Handler → Error Middleware → Structured Response → Slack Bot → User
```

## 🔒 **Security Architecture**

### **1. Authentication Flow**
```typescript
// OAuth 2.0 with Google
1. Slack: Google OAuth → Access Token
2. Slack → Backend: Token exchange
3. Backend: Validate token with Google
4. Backend: Issue session token
5. Slack: Store session token securely
```

### **2. Authorization Patterns**
```typescript
// Route protection with middleware
app.use('/api/assistant', authMiddleware, assistantRoutes);

// Service-level authorization
class GmailService {
  async sendEmail(params: SendEmailParams, accessToken: string): Promise<EmailResult> {
    // Validate token and permissions
    const user = await this.authService.validateToken(accessToken);
    if (!user.hasGmailScope) {
      throw new Error('Insufficient permissions');
    }
    // Proceed with email operation
  }
}
```

### **3. Security Headers**
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## 🧪 **Testing Architecture**

### **1. Test Structure**
```
tests/
├── unit/                    # Unit tests for individual components
├── integration/            # Integration tests for service interactions
├── ai-behavior/           # AI behavior validation tests
│   ├── context-continuity/    # Conversation context tests
│   ├── decision-quality/      # Agent decision validation
│   ├── error-recovery/        # Error handling tests
│   ├── intent-recognition/    # Intent understanding tests
│   └── workflow-validation/   # Multi-agent workflow tests
└── fixtures/               # Test data and mocks
```

### **2. Testing Patterns**
```typescript
// Service testing with dependency injection
describe('GmailService', () => {
  let gmailService: GmailService;
  let mockAuthService: jest.Mocked<AuthService>;
  
  beforeEach(() => {
    mockAuthService = createMockAuthService();
    gmailService = new GmailService(mockAuthService);
  });
  
  it('should send email with valid token', async () => {
    // Test implementation
  });
});

// AI behavior testing
describe('Master Agent Routing', () => {
  it('should route email requests to emailAgent', async () => {
    const response = await masterAgent.processUserInput(
      'Send an email to john about the meeting',
      'test-session-id'
    );
    
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({ name: 'emailAgent' })
    );
  });
});
```

## 📈 **Performance Architecture**

### **1. Caching Strategy**
```typescript
// Session-based caching
class SessionService {
  private sessions = new Map<string, SessionData>();
  
  getOrCreateSession(sessionId: string, userId?: string): SessionData {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }
    
    const session = this.createNewSession(sessionId, userId);
    this.sessions.set(sessionId, session);
    return session;
  }
}
```

### **2. Async Processing**
```typescript
// Non-blocking agent execution
class ToolExecutorService {
  async executeToolCalls(toolCalls: ToolCall[], context: ToolExecutionContext): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeSingleTool(toolCall, context);
        results.push(result);
        
        // Stop on critical failures
        if (result.error && this.isCriticalTool(toolCall.name)) {
          break;
        }
      } catch (error) {
        results.push(this.createErrorResult(error, context));
      }
    }
    
    return results;
  }
}
```

## 🔄 **Error Handling Architecture**

### **1. Error Hierarchy**
```typescript
// Structured error types
export class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}
```

### **2. Error Recovery Patterns**
```typescript
// Graceful degradation in Master Agent
if (this.useOpenAI && this.openaiService) {
  try {
    const response = await this.openaiService.generateToolCalls(userInput, systemPrompt, sessionId);
    toolCalls = response.toolCalls;
    message = response.message;
  } catch (openaiError) {
    logger.warn('OpenAI failed, falling back to rule-based routing:', openaiError);
    toolCalls = this.determineToolCalls(userInput);
    message = this.generateResponse(userInput, toolCalls);
  }
}
```

## 🚀 **Deployment Architecture**

### **1. Environment Configuration**
```typescript
// Environment-based configuration
class ConfigService {
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }
  
  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }
  
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
```

### **2. Health Monitoring**
```typescript
// Comprehensive health checks
app.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: configService.nodeEnv,
    services: await serviceManager.getHealthStatus(),
    agents: AgentFactory.getStats()
  };
  
  const isHealthy = health.services.every(service => service.healthy);
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## 📋 **Architecture Decision Records (ADRs)**

### **ADR-001: Service Registry Pattern**
- **Decision**: Use centralized service registry with dependency injection
- **Rationale**: Enables proper lifecycle management and testing
- **Consequences**: Services must implement IService interface

### **ADR-002: Plugin-Based Agent System**
- **Decision**: Use factory pattern for agent registration and discovery
- **Rationale**: Enables easy extension and testing of agent capabilities
- **Consequences**: All agents must extend BaseAgent

### **ADR-003: Middleware-First Security**
- **Decision**: Implement security at middleware level
- **Rationale**: Centralized security enforcement and easier testing
- **Consequences**: All routes automatically protected

## 🔍 **Architecture Validation**

### **1. Dependency Analysis**
```bash
# Check for circular dependencies
npm run lint:circular

# Validate architectural boundaries
npm run test:architecture
```

### **2. Code Quality Gates**
```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Testing
npm run test:coverage
```

### **3. Performance Monitoring**
```bash
# Load testing
npm run test:load

# Memory profiling
npm run test:memory
```

## 📚 **AI Development Guidelines**

### **1. Architecture Compliance**
When implementing new features:
1. **Review this architecture document** for relevant patterns
2. **Follow established interfaces** and contracts
3. **Maintain separation of concerns** between layers
4. **Use dependency injection** for external dependencies
5. **Implement comprehensive error handling**

### **2. Extension Points**
- **New Agents**: Extend BaseAgent and register with AgentFactory
- **New Services**: Implement IService and register with ServiceManager
- **New Middleware**: Add to middleware stack in correct order
- **New Routes**: Follow established routing patterns

### **3. Testing Requirements**
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test service interactions
- **AI Behavior Tests**: Validate agent decision-making
- **Performance Tests**: Ensure scalability requirements

This architecture provides a solid foundation for AI-assisted development while maintaining code quality and system reliability.
