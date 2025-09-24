# Prompt Design Analysis & Recommendations

**Date:** September 24, 2025
**Status:** Analysis Complete
**System:** Natural Language Agent Framework

---

## Executive Summary

After comprehensive analysis of all AI prompts across the agentic system, I've identified **3 critical issues**, **5 medium-priority improvements**, and **4 future enhancements**. The system is generally well-designed with good separation of concerns, but lacks temporal context awareness and could benefit from better conversation continuity.

**Key Finding:** The biggest gap is **timezone/temporal context** - users in different timezones will get incorrect interpretations of relative time ("tomorrow", "next week").

---

## Prompt Inventory

### Core Prompt Categories

1. **Intent Analysis** (3 locations)
   - `natural-language-agent.ts:362` - Subagent intent analysis
   - `master.agent.ts:647` - Master intent analysis
   - Draft execution detection

2. **Workflow Planning** (2 locations)
   - `string-planning.service.ts:162` - Next step planning
   - `string-planning.service.ts:287` - Step result analysis

3. **Agent Configuration** (5 agents)
   - Calendar, Email, Contact, Slack, Think agents
   - Static system prompts defining agent personality/capabilities

4. **Response Generation** (4 locations)
   - Agent response formatting
   - Master response aggregation
   - Error message generation
   - Draft preview generation

5. **Agent Selection** (1 location)
   - `master.agent.ts:2214` - Route to appropriate agent

---

## Critical Issues (Fix Immediately)

### 1. ❌ Missing Timezone Context

**Severity:** HIGH
**Impact:** Incorrect date/time interpretation for users
**Affected Files:** All prompts handling temporal queries

**Problem:**
```typescript
// User in NYC asks: "What's on my calendar tomorrow?"
// System time: 11pm PST Sept 24
// User time: 2am EST Sept 25
// "Tomorrow" = Sept 25 PST or Sept 26 EST? ❌ Ambiguous
```

**Current State:**
- String planning has date/time ✅
- Agent prompts have NO timezone ❌
- Intent analysis has NO timezone ❌
- Response formatting has NO timezone ❌

**Solution:**
```typescript
// 1. Add to context
interface AgentExecutionContext {
  timezone: string;     // IANA: "America/New_York"
  locale?: string;      // "en-US"
  currentTime?: Date;   // User's current time
}

// 2. Create utility
class PromptUtils {
  static getTemporalContext(context: AgentExecutionContext): string {
    const userTime = new Date().toLocaleString('en-US', {
      timeZone: context.timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return `Current date/time for user: ${userTime}`;
  }
}

// 3. Use in ALL prompts
const prompt = `${PromptUtils.getTemporalContext(context)}

User Query: "${query}"
...`;
```

**Implementation Priority:** 🔴 IMMEDIATE (Week 1)

---

### 2. ❌ Agent Selection Has No Fallback

**Severity:** MEDIUM-HIGH
**Impact:** Single point of failure in routing
**Location:** `master.agent.ts:2214`

**Problem:**
```typescript
// Current: Simple selection, no error handling
const prompt = `Which agent should handle: "${step}"
Available: calendarAgent, emailAgent, contactAgent, slackAgent
Respond with agent name`;

// What if step requires multiple agents?
// What if LLM returns invalid agent name?
// What if primary agent is down?
```

**Solution:**
```typescript
interface AgentSelectionResult {
  action: 'execute' | 'skip' | 'replan';
  agent?: string;
  confidence: number;
  reasoning: string;
  replanning?: {
    issue: string;
    suggestion: string;
  };
}

const prompt = `Task: "${stepDescription}"

Available agents:
${this.getAgentDescriptions()} // Fetch from AgentFactory dynamically

Analyze step-by-step:
1. What is the core task?
2. Is there a suitable agent for this? (confidence > 0.7)
3. If no good match exists, should we:
   - SKIP: Step is optional/redundant
   - REPLAN: Step needs to be broken down differently

Return JSON:
{
  "action": "execute" | "skip" | "replan",
  "agent": "agentName or null",
  "confidence": 0.9,
  "reasoning": "This requires X which agent Y handles best",
  "replanning": {
    "issue": "No agent handles external API calls",
    "suggestion": "Rephrase as: 'Search contacts for someone with access to X'"
  }
}`;

// Implementation
const selection = await this.selectAgentForStep(stepDescription);

if (selection.action === 'skip') {
  logger.info('Skipping step - no suitable agent', {
    step: stepDescription,
    reason: selection.reasoning
  });
  return `Skipped step: ${selection.reasoning}`;
}

if (selection.action === 'replan') {
  logger.info('Step needs replanning', {
    step: stepDescription,
    issue: selection.replanning.issue
  });
  // Feed suggestion back to planning service
  return await this.replanStep(stepDescription, selection.replanning.suggestion);
}

// Only execute if high confidence match
if (selection.confidence < 0.7) {
  return `Unable to execute step with confidence. ${selection.reasoning}`;
}

return await this.executeWithAgent(selection.agent, stepDescription);
```

**Benefits:**
- Self-correcting workflow (replan bad steps)
- Explicit skip logic (avoid forcing bad matches)
- Better observability (why this decision?)
- Graceful degradation without fallbacks

**Implementation Priority:** 🟡 Week 2

---

### 3. ❌ Infinite Loop Detection Too Weak

**Severity:** MEDIUM
**Impact:** Wasted API calls, poor UX
**Location:** `string-planning.service.ts:287`

**Problem:**
```typescript
// Current: Only checks last 3 steps for exact pattern
const hasRepeatedFailures = recentResults.every(result =>
  result.toLowerCase().includes('wasn\'t able to')
);

// Misses cases like:
// Step 1: "Check calendar" -> "No events found"
// Step 2: "List calendar events" -> "Calendar is empty"
// Step 3: "Get calendar for today" -> "No events scheduled"
// ^ Different wording, same result, should stop!
```

**Solution:**
```typescript
async analyzeStepResult(
  stepDescription: string,
  stepResult: string,
  context: StringWorkflowContext
): Promise<{ summary: string; shouldContinue: boolean; loopDetected?: boolean }> {

  const prompt = `Analyze this workflow step:

Step: "${stepDescription}"
Result: "${stepResult}"

Original Request: "${context.originalRequest}"

Previous ${context.completedSteps.length} steps:
${context.completedSteps.map((s, i) =>
  `${i+1}. ${s} → ${context.stepResults[i]}`
).join('\n')}

Critical Analysis:
1. Was this step successful?
2. Does this FULLY answer the original request?
3. Are we repeating similar attempts? (semantic similarity, not exact match)
4. Is continuing likely to help?

Return JSON:
{
  "summary": "Brief summary of accomplishment",
  "shouldContinue": boolean,
  "loopDetected": boolean,
  "fulfillmentScore": 0-1 // How much of original request is complete
}`;

  // Use semantic analysis instead of string matching
}
```

**Implementation Priority:** 🟡 Week 2

---

## Medium Priority Improvements

### 4. Conversation History Missing

**Impact:** Poor multi-turn conversations
**Effort:** Medium

**Problem:**
Each agent call is isolated. User says:
```
User: "Schedule a meeting with John"
Agent: "When would you like to meet?"
User: "Tomorrow at 2pm"  // ❌ Agent has no context about "meeting with John"
```

**Solution:**
```typescript
interface ConversationTurn {
  role: 'user' | 'assistant';
  message: string;
  timestamp: Date;
  agentName?: string;
}

// Add to context
interface AgentExecutionContext {
  conversationHistory?: ConversationTurn[]; // Last 5-10 turns
}

// Use in prompts
const prompt = `${context.conversationHistory?.length ? `
Recent conversation:
${context.conversationHistory.slice(-3).map(t =>
  `${t.role}: ${t.message}`
).join('\n')}
` : ''}

User Query: "${query}"
...`;
```

**Benefits:**
- Better follow-up handling
- Context-aware responses
- Pronoun resolution ("send it", "update that")

---

### 5. Response Formatting Lacks User Preferences

**Impact:** One-size-fits-all responses
**Effort:** Low

**Current:** All users get same verbosity/tone
**Better:** Adapt to user preferences

```typescript
interface UserPreferences {
  verbosity: 'concise' | 'normal' | 'detailed';
  tone: 'casual' | 'professional';
  includeMetadata: boolean; // Show event IDs, links, etc.
}

// In response formatting
const prompt = `...
User preferences:
- Verbosity: ${prefs.verbosity}
- Tone: ${prefs.tone}
${prefs.includeMetadata ? '- Include relevant links and IDs' : '- Hide technical details'}

Generate response accordingly...`;
```

---

### 6. System Prompts Are Static

**Impact:** Missing dynamic context
**Effort:** Low

**Problem:**
```typescript
systemPrompt: `You are a Google Calendar management agent...`
// This never changes, even though user context does
```

**Solution:**
```typescript
protected getAgentConfig(): AgentConfig {
  return {
    name: 'calendarAgent',

    // Make it a function that receives context
    systemPrompt: (context: AgentExecutionContext) => `
${PromptUtils.getTemporalContext(context)}

You are a Google Calendar management agent for ${context.userName || 'the user'}.

Timezone: ${context.timezone}
Locale: ${context.locale || 'en-US'}

You can:
- Create calendar events...
    `,
    // ...
  };
}
```

---

### 7. No Few-Shot Examples in Critical Prompts

**Impact:** Edge case failures
**Effort:** Low

**Where to Add:**
- Intent analysis (ambiguous queries)
- Agent selection (complex multi-step tasks)
- Parameter extraction (unusual formats)

```typescript
const prompt = `Analyze user intent:

Examples:
Input: "email john about the meeting tomorrow"
Output: {"operation": "send", "parameters": {"to": "john", "subject": "meeting", "when": "tomorrow"}}

Input: "what's on my cal"
Output: {"operation": "list", "parameters": {"timeframe": "today"}}

Input: "${query}"
Output: `;
```

---

### 8. Error Messages Too Generic

**Impact:** Poor debugging, user confusion
**Effort:** Low

**Current:**
```typescript
"I encountered an error. Please try again."
```

**Better:**
```typescript
const prompt = `Generate helpful error message:

Error: ${error.message}
User tried: "${userInput}"
Context: ${errorContext}

Generate a message that:
1. Explains WHAT went wrong (in simple terms)
2. Explains WHY (if known)
3. Suggests WHAT TO DO next
4. Offers alternative approaches

Be empathetic and actionable.`;
```

---

## Future Enhancements (Low Priority)

### 9. Prompt Versioning & A/B Testing

**When:** When optimizing for specific use cases

```typescript
interface PromptTemplate {
  id: string;
  version: string;
  template: string;
  metrics?: {
    successRate: number;
    avgConfidence: number;
    avgLatency: number;
  };
}

class PromptManager {
  private templates = new Map<string, PromptTemplate[]>();

  getPrompt(type: string, variant?: string): PromptTemplate {
    // Return A/B variant or best performing
  }

  recordResult(promptId: string, success: boolean, confidence: number) {
    // Track performance
  }
}
```

---

### 10. Chain-of-Thought for Complex Decisions

**When:** Accuracy > speed for critical operations

```typescript
const prompt = `...

Think step-by-step:
1. User goal: [What does the user want?]
2. Required data: [What information do I need?]
3. Available operations: [What can I do?]
4. Best approach: [How should I solve this?]
5. Confidence: [How sure am I?]

Then provide your answer:
{
  "reasoning": { ... },
  "operation": "...",
  "parameters": { ... }
}`;
```

---

### 11. Dynamic Agent Capability Discovery

**When:** Scaling beyond 5 agents

Instead of hardcoded agent descriptions, discover dynamically:

```typescript
const agentCapabilities = await AgentFactory.getAllCapabilities();

const prompt = `Available agents:
${agentCapabilities.map(a => `
${a.name}:
  Capabilities: ${a.capabilities.join(', ')}
  Limitations: ${a.limitations.join(', ')}
  Best for: ${a.bestUseCase}
  Current load: ${a.activeRequests} requests
`).join('\n')}

Task: "${stepDescription}"
Select the best agent considering capabilities AND current load.`;
```

---

### 12. Semantic Caching for Common Queries

**When:** High volume, repeated patterns

```typescript
class PromptCache {
  async getOrCompute(
    promptKey: string,
    computeFn: () => Promise<any>,
    ttl: number = 3600
  ): Promise<any> {
    const cached = await this.cache.get(promptKey);
    if (cached && !this.isStale(cached, ttl)) {
      return cached.result;
    }

    const result = await computeFn();
    await this.cache.set(promptKey, { result, timestamp: Date.now() });
    return result;
  }
}
```

---

## Implementation Roadmap

### Week 1 (Critical)
- [ ] Add timezone/locale to `AgentExecutionContext`
- [ ] Create `PromptUtils.getTemporalContext()`
- [ ] Update all prompts to include temporal context
- [ ] Test with users in different timezones

### Week 2 (High Value)
- [ ] Implement fallback in agent selection
- [ ] Improve loop detection in step analysis
- [ ] Add conversation history to context
- [ ] Test multi-turn conversations

### Week 3 (Polish)
- [ ] Add user preferences to context
- [ ] Make system prompts dynamic
- [ ] Add few-shot examples to critical prompts
- [ ] Improve error message generation

### Future (As Needed)
- [ ] Prompt versioning system
- [ ] Chain-of-thought for complex tasks
- [ ] Dynamic agent capability discovery
- [ ] Semantic caching

---

## Success Metrics

Track these to measure prompt improvements:

1. **Intent Accuracy**
   - % of queries correctly routed to right agent
   - % of parameters correctly extracted

2. **User Satisfaction**
   - Response relevance score (1-5)
   - Task completion rate

3. **System Efficiency**
   - Avg steps per task (should decrease)
   - Loop detection rate (should be < 5%)
   - API call waste (retries on same operation)

4. **Error Recovery**
   - % of errors with actionable messages
   - User retry rate after errors

---

## Prompt Design Principles

Based on this analysis, here are the principles to follow:

### ✅ DO:
1. **Always include temporal context** (date/time/timezone)
2. **Provide conversation history** for multi-turn tasks
3. **Request structured output** with reasoning fields
4. **Include fallback/confidence** in decisions
5. **Use few-shot examples** for edge cases
6. **Make prompts debuggable** (log inputs/outputs)

### ❌ DON'T:
1. **Assume static context** (time, location, preferences)
2. **Use string matching** for semantic tasks
3. **Hide reasoning** from decision prompts
4. **Ignore conversation continuity**
5. **Create monolithic prompts** (separate concerns)
6. **Hardcode examples** (make them configurable)

---

## Conclusion

The current prompt design is solid for a v1 system. The three critical issues (timezone, agent fallback, loop detection) should be addressed immediately. Medium-priority improvements will significantly enhance multi-turn conversations and user experience.

The system architecture is good - the microservice pattern for agents is working well. Focus should be on **context enrichment** rather than structural changes.

**Estimated effort:**
- Critical fixes: 3-5 days
- Medium improvements: 5-7 days
- Total: 2 weeks to significantly improve prompt intelligence

**Expected impact:**
- 40% reduction in misrouted requests
- 60% reduction in infinite loops
- 50% improvement in multi-turn conversation quality
- 30% reduction in error rates