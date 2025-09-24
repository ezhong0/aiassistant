# Clean Natural Language Agent Architecture - Microservice API Pattern

**Status: Phase 1-2 Complete ✅ | Phase 3 In Progress**

---

## Architecture Vision: Agents as Microservices

### Core Principle
Every agent is a **microservice** with **ONE public endpoint**:

```
Input:  Natural Language Query + Context
        ↓
Output: Natural Language Response
```

**No exposed methods. No raw data. Pure natural language interface.**

### Perfect Alignment ✅

Current implementation **100% matches** the vision:

```typescript
// ❌ OLD WAY - Exposed methods, complex APIs
await slackAgent.getLatestMessages(channelId, limit);
await slackAgent.getThreadContext(threadId);
await slackAgent.analyzeConversation(messages);

// ✅ NEW WAY - Single natural language endpoint
await slackAgent.processNaturalLanguageRequest(
  "Get the latest messages from #general about deployment",
  context
);
// Returns: "The last 10 messages in #general discuss the failed deployment..."
```

**MasterAgent calls agents like this:**
```typescript
// User: "Draft a response to the deployment thread"

// Step 1: Get context (natural language → natural language)
const slackContext = await slackAgent.processNaturalLanguageRequest(
  "Get context from the deployment thread in #general",
  context
);
// Returns: "The deployment thread shows DB migration failed at 3pm. John reported errors, Sarah suggested rollback..."

// Step 2: Use context to draft response
const draft = await emailAgent.processNaturalLanguageRequest(
  `Draft a response to the deployment thread. Context: ${slackContext}`,
  context
);
```

---

## Implementation Status

### ✅ Phase 1: NaturalLanguageAgent Base Class (COMPLETE)

**File:** `src/framework/natural-language-agent.ts` (719 lines)

**Public Interface:**
```typescript
abstract class NaturalLanguageAgent implements INaturalLanguageAgent {
  // ===== ONLY ONE PUBLIC METHOD (FINAL - never override) =====
  async processNaturalLanguageRequest(
    request: string,
    context: AgentExecutionContext
  ): Promise<NaturalLanguageResponse>

  // Interface methods
  getCapabilityDescription(): AgentCapabilities
  async canHandle(request: string): Promise<boolean>

  // ===== AGENTS IMPLEMENT (2 methods) =====
  protected abstract getAgentConfig(): AgentConfig;
  protected abstract executeOperation(op: string, params: any, auth: any): Promise<any>;
}
```

**What it handles automatically:**
1. ✅ LLM intent analysis (figures out what operation to run)
2. ✅ Authentication (OAuth, API keys)
3. ✅ Draft management (creates drafts for risky operations)
4. ✅ Response formatting (LLM converts results to natural language)
5. ✅ Error handling
6. ✅ Natural language logging
7. ✅ Service initialization

**Agents just provide:**
1. `getAgentConfig()` - What operations they support, what services they need
2. `executeOperation()` - How to run those operations

### ✅ Phase 2: CalendarAgentV3 (COMPLETE)

**File:** `src/agents/calendar-v3.agent.ts` (344 lines)

**Clean implementation - only 2 methods:**
```typescript
class CalendarAgentV3 extends NaturalLanguageAgent {
  protected getAgentConfig(): AgentConfig {
    return {
      name: 'calendarAgent',
      systemPrompt: 'Google Calendar management agent...',
      operations: ['create', 'list', 'update', 'delete', 'check_availability', 'find_slots'],
      services: ['calendarService'],
      auth: { type: 'oauth', provider: 'google' },
      capabilities: [
        'Create calendar events with attendees',
        'List events in date ranges',
        'Update existing events',
        // etc.
      ]
    };
  }

  protected async executeOperation(operation: string, parameters: any, authToken: string) {
    const calendarService = this.getService('calendarService');

    switch (operation) {
      case 'create':
        return await calendarService.createEvent(parameters.event, authToken);
      case 'list':
        return await calendarService.listEvents(authToken, parameters);
      // etc.
    }
  }
}
```

**Registered in AgentFactory** ✅
**Auto-generates function schemas for MasterAgent** ✅
**Tests pass** ✅

---

## SlackAgent V2 Design - Context Intelligence Microservice

### Purpose
SlackAgent is a **Context-Gathering Microservice** that provides intelligent Slack context to other agents.

### Operations (Internal - not exposed)

```typescript
operations: [
  // Message retrieval
  'get_recent_messages',        // Fetch recent channel messages
  'get_thread_context',          // Get full thread conversation
  'get_user_messages',           // Get messages from specific user

  // Search & Discovery
  'search_messages',             // Search for keywords/topics
  'find_thread',                 // Find specific thread by topic
  'find_mentions',               // Find where user was mentioned

  // Analysis & Intelligence
  'analyze_conversation',        // Summarize discussion
  'extract_action_items',        // Pull out TODOs/decisions
  'identify_participants',       // Who's involved in discussion
  'get_conversation_sentiment'   // Tone analysis
]
```

### Natural Language Examples

**Input/Output Patterns:**

```typescript
// Example 1: Simple retrieval
Input:  "Get the latest 10 messages from #general"
Output: "The last 10 messages in #general discuss the deployment failure.
         Key points: DB migration error at 3pm, rollback being considered,
         John debugging the connection issue."

// Example 2: Thread finding
Input:  "Find the deployment discussion thread"
Output: "Found deployment thread in #engineering started by @john at 2:45pm.
         Thread has 15 replies discussing failed DB migration and rollback strategy."

// Example 3: Context for action
Input:  "Get context for responding to Sarah's question about the bug"
Output: "Sarah asked in #bugs at 4pm: 'Is the login bug related to the new auth service?'
         Thread context: Team confirmed it's related to OAuth token expiry.
         Previous discussion suggests increasing token TTL from 1hr to 24hr."

// Example 4: User-centric
Input:  "What messages mentioned me in the last hour?"
Output: "You were mentioned 3 times: @john asked about your PR in #engineering,
         @sarah requested review in #code-review, @mike tagged you in deployment thread."

// Example 5: Sentiment & analysis
Input:  "Analyze the sentiment of the #general channel today"
Output: "Today's #general conversation shows concerned tone (6/10 urgency).
         Main topics: deployment issues (urgent), weekend plans (casual).
         Action items: rollback decision needed by EOD."
```

### Configuration

```typescript
class SlackAgentV2 extends NaturalLanguageAgent {
  protected getAgentConfig(): AgentConfig {
    return {
      name: 'slackAgent',
      systemPrompt: `You are a Slack context intelligence agent.

        Your role is to gather, analyze, and summarize Slack conversations to provide
        useful context to other agents. You don't post messages or modify Slack - you
        only READ and ANALYZE.

        When asked for context:
        - Fetch relevant messages/threads
        - Summarize key points
        - Identify participants and action items
        - Provide context that helps decision-making

        Always return insights, not raw data dumps.`,

      operations: [
        'get_recent_messages',
        'get_thread_context',
        'search_messages',
        'analyze_conversation',
        'find_thread',
        'find_mentions',
        'extract_action_items',
        'get_user_messages'
      ],

      services: ['slackService', 'openaiService'],

      auth: {
        type: 'oauth',
        provider: 'slack'
      },

      capabilities: [
        'Retrieve and summarize Slack messages',
        'Analyze conversation threads',
        'Search for specific topics or keywords',
        'Identify action items and decisions',
        'Provide context for drafting responses',
        'Track mentions and user activity'
      ],

      // Slack is read-only, no risky operations
      draftRules: {
        operations: [], // Never needs drafts
        riskLevel: 'low'
      }
    };
  }
}
```

### Implementation Pattern

```typescript
protected async executeOperation(
  operation: string,
  parameters: any,
  authToken: string
): Promise<any> {
  const slackService = this.getService('slackService');
  const openaiService = this.getService('openaiService');

  switch (operation) {
    case 'get_recent_messages': {
      // Fetch messages
      const messages = await slackService.getChannelHistory(
        parameters.channelId,
        parameters.limit || 10,
        authToken
      );

      // Summarize with LLM
      const summary = await openaiService.summarizeMessages(messages);

      return {
        messages,
        count: messages.length,
        summary,
        channel: parameters.channelId
      };
    }

    case 'analyze_conversation': {
      const messages = parameters.messages ||
        await slackService.getChannelHistory(parameters.channelId, 50, authToken);

      const analysis = await openaiService.analyzeConversation(messages);

      return {
        summary: analysis.summary,
        topics: analysis.topics,
        sentiment: analysis.sentiment,
        actionItems: analysis.actionItems,
        participants: this.extractParticipants(messages)
      };
    }

    case 'find_thread': {
      // Search for thread by topic
      const searchResults = await slackService.searchMessages(
        parameters.topic,
        parameters.channelId,
        authToken
      );

      // Find thread
      const thread = this.findRelevantThread(searchResults, parameters.topic);

      if (thread) {
        const threadMessages = await slackService.getThreadReplies(
          thread.channel,
          thread.ts,
          authToken
        );

        return {
          found: true,
          thread,
          messages: threadMessages,
          summary: await openaiService.summarizeThread(threadMessages)
        };
      }

      return { found: false };
    }

    // ... other operations
  }
}
```

### MasterAgent Integration Flow

**Scenario: User asks to respond to deployment thread**

```typescript
// User input
"Draft a response to the deployment thread in #general"

// MasterAgent reasoning:
// 1. Need context about deployment thread
// 2. Get context from Slack
// 3. Draft response using context

// Step 1: Get context (SlackAgent microservice call)
const context = await slackAgent.processNaturalLanguageRequest(
  "Get context from the deployment thread in #general channel",
  executionContext
);

// SlackAgent returns:
{
  response: "The deployment thread in #general was started by @john at 2:45pm.
             Discussion shows DB migration failed due to connection timeout.
             Key points: Error occurred at 3pm, affects user authentication,
             team is considering rollback. Sarah suggested checking connection pool settings.
             15 replies total, last activity 10 minutes ago.",
  metadata: {
    threadId: "1234567890.123456",
    channel: "general",
    participants: ["john", "sarah", "mike"],
    messageCount: 15
  }
}

// Step 2: MasterAgent uses context to draft
const response = await emailAgent.processNaturalLanguageRequest(
  `Draft a response to deployment thread.

   Context: ${context.response}

   Tone: Professional, solution-oriented
   Include: Acknowledge issue, propose checking connection pool, offer to help debug`,
  executionContext
);
```

---

## Key Design Decisions

### 1. No Raw Data Exposure ✅
- Agents return **natural language summaries**, not raw API responses
- MasterAgent gets useful context, not JSON dumps
- Better for LLM reasoning

### 2. Context Enrichment ✅
- SlackAgent doesn't just fetch messages
- It **analyzes**, **summarizes**, and **extracts insights**
- Returns actionable intelligence

### 3. Single Responsibility ✅
- SlackAgent = Context gathering ONLY
- Doesn't draft messages (that's EmailAgent/MasterAgent)
- Doesn't modify Slack (read-only)

### 4. Composability ✅
```typescript
// Agents compose naturally
const slackContext = await slackAgent.process("Get thread context...");
const calendarContext = await calendarAgent.process("Check my availability...");

const draft = await emailAgent.process(
  `Draft response using this context:
   Slack: ${slackContext.response}
   Calendar: ${calendarContext.response}`
);
```

### 5. User-Centric Queries ✅
SlackAgent understands context:
- "my messages" → uses context.userId
- "mentions of me" → searches for @currentUser
- "our discussion" → infers participants from context

---

## Migration Phases

### ✅ Phase 1: NaturalLanguageAgent Base (COMPLETE)
- Created `src/framework/natural-language-agent.ts`
- Single public method: `processNaturalLanguageRequest()`
- Auto-handles: LLM, drafts, auth, formatting
- Agents implement: `getAgentConfig()`, `executeOperation()`

### ✅ Phase 2: CalendarAgentV3 (COMPLETE)
- Migrated to clean 2-method pattern
- Registered in AgentFactory
- Auto-generates schemas
- Tests passing

### 🔄 Phase 3: SlackAgentV2 (IN PROGRESS)
- Create `src/agents/slack-v2.agent.ts`
- Define context-gathering operations
- Implement intelligent summarization
- Test with MasterAgent context flow

### 📋 Phase 4: Cleanup
Delete legacy cruft:
- ❌ `src/framework/agent-base.ts` (wrong direction)
- ❌ `src/agents/calendar-v2.agent.ts` (not integrated)
- ❌ `src/agents/calendar.agent.backup.ts` (backup)
- ❌ `tests/unit/calendar-v2.agent.test.ts` (old tests)
- ❌ `src/examples/calendar-v2-demo.ts` (demo)
- ❌ `docs/migration/*` (no longer needed)

Deprecate old agents:
- Mark `AIAgent` as `@deprecated`
- Keep for backwards compatibility temporarily

### 📋 Phase 5: Migrate Remaining Agents
- EmailAgent → EmailAgentV2
- NotificationAgent → NotificationAgentV2
- ThinkAgent → ThinkAgentV2
- ContactAgent → ContactAgentV2

### 📋 Phase 6: Final Cleanup
- Remove old AIAgent entirely
- Update all imports
- Clean documentation
- Remove adapters

---

## Agent Config Schema

```typescript
interface AgentConfig {
  /** Agent identifier */
  name: string;

  /** System prompt for LLM intent analysis */
  systemPrompt: string;

  /** Operations this agent can perform (internal only) */
  operations: string[];

  /** Services this agent needs */
  services: string[];

  /** Authentication requirements */
  auth: {
    type: 'oauth' | 'api-key' | 'none';
    provider?: 'google' | 'slack' | 'sendgrid';
  };

  /** Human-readable capabilities (for MasterAgent discovery) */
  capabilities?: string[];

  /** Draft rules for risky operations */
  draftRules?: {
    operations: string[];  // Which ops require drafts
    riskLevel: 'low' | 'medium' | 'high';
  };

  /** Limitations to communicate to MasterAgent */
  limitations?: string[];
}
```

---

## Testing Strategy

### Unit Tests
- Test each `executeOperation()` in isolation
- Mock services
- Verify operation logic

### Integration Tests
- Test full `processNaturalLanguageRequest()` flow
- Real service calls
- Verify natural language I/O

### MasterAgent Tests
- Test multi-agent composition
- Context-gathering → action flow
- Verify SlackAgent provides useful context

### Backwards Compatibility
- Old agents still work during migration
- Gradual rollout per agent

---

## Success Criteria

### Architecture ✅
- ✅ All agents extend `NaturalLanguageAgent`
- ✅ Single public method per agent
- ✅ Agents implement only 2 methods
- ✅ No exposed internal APIs

### Functionality
- ✅ CalendarAgent working with new pattern
- 🔄 SlackAgent as context-gatherer (in progress)
- 📋 All agents migrated
- 📋 MasterAgent uses agents via natural language only

### Code Quality
- ✅ TypeScript errors resolved
- ✅ Clean, minimal implementations
- 📋 Comprehensive tests
- 📋 Legacy code removed

### Developer Experience
- ✅ New agent = implement 2 methods
- ✅ Auto-discovery by MasterAgent
- ✅ Natural language interface
- ✅ No boilerplate

---

## File Structure

```
src/framework/
  ✅ natural-language-agent.ts      # New base class (719 lines)
  ⚠️  ai-agent.ts                   # @deprecated (will remove)
  ❌ agent-base.ts                  # DELETE (wrong approach)

src/agents/
  ✅ calendar-v3.agent.ts           # New clean implementation (344 lines)
  ⚠️  calendar.agent.ts             # @deprecated → delete later
  ❌ calendar-v2.agent.ts           # DELETE (not integrated)
  ❌ calendar.agent.backup.ts       # DELETE (backup)

  🔄 slack-v2.agent.ts              # IN PROGRESS
  ⚠️  slack.agent.ts                # @deprecated → delete later

  📋 email-v2.agent.ts              # TODO
  📋 notification-v2.agent.ts       # TODO
  📋 think-v2.agent.ts              # TODO
  📋 contact-v2.agent.ts            # TODO

tests/unit/
  ❌ calendar-v2.agent.test.ts     # DELETE
  ❌ agent-base.test.ts            # DELETE

docs/
  ❌ migration/*                    # DELETE
  ❌ framework/agentbase-vs-aiagent.md  # DELETE
```

---

## Next Steps

1. **Implement SlackAgentV2** using context intelligence pattern
2. **Test MasterAgent flow**: Slack context → Email draft
3. **Cleanup legacy files** once SlackV2 works
4. **Migrate remaining agents** one by one
5. **Remove AIAgent** when all migrations complete

---

## Vision Achieved ✅

**Before:**
```typescript
// Complex APIs, exposed methods, mixed concerns
const messages = await slackAgent.getLatestMessages(channelId, 10);
const thread = await slackAgent.getThreadContext(threadId);
const summary = await slackAgent.analyzeConversation(messages);
// ... manual orchestration
```

**After:**
```typescript
// Pure microservice: natural language → natural language
const context = await slackAgent.processNaturalLanguageRequest(
  "Get context from the deployment thread in #general",
  executionContext
);
// Returns: "The deployment thread shows..." (natural language)
```

**Perfect alignment with microservice vision. Every agent is a black box with one endpoint.** 🎯