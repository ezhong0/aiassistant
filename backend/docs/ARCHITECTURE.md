# AI Assistant Application - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Service Layer](#service-layer)
4. [Agent Architecture](#agent-architecture)
5. [Workflow Execution](#workflow-execution)
6. [Tool Registry System](#tool-registry-system)
7. [Data Flow](#data-flow)
8. [Authentication & Authorization](#authentication--authorization)
9. [Key Design Patterns](#key-design-patterns)
10. [Recent Refactoring](#recent-refactoring)

---

## Overview

This is an AI-powered assistant application that orchestrates multiple domain-specific services (Email, Calendar, Contacts, Slack) through an intelligent agent system. The architecture follows clean separation of concerns with three distinct layers:

- **Presentation Layer**: Express routes, middleware
- **Business Logic Layer**: Agents, workflow execution
- **Data Layer**: Domain services, API clients, database

### Core Technologies
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **AI**: OpenAI GPT-4 (via GenericAIService)
- **Database**: PostgreSQL (via DatabaseService)
- **Cache**: Redis (via CacheService)
- **External APIs**: Gmail, Google Calendar, Slack

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

## Service Layer

### Three Service Management Systems

The application uses **three distinct service management systems**, each with a specific purpose:

#### 1. **ServiceManager** (Core Infrastructure)
Location: `src/services/service-manager.ts`

**Purpose**: Manages core infrastructure services

**Services**:
- DatabaseService
- CacheService
- OAuthStateService
- TokenStorageService
- AuthStatusService
- AuthService
- TokenManager
- GenericAIService
- AIServiceCircuitBreaker
- GoogleOAuthManager
- SlackOAuthManager
- ContextManager

**Features**:
- Dependency tracking
- Initialization ordering
- Singleton pattern
- Health checking

#### 2. **DomainServiceContainer** (Domain Services)
Location: `src/services/domain/dependency-injection/domain-service-container.ts`

**Purpose**: Manages domain-specific business logic services

**Services**:
- EmailDomainService (Gmail operations)
- CalendarDomainService (Google Calendar operations)
- ContactsDomainService (Google Contacts operations)
- SlackDomainService (Slack API operations)
- AIDomainService (AI/OpenAI operations)

**Features**:
- Lazy initialization
- Service resolution
- Dependency injection
- Health monitoring

#### 3. **AgentFactory** (Agent Management)
Location: `src/framework/agent-factory.ts`

**Purpose**: Manages SubAgent lifecycle and discovery

**Agents**:
- EmailAgent
- CalendarAgent
- ContactAgent
- SlackAgent

**Features**:
- Agent registration
- Capability discovery
- Natural language execution
- Agent health checking
- Enable/disable agents

### Service Initialization Flow

**Order of Initialization** (from `service-initialization.ts`):

```typescript
1. Config Validation (UnifiedConfig singleton)
2. Domain Services Initialization
   ↓
3. Core Infrastructure Services:
   - DatabaseService (no dependencies)
   - CacheService (no dependencies)
   - OAuthStateService (→ cacheService)
   - TokenStorageService (→ databaseService)
   - AuthStatusService (→ tokenStorageService)
   - AuthService (no dependencies)
   - TokenManager (→ tokenStorageService, authService)
   - GenericAIService (no dependencies)
   - AIServiceCircuitBreaker (no dependencies)
   - GoogleOAuthManager (→ authService, tokenManager, oauthStateService)
   - SlackOAuthManager (→ tokenManager, oauthStateService)
   - ContextManager (→ cacheService)
   ↓
4. Agent Factory Initialization
   ↓
5. Circuit Breaker Connections
```

**Key Points**:
- Services declare dependencies explicitly
- ServiceManager initializes in dependency order
- Circular dependencies are not allowed
- Failed services are logged but don't crash app

### BaseService Pattern

All services extend `BaseService` which provides:

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
- Consistent lifecycle management
- Health checking
- Logging
- Ready-state assertions

---

## Agent Architecture

### Master Agent

Location: `src/agents/master.agent.ts`

**Responsibilities**:
1. **Understanding & Planning**: Analyze user request and create workflow plan
2. **Execution Loop**: Coordinate SubAgents via WorkflowExecutor
3. **Final Output**: Generate human-readable response

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

### SubAgent Architecture

Location: `src/framework/base-subagent.ts`

All SubAgents (EmailAgent, CalendarAgent, etc.) extend `BaseSubAgent` and implement a **3-phase workflow**:

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

### Agent-to-Service Mapping

Each SubAgent:
1. Gets its domain service from `DomainServiceResolver`
2. Uses `ToolRegistry` to discover available tools
3. Maps tool names to service methods
4. Executes tool calls by invoking service methods

**Example (EmailAgent)**:

```typescript
class EmailAgent extends BaseSubAgent {
  private emailService: IEmailDomainService

  constructor() {
    super('email', {...})
    this.emailService = DomainServiceResolver.getEmailService()
  }

  protected getAvailableTools(): string[] {
    return ToolRegistry.getToolNamesForDomain('email')
  }

  protected async executeToolCall(toolName, params) {
    const serviceMethod = this.getToolToServiceMap()[toolName]
    return await this.emailService[serviceMethod](userId, params)
  }
}
```

---

## Workflow Execution

### WorkflowExecutor

Location: `src/services/workflow-executor.service.ts`

**Purpose**: Orchestrate multi-step workflows with iterative execution

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

Location: `src/framework/tool-registry.ts`

**Purpose**: Single source of truth for all tool definitions

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
- **Single source of truth**: No duplication
- **Type safety**: Parameter validation
- **AI-friendly**: Generate definitions for prompts
- **Discoverability**: Easy to find available tools
- **Maintainability**: Change once, update everywhere

---

## Data Flow

### End-to-End Request Flow

**Example: User asks "Send email to John"**

```
1. Slack Event → SlackRoutes
   ↓
2. SlackRoutes → MasterAgent.processUserInput()
   ↓
3. MasterAgent:
   a. Build message history (ContextManager)
   b. Analyze & Plan: "Need to send email to John"
   c. WorkflowExecutor.execute()
   ↓
4. WorkflowExecutor (Iteration 1):
   a. Environment Check: ✓ Have all info
   b. Action Execution: "Execute EmailAgent with 'send email to John'"
   c. Delegate to EmailAgent
   ↓
5. EmailAgent (3-phase):
   a. Intent Assessment: Need tool 'send_email', params {to: 'john@...', body: '...'}
   b. Tool Execution:
      - ToolRegistry: send_email → EmailDomainService.sendEmail()
      - EmailDomainService.sendEmail(userId, params)
      - GoogleAPIClient.makeRequest('/gmail/send', ...)
      - OAuth token via TokenManager
      - API call to Gmail
   c. Response Formatting: "Sent email to John successfully"
   ↓
6. WorkflowExecutor (Iteration 1 continued):
   c. Progress Assessment: ✓ Complete
   d. Return final context
   ↓
7. MasterAgent:
   d. Generate final response: "I've sent the email to John for you"
   ↓
8. SlackRoutes → Slack API
   ↓
9. User sees: "I've sent the email to John for you"
```

### Context Management

**ContextManager** tracks conversation history:

```typescript
class ContextManager {
  // Store conversation history
  async saveContext(sessionId, context): Promise<void>

  // Retrieve conversation history
  async getContext(sessionId): Promise<string | null>

  // Clear old contexts
  async clearContext(sessionId): Promise<void>
}
```

**Context Format** (SimpleContext pattern):

```
User Request: "Send email to John about meeting"

Previous Context:
- User is named Alice
- John's email is john@example.com
- Meeting is tomorrow at 2pm

Current Step:
Executing EmailAgent to send email

Results:
✓ Email sent successfully (ID: msg_123)
```

---

## Authentication & Authorization

### OAuth Flow

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

**TokenManager** (src/services/token-manager.ts):

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
- Encrypted at rest
- Associated with userId (format: `teamId:slackUserId`)
- Includes expiry time for proactive refresh

**Token Validation**:
1. Check if token exists
2. Check if expired (locally)
3. If expired, refresh using refresh_token
4. If refresh fails, require re-auth
5. Return valid token to caller

---

## Key Design Patterns

### 1. **Dependency Injection**
- Services don't create dependencies
- Dependencies injected via ServiceManager
- Testable and flexible

```typescript
// Bad
class EmailAgent {
  private service = new EmailDomainService() // Hard-coded!
}

// Good
class EmailAgent {
  private service: IEmailDomainService
  constructor() {
    this.service = DomainServiceResolver.getEmailService()
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

## Recent Refactoring

### **Phase 1: Route Handler Extraction** ✅

**Before**: `auth.routes.ts` (1,249 lines)
- OAuth flows, token management, debug endpoints, business logic all mixed

**After**: Modular structure
```
routes/auth/
├── index.ts              (router with environment gating)
├── oauth.routes.ts       (OAuth flows)
├── token.routes.ts       (token management)
└── debug/                (debug endpoints - dev only)
    ├── index.ts
    ├── test-oauth.routes.ts
    └── config.routes.ts
```

**Benefits**:
- Files now 150-450 lines (manageable)
- Debug routes only in development
- Clear separation of concerns
- Easier testing

**Location**: `src/routes/auth/`

---

### **Phase 2: Environment-Gated Debug Router** ✅

**Implementation**:
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

### **Phase 3: Bug Fixes** ✅

**Bug**: Execution time always 0

**Before**:
```typescript
executionTime: Date.now() - Date.now()  // Always 0!
```

**After**:
```typescript
const startTime = Date.now()
// ... operation ...
executionTime: Date.now() - startTime  // Accurate!
```

**Fixed in**: `ai-domain.service.ts` (3 methods)
- `generateChatCompletion`
- `generateTextCompletion`
- `generateEmbeddings`

---

### **Phase 4: Architectural Analysis** ✅

**Decision**: Keep `slack-domain.service.ts` as-is (1,253 lines)

**Reasoning**:
- Comprehensive Slack API wrapper (intentional design)
- 20 methods, all following consistent patterns
- No code duplication
- Splitting would add coordination overhead
- Already well-organized by functionality

---

## Architecture Decisions Records (ADRs)

### ADR-001: Three Service Management Systems

**Decision**: Use three separate service management systems

**Context**:
- ServiceManager: Infrastructure (DB, cache, auth)
- DomainServiceContainer: Business logic (email, calendar)
- AgentFactory: Agents

**Reasoning**:
- Different lifecycles
- Different concerns
- Clear boundaries
- Independent evolution

**Alternatives Considered**:
- Single unified manager: Too complex, mixed concerns
- No management: Chaos, circular dependencies

**Status**: Accepted ✅

---

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

**Alternatives Considered**:
- Single-phase: Less structured, harder to debug
- Custom workflows per agent: Inconsistent, hard to maintain

**Status**: Accepted ✅

---

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

**Alternatives Considered**:
- Tool definitions in agents: Duplication
- Tool definitions in services: Mixed concerns

**Status**: Accepted ✅

---

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

**Alternatives Considered**:
- Structured JSON: Rigid schema, harder for AI
- Database storage: Complexity, performance

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

3. **Register in Container** (`domain/index.ts`):
```typescript
container.register('newDomainService', () => new NewDomainService())
```

4. **Add to Resolver** (`domain-service-container.ts`):
```typescript
static getNewService(): INewDomainService {
  return container.resolve('newDomainService')
}
```

### Adding a New SubAgent

1. **Create Agent** (`agents/new.agent.ts`):
```typescript
export class NewAgent extends BaseSubAgent {
  constructor() {
    super('new', { name: 'NewAgent', ... })
    this.service = DomainServiceResolver.getNewService()
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

3. **Register Agent** (`agent-factory.ts`):
```typescript
this.registerAgentClass('newAgent', NewAgent)
```

### Adding a New Route

1. **Create Route File** (`routes/new.routes.ts`):
```typescript
const router = express.Router()
router.get('/endpoint', middleware, handler)
export default router
```

2. **Mount in App** (`index.ts`):
```typescript
app.use('/api/new', newRoutes)
```

3. **Add Middleware**: Rate limiting, auth, validation

---

## Troubleshooting

### Common Issues

**Issue**: Agent not found
```
Solution: Check AgentFactory registration in agent-factory.ts
```

**Issue**: Service not initialized
```
Solution: Check service-initialization.ts dependency order
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
Use DomainServiceResolver or ServiceManager
```

---

## Performance Considerations

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

---

## Security Considerations

### OAuth Security
- Tokens encrypted at rest
- State parameter signed (HMAC)
- CSRF protection
- Token expiry validation

### API Security
- Rate limiting per user
- Input validation (Zod schemas)
- SQL injection prevention (parameterized queries)
- XSS protection (sanitized inputs)

### Environment Variables
- Never commit .env files
- Use secrets management in production
- Validate all config at startup

---

## Future Improvements

### Potential Enhancements
1. **Event sourcing**: Track all agent actions
2. **Audit logging**: Compliance and debugging
3. **A/B testing**: Test different prompts
4. **Multi-language**: i18n support
5. **Real-time updates**: WebSocket for progress
6. **Analytics**: Track usage patterns
7. **Testing**: More integration and E2E tests

### Scalability Considerations
1. **Horizontal scaling**: Stateless design
2. **Queue system**: Background job processing
3. **Microservices**: Split into smaller services
4. **Database sharding**: Scale data layer
5. **CDN**: Static asset delivery

---

## References

### Key Files
- **Service Initialization**: `src/services/service-initialization.ts`
- **Master Agent**: `src/agents/master.agent.ts`
- **Base SubAgent**: `src/framework/base-subagent.ts`
- **Workflow Executor**: `src/services/workflow-executor.service.ts`
- **Tool Registry**: `src/framework/tool-registry.ts`
- **Domain Services**: `src/services/domain/`
- **Auth Routes**: `src/routes/auth/`

### Related Documentation
- API Documentation: `/docs/swagger.ts`
- Environment Setup: `/.env.example`
- Database Schema: `/prisma/schema.prisma` (if using Prisma)

---

*Last Updated: September 2025*
*Architecture Version: 2.0*
*Refactoring Phase: Completed*