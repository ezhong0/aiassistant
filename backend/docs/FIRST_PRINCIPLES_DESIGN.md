# First Principles Design: Railway + Supabase Architecture

## Core Problem Statement

**Input**: Natural language user message + conversation context
**Output**: Natural language assistant response
**Constraints**: Multi-turn conversations, confirmation flows, 5-minute undo, low cost

---

## First Principles Analysis

### What are we REALLY building?

A stateful chat system that:
1. Authenticates users
2. Maintains conversation context
3. Processes natural language through AI agents
4. Handles multi-turn operations (confirm, undo)
5. Integrates with Gmail/Calendar

### What are the ESSENTIAL components?

**Minimum Viable Architecture:**
```
User → Auth → API → State → Agents → External APIs
```

Breaking down each:

1. **Auth**: Validate user identity
   - JWT token verification
   - User ID extraction

2. **API**: Accept/return natural language
   - Single endpoint: POST /chat
   - Input: {message, session_id}
   - Output: {response, session_id}

3. **State**: Maintain conversation context
   - Session storage (5-min TTL)
   - working_data (confirmation flows)
   - last_action (undo mechanism)

4. **Agents**: Process requests (4-Prompt Architecture)
   - Master Agent: Intent → Commands
   - SubAgents: Tools → Response

5. **External APIs**: Gmail, Calendar
   - OAuth tokens
   - API calls

---

## Design Decisions (From First Principles)

### Decision 1: Auth Strategy

**Options Evaluated:**
1. DIY PostgreSQL OAuth
2. Supabase Auth
3. Auth0 / Clerk

**First Principles Analysis:**
- Core requirement: Validate requests, identify users
- Secondary: OAuth with Google (for Gmail/Calendar)
- Non-essential: Password auth, email verification (can add later)

**Winner: Supabase Auth**

Why?
- ✅ Handles OAuth (Google, Apple, etc.) - 100+ hours saved
- ✅ JWT generation/validation - security best practices
- ✅ Free up to 50k users - cost-effective
- ✅ Auto token refresh - less code
- ✅ Battle-tested - production-ready

**Key Insight**: Supabase solves 90% of auth complexity for $0. Building it ourselves = technical debt.

### Decision 2: Token Management

**Problem**: Need Google OAuth tokens for Gmail/Calendar API

**Options:**
1. Store in Supabase (provider_token)
2. Use existing TokenManager
3. Hybrid approach

**Analysis:**
```
Supabase provider_token:
- Pro: Automatic refresh
- Con: Tied to Supabase session
- Con: Refresh token not directly accessible
- Con: Requires Supabase SDK in backend

Existing TokenManager:
- Pro: Already implemented ✅
- Pro: Direct control over tokens
- Pro: Works with current architecture
- Con: Need to link Supabase user → TokenManager
```

**Winner: Hybrid**
- Supabase: User auth + JWT validation
- Existing TokenManager: Google token storage
- Link: user.id (Supabase) = userId (TokenManager)

**Key Insight**: Don't rebuild what works. Use Supabase for auth, keep TokenManager for tokens.

### Decision 3: State Management

**Core Requirement**: Persist state between requests

**Options:**
1. Stateless (pass everything in request)
2. Database storage (PostgreSQL)
3. In-memory + Redis backup
4. Redis-only

**Analysis:**
```
Stateless:
- Pro: Simple
- Con: Large payloads (working_data can be big)
- Con: Security risk (sensitive data in requests)
- Verdict: ❌ Not viable for confirmation flows

Database:
- Pro: Durable
- Con: Slow (network roundtrip)
- Con: Overkill for 5-min sessions
- Verdict: ❌ Over-engineered

In-memory + Redis:
- Pro: Fast (< 1ms access)
- Pro: Backup for failover
- Pro: Auto-expiry (TTL)
- Con: Slightly complex
- Verdict: ✅ Optimal

Redis-only:
- Pro: Simple
- Con: Network latency on every access
- Con: More expensive (higher Redis usage)
- Verdict: ⚠️ Good, but slower
```

**Winner: In-memory + Redis Backup**

**Implementation:**
```typescript
class SessionManager {
  private sessions: Map<string, SessionState> = new Map()

  async get(id: string) {
    // 1. Try memory (< 1ms)
    if (this.sessions.has(id)) return this.sessions.get(id)

    // 2. Fallback to Redis (~5ms)
    const cached = await redis.get(`session:${id}`)
    if (cached) {
      const session = JSON.parse(cached)
      this.sessions.set(id, session) // Warm cache
      return session
    }

    // 3. Create new
    return this.create(id)
  }

  async save(id: string, state: SessionState) {
    this.sessions.set(id, state) // Update memory
    await redis.setex(`session:${id}`, 300, JSON.stringify(state)) // Backup
  }
}
```

**Key Insight**: In-memory for speed, Redis for reliability. Best of both worlds.

### Decision 4: API Design

**Core Requirement**: Accept natural language, return natural language

**Options:**
1. Single /chat endpoint
2. Separate endpoints per action type
3. GraphQL
4. WebSocket

**Analysis:**
```
Single endpoint:
- Pro: Simplest for client
- Pro: Natural language = dynamic (fits one endpoint)
- Con: Large handler function
- Verdict: ✅ Optimal for MVP

Separate endpoints:
- Pro: Clear separation
- Con: Clients need to route (defeats "natural language")
- Con: More code
- Verdict: ❌ Over-complicates

GraphQL:
- Pro: Flexible queries
- Con: Overkill for chat
- Con: Extra complexity
- Verdict: ❌ Not needed

WebSocket:
- Pro: Real-time streaming
- Con: More complex state management
- Con: Not needed for MVP
- Verdict: ⚠️ Future enhancement
```

**Winner: Single POST /chat/message Endpoint**

**Contract:**
```typescript
Request:
{
  message: string           // Natural language
  session_id?: string       // Optional (auto-create)
}

Response:
{
  message: string           // Natural language
  session_id: string        // For next request
  metadata?: {              // Optional diagnostics
    tools_used: string[]
    processing_time: number
  }
}
```

**Key Insight**: Simplest API = easiest to use. Natural language doesn't need complex routing.

### Decision 5: Deployment Platform

**Given**: Already on Railway

**Question**: Should we change?

**Options:**
1. Stay on Railway
2. Move to AWS Lambda (FaaS)
3. Move to Cloud Run
4. Move to Vercel

**Analysis:**
```
Railway:
- Pro: Already deployed ✅
- Pro: No cold starts ✅
- Pro: $8-15/month ✅
- Pro: Built-in Redis ✅
- Pro: Auto-scaling ✅
- Con: Less features than AWS
- Verdict: ✅ Perfect for our needs

FaaS (Lambda):
- Pro: Auto-scale to zero
- Con: Cold starts (1-3s) ❌
- Con: State management complex ❌
- Con: $100-175/month ❌
- Verdict: ❌ Wrong fit

Cloud Run:
- Pro: No cold starts (min instances)
- Pro: Auto-scaling
- Con: More expensive than Railway
- Con: Migration effort
- Verdict: ⚠️ Good but unnecessary

Vercel:
- Pro: Easy deployment
- Con: 10s timeout (too short for AI) ❌
- Con: Edge functions cold start
- Verdict: ❌ Not suitable
```

**Winner: Stay on Railway**

**Key Insight**: Railway is perfect for our use case. Don't fix what isn't broken.

---

## Simplified Architecture

### Final Design

```
┌─────────────────────────────────────────────────┐
│              CLIENT (iOS/Web)                    │
│  • Natural language chat                         │
│  • Supabase Auth SDK                             │
└─────────────────────────────────────────────────┘
                      ↓ HTTPS + JWT
┌─────────────────────────────────────────────────┐
│           SUPABASE (Auth Only)                   │
│  • OAuth (Google, Apple, Email)                  │
│  • JWT generation                                │
│  • Token refresh                                 │
│  • User management                               │
└─────────────────────────────────────────────────┘
                      ↓ JWT Token
┌─────────────────────────────────────────────────┐
│          RAILWAY BACKEND (Express)               │
│  ┌───────────────────────────────────────────┐  │
│  │  POST /api/chat/message                   │  │
│  │                                           │  │
│  │  1. Verify Supabase JWT                   │  │
│  │  2. Get/Create session                    │  │
│  │  3. Call Master Agent                     │  │
│  │  4. Save session                          │  │
│  │  5. Return response                       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  SessionManager                           │  │
│  │  • In-memory Map<id, SessionState>        │  │
│  │  • Redis backup (5-min TTL)               │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  MasterAgent + SubAgents                  │  │
│  │  • 4-Prompt Architecture (unchanged)      │  │
│  │  • Uses SessionManager for state          │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  TokenManager (existing)                  │  │
│  │  • Google OAuth tokens                    │  │
│  │  • PostgreSQL storage                     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         EXTERNAL APIS                            │
│  • Gmail • Calendar • Anthropic/OpenAI           │
└─────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Why? |
|-----------|---------------|------|
| **Supabase** | User auth, JWT validation | Best-in-class OAuth, zero maintenance |
| **SessionManager** | Conversation state | Fast (in-memory) + reliable (Redis) |
| **TokenManager** | Google API tokens | Already implemented, works well |
| **MasterAgent** | Orchestration | 4-Prompt Architecture (unchanged) |
| **SubAgents** | Tool execution | Domain-specific logic (unchanged) |
| **Single API** | Natural language I/O | Simplest interface |

### Data Flow

**Request Flow:**
```
1. Client → POST /api/chat/message
   Headers: { Authorization: Bearer <supabase_jwt> }
   Body: { message: "Find emails from Sarah", session_id: "sess_123" }

2. Middleware → Verify JWT with Supabase
   Extract user.id from JWT

3. SessionManager → Load session state
   Try memory → Try Redis → Create new

4. MasterAgent → Process request
   - Intent Understanding (Prompt 1)
   - Execute SubAgents
   - Context Update (Prompt 2)

5. SessionManager → Save session state
   Update memory + Redis backup

6. Response → Return to client
   { message: "Found 3 emails...", session_id: "sess_123" }
```

**State Storage:**
```
In-Memory (fast):
sessions: Map<sessionId, SessionState>

Redis (backup):
session:sess_123 → { ...SessionState } (TTL: 300s)
```

---

## What Changed from Original Plan?

### Kept (Good decisions):
✅ Supabase for auth (still best choice)
✅ Railway deployment (already there)
✅ Single /chat endpoint (simplest)
✅ In-memory + Redis state (optimal)

### Simplified:
✅ **No custom user_tokens table** - use existing TokenManager
✅ **No database migrations** - state lives in Redis only
✅ **No Supabase database** - just auth service
✅ **Minimal code changes** - mostly deletions

### Why This is Better:

**Original Plan:**
- Migrate tokens to Supabase database
- Create user_tokens table
- Update TokenManager to use Supabase
- = More complexity, more code

**Revised Plan:**
- Keep existing TokenManager
- Link Supabase user.id → TokenManager userId
- = Less complexity, less code

**Key Insight**: The existing token management works. Don't replace what works.

---

## Implementation Complexity

### Lines of Code by Task:

1. **Remove Slack**: -2000 lines (deletion)
2. **SessionManager**: +150 lines (new service)
3. **Supabase middleware**: +30 lines (auth check)
4. **Chat endpoint**: +50 lines (route handler)
5. **Agent updates**: +50 lines (session integration)
6. **DI updates**: +20 lines (registration)

**Total: +300 lines, -2000 lines = Net -1700 lines**

**Simpler codebase = easier to maintain**

---

## Cost Analysis

### Infrastructure Costs:

```
Railway:
- Backend: $5-8/month (hobby plan)
- Redis: $3/month (25MB)
Total: $8-11/month

Supabase:
- Auth: FREE (up to 50k users)
- Database: Not using (FREE)
Total: $0/month

External APIs:
- Claude/OpenAI: $3-30/month (usage-based)
- Gmail/Calendar: FREE

TOTAL: $11-41/month
```

### Scaling Costs:

```
1k messages/month:     $11/month
10k messages/month:    $25/month
100k messages/month:   $150/month
```

**Linear scaling = predictable costs**

---

## Risk Analysis

### Risks Mitigated:

1. **State Loss**: Redis backup prevents session loss on container restart
2. **Auth Vulnerability**: Supabase handles security (SOC 2 certified)
3. **Token Expiry**: Existing TokenManager handles refresh
4. **Scale Limits**: Railway auto-scales, Supabase handles 50k users
5. **Cost Overrun**: Free tiers + predictable scaling

### Remaining Risks:

1. **Redis Failure**: Sessions lost (acceptable - 5 min TTL anyway)
2. **Railway Outage**: Downtime (mitigated by Railway SLA)
3. **Supabase Outage**: Can't auth new users (cached JWT still works)

**All risks acceptable for MVP**

---

## Final Verdict

**This architecture is:**
- ✅ Simpler than original plan
- ✅ Cheaper ($11-25/month vs $100+/month FaaS)
- ✅ Faster (in-memory state, no cold starts)
- ✅ More maintainable (less code)
- ✅ Production-ready (battle-tested components)

**Implementation timeline: 3-4 days**

**Next: Execute migration**

---

*Design Version: 2.0 (Simplified)*
*Created: January 2025*
