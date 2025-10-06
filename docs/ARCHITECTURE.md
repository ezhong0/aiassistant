# System Architecture

> **Single Source of Truth** for AI Assistant Application architecture, design patterns, and system-level decisions.

## Table of Contents

1. [System Overview](#system-overview)
2. [3-Layer Architecture](#3-layer-architecture)
3. [Dependency Injection & Service Management](#dependency-injection--service-management)
4. [Data Flow & Processing](#data-flow--processing)
5. [Error Handling System](#error-handling-system)
6. [Stateless Design](#stateless-design)
7. [Scalability & Performance](#scalability--performance)
8. [Technology Stack](#technology-stack)
9. [Directory Structure](#directory-structure)

---

## System Overview

The AI Assistant Application is a **stateless, horizontally-scalable backend** that processes natural language queries about email, calendar, contacts, and Slack data through an intelligent 3-layer processing pipeline.

### Core Design Principles

1. **Stateless Architecture**: Client manages conversation state, server can handle any request
2. **Horizontal Scalability**: Any server instance can process any request (no session affinity)
3. **Dependency Injection**: Constructor-based DI with Awilix for clean service dependencies
4. **Lifecycle Management**: All services follow initialize → ready → destroy pattern
5. **Type Safety**: Full TypeScript with strict mode, Zod validation at boundaries
6. **Error Transparency**: Structured errors with correlation IDs, retry strategies, and user-friendly messages

---

## 3-Layer Architecture

The system uses a **DAG-based execution model** where Layer 1 creates a plan, Layer 2 executes it in parallel stages, and Layer 3 synthesizes results.

### Architecture Diagram

```
User Query: "Show me urgent emails from my boss"
    ↓
┌─────────────────────────────────────────────────────┐
│ ORCHESTRATOR (orchestrator.service.ts)             │
│ - Coordinates all 3 layers                          │
│ - Tracks timing & token usage                       │
│ - Handles confirmation workflows                    │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ LAYER 1: Query Decomposition                        │
│ (query-decomposer.service.ts)                       │
│                                                      │
│ Input:  Natural language + conversation history     │
│ Output: ExecutionGraph (DAG of operations)          │
│                                                      │
│ Components:                                          │
│ • DecompositionPromptBuilder - Builds LLM prompt    │
│ • ExecutionGraphValidator - Validates graph         │
│                                                      │
│ Produces:                                            │
│ {                                                    │
│   query_classification: { type, complexity, ... }   │
│   information_needs: [                              │
│     { id: "node1", type: "metadata_filter", ... },  │
│     { id: "node2", type: "semantic_analysis", ... } │
│   ],                                                 │
│   resource_estimate: { tokens, cost, time }         │
│ }                                                    │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ LAYER 2: Parallel Execution                         │
│ (execution-coordinator.service.ts)                  │
│                                                      │
│ Executes ExecutionGraph in stages:                  │
│                                                      │
│ Stage 0 (parallel):                                 │
│   ├─ metadata_filter → emails from boss            │
│   └─ metadata_filter → emails from today           │
│                                                      │
│ Stage 1 (parallel, depends on Stage 0):            │
│   ├─ semantic_analysis → analyze urgency           │
│   └─ cross_reference → rank results                │
│                                                      │
│ Strategy Types (5 total):                           │
│ • metadata_filter    - Filter by date/sender/label  │
│ • keyword_search     - Text-based search            │
│ • batch_thread_read  - Fetch email threads          │
│ • semantic_analysis  - LLM-based intent detection   │
│ • cross_reference    - Rank/combine prev results    │
│                                                      │
│ Output: Map<nodeId, NodeResult> with structured data│
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ LAYER 3: Response Synthesis                         │
│ (synthesis.service.ts)                              │
│                                                      │
│ Input:  Structured findings from Layer 2            │
│ Output: Natural language response                   │
│                                                      │
│ Process:                                             │
│ 1. Format findings (remove raw data, keep summaries)│
│ 2. Build synthesis prompt with user preferences     │
│ 3. Call LLM to generate natural language            │
│ 4. Return bounded response (<2000 tokens)           │
│                                                      │
│ User Preferences:                                    │
│ • tone: professional|casual|concise                 │
│ • verbosity: brief|normal|detailed                  │
│ • format: bullets|prose                             │
└─────────────────────────────────────────────────────┘
    ↓
Natural Language Response + Metadata
```

### Layer Responsibilities

**Layer 1: Query Decomposition**
- **Input**: `{ user_query, conversation_history, user_context, timestamp }`
- **Output**: `ExecutionGraph` (validated DAG)
- **Purpose**: Convert natural language into structured execution plan
- **LLM Usage**: 1 call to decompose intent → execution graph
- **Key Files**:
  - `layers/layer1-decomposition/query-decomposer.service.ts` - Main service
  - `layers/layer1-decomposition/decomposition-prompt-builder.ts` - Prompt generation
  - `layers/layer1-decomposition/execution-graph-validator.ts` - Graph validation
  - `layers/layer1-decomposition/execution-graph.types.ts` - Type definitions

**Layer 2: Execution Coordinator**
- **Input**: `ExecutionGraph` + `userId`
- **Output**: `Map<nodeId, NodeResult>` with structured data
- **Purpose**: Execute DAG in parallel stages, respecting dependencies
- **LLM Usage**: 0-N calls depending on semantic_analysis nodes
- **Parallel Execution**: Groups nodes by `parallel_group`, executes stage-by-stage
- **Dependency Resolution**: Resolves `{{nodeId.field}}` references from previous stages
- **Key Files**:
  - `layers/layer2-execution/execution-coordinator.service.ts` - Orchestrator
  - `layers/layer2-execution/strategy-registry.ts` - Strategy resolution
  - `layers/layer2-execution/strategies/*.ts` - 5 strategy implementations

**Layer 3: Response Synthesis**
- **Input**: `{ original_query, execution_graph, execution_results, user_preferences }`
- **Output**: `{ message, metadata }`
- **Purpose**: Convert structured findings → natural language
- **LLM Usage**: 1 call to synthesize response
- **Token Limits**: Input prompt condensed, output capped at 2000 tokens
- **Key Files**:
  - `layers/layer3-synthesis/synthesis.service.ts` - Main service
  - `layers/layer3-synthesis/synthesis.types.ts` - Type definitions

### Strategy Pattern (Layer 2)

Each execution node type maps to a strategy executor:

| Node Type | Strategy Class | Purpose | LLM Calls |
|-----------|---------------|---------|-----------|
| `metadata_filter` | `MetadataFilterStrategy` | Filter emails by metadata (date, sender, label, read status) | 0 |
| `keyword_search` | `KeywordSearchStrategy` | Text-based search across email content | 0 |
| `batch_thread_read` | `BatchThreadReadStrategy` | Fetch full email threads in batch | 0 |
| `semantic_analysis` | `SemanticAnalysisStrategy` | LLM-based intent/urgency/sentiment analysis | 1 per email (batched) |
| `cross_reference` | `CrossReferenceStrategy` | Rank/filter/combine results from previous nodes | 1 (ranking) |

**Strategy Registration**: Auto-registration via `@Strategy` decorator (zero-config pattern)

**Base Classes**:
- `BaseStrategy` - Common functionality (result creation, logging)
- Located in `layers/layer2-execution/strategies/base-strategy.ts`

---

## Dependency Injection & Service Management

### Awilix Container

The application uses **Awilix** for constructor-based dependency injection with strict mode enabled.

```typescript
// DI Container Creation (di/container.ts)
const container = createContainer<Cradle>({
  injectionMode: InjectionMode.CLASSIC,  // Constructor injection
  strict: true,                           // Fail fast on missing deps
});
```

### Service Registrations

Services are registered in category-based files under `di/registrations/`:

1. **`core-services.ts`** - Infrastructure (CacheService, EncryptionService, SentryService)
2. **`auth-services.ts`** - Authentication (SupabaseTokenProvider)
3. **`ai-services.ts`** - AI (AIDomainService, AICircuitBreaker)
4. **`domain-services.ts`** - Business logic (EmailDomainService, CalendarDomainService, etc.)
5. **`layer-services.ts`** - 3-layer architecture services
6. **`middleware-services.ts`** - Express middleware
7. **`framework-services.ts`** - Tool registry, API clients

### Service Lifecycle

All services extend `BaseService` and follow a strict lifecycle:

```typescript
export abstract class BaseService implements IService {
  // States: CREATED → INITIALIZING → READY → SHUTTING_DOWN → DESTROYED

  async initialize(): Promise<void> {
    this._state = ServiceState.INITIALIZING;
    await this.onInitialize();  // Subclass implements
    this._state = ServiceState.READY;
  }

  async destroy(): Promise<void> {
    this._state = ServiceState.SHUTTING_DOWN;
    await this.onDestroy();  // Subclass implements
    this._state = ServiceState.DESTROYED;
  }

  // Helpers for subclasses
  protected assertReady(): void { /* throws if not ready */ }
  protected logError(msg, error, meta): void { /* structured logging */ }
  protected executeWithRetry<T>(...): Promise<T> { /* retry logic */ }
}
```

**Key Patterns**:
- ✅ Constructor injection (dependencies declared in constructor)
- ✅ Singleton lifetime for most services
- ✅ Health checks via `getHealth()` method
- ✅ Graceful shutdown in reverse dependency order
- ❌ Never use service locator pattern (don't pass container around)

### Domain Service Pattern

Google-based services (Email, Calendar, Contacts) extend `BaseDomainService`:

```typescript
export abstract class BaseDomainService extends BaseService {
  constructor(
    serviceName: string,
    protected supabaseTokenProvider: SupabaseTokenProvider,
    protected googleAPIClient: GoogleAPIClient
  ) {
    super(serviceName);
  }

  // Shared authentication helper
  protected async getGoogleCredentials(userId: string): Promise<AuthCredentials> {
    const tokens = await this.supabaseTokenProvider.getGoogleTokens(userId);
    return { type: 'oauth2', accessToken: tokens.access_token, ... };
  }

  // Shared health check
  getHealth() { /* checks initialized, hasGoogleClient, authenticated */ }
}
```

---

## Data Flow & Processing

### Request Processing Flow

```
Client Request (POST /api/chat/message)
  ↓
┌─────────────────────────────────────┐
│ Express Middleware Chain            │
├─────────────────────────────────────┤
│ 1. request-id.middleware.ts         │ → Generate correlation ID
│ 2. security.middleware.ts           │ → Helmet security headers
│ 3. rate-limiting.middleware.ts      │ → Throttle requests
│ 4. api-logging.middleware.ts        │ → Log request start
│ 5. supabase-auth.middleware.ts      │ → Verify JWT token
│ 6. validation.middleware.ts         │ → Validate request schema
└─────────────────────────────────────┘
  ↓
Route Handler (chat.routes.ts)
  ↓
OrchestratorService.processUserInput()
  ├─ Layer 1: Decompose query → ExecutionGraph
  ├─ Check if confirmation needed (expensive query)
  ├─ Layer 2: Execute graph → NodeResults
  ├─ Layer 3: Synthesize → Natural language
  └─ Return { message, metadata }
  ↓
┌─────────────────────────────────────┐
│ Error Middleware                    │
├─────────────────────────────────────┤
│ error-handler.middleware.ts         │ → Transform errors
│ sentry.middleware.ts                │ → Log to Sentry
└─────────────────────────────────────┘
  ↓
Client Response (JSON)
{
  message: "You have 3 urgent emails from your boss...",
  metadata: {
    processingTime: 2345,
    tokensUsed: 1250,
    layers: { layer1_tokens: 300, layer2_tokens: 200, layer3_tokens: 750 }
  }
}
```

### Stateless Request Handling

**Client Responsibilities**:
1. Store conversation history locally (AsyncStorage, SQLite)
2. Send last 3-5 conversation turns with each request
3. Handle offline mode (queue requests)
4. Manage multi-device sync (optional)

**Server Responsibilities**:
1. Process each request independently
2. Store only persistent data (OAuth tokens, user preferences)
3. Cache user context for 30min (optional, via Redis)
4. No session state, no sticky sessions

**Why Stateless?**
- ✅ Horizontal scaling without session affinity
- ✅ Simplified deployment (no state management)
- ✅ Multi-device support (client manages state)
- ✅ Offline-first mobile apps
- ✅ Load balancer can distribute freely

---

## Error Handling System

### Error Hierarchy

```
AppError (base)
├── APIClientError (API-related errors)
├── WorkflowError (3-layer execution errors)
├── DomainError (service errors)
├── ValidationError (input validation)
└── AuthenticationError (auth failures)
```

### ErrorFactory Pattern

All errors created via `ErrorFactory` for consistency:

```typescript
// API Errors
ErrorFactory.api.badRequest(message, details)
ErrorFactory.api.unauthorized(message)
ErrorFactory.api.notFound(resource)
ErrorFactory.api.rateLimited(message, retryAfter)

// Domain Errors
ErrorFactory.domain.serviceError(serviceName, message, details)
ErrorFactory.domain.serviceTimeout(serviceName, timeout)
ErrorFactory.domain.agentFailed(agentName, originalError)

// Workflow Errors
ErrorFactory.workflow.executionFailed(message, workflowId, iteration)
ErrorFactory.workflow.iterationLimit(current, max, workflowId)

// External API Errors
ErrorFactory.external.google.authFailed()
ErrorFactory.external.google.rateLimit()
ErrorFactory.external.openai.timeout()
```

### Retry Strategy

**RetryManager** (`errors/retry-manager.ts`) provides:
- Exponential backoff (100ms → 200ms → 400ms → ...)
- Configurable retry attempts
- Retryable error detection (based on error codes/types)
- Fallback strategies

```typescript
// In BaseService
protected async executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  const result = await retryManager.execute(
    operation,
    retryConfig,
    { service: this.name, operation: operationName }
  );

  if (!result.success) {
    throw this.handleError(result.error, operationName);
  }

  return result.result!;
}
```

### Error Correlation

**Correlation IDs** track requests across services:
1. Generated in `request-id.middleware.ts`
2. Attached to all log entries
3. Included in error responses
4. Sent to Sentry for tracking

**Error Logging Flow**:
```
Error occurs in service
  ↓
BaseService.handleError()
  ↓
ErrorFactory creates AppError with correlation ID
  ↓
logger.error() with structured metadata
  ↓
Sentry middleware captures for monitoring
  ↓
error-handler.middleware transforms for client
  ↓
Client receives user-friendly message
```

---

## Stateless Design

### Why Stateless?

The system is designed to be **completely stateless** at the HTTP layer:

1. **Horizontal Scalability**: Any server can handle any request
2. **No Session Affinity**: Load balancer can distribute freely
3. **Multi-Device Support**: Client manages conversation state
4. **Simplified Deployment**: No distributed session storage needed
5. **Offline-First Mobile**: Local state with optional sync

### What's Stateless

✅ **Conversation State**: Client sends conversation history with each request
✅ **Compute Layer**: No in-memory user state
✅ **Request Handling**: Each request is independent

### What Uses Persistent Storage

These are stored in Supabase (PostgreSQL):
- ✅ **OAuth Tokens**: Required by OAuth 2.0 spec (encrypted at rest)
- ✅ **User Preferences**: Tone, verbosity, timezone, etc.
- ✅ **Connected Accounts**: Gmail, Slack credentials

### Optional Caching Layer

Redis is used for **performance optimization** (not required):
- User context cached for 30min (accounts, timezone)
- Can be disabled via `DISABLE_REDIS=true`
- Cache misses fall back to database

### Client-Side State Management

**Frontend (React Native)**:
```typescript
// Local conversation storage
await AsyncStorage.setItem('conversation:123', JSON.stringify(history));

// Send to server with context
const response = await api.sendMessage(message, {
  conversationHistory: history.slice(-5),  // Last 5 turns
  userId
});

// Update local state
await AsyncStorage.setItem('conversation:123',
  JSON.stringify([...history, userMessage, assistantResponse])
);
```

---

## Scalability & Performance

### Horizontal Scaling Architecture

```
Load Balancer (Round Robin / Least Connections)
    ↓
┌─────────┬─────────┬─────────┬─────────┐
│ API     │ API     │ API     │ API     │
│ Server 1│ Server 2│ Server 3│ Server 4│
└─────────┴─────────┴─────────┴─────────┘
      ↓         ↓         ↓         ↓
┌────────────────────────────────────────┐
│   Redis Cache (Optional)               │
│   - User context (30min TTL)           │
│   - Rate limiting counters             │
└────────────────────────────────────────┘
      ↓         ↓         ↓         ↓
┌────────────────────────────────────────┐
│   Supabase PostgreSQL                  │
│   - OAuth tokens (encrypted)           │
│   - User preferences                   │
└────────────────────────────────────────┘
```

### Performance Optimizations

**1. Parallel Execution** (Layer 2)
- Groups operations by `parallel_group`
- Executes all nodes in a stage concurrently
- Example: Filter emails AND analyze sentiment in parallel

**2. DataLoader Pattern** (10x reduction in API calls)
- Batches multiple requests to same resource
- Deduplicates identical requests
- Located in `services/api/data-loader.ts`

**3. Response Streaming** (Server-Sent Events)
- Streams Layer 3 synthesis output as it generates
- Reduces perceived latency
- Better UX for long responses

**4. Redis Caching** (Optional)
- User context cached for 30min
- Rate limit counters cached
- Can be disabled without breaking functionality

**5. Connection Pooling**
- PostgreSQL connection pool
- Google API client connection reuse
- Prevents connection exhaustion

### Scalability Limits

| Metric | Current Capacity | With Optimization | With Horizontal Scaling |
|--------|------------------|-------------------|-------------------------|
| Concurrent Users | ~1,000 per instance | ~10,000 per instance | Unlimited |
| Requests/sec | ~100 | ~1,000 | Unlimited |
| Avg Response Time | <3s | <2s | <2s |
| Token Usage | ~1,500 per request | ~1,000 per request | - |

---

## Technology Stack

### Backend

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Runtime** | Node.js 18+ | JavaScript runtime |
| **Language** | TypeScript 5.x (strict mode) | Type safety |
| **Framework** | Express.js | HTTP server |
| **DI Container** | Awilix | Dependency injection |
| **Database** | PostgreSQL (Supabase) | User data, OAuth tokens |
| **Cache** | Redis (optional) | Performance optimization |
| **AI** | OpenAI GPT-4o | LLM processing |
| **Auth** | Supabase Auth | OAuth 2.0 management |
| **Validation** | Zod | Runtime schema validation |
| **Logging** | Winston | Structured logging |
| **Monitoring** | Sentry | Error tracking |
| **Testing** | Jest | Unit, integration, E2E tests |

### External APIs

| Service | Purpose | Auth Method |
|---------|---------|-------------|
| Gmail API | Email operations | OAuth 2.0 |
| Google Calendar API | Calendar operations | OAuth 2.0 |
| Google Contacts API | Contact operations | OAuth 2.0 |
| Slack API | Slack operations | OAuth 2.0 |
| OpenAI API | LLM processing | API Key |

### Frontend

| Category | Technology |
|----------|-----------|
| **Framework** | React Native |
| **Language** | TypeScript |
| **Storage** | AsyncStorage / SQLite |
| **Design System** | Custom design tokens |

---

## Directory Structure

### High-Level Organization

```
assistantapp/
├── backend/                 # Node.js API server
│   ├── src/                # Source code
│   │   ├── layers/         # 3-layer architecture
│   │   ├── services/       # Business logic
│   │   ├── di/             # Dependency injection
│   │   ├── errors/         # Error handling
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── config/         # Configuration
│   │   └── index.ts        # Entry point
│   ├── tests/              # Test files
│   └── docs/               # Documentation
│
├── frontend/               # React Native app
│   └── ChatbotApp/
│       ├── src/
│       ├── ios/
│       └── android/
│
└── docs/                   # Project-level docs
    ├── ARCHITECTURE.md     # This file
    └── WHY.md              # Design philosophy
```

### Backend Source Structure

```
src/
├── layers/                      # 3-Layer Architecture
│   ├── orchestrator.service.ts           # Coordinates all layers
│   ├── layer1-decomposition/
│   │   ├── query-decomposer.service.ts   # Main service
│   │   ├── decomposition-prompt-builder.ts
│   │   ├── execution-graph-validator.ts
│   │   └── execution-graph.types.ts
│   ├── layer2-execution/
│   │   ├── execution-coordinator.service.ts
│   │   ├── strategy-registry.ts
│   │   ├── execution.types.ts
│   │   └── strategies/
│   │       ├── base-strategy.ts
│   │       ├── metadata-filter-strategy.ts
│   │       ├── keyword-search-strategy.ts
│   │       ├── batch-thread-read-strategy.ts
│   │       ├── cross-reference-strategy.ts
│   │       └── semantic-analysis-strategy.ts
│   └── layer3-synthesis/
│       ├── synthesis.service.ts
│       └── synthesis.types.ts
│
├── services/                    # Business Logic
│   ├── base-service.ts                    # Base class for all services
│   ├── domain/                            # Domain services
│   │   ├── base-domain.service.ts         # Base for Google services
│   │   ├── ai-domain.service.ts
│   │   ├── email-domain.service.ts
│   │   ├── calendar-domain.service.ts
│   │   └── contacts-domain.service.ts
│   ├── api/                               # API clients
│   │   ├── clients/
│   │   │   ├── google-api-client.ts
│   │   │   └── openai-api-client.ts
│   │   └── data-loader.ts                 # DataLoader pattern
│   ├── cache.service.ts
│   ├── encryption.service.ts
│   ├── sentry.service.ts
│   ├── user-context.service.ts
│   └── user-preferences.service.ts
│
├── di/                          # Dependency Injection
│   ├── container.ts                       # Awilix container setup
│   └── registrations/                     # Service registrations
│       ├── core-services.ts
│       ├── auth-services.ts
│       ├── ai-services.ts
│       ├── domain-services.ts
│       ├── layer-services.ts
│       ├── middleware-services.ts
│       └── framework-services.ts
│
├── errors/                      # Error Handling
│   ├── error-factory.ts                   # Main error factory
│   ├── error-codes.ts                     # Error code constants
│   ├── specialized-errors.ts              # Error subclasses
│   ├── retry-manager.ts                   # Retry logic
│   └── transformers.ts                    # Error transformers
│
├── middleware/                  # Express Middleware
│   ├── request-id.middleware.ts
│   ├── security.middleware.ts
│   ├── rate-limiting.middleware.ts
│   ├── api-logging.middleware.ts
│   ├── supabase-auth.middleware.ts
│   ├── validation.middleware.ts
│   ├── error-handler.middleware.ts
│   └── sentry.middleware.ts
│
├── config/                      # Configuration
│   └── unified-config.ts                  # Zod-validated config
│
└── routes/                      # API Routes
    └── chat.routes.ts
```

---

## See Also

- **[WHY.md](./WHY.md)** - Design philosophy and decision rationale
- **[backend/docs/api/commands.md](../backend/docs/api/commands.md)** - E2E testing command library
- **[backend/docs/adr/](../backend/docs/adr/)** - Architecture Decision Records
- **[backend/docs/development/QUICK_REFERENCE.md](../backend/docs/development/QUICK_REFERENCE.md)** - Common development tasks

---

**Last Updated**: 2025-10 (based on commit `7666e1a`)
