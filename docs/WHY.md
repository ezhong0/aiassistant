# Design Philosophy & Decisions

> **Why this architecture?** Understanding the reasoning behind technical choices, tradeoffs made, and alternatives considered.

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Why 3-Layer Architecture?](#why-3-layer-architecture)
3. [Why Stateless Design?](#why-stateless-design)
4. [Why DAG-Based Execution?](#why-dag-based-execution)
5. [Why Dependency Injection?](#why-dependency-injection)
6. [Why Structured Error Handling?](#why-structured-error-handling)
7. [Why Not...](#why-not)
8. [Future Considerations](#future-considerations)

---

## Core Philosophy

### Principle #1: Optimize for Horizontal Scalability

**Why?** AI workloads are unpredictable. A single complex query might require 30 LLM calls. Vertical scaling has limits.

**How?**
- Stateless HTTP layer (any server handles any request)
- No session affinity required
- Client manages conversation state
- No distributed session storage needed

**Tradeoff**: Clients send conversation history with every request (adds ~1-2KB per request, acceptable for better scalability)

### Principle #2: Fail Fast, Fail Clearly

**Why?** Debugging distributed AI systems is hard. Errors should be:
- Immediately detectable (strict TypeScript, Zod validation)
- Easily traceable (correlation IDs, structured logging)
- User-friendly (AppError with `userFriendly` messages)

**How?**
- TypeScript strict mode catches errors at compile time
- Zod validates at runtime boundaries (API, LLM responses)
- ErrorFactory ensures consistent error creation
- Sentry integration for production monitoring

**Tradeoff**: More upfront validation code (worth it for production reliability)

### Principle #3: Make the Right Thing Easy

**Why?** Developer velocity matters. Common patterns should be zero-config.

**How?**
- BaseService provides lifecycle management automatically
- Strategies auto-register via `@Strategy` decorator
- ErrorFactory provides namespaced error creation
- DI container validates dependencies on startup

**Tradeoff**: More abstraction layers (but patterns are consistent across codebase)

### Principle #4: Predictable Costs & Performance

**Why?** AI API costs can spiral quickly. Users need predictable pricing.

**How?**
- Layer 1 estimates cost/tokens BEFORE execution
- User confirmation for expensive queries (>$0.01)
- Token limits at each layer prevent runaway costs
- Parallel execution minimizes total latency

**Tradeoff**: Extra LLM call for cost estimation (pays for itself in prevented overages)

---

## Why 3-Layer Architecture?

### The Problem

Initial agent-based approach had issues:
- Agents made sequential LLM calls (slow)
- No cost estimation before execution
- Difficult to optimize or cache
- Hard to test deterministically

### The Solution: 3-Layer DAG Pipeline

**Layer 1** (Decomposition): Create execution plan
- **Why separate?** Allows cost estimation & user confirmation
- **Single LLM call** produces entire plan
- **Validates** plan before execution

**Layer 2** (Execution): Execute plan in parallel
- **Why DAG?** Enables parallel execution of independent operations
- **Stage-based** execution respects dependencies
- **Deterministic** - same graph always produces same execution order

**Layer 3** (Synthesis): Convert findings → natural language
- **Why separate?** Allows fine-grained control over output
- **Bounded output** prevents long, rambling responses
- **User preferences** can customize tone/format

### What We Considered

| Alternative | Why Not |
|-------------|---------|
| **Single LLM Call** | Can't parallelize operations, cost estimation impossible, output quality inconsistent |
| **Agents Only** | Sequential execution too slow, unpredictable costs, hard to cache |
| **LangChain/LangGraph** | Too much abstraction, vendor lock-in, harder to debug, overkill for our needs |
| **Function Calling Only** | No parallel execution, no cost control, sequential bottleneck |

### Tradeoffs

**Pros:**
- ✅ Parallel execution (2-5x faster than sequential)
- ✅ Cost estimation before execution
- ✅ User confirmation for expensive queries
- ✅ Testable (each layer independently tested)
- ✅ Cacheable (Layer 2 results can be cached)

**Cons:**
- ❌ Extra LLM call for decomposition (~300 tokens)
- ❌ More complex than single-call approach
- ❌ Requires graph validation logic

**Decision**: Pros outweigh cons for production system with cost control needs.

---

## Why Stateless Design?

### The Problem

Session-based systems create scaling bottlenecks:
- Session affinity required (sticky sessions)
- Distributed session storage needed (Redis Sentinel, etc.)
- Multi-device sync is complex
- Offline mode nearly impossible

### The Solution: Client-Managed State

**Client Stores:**
- Conversation history (AsyncStorage/SQLite)
- User preferences (local cache)
- Offline queue of pending requests

**Server Stores:**
- OAuth tokens (required by OAuth spec)
- User preferences (synced across devices)
- Connected accounts metadata

### What We Considered

| Approach | Why Not |
|----------|---------|
| **Server-Side Sessions** | Requires sticky sessions, no multi-device support, can't work offline |
| **Redis Sessions** | Need Redis Sentinel for HA, adds operational complexity, still breaks multi-device |
| **Cookies** | Size limits (~4KB), mobile apps can't use, privacy concerns |
| **WebSockets** | Persistent connections don't scale horizontally, complex to maintain |

### Tradeoffs

**Pros:**
- ✅ Horizontal scaling without session affinity
- ✅ Multi-device support (client syncs state)
- ✅ Offline-first mobile apps possible
- ✅ Simplified deployment (no distributed sessions)
- ✅ Load balancer can distribute freely

**Cons:**
- ❌ Clients send conversation history each request (~1-2KB overhead)
- ❌ Clients must implement state management
- ❌ Potential for state divergence across devices (solvable with sync strategy)

**Decision**: Mobile-first approach requires offline support, making client-managed state the better choice.

---

## Why DAG-Based Execution?

### The Problem

Sequential execution is slow:
```
Filter emails (200ms)
  → Analyze urgency (1200ms)
    → Rank results (800ms)
      → Read threads (500ms)
Total: 2700ms
```

### The Solution: Parallel DAG Execution

```
Stage 0 (parallel):
  Filter by sender (200ms)  ─┐
  Filter by date (200ms)     ├─→ Stage 1 (parallel):
  Filter by label (200ms)   ─┘      Analyze urgency (1200ms) ─┐
                                     Rank results (800ms)      ├─→ Stage 2:
                                                               ─┘      Read threads (500ms)
Total: 1900ms (30% faster)
```

### What We Considered

| Approach | Why Not |
|----------|---------|
| **Sequential Only** | Too slow for complex queries (3-10s response time) |
| **Fully Parallel** | Dependencies exist (can't analyze emails before filtering them) |
| **Map-Reduce** | Overkill for our scale, harder to reason about |
| **Reactive Streams** | Complex to implement, harder to debug, over-engineering |

### Tradeoffs

**Pros:**
- ✅ 2-5x faster than sequential (depending on query)
- ✅ Explicit dependencies (easy to reason about)
- ✅ Stage-based logging (clear progress tracking)
- ✅ Testable (each stage tested independently)

**Cons:**
- ❌ More complex than sequential execution
- ❌ Requires dependency resolution logic
- ❌ Graph validation needed

**Decision**: Speed gains are critical for UX. Complexity is manageable with good abstractions.

---

## Why Dependency Injection?

### The Problem

Without DI, services had circular dependencies and hard-coded instantiation:

```typescript
// Anti-pattern: Service Locator
class EmailService {
  constructor() {
    this.calendar = serviceManager.get('calendar');  // Implicit dependency
    this.ai = serviceManager.get('ai');              // Hard to test
  }
}
```

### The Solution: Awilix Constructor Injection

```typescript
// Pattern: Constructor Injection
export class EmailDomainService extends BaseDomainService {
  constructor(
    supabaseTokenProvider: SupabaseTokenProvider,
    googleAPIClient: GoogleAPIClient,
    aiService: AIDomainService  // Explicit dependency
  ) {
    super('EmailDomainService', supabaseTokenProvider, googleAPIClient);
  }
}
```

### What We Considered

| Approach | Why Not |
|----------|---------|
| **Manual Instantiation** | Circular dependency hell, hard to test, tight coupling |
| **Service Locator** | Hidden dependencies, hard to test, no compile-time checking |
| **InversifyJS** | Too heavyweight, decorator-heavy, TypeScript-specific complexity |
| **tsyringe** | Microsoft-specific, less mature, smaller ecosystem |

### Why Awilix?

- ✅ Constructor injection (explicit dependencies)
- ✅ No decorators needed (simpler)
- ✅ Supports both TypeScript and JavaScript
- ✅ Mature, well-tested library
- ✅ Lifetime management (singleton, scoped, transient)
- ✅ Validation on startup (fails fast on missing deps)

### Tradeoffs

**Pros:**
- ✅ Explicit dependencies (no surprises)
- ✅ Easy to test (inject mocks in constructor)
- ✅ No circular dependencies
- ✅ Fail fast on startup (missing deps detected immediately)

**Cons:**
- ❌ Boilerplate for registration
- ❌ Learning curve for DI pattern

**Decision**: Type safety and testability are critical for production systems.

---

## Why Structured Error Handling?

### The Problem

Inconsistent error handling leads to:
- Different error formats across services
- Lost context when errors propagate
- Hard to retry intelligently
- Poor user experience

### The Solution: ErrorFactory + AppError

```typescript
// ❌ Bad: Throw generic errors
throw new Error('Google API failed');

// ✅ Good: Use ErrorFactory
throw ErrorFactory.external.google.rateLimit();
// Result: Structured error with:
// - Error code (GOOGLE_RATE_LIMIT)
// - HTTP status (429)
// - Retryable flag (true)
// - Retry-after (60s)
// - Correlation ID
// - User-friendly message
```

### Error Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **api** | API-level errors | badRequest, unauthorized, notFound |
| **domain** | Service errors | serviceUnavailable, agentFailed |
| **workflow** | 3-layer execution | iterationLimit, executionFailed |
| **validation** | Input validation | fieldValidationFailed, invalidInput |
| **external** | 3rd-party APIs | google.rateLimit, openai.timeout |

### What We Considered

| Approach | Why Not |
|----------|---------|
| **Generic Errors** | No structure, hard to handle programmatically, poor UX |
| **HTTP Status Only** | Insufficient for internal errors, can't express retryability |
| **Exception Classes** | Verbose, hard to maintain, doesn't prevent misuse |
| **Result Types** | Too functional, not idiomatic JavaScript, hurts readability |

### Tradeoffs

**Pros:**
- ✅ Consistent error format
- ✅ Correlation IDs for tracing
- ✅ Retry strategies built-in
- ✅ User-friendly messages
- ✅ Structured logging

**Cons:**
- ❌ More code than `throw new Error`
- ❌ Requires discipline to use ErrorFactory

**Decision**: Production reliability requires structured errors. DevEx cost is acceptable.

---

## Why Not...

### Why Not GraphQL?

**Considered**: GraphQL for flexible querying

**Rejected because**:
- Natural language IS our query language
- Clients don't compose queries (LLM does)
- GraphQL overhead not justified
- REST is simpler for our use case

**When we'd use it**: If we had a complex client-driven query UI

---

### Why Not Microservices?

**Considered**: Separate services for Email, Calendar, Contacts

**Rejected because**:
- Cross-domain queries are common ("Show emails about meetings")
- Network latency between services adds 100-500ms per hop
- Operational complexity (deployment, monitoring, debugging)
- Current scale doesn't justify complexity

**When we'd use it**: If individual domains need independent scaling OR different tech stacks

---

### Why Not WebSockets?

**Considered**: WebSocket for real-time streaming

**Rejected because**:
- HTTP/2 Server-Sent Events (SSE) sufficient for our needs
- WebSockets don't work well with load balancers
- Persistent connections harder to scale
- Adds operational complexity

**When we'd use it**: If we needed bidirectional real-time communication

---

### Why Not LangChain/LangGraph?

**Considered**: LangChain for agent orchestration

**Rejected because**:
- Too much abstraction for our needs
- Vendor lock-in concerns
- Harder to debug (magical internals)
- We need fine-grained control over costs
- Graph execution pattern is simple enough to implement

**When we'd use it**: If we needed 20+ agent types or complex retrieval chains

---

### Why Not Serverless (Lambda/Functions)?

**Considered**: AWS Lambda for stateless execution

**Rejected because**:
- Cold starts add 1-3s latency (unacceptable for chat)
- 15min timeout too short for complex queries
- Harder to debug
- More expensive for sustained load
- Container-based deployment simpler

**When we'd use it**: If we had sporadic traffic OR very simple request handlers

---

## Future Considerations

### What Might Change

**1. Caching Layer 2 Results**

**Current**: Every query executes from scratch
**Future**: Cache filtered email results for 5min

**Why not now?** Adds complexity, invalidation strategy needed
**When?** When we see repeated queries within 5min windows

---

**2. Streaming Layer 1 Decomposition**

**Current**: Layer 1 returns complete graph before Layer 2 starts
**Future**: Stream graph nodes as they're generated, start Layer 2 early

**Why not now?** Adds complexity, harder to validate
**When?** When Layer 1 decomposition >2s

---

**3. Multi-Region Deployment**

**Current**: Single region deployment
**Future**: Multi-region for lower latency

**Why not now?** Operational complexity, database replication strategy needed
**When?** When we have global user base with <1s latency requirements

---

**4. GraphQL for Advanced Clients**

**Current**: REST API only
**Future**: GraphQL alongside REST for power users

**Why not now?** Most users use natural language, not structured queries
**When?** When we have API consumers building custom UIs

---

**5. Microservices for Email Domain**

**Current**: Monolithic service
**Future**: Separate Email service if it scales independently

**Why not now?** Cross-domain queries are common, network latency cost
**When?** When Email domain has 10x more traffic than others

---

## See Also

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and implementation details
- **[backend/docs/adr/](../backend/docs/adr/)** - Specific architectural decisions with context
- **[backend/docs/development/QUICK_REFERENCE.md](../backend/docs/development/QUICK_REFERENCE.md)** - Common development patterns

---

**Last Updated**: 2025-10
