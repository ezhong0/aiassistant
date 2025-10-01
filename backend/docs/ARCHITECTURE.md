# AI Assistant Application - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Dependency Injection System](#dependency-injection-system)
4. [Service Layer](#service-layer)
5. [Agent Architecture](#agent-architecture)
6. [Workflow Execution](#workflow-execution)
7. [Tool Registry System](#tool-registry-system)
8. [Domain Services](#domain-services)
9. [Authentication & Authorization](#authentication--authorization)
10. [Security & Middleware](#security--middleware)
11. [AI-Powered Testing System](#ai-powered-testing-system)
12. [Key Design Patterns](#key-design-patterns)
13. [Performance & Scalability](#performance--scalability)

---

## Overview

This is an AI-powered assistant application that orchestrates multiple domain-specific services (Email, Calendar, Contacts, Slack) through an intelligent agent system. The architecture follows clean separation of concerns with dependency injection, comprehensive testing, and enterprise-grade security.

### Core Technologies
- **Runtime**: Node.js 20+ with TypeScript 5.9
- **Framework**: Express.js 5.1
- **AI**: OpenAI GPT-4 (via GenericAIService)
- **Database**: PostgreSQL (via DatabaseService)
- **Cache**: Redis (via CacheService)
- **External APIs**: Gmail, Google Calendar, Google Contacts, Slack
- **Dependency Injection**: Awilix
- **Testing**: Jest with AI-powered E2E testing

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Auth Routes  │  │ Slack Routes │  │ Protected Routes   │   │
│  │ (OAuth flow) │  │ (Events/Bot) │  │ (API endpoints)    │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY INJECTION LAYER                    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                Awilix Container                       │    │
│  │  • Constructor-based dependency injection             │    │
│  │  • Type-safe service resolution                       │    │
│  │  • Lifetime management (singleton/scoped/transient)   │    │
│  │  • Service registration and discovery                 │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT LAYER                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Master Agent                          │    │
│  │  • Message history building                             │    │
│  │  • Situation analysis                                   │    │
│  │  • Workflow planning                                    │    │
│  │  • Workflow execution (via WorkflowExecutor)           │    │
│  │  • Final response generation                            │    │
│  └────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌───────────────────────────────────────────────────────┐     │
│  │              WorkflowExecutor                          │     │
│  │  Iteration Loop (max 10 iterations):                   │     │
│  │  1. Environment Check (needs user input?)              │     │
│  │  2. Action Execution (delegate to SubAgents)           │     │
│  │  3. Progress Assessment (complete or continue?)        │     │
│  └───────────────────────────────────────────────────────┘     │
│                              ↓                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Email   │ │ Calendar │ │ Contacts │ │  Slack   │          │
│  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │          │
│  │ (3-phase)│ │ (3-phase)│ │ (3-phase)│ │ (3-phase)│          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │   Domain    │ │   Domain    │ │   Domain    │              │
│  │  Services   │ │  Services   │ │  Services   │              │
│  │  Container  │ │  Container  │ │  Container  │              │
│  ├─────────────┤ ├─────────────┤ ├─────────────┤              │
│  │ Email       │ │ Calendar    │ │ Slack       │              │
│  │ Service     │ │ Service     │ │ Service     │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│                              ↓                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │   Google    │ │   Slack     │ │   OpenAI    │              │
│  │ API Client  │ │ API Client  │ │ API Client  │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  Database   │ │   Redis     │ │   Config    │              │
│  │  Service    │ │   Cache     │ │   Service   │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dependency Injection System

### Awilix Container Architecture

The application uses **Awilix** for clean constructor-based dependency injection with type safety and explicit lifetime management.

**Location**: `src/di/container.ts`

**Key Features**:
- **Constructor-based injection**: All dependencies injected via constructor parameters
- **Type-safe resolution**: Full TypeScript support with interface-based contracts
- **Lifetime management**: Singleton, scoped, and transient service lifetimes
- **No service locator pattern**: Dependencies are explicit and testable
- **Easy testing**: Container scopes for isolated test environments

**Container Structure**:

```typescript
export interface Cradle {
  // Configuration and logging
  config: typeof unifiedConfig;
  logger: typeof logger;

  // Core Infrastructure Services
  databaseService: DatabaseService;
  cacheService: CacheService;
  encryptionService: EncryptionService;
  sentryService: SentryService;
  errorHandlingService: ErrorHandlingService;

  // Auth Services
  authService: AuthService;
  tokenStorageService: TokenStorageService;
  tokenManager: TokenManager;
  authStatusService: AuthStatusService;
  oauthStateService: OAuthStateService;

  // OAuth Managers
  googleOAuthManager: GoogleOAuthManager;
  slackOAuthManager: SlackOAuthManager;

  // Domain Services
  emailDomainService: EmailDomainService;
  calendarDomainService: CalendarDomainService;
  contactsDomainService: ContactsDomainService;
  slackDomainService: SlackDomainService;
  aiDomainService: AIDomainService;

  // AI Services
  genericAIService: GenericAIService;
  aiServiceCircuitBreaker: AIServiceCircuitBreaker;

  // Workflow Services
  contextManager: ContextManager;
  workflowExecutor: WorkflowExecutor;

  // Agent Services
  masterAgent: MasterAgent;
  emailAgent: EmailAgent;
  calendarAgent: CalendarAgent;
  contactAgent: ContactAgent;
  slackAgent: SlackAgent;

  // Middleware
  errorHandler: ErrorHandlerMiddleware;
  notFoundHandler: NotFoundHandlerMiddleware;
}
```

### Service Registration

**Location**: `src/di/registrations/`

Services are registered in dependency order across multiple registration modules:

1. **Core Services** (`core-services.ts`): Database, cache, encryption, error handling
2. **Auth Services** (`auth-services.ts`): OAuth, tokens, authentication
3. **Domain Services** (`domain-services.ts`): Email, calendar, contacts, Slack, AI
4. **AI Services** (`ai-services.ts`): OpenAI integration, circuit breaker
5. **Workflow Services** (`workflow-services.ts`): Context management, workflow execution
6. **Agent Services** (`agent-services.ts`): Master agent, sub-agents
7. **Middleware Services** (`middleware-services.ts`): Error handling, validation

**Registration Pattern**:

```typescript
export function registerCoreServices(container: AppContainer): void {
  container.register({
    // Core infrastructure services
    databaseService: asClass(DatabaseService).singleton(),
    cacheService: asClass(CacheService).singleton(),
    encryptionService: asClass(EncryptionService).singleton(),
    sentryService: asClass(SentryService).singleton(),
    errorHandlingService: asClass(ErrorHandlingService).singleton(),
  });
}
```

**Benefits**:
- **Explicit dependencies**: All dependencies declared in constructor
- **Testability**: Easy to mock dependencies for unit tests
- **Lifetime control**: Singleton services for shared resources
- **Type safety**: Full TypeScript support with interface contracts
- **Circular dependency prevention**: Awilix detects and prevents cycles

---

## Service Layer

### BaseService Pattern

All services extend `BaseService` which provides consistent lifecycle management, health checking, and logging.

**Location**: `src/services/base-service.ts`

```typescript
abstract class BaseService {
  protected serviceName: string;
  protected initialized: boolean;
  protected healthy: boolean;

  // Lifecycle methods
  async initialize(): Promise<void>
  async destroy(): Promise<void>

  // Abstract hooks (implemented by subclasses)
  protected abstract onInitialize(): Promise<void>
  protected abstract onDestroy(): Promise<void>

  // Health checking
  getHealth(): { healthy: boolean; details?: any }

  // Utilities
  protected assertReady(): void
  protected logInfo(...): void
  protected logError(...): void
}
```

**Benefits**:
- **Consistent lifecycle**: All services follow the same initialization pattern
- **Health monitoring**: Built-in health checks for all services
- **Error handling**: Standardized error logging and handling
- **Ready-state assertions**: Prevents operations on uninitialized services

### Service Categories

#### 1. **Infrastructure Services**
- **DatabaseService**: PostgreSQL connection and query management
- **CacheService**: Redis caching with TTL management
- **EncryptionService**: AES-256-GCM encryption for sensitive data
- **SentryService**: Error tracking and performance monitoring
- **ErrorHandlingService**: Centralized error handling and reporting

#### 2. **Authentication Services**
- **AuthService**: JWT token generation and validation
- **TokenStorageService**: Encrypted token storage in database
- **TokenManager**: OAuth token refresh and validation
- **AuthStatusService**: User authentication status tracking
- **OAuthStateService**: OAuth state management with HMAC signing

#### 3. **OAuth Managers**
- **GoogleOAuthManager**: Google OAuth 2.0 flow management
- **SlackOAuthManager**: Slack OAuth 2.0 flow management

#### 4. **Domain Services**
- **EmailDomainService**: Gmail API operations
- **CalendarDomainService**: Google Calendar API operations
- **ContactsDomainService**: Google Contacts API operations
- **SlackDomainService**: Slack API operations
- **AIDomainService**: OpenAI API operations

#### 5. **AI Services**
- **GenericAIService**: OpenAI API wrapper with retry logic
- **AIServiceCircuitBreaker**: Circuit breaker for AI service resilience

#### 6. **Workflow Services**
- **ContextManager**: Conversation context and session management
- **WorkflowExecutor**: Multi-step workflow orchestration

---

## Agent Architecture

### Master Agent

**Location**: `src/agents/master.agent.ts`

The Master Agent orchestrates the entire workflow through a 4-phase process:

1. **Message History Building**: Gather conversation context
2. **Analysis & Planning**: Understand intent and create workflow plan
3. **Workflow Execution**: Coordinate SubAgents via WorkflowExecutor
4. **Final Response Generation**: Generate human-readable response

**Processing Flow**:

```typescript
async processUserInput(userInput, sessionId, userId, slackContext) {
  // Phase 1: Build message history
  const messageHistory = await this.buildMessageHistory(...)

  // Phase 2: Analyze & Plan
  const workflowContext = await this.analyzeAndPlan(...)

  // Phase 3: Execute workflow
  const finalContext = await this.workflowExecutor.execute(...)

  // Phase 4: Generate final response
  const response = await this.generateFinalResponse(...)

  return { message: response, success: true, metadata: {...} }
}
```

**Key Features**:
- **Context awareness**: Maintains conversation history and user context
- **Workflow orchestration**: Coordinates multiple SubAgents
- **Progress tracking**: Real-time progress updates via Slack
- **Error handling**: Comprehensive error recovery and user feedback

### SubAgent Architecture

**Location**: `src/framework/base-subagent.ts`

All SubAgents extend `BaseSubAgent` and implement a **3-phase workflow**:

#### **Phase 1: Intent Assessment**
- Understand what the user wants to do
- Identify which tools are needed
- Create execution plan

```typescript
// AI generates structured output:
{
  context: "Updated context with understanding",
  toolsNeeded: ["send_email", "get_contacts"],
  executionPlan: "First get contacts, then send email"
}
```

#### **Phase 2: Tool Execution**
- Execute tools via ToolRegistry
- Call domain service methods
- Handle errors and retries

```typescript
// For each tool:
const serviceMethod = this.getToolToServiceMap()[toolName]
const result = await this.getService()[serviceMethod](userId, params)
```

#### **Phase 3: Response Formatting**
- Format results for Master Agent
- Return structured response
- Include success/error information

```typescript
{
  message: "Sent email to John Doe successfully",
  success: true,
  metadata: {
    tools_used: ["send_email"],
    execution_time: 2.5,
    data: { messageId: "abc123" }
  }
}
```

**Available SubAgents**:
- **EmailAgent**: Gmail operations (send, search, retrieve)
- **CalendarAgent**: Google Calendar operations (schedule, check availability)
- **ContactAgent**: Google Contacts operations (search, create, update)
- **SlackAgent**: Slack operations (send messages, handle events)

---

## Workflow Execution

### WorkflowExecutor

**Location**: `src/services/workflow-executor.service.ts`

The WorkflowExecutor orchestrates multi-step workflows with iterative execution and context management.

**Algorithm**:

```typescript
while (iteration < maxIterations) {
  // 1. Environment Check: Do we have everything we need?
  const envCheck = await this.checkEnvironment(context)
  if (envCheck.needsUserInput) {
    return // Pause for user input
  }

  // 2. Action Execution: Execute next action via SubAgent
  const action = await this.executeAction(context)
  if (action.hasAgentAction) {
    // Delegate to appropriate agent
    const agent = AgentFactory.getAgent(action.agentName)
    const result = await agent.processNaturalLanguageRequest(...)
    context = updateContext(result)
  }

  // 3. Progress Assessment: Are we done or need more steps?
  const progress = await this.assessProgress(context)
  if (progress.isComplete) {
    return context // Done!
  }

  if (!progress.shouldContinue) {
    break
  }

  iteration++
}
```

**Three Prompt Builders**:
1. **EnvironmentCheckPromptBuilder**: Check if we need user input
2. **ActionExecutionPromptBuilder**: Determine next action
3. **ProgressAssessmentPromptBuilder**: Check if complete

**Features**:
- **Max 10 iterations** to prevent infinite loops
- **Context accumulation**: Each step adds to context string
- **Token management**: OAuth token refresh when needed
- **Error handling**: Unified error types with recovery
- **Progress tracking**: Slack integration for real-time updates

---

## Tool Registry System

### ToolRegistry

**Location**: `src/framework/tool-registry.ts`

The ToolRegistry serves as the single source of truth for all tool definitions, enabling AI agents to discover and execute available operations.

**Tool Definition**:

```typescript
interface ToolDefinition {
  name: string                    // "send_email"
  description: string             // What the tool does
  parameters: {...}               // Parameter schemas
  requiredParameters: string[]    // Required params
  domain: 'email' | 'calendar' | 'contacts' | 'slack'
  serviceMethod: string           // Method name in domain service
  requiresAuth: boolean
  requiresConfirmation: boolean
  isCritical: boolean
  examples: string[]
}
```

**Registration Pattern**:

All tools are registered at startup in `tool-registry.ts`. Example:

```typescript
ToolRegistry.registerTool({
  name: 'send_email',
  description: 'Send an email message',
  parameters: {
    userId: { type: 'string', description: 'User ID', required: true },
    to: { type: 'string', description: 'Recipient email' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body' }
  },
  requiredParameters: ['userId', 'to', 'body'],
  domain: 'email',
  serviceMethod: 'sendEmail',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: true,
  examples: ['Send email to john@example.com']
})
```

**Usage**:

```typescript
// Get tools for a domain
const emailTools = ToolRegistry.getToolsForDomain('email')

// Get tool definition
const tool = ToolRegistry.getTool('send_email')

// Validate parameters
const validation = ToolRegistry.validateToolParameters('send_email', params)

// Generate prompt-friendly definitions
const toolDefs = ToolRegistry.generateToolDefinitionsForDomain('email')
```

**Benefits**:
- **Single source of truth**: No duplication across agents
- **Type safety**: Parameter validation with Zod schemas
- **AI-friendly**: Generate definitions for prompts
- **Discoverability**: Easy to find available tools
- **Maintainability**: Change once, update everywhere

---

## Domain Services

### Email Domain Service

**Location**: `src/services/domain/email-domain.service.ts`

High-level email operations using the Gmail API with OAuth2 authentication.

**Key Features**:
- **Email sending**: Rich formatting, attachments, threading
- **Email search**: Advanced query capabilities with filters
- **Thread management**: Conversation thread handling
- **Draft management**: Create, update, and send drafts
- **Attachment handling**: File upload and download

**OAuth Integration**:
- **Automatic token refresh**: Handles expired tokens transparently
- **Scope management**: Gmail readonly and send permissions
- **Error handling**: Comprehensive error recovery

### Calendar Domain Service

**Location**: `src/services/domain/calendar-domain.service.ts`

Google Calendar API operations for scheduling and availability management.

**Key Features**:
- **Event creation**: Create events with attendees and video links
- **Availability checking**: Free/busy time analysis
- **Event management**: Update, delete, and reschedule events
- **Recurring events**: Handle recurring meeting patterns
- **Time zone handling**: Multi-timezone support

### Contacts Domain Service

**Location**: `src/services/domain/contacts-domain.service.ts`

Google Contacts API operations for contact management and search.

**Key Features**:
- **Contact search**: Advanced search with filters
- **Contact management**: Create, update, and delete contacts
- **Group management**: Contact group and label handling
- **Photo management**: Contact photo upload and retrieval
- **Metadata handling**: Custom contact fields and properties

### Slack Domain Service

**Location**: `src/services/domain/slack-domain.service.ts`

Comprehensive Slack API wrapper with 20+ methods for workspace integration.

**Key Features**:
- **Message sending**: Rich text, blocks, and interactive components
- **Event handling**: Real-time event processing
- **User management**: User information and presence
- **Channel management**: Channel operations and permissions
- **File operations**: File upload and sharing

### AI Domain Service

**Location**: `src/services/domain/ai-domain.service.ts`

OpenAI API wrapper with advanced features and error handling.

**Key Features**:
- **Chat completions**: GPT-4 and GPT-3.5-turbo support
- **Text generation**: Custom prompts and parameters
- **Embeddings**: Semantic search and similarity
- **Image generation**: DALL-E integration
- **Audio processing**: Transcription and translation
- **Function calling**: Structured output with function definitions

**Lazy Initialization Pattern**:
Unlike other services, this uses lazy initialization in `onInitialize()` because:
- API clients are obtained via factory (`getAPIClient()`)
- Authentication requires environment variables at runtime
- Client initialization may fail and needs proper error handling
- Allows service to exist before external API is ready

---

## Authentication & Authorization

### OAuth Flow Architecture

**Three OAuth Managers**:
1. **GoogleOAuthManager**: Gmail, Calendar, Contacts
2. **SlackOAuthManager**: Slack bot and user tokens
3. **AuthService**: JWT tokens for internal auth

**OAuth Flow (Google)**:

```
1. User clicks "Connect Gmail" in Slack
   ↓
2. SlackAgent → auth/google/slack?user_id=U123&team_id=T456
   ↓
3. AuthService.generateAuthUrl(scopes, state)
   → Redirect to Google OAuth consent screen
   ↓
4. User grants permissions
   ↓
5. Google → auth/callback?code=xyz&state={user_id,team_id}
   ↓
6. AuthService.exchangeCodeForTokens(code)
   → Get access_token, refresh_token
   ↓
7. TokenStorageService.storeUserTokens(userId, tokens)
   → Store in database
   ↓
8. Slack notification: "✅ Gmail connected!"
```

### Token Management

**TokenManager** (`src/services/token-manager.ts`):

```typescript
class TokenManager {
  // Get valid token (refresh if expired)
  async getValidTokens(userId, service): Promise<Tokens>

  // Check if token is expired
  isTokenExpired(token): boolean

  // Refresh token
  async refreshToken(userId, refreshToken): Promise<NewTokens>

  // Validate token with provider
  async validateToken(token): Promise<boolean>
}
```

**Token Storage**:
- Stored in PostgreSQL via DatabaseService
- Encrypted at rest using AES-256-GCM
- Associated with userId (format: `teamId:slackUserId`)
- Includes expiry time for proactive refresh

**Token Validation**:
1. Check if token exists
2. Check if expired (locally)
3. If expired, refresh using refresh_token
4. If refresh fails, require re-auth
5. Return valid token to caller

### Route Protection

**Location**: `src/routes/auth/`

**Environment-Gated Debug Routes**:
```typescript
// routes/auth/index.ts
if (process.env.NODE_ENV !== 'production') {
  router.use('/debug', debugRoutes)
}
```

**Benefits**:
- Debug endpoints never accessible in production
- Security improvement
- Cleaner production build

---

## Security & Middleware

### Security Middleware

**Location**: `src/middleware/security.middleware.ts`

**CORS Configuration**:
```typescript
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = corsOrigin ? corsOrigin.split(',').map(o => o.trim()) : [];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins if no explicit config
    if (process.env.NODE_ENV === 'development' && allowedOrigins.length === 0) {
      return callback(null, true);
    }
    
    // In production, require explicit allowlist
    if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
      callback(new Error('CORS configuration required in production'), false);
      return;
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Authorization', 'X-Session-Id'],
  maxAge: 86400 // 24 hours
});
```

**Security Headers**:
```typescript
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    },
    reportOnly: process.env.NODE_ENV === 'development'
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});
```

### Rate Limiting

**Location**: `src/middleware/rate-limiting.middleware.ts`

**Features**:
- **Per-user rate limiting**: Different limits for different user types
- **Endpoint-specific limits**: Custom limits for different operations
- **Exponential backoff**: Automatic retry with increasing delays
- **Redis-backed**: Distributed rate limiting across multiple instances

### Input Validation

**Location**: `src/middleware/validation.middleware.ts`

**Zod Schema Validation**:
```typescript
export function validateRequest(options: ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate query parameters
      if (options.query) {
        req.validatedQuery = options.query.parse(req.query);
      }

      // Validate request body
      if (options.body) {
        req.validatedBody = options.body.parse(req.body);
      }

      // Validate path parameters
      if (options.params) {
        req.validatedParams = options.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = transformZodErrors(error);
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors
        });
      }
      next(error);
    }
  };
}
```

### API Logging

**Location**: `src/middleware/api-logging.middleware.ts`

**Features**:
- **Request/response logging**: Complete API interaction tracking
- **Sensitive data filtering**: Automatic filtering of passwords, tokens
- **Performance metrics**: Request duration and response size
- **Correlation IDs**: Request tracing across services
- **Configurable verbosity**: Different log levels for different environments

---

## AI-Powered Testing System

### Overview

**Location**: `backend/tests/e2e/`

This is an advanced E2E testing system that uses AI to generate test scenarios, execute them through the MasterAgent, and evaluate the results using AI scoring. The system provides comprehensive testing of the entire workflow while maintaining realistic AI interactions.

### Core Components

#### 1. **AI Test Scenario Generator** (`tests/e2e/ai/scenario-generator.ts`)
- Generates realistic user inputs using AI
- Creates diverse scenarios across categories (email, calendar, Slack, contacts, multi-domain)
- Supports different complexity levels (simple, medium, complex)
- Includes edge case generation
- Provides expected actions and API calls for each scenario

#### 2. **AI Response Evaluator** (`tests/e2e/ai/response-evaluator.ts`)
- Analyzes complete execution traces using AI
- Scores response quality, tool completeness, workflow efficiency, and error handling
- Answers critical questions:
  - "Does the response look appropriate for the given request?"
  - "Were all the tools (API calls) that should've happened actually called?"
- Provides detailed findings, strengths, weaknesses, and recommendations
- Generates comprehensive evaluation reports

#### 3. **Master Agent Executor** (`tests/e2e/framework/master-agent-executor.ts`)
- Complete workflow execution tracing
- Captures all API calls, timing, and performance metrics
- Service initialization for E2E testing environment
- Comprehensive logging and monitoring

#### 4. **API Mock Manager** (`tests/e2e/framework/api-mock-manager.ts`)
- Single-point API interception at BaseAPIClient level
- Realistic mock responses for Google APIs and Slack
- **OpenAI calls use the REAL API** for authentic AI responses
- Performance simulation with realistic delays
- Complete request/response logging and analytics

### Key Design Principles

- **Real OpenAI API Calls**: All OpenAI/LLM calls flow through the real OpenAI API to generate authentic responses
- **AI-Generated API Mocks**: External API calls (Google, Slack, etc.) are intercepted and mocked using AI-generated responses
- **AI-Powered Evaluation**: Each step is evaluated by AI to determine quality, completeness, and appropriateness
- **Comprehensive Coverage**: Tests cover the entire workflow from input to final response

### Workflow

#### 1. Scenario Generation
```
AI Test Scenario Generator → OpenAI API → Diverse test scenarios
```

The system generates realistic test scenarios using AI, ensuring:
- Variety in request types (email, calendar, Slack, etc.)
- Realistic user inputs and contexts
- Edge cases and error conditions
- Different complexity levels

#### 2. Execution
```
Test Scenario → MasterAgent → Real OpenAI API calls + Mocked external APIs → Execution Trace
```

During execution:
- **OpenAI API calls are REAL** - All LLM interactions use the actual OpenAI API
- **External APIs are MOCKED** - Google, Slack, and other external services return AI-generated mock responses
- **Complete tracing** - Every API call, prompt, and response is captured

#### 3. Evaluation
```
Execution Trace → AI Response Evaluator → Quality Scores & Recommendations
```

The AI evaluator analyzes:
- Response appropriateness for the given request
- Tool completeness (expected API calls made)
- Workflow efficiency and error handling
- Overall quality and user experience

### Usage

**Run AI-Powered E2E Tests**:
```bash
# Run the complete AI-powered E2E testing system
npm run test:ai-e2e

# Run basic E2E tests (without AI generation/evaluation)
npm run test:e2e
```

**Test Flow**:
1. **AI generates test scenarios** based on your requirements
2. **Each scenario is executed** through the MasterAgent workflow
3. **All API calls are intercepted and mocked** realistically
4. **AI evaluates the execution** for quality and completeness
5. **Comprehensive reports** are generated with scores and insights

---

## Key Design Patterns

### 1. **Dependency Injection**
- Services don't create dependencies
- Dependencies injected via Awilix container
- Testable and flexible

```typescript
// Good
class EmailAgent {
  private service: IEmailDomainService
  constructor(service: IEmailDomainService) {
    this.service = service
  }
}
```

### 2. **Single Responsibility Principle**
- Each class has one job
- Easy to understand and maintain
- Examples:
  - MasterAgent: Orchestration only
  - WorkflowExecutor: Workflow iteration only
  - SubAgents: Domain-specific operations only
  - DomainServices: API calls only

### 3. **Strategy Pattern**
- Prompt builders are strategies
- Different builders for different prompts
- Swappable implementations

```typescript
class MasterAgent {
  constructor(
    private situationBuilder: SituationAnalysisPromptBuilder,
    private planningBuilder: WorkflowPlanningPromptBuilder,
    private responseBuilder: FinalResponsePromptBuilder
  ) {}
}
```

### 4. **Factory Pattern**
- AgentFactory creates agents
- PromptBuilderFactory creates prompt builders
- Centralized creation logic

```typescript
const emailAgent = AgentFactory.getAgent('emailAgent')
const builders = PromptBuilderFactory.createAllBuilders(aiService)
```

### 5. **Template Method Pattern**
- BaseService defines lifecycle
- Subclasses implement specific steps

```typescript
abstract class BaseService {
  async initialize() {
    // Template
    await this.onInitialize() // Subclass implements
    this.initialized = true
  }

  protected abstract onInitialize(): Promise<void>
}
```

### 6. **Builder Pattern**
- Prompt builders construct complex prompts
- Fluent interface
- Separation of concerns

```typescript
const prompt = new IntentAssessmentPromptBuilder(aiService, 'email')
  .withContext(context)
  .withTools(tools)
  .build()
```

### 7. **Registry Pattern**
- ToolRegistry is a registry
- AgentFactory is a registry
- Central lookup location

```typescript
ToolRegistry.registerTool(toolDef)
const tool = ToolRegistry.getTool('send_email')
```

### 8. **Circuit Breaker Pattern**
- AIServiceCircuitBreaker prevents cascade failures
- Fails fast when service is down
- Auto-recovery after timeout

---

## Performance & Scalability

### Caching Strategy
- **Redis**: Conversation context, OAuth state
- **In-memory**: Tool definitions, agent capabilities
- **Database**: User tokens, persistent data

### Optimization Opportunities
1. **Prompt caching**: Cache frequently-used prompts
2. **Batch operations**: Group multiple API calls
3. **Streaming**: Use streaming for long AI responses
4. **Connection pooling**: Reuse database/API connections
5. **Rate limiting**: Prevent API exhaustion

### Scalability Considerations
1. **Horizontal scaling**: Stateless design
2. **Queue system**: Background job processing
3. **Microservices**: Split into smaller services
4. **Database sharding**: Scale data layer
5. **CDN**: Static asset delivery

### Performance Targets
- **Search/Retrieval**: <2 seconds
- **Email Drafting**: <5 seconds
- **Calendar Operations**: <3 seconds
- **Workflow Execution**: <10 seconds
- **Bulk Operations**: <30 seconds (50 emails)

### Scalability Requirements
- **1,000 users** at launch (MVP)
- **10,000 users** at 12 months
- **100,000 users** at 24 months
- **1,000 concurrent users** executing commands

---

## Architecture Decisions Records (ADRs)

### ADR-001: Awilix Dependency Injection

**Decision**: Use Awilix for dependency injection

**Context**:
- Need type-safe dependency injection
- Constructor-based injection preferred
- Easy testing with container scopes

**Reasoning**:
- Type-safe service resolution
- Explicit lifetime management
- No service locator anti-pattern
- Easy mocking for tests

**Status**: Accepted ✅

### ADR-002: BaseSubAgent 3-Phase Workflow

**Decision**: All SubAgents use 3-phase workflow

**Context**:
- Phase 1: Intent Assessment
- Phase 2: Tool Execution
- Phase 3: Response Formatting

**Reasoning**:
- Consistent pattern across all agents
- AI-friendly structured approach
- Easy to understand and debug
- Testable at each phase

**Status**: Accepted ✅

### ADR-003: ToolRegistry as Single Source of Truth

**Decision**: All tools defined in ToolRegistry

**Context**:
- Previously scattered across agents and services
- Duplication and inconsistency

**Reasoning**:
- Single source of truth
- No duplication
- Easy discovery
- AI prompt generation

**Status**: Accepted ✅

### ADR-004: Context as String (SimpleContext)

**Decision**: Pass context as formatted string, not structured objects

**Context**:
- MasterAgent and SubAgents communicate via context strings
- Format: Human-readable key-value pairs

**Reasoning**:
- AI-friendly format
- Easy to read and debug
- Flexible schema
- Natural language processing

**Status**: Accepted ✅

---

## Best Practices

### Adding a New Domain Service

1. **Define Interface** (`interfaces/new-domain.interface.ts`):
```typescript
export interface INewDomainService extends IDomainService {
  someMethod(userId: string, params: any): Promise<Result>
}
```

2. **Implement Service** (`new-domain.service.ts`):
```typescript
export class NewDomainService extends BaseService implements INewDomainService {
  protected async onInitialize() { /* init */ }
  async someMethod(userId, params) { /* impl */ }
}
```

3. **Register in Container** (`domain-services.ts`):
```typescript
container.register({
  newDomainService: asClass(NewDomainService).singleton()
})
```

4. **Add to Cradle Interface** (`container.ts`):
```typescript
newDomainService: import('../services/domain/new-domain.service').NewDomainService;
```

### Adding a New SubAgent

1. **Create Agent** (`agents/new.agent.ts`):
```typescript
export class NewAgent extends BaseSubAgent {
  constructor(service: INewDomainService) {
    super('new', { name: 'NewAgent', ... })
    this.service = service
  }

  protected getAvailableTools() {
    return ToolRegistry.getToolNamesForDomain('new')
  }

  protected async executeToolCall(toolName, params) {
    const serviceMethod = this.getToolToServiceMap()[toolName]
    return await this.service[serviceMethod](userId, params)
  }
}
```

2. **Register Tools** (`tool-registry.ts`):
```typescript
ToolRegistry.registerTool({
  name: 'new_tool',
  domain: 'new',
  serviceMethod: 'someMethod',
  ...
})
```

3. **Register Agent** (`agent-services.ts`):
```typescript
container.register({
  newAgent: asClass(NewAgent).singleton()
})
```

### Adding a New Route

1. **Create Route File** (`routes/new.routes.ts`):
```typescript
export function createNewRoutes(container: AppContainer) {
const router = express.Router()
router.get('/endpoint', middleware, handler)
  return router
}
```

2. **Mount in App** (`index.ts`):
```typescript
app.use('/api/new', createNewRoutes(container))
```

3. **Add Middleware**: Rate limiting, auth, validation

---

## Troubleshooting

### Common Issues

**Issue**: Agent not found
```
Solution: Check agent registration in agent-services.ts
```

**Issue**: Service not initialized
```
Solution: Check service registration in appropriate registration file
```

**Issue**: OAuth token expired
```
Solution: TokenManager handles refresh automatically
Check TokenStorageService has valid refresh_token
```

**Issue**: Tool not found
```
Solution: Verify tool registered in ToolRegistry
Check domain matches (email, calendar, contacts, slack)
```

**Issue**: Circular dependency
```
Solution: Services should never import each other directly
Use constructor injection via Awilix container
```

---

## References

### Key Files
- **Dependency Injection**: `src/di/container.ts`
- **Service Registration**: `src/di/registrations/`
- **Master Agent**: `src/agents/master.agent.ts`
- **Base SubAgent**: `src/framework/base-subagent.ts`
- **Workflow Executor**: `src/services/workflow-executor.service.ts`
- **Tool Registry**: `src/framework/tool-registry.ts`
- **Domain Services**: `src/services/domain/`
- **Auth Routes**: `src/routes/auth/`
- **AI Testing**: `backend/tests/e2e/`

### Related Documentation
- API Documentation: `/docs/swagger.ts`
- Environment Setup: `/.env.example`
- Database Schema: `/migrations/`
- Testing Framework: `backend/tests/e2e/AI-POWERED-E2E-TESTING-SYSTEM.md`

---

*Last Updated: January 2025*
*Architecture Version: 3.0*
*Dependency Injection: Awilix-based*
*Testing: AI-Powered E2E System*