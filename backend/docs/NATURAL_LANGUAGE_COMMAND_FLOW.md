# Email/Calendar AI Assistant: Complete Architecture

## Executive Summary

This system uses **sequential domain-based routing** with **LLM-powered SubAgents** that execute tools one-by-one with reassessment after each tool. Master Agent orchestrates with natural language commands and sequential context updates. SubAgents plan multiple tools but execute them incrementally with LLM reassessment between each execution.

**Key Design Decisions:**
- Master Agent: 2 LLM calls (intent understanding + sequential context updates/responses)
- SubAgent: 1+N LLM calls (tool planning + reassessment after each tool execution)
- Natural language commands between agents (no hardcoded method names)
- Sequential execution (no parallel operations)
- LLM reassessment after every tool execution in SubAgents
- Unified prompt for reassessment and final response formatting

---

## System Architecture

```
┌─────────────────────────────────────┐
│           USER                       │
│     Natural Language Query           │
└──────────────┬──────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│         MASTER AGENT                        │
│                                             │
│  Prompt 1: Intent & Routing                │
│  Prompt 2: Sequential Context Updates      │
│           & Response Synthesis             │
└──────┬─────────────────┬───────────────────┘
       │                 │
       ▼                 ▼
┌─────────────┐   ┌──────────────────────────┐
│ SESSION     │   │   SUBAGENTS              │
│ STATE       │◄──┤                          │
│             │   │  Prompt 1: Tool Planning │
│ • Results   │   │  Execute Tool 1           │
│ • Refs      │   │  ↔ Reassessment          │
│ • History   │   │  Execute Tool 2           │
│ • Context   │   │  ↔ Reassessment          │
│             │   │  Return Final Response    │
└─────────────┘   └────────┬─────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  TOOLS/APIs  │
                    │              │
                    │  • Gmail     │
                    │  • Calendar  │
                    │  • Contacts  │
                    └──────────────┘
```

---

## Master Agent

### Purpose
Orchestrate query handling by routing to appropriate SubAgents and synthesizing final responses.

### Prompt 1: Intent Understanding & Routing

**What it does:**
The Master Agent's first prompt serves as both intent classifier and command generator. It must accurately parse user intent, resolve conversational references, and create natural language commands that SubAgents can execute effectively.

**Core Assessment Tasks:**
1. **Intent Analysis**: Understand what the user wants to accomplish
3. **Domain Detection**: Identify which services needed (email, calendar, actions, or multiple)
4. **Command Synthesis**: Generate natural language instructions for SubAgents
5. **Risk Assessment**: Evaluate potential impact of requested actions
6. **Ambiguity Detection**: Identify unclear aspects requiring user clarification

**Context provided to LLM:**
```
User Query: "{user's message}"

Conversation History (Last 3-5 exchanges):
- Previous queries and responses
- Recently discussed topics/people
- Entities referenced in current conversation
- Context for pronoun resolution ("that", "it", "them")

User Context:
- Email accounts: work@company.com, personal@gmail.com
- VIP contacts: {names with relationships}
- Preferences: {working hours, output style}

```

**Output format:**
```json
{
  "commands": [
    {
      "agent": "email",
      "command": "Find all emails from Sarah Chen about budget from the last two weeks",
      "order": 1
    },
    {
      "agent": "calendar", 
      "command": "Check my availability for Friday afternoon",
      "order": 2
    }
  ],
  "clarifications": []
}
```

**Execution strategy:**
Commands are executed sequentially in order. After each SubAgent returns its natural language response, it's passed to Master Agent's Prompt 2 for context updates and plan reformulation.

**Flow:**
- If clarifications needed → return to user immediately
- Otherwise → proceed to execute commands

---

### Sequential Command Execution

**What happens:**
```
For each command in order:
  1. Get appropriate SubAgent (EmailAgent, CalendarAgent, ActionAgent)
  2. Pass: natural language command + session context
  3. SubAgent executes and returns natural language response
  4. Pass SubAgent response to Master Agent Prompt 2
  5. Prompt 2 updates context and determines:
     - If there are more commands → repeat with next command
     - If complete → formulate final response to user
  6. If SubAgent returns needs_clarification → stop and return to user
```

**Master Agent Prompt 2 handles:**
- Context updates from SubAgent response
- Plan reformulation if needed based on new information
- Decision to continue to next command or synthesize final response
- Conversation history updates for reference resolution

---

### Prompt 2: Context Update and Response Synthesis

**What it does:**
This unified prompt serves multiple critical functions in the sequential execution model. It acts as a context updater, plan reformulator, continuation decision-maker, and response synthesizer.

**Core Assessment Tasks:**
1. **Context Integration**: Absorb SubAgent results into evolving understanding
2. **Progress Evaluation**: Assess whether goal is moving closer to completion
3. **Plan Adaptation**: Modify remaining steps based on new information learned
4. **Continuation Decision**: Determine if more commands needed or ready to synthesize
5. **Risk Reassessment**: Update risk level based on accumulated actions
6. **Reference Construction**: Build conversational references for user's next queries

**Context provided to LLM:**
```
Original User Query: "{query}"

Current Command Plan:
- Command 1 (EXECUTED): EmailAgent → "Find emails from Sarah"
- Command 2 (NEXT): CalendarAgent → "Check availability Friday"
- Command 3 (PENDING): ActionAgent → "Draft response"

Latest SubAgent Response:
- Agent: "email"
- Natural Language: "{response text}"
- Structured Data: {emails found, metadata}
- Status: complete | needs_clarification

Conversation Context: {previous exchanges for reference resolution}
```

**Output format (when more commands remain):**
```json
{
  "continue_execution": true,
  "updated_context": {
    "step_completed": "email_search",
    "sarah_email": "sarah@company.com",
    "emails_found": 5,
    "next_command_context": "Now checking calendar availability..."
  },
  "plan_updates": [
    {
      "command": "calendar",
      "command": "Check availability Friday afternoon (updated with Sarah's schedule)",
      "order": 2
    }
  ]
}
```

**Output format (when execution complete):**
```json
{
  "continue_execution": false,
  "response": "Natural language response to user incorporating all SubAgent results",
  "status": "complete | needs_clarification",
  "conversation_references": {
    "the first email": "email_id_123",
    "Sarah's email": "email_id_123",
    "Friday meeting": "availability_confirmed"
  },
  "suggested_actions": [
    "Reply to Sarah's email",
    "Schedule Friday meeting"
  ]
}
```

**Flow decisions:**
- **continue_execution**: true → Execute next command in sequence
- **continue_execution**: false → Return response to user, conversation turn ends
- **status**: "needs_clarification" → Ask user question, restart from Intent Understanding

---

## SubAgent Pattern

All SubAgents (EmailAgent, CalendarAgent, ActionAgent) follow a sequential tool execution pattern with LLM reassessment after each tool. This design eliminates the overhead of comprehensive planning upfront and instead adapts based on actual tool execution results.

### Context Engineering Principle

**Key insight**: Instead of planning everything upfront and reviewing plans for deterministic operations, execute tools incrementally and let LLM reason at each step based on real results.

**Why this works better**:
- Eliminates SubAgent overhead (PlanReview for simple operations)
- Adapts to unexpected results naturally
- Uses LLM strength: reasoning about observed data
- Avoids LLM weakness: planning complex sequences without context

### Phase 1: Tool Planning (LLM Call)

**What it does:**
The SubAgent's planning prompt transforms natural language commands into actionable tool sequences. Unlike traditional approaches that try to plan everything upfront, this creates a flexible initial plan that will be adapted based on actual tool execution results.

**Core Assessment Tasks:**
1. **Command Interpretation**: Parse Master Agent's natural language instructions
2. **Tool Mapping**: Identify relevant API calls and their sequence dependencies
3. **Parameter Initialization**: Set up first tool with best available parameters
4. **Contingency Planning**: Anticipate potential paths based on expected results
5. **Risk Evaluation**: Assess complexity and potential failure modes

**Context provided to LLM:**
```
Command from Master Agent: "{natural language command}"

Available Tools:
- gmail_search(query, account_ids): Search emails
- gmail_get_thread(thread_id): Get full thread with all messages
- gmail_send(to, subject, body, thread_id): Send or reply to email
- gmail_archive(message_ids): Archive emails
- contact_lookup(name): Find contact by name

User Context:
- Email accounts: {list with types}
- VIP contacts: {list}
- Recent searches: {last 3 searches for context}

SubAgent Context:
- Previously executed tools: {empty initially}
- Current working data: {}
```

**Output format:**
```json
{
  "tool_plan": [
    {
      "tool": "contact_lookup",
      "params": {
        "name": "Sarah"
      },
      "reason": "Need to find Sarah's email address first",
      "order": 1
    },
    {
      "tool": "gmail_search",
      "params": {
        "query": "from:{email_from_contact_lookup} budget OR budgeting after:14d",
        "account_ids": ["all"]
      },
      "reason": "Search for budget-related emails from Sarah",
      "order": 2
    }
  ],
  "next_tool": 1
}
```

**Flow:**
Proceed to execute the first tool (order 1) deterministically

---

### Phase 2: Sequential Tool Execution and Reassessment

**What happens:**
```
For each tool in sequence:
  1. Execute single tool (API call)
  2. Store result in SubAgent context  
  3. Call reassessment prompt (LLM)
  4. LLM decides: continue to next tool OR complete command OR ask clarification
  5. If continue: update plan and execute next tool
  6. If complete: format response and return to Master Agent
```

**SubAgent context updates:**
```
After each tool execution:
{
  "executed_tools": [
    {
      "tool": "contact_lookup",
      "params": {name: "Sarah"},
      "result": {success: true, data: {email: "sarah@company.com"}},
      "timestamp": "..."
    }
  ],
  "working_data": {
    "sarah_email": "sarah@company.com",
    "emails_found": []
  }
}
```

**Reassessment Prompt (called after each tool execution):**

The same LLM prompt serves as both reassessment and final response formatting. After each tool execution, it decides:

---

### Phase 3: Tool Reassessment / Response Decision (LLM Call)

**What it does:**
This unified prompt serves as both reassessment engine and response formatter. After each tool execution, it performs sophisticated analysis to determine the optimal next action, eliminating the need for separate planning review phases.

**Core Assessment Tasks:**
1. **Result Analysis**: What intelligence did this tool reveal?
2. **Progress Evaluation**: Are we moving toward completing the Master Agent's command?
3. **Context Integration**: How does this tool result change our understanding?
4. **Plan Adaptation**: Should we modify the remaining execution path?
5. **Completion Assessment**: Do we have sufficient information to fulfill the request?
6. **Continuation Decision**: Continue to next tool, synthesize response, or request clarification?

**Context provided to LLM:**
```
Original Command: "{command from Master Agent}"

Executed Tools:
{detailed list of tools executed with complete results}

SubAgent Context (Accumulative Intelligence):
{working data accumulated during execution}
{confidence level progression}
{risk level updates}
{discovered entities and patterns}

Latest Tool Result Analysis:
{tool_name: "contact_lookup", result: {success: true, data: {...}}, insights: {...}}

Next Tool in Plan:
{tool: "gmail_search", params: {...}, order: 2} (if exists)

Assessment Framework:
- Result Completeness: Did we get the data we expected?
- Context Evolution: How does this change our understanding?
- Goal Proximity: Are we closer to fulfilling the command?
- Path Optimization: Should we adapt the remaining plan?
- Information Sufficiency: Do we have enough to proceed or synthesize?
```

**Output format (continue to next tool):**
```json
{
  "continue_execution": true,
  "status": "tool_successful",
  
  "plan_updates": [
    {
      "tool": "gmail_search",
      "params": {
        "query": "from:sarah@company.com budget after:14d",
        "account_ids": ["all"]
      },
      "reason": "Updated with Sarah's email address from contact lookup",
      "order": 2
    }
  ],
  
  "updated_working_data": {
    "sarah_email": "sarah@company.com",
    "contact_confirmed": true
  },
  
  "next_tool_order": 2
}
```

**Output format (command complete):**
```json
{
  "continue_execution": false,
  "status": "complete",
  
  "response": {
    "natural_language": "Found 5 emails from Sarah Chen about budget from the last two weeks...",
    "structured_data": {
      "emails": [...],
      "total_count": 5,
      "metadata": {...}
    }
  }
}
```

**Output format (needs clarification):**
```json
{
  "continue_execution": false,
  "status": "needs_clarification",
  
  "clarification": {
    "issue": "Found 3 contacts named Sarah",
    "question": "Which Sarah did you mean?",
    "options": [
      {"name": "Sarah Chen", "email": "sarah@company.com", "type": "colleague"},
      {"name": "Sarah Johnson", "email": "sjohnson@client.com", "type": "client"}
    ]
  }
}
```

**Flow decisions:**

**If continue_execution = true:**
- Execute next tool in sequence (order: next_tool_order)
- Loop back to this reassessment prompt

**If continue_execution = false AND status = "complete":**
- Return natural_language response to Master Agent with structured_data
- SubAgent execution ends

**If continue_execution = false AND status = "needs_clarification":**
- Return clarification request to Master Agent
- Master Agent will ask user, restart from Intent Understanding

**If continue_execution = false AND status = "error":**
- Return error to Master Agent
- Master Agent decides how to handle

---

## Error Handling and Cross-Cutting Concerns

### Error Handling Strategy

**General Approach:**
- Can't resolve entity? Ask user immediately
- API error? Return error, don't retry complex logic
- Single retry at most, then escalate to user
- Step fails? Try known alternative approach
- Max 2 retries before asking user
- Adapt strategy based on failure patterns

### Safety and Preview System

**Write Operation Rules**:

**Low Risk** (execute directly):
- Personal actions: archive, label, mark read
- Non-destructive: star, flag, snooze

**Medium Risk** (preview first):
- Single email sends
- Personal calendar events
- Contact updates

**High Risk** (explicit confirmation required):
- Bulk operations (>5 items)
- External recipients (clients, partners)
- Calendar with multiple attendees
- Any irreversible action

### Performance Optimization

**Caching Strategy**:
- Contact resolution (name → email): cache 24h
- Calendar availability: cache 1h
- Email search results: cache 15m (for follow-up queries)
- Session references: cache until session timeout

**Streaming Responses**:
- Show partial results as tools execute
- Progressive disclosure of complex synthesis
- Real-time updates during adaptive reasoning

### Conversational Continuity

**Context Window Management**:
- Last 5 queries/responses maintained
- Entity resolution uses conversation history
- "This", "that", "them" resolved automatically
- Previous results available for reference

**Reference Resolution Pattern**:
```
User: "Show me emails from Sarah"
System: Returns 5 emails in conversation history

User: "Reply to the second one"
System: Uses conversation history to resolve "the second one" → email_456
```

---

## Conversation History Management

### Context for Each Request

**Each request is independent** except for conversation history that provides context for pronoun resolution and topic continuity.

**Context includes:**
- Last 3-5 query/response pairs
- Recently discussed entities (people, emails, events)
- Topic continuity ("we were discussing Sarah's budget request")
- Pronoun resolution context ("that email", "the meeting")

**Reference Resolution within conversations:**

When processing "reply to the second email":
1. Look at conversation history for recent email searches
2. Identify which result corresponds to "second email"
3. Resolve to specific email ID from conversation context
4. Pass resolved reference to SubAgent command

---

## Concrete Examples

### Example 1: Simple Search

**User:** "Show me emails from Sarah about the budget"

**Master Agent - Prompt 1:**
```
Input: Query + empty results (new conversation)
Output:
{
  "commands": [{
    "agent": "email",
    "command": "Find all emails from Sarah about the budget",
    "order": 1
  }]
}
```

**EmailAgent - Prompt 1:**
```
Input: "Find all emails from Sarah about the budget"
Output:
{
  "tool_plan": [
    {"tool": "contact_lookup", "params": {"name": "Sarah"}, "order": 1},
    {"tool": "gmail_search", "params": {
      "query": "from:{email_from_contact_lookup} budget",
      "account_ids": ["all"]
    }, "order": 2}
  ],
  "next_tool": 1
}
```

**EmailAgent - Tool 1 Execution + Reassessment:**
```
Execute contact_lookup → sarah@company.com
Reassessment prompt output:
{
  "continue_execution": true,
  "next_tool_order": 2
}
```

**EmailAgent - Tool 2 Execution + Reassessment:**
```
Execute gmail_search → 5 emails found  
Reassessment prompt output:
{
  "continue_execution": false,
  "status": "complete",
  "response": {
    "natural_language": "Found 5 emails from Sarah about budget...",
    "structured_data": {emails: [...]}
  }
}
```

**Master Agent - Prompt 2:**
```
Input: EmailAgent completion response
Output:
{
  "continue_execution": false,
  "response": "I found 5 emails from Sarah about the budget:
               1. Q4 Budget Review (Dec 15)
               2. Budget Questions (Dec 20)
               ...",
  "status": "complete",
  "conversation_references": {
    "the first email": "email_123",
    "the second one": "email_456"
  }
}
```

**Total LLM calls: 5** (Master: 2, EmailAgent: 3 - planning + 2 reassessments)
**Time: ~5-8 seconds**

---

### Example 2: Reassessment Needed

**User:** "Show me emails from John"

**Master Agent - Prompt 1:**
```
Output:
{
  "commands": [{
    "agent": "email",
    "command": "Find all emails from John",
    "order": 1
  }]
}
```

**EmailAgent - Prompt 1:**
```
Output:
{
  "tool_plan": [
    {"tool": "contact_lookup", "params": {"name": "John"}, "order": 1}
  ],
  "next_tool": 1
}
```

**EmailAgent - Tool 1 Execution + Reassessment:**
```
Execute contact_lookup → Returns 3 Johns
Reassessment prompt output:
{
  "continue_execution": false,
  "status": "needs_clarification",
  "clarification": {
    "question": "I found 3 contacts named John. Which one?",
    "options": [
      "John Smith (colleague, last emailed 2 days ago)",
      "John Doe (client, frequent contact)",
      "John Lee (vendor, occasional)"
    ]
  }
}
```

**Master Agent - Prompt 2:**
```
Input: EmailAgent needs clarification
Output:
{
  "continue_execution": false,
  "response": "I found 3 people named John in your contacts...",
  "status": "needs_clarification",
  "clarification": {...}
}
```

**User:** "The client"

**Master Agent - Prompt 1** (new turn):
```
Input: "The client" + clarification context
Output:
{
  "commands": [{
    "agent": "email",
    "command": "Find all emails from John Doe (john.doe@client.com)",
    "order": 1
  }]
}
```

*Continues with search...*

**Total LLM calls: 5** (Master: 3, EmailAgent: 2 - planning + reassessment + final response)
**Time: ~8-12 seconds** (includes user interaction)

---

### Example 3: Adaptive Execution

**User:** "What emails haven't I responded to?"

**Master Agent - Prompt 1:**
```
Output:
{
  "commands": [{
    "agent": "email",
    "command": "Find all emails where I haven't sent a response",
    "order": 1
  }]
}
```

**EmailAgent - Prompt 1:**
```
Output:
{
  "tool_plan": [
    {
      "tool": "gmail_search",
      "params": {"query": "is:inbox after:7d"},
      "reason": "Get recent inbox emails",
      "order": 1
    }
  ],
  "next_tool": 1
}
```

**EmailAgent - Tool 1 Execution + Reassessment:**
```
Execute gmail_search → 50 emails found
Reassessment prompt output:
{
  "continue_execution": true,
  "plan_updates": [
    {
      "tool": "gmail_get_thread",
      "params": {"thread_ids": [all 50 thread IDs]},
      "reason": "Need to check who sent last message in each thread",
      "order": 2
    }
  ],
  "next_tool_order": 2
}
```

**EmailAgent - Tool 2 Execution + Reassessment:**
```
Execute gmail_get_thread for all 50 threads
For each thread, check programmatically: last_sender != user?
Filter to 8 unanswered threads
Reassessment prompt output:
{
  "continue_execution": false,
  "status": "complete",
  "response": {
    "natural_language": "You have 8 unanswered emails...",
    "structured_data": {emails: [...]}
  }
}
```

**Master Agent - Prompt 2:**
```
Output:
{
  "continue_execution": false,
  "response": "You have 8 unanswered emails...",
  "status": "complete"
}
```

**Total LLM calls: 6** (Master: 2, EmailAgent: 4 - planning + 2 reassessments + final response)
**Time: ~10-15 seconds**

---

### Example 4: Multi-Turn with References

**Turn 1:**
```
User: "Show me emails from clients"
Master Agent Prompt 1 → Route to EmailAgent
EmailAgent → Returns 12 emails
Master Agent Prompt 2 → Format response
System: "You have 12 emails from clients..."
**Conversation History**: Added exchange to history
```

**Turn 2:**
```
User: "Reply to the second one saying I'll send it Friday"
Master Agent Prompt 1:
  - Resolves "the second one" → email_id_002 from conversation history
  - Routes to ActionAgent with full email context
ActionAgent Prompt 1 → Plan: draft_reply
ActionAgent Execution → Create draft
ActionAgent Prompt 2 → Format draft preview
Master Agent Prompt 2 → Present draft to user
System: "Here's the draft reply: ..."
```

**Turn 3:**
```
User: "Send it"
Master Agent Prompt 1:
  - Resolves "it" → draft from conversation history
  - Routes to ActionAgent
ActionAgent → Send email (no LLM, just API call)
Master Agent Prompt 2 → Confirm sent
System: "Sent! Replied to Acme Corp."
```

---

## Tool Definitions

### EmailAgent Tools

```
gmail_search(query: string, account_ids: string[])
  - Searches across specified accounts
  - Returns: Email[] with metadata
  
gmail_get_thread(thread_id: string)
  - Gets full conversation thread
  - Returns: Thread with all messages
  
gmail_send(to: string, subject: string, body: string, thread_id?: string)
  - Sends new email or reply
  - Returns: Message ID
  
gmail_archive(message_ids: string[])
  - Archives specified emails
  - Returns: Success count
  
contact_lookup(name: string)
  - Finds contacts by name
  - Returns: Contact[] with email addresses
```

### CalendarAgent Tools

```
calendar_get_events(start: Date, end: Date, account_ids: string[])
  - Gets events in time range
  - Returns: Event[]
  
calendar_create_event(title: string, start: Date, end: Date, attendees: string[])
  - Creates new event
  - Returns: Event ID
  
calendar_update_event(event_id: string, changes: object)
  - Updates existing event
  - Returns: Updated Event
  
calendar_find_availability(participants: string[], duration: number, timeframe: string)
  - Finds free slots for all participants
  - Returns: TimeSlot[]
```

### ActionAgent Tools

Uses both Email and Calendar tools depending on action type.

---

## Error Handling

### Master Agent Error Handling

**SubAgent returns error:**
```
If error.recoverable:
  - Retry with modified command
  - Or ask user for clarification
Else:
  - Return error to user with explanation
  - Suggest alternative approach
```

**Timeout:**
```
If execution > 30 seconds:
  - Return partial results if available
  - Inform user of timeout
  - Offer to retry
```

### SubAgent Error Handling

**Tool execution fails:**
```
In Tool Execution phase:
  If error.type == "AUTH_EXPIRED":
    - Return needs_reauth to Master Agent
  Elif error.type == "RATE_LIMIT":
    - Wait and retry (exponential backoff, max 3 retries)
  Elif error.type == "NOT_FOUND":
    - Continue to Prompt 2 for reassessment
  Else:
    - Log error, continue to Prompt 2
```

**Empty results:**
```
In Prompt 2:
  LLM decides:
    - Try broader search?
    - Try different keywords?
    - Return "no results found" with suggestions?
```

**Ambiguous results:**
```
In Prompt 2:
  LLM decides:
    - Ask user for clarification?
    - Make best guess and proceed?
    - Show all options?
```

---

## Performance Targets

### LLM Call Count by Query Type

**Simple** (4-5 calls, ~6-8 seconds):
- "Show me emails from Sarah" → Master: 2, SubAgent: 3 (planning + 2 reassessments)
- "What's on my calendar today?" → Master: 2, SubAgent: 2-3

**Medium** (5-7 calls, ~8-12 seconds):
- "What emails haven't I responded to?" → Master: 2, SubAgent: 4-5 (planning + sequential tools)
- "Find conflicts in my calendar" → Master: 2, SubAgent: 3-4

**Complex** (6-10 calls, ~12-18 seconds):
- "Catch me up on the Johnson project" → Master: 2, SubAgent: 4-8 (multiple domains)
- "What meetings am I not prepared for?" → Master: 2, SubAgent: 4-6

**Multi-step** (8-12 calls, ~15-25 seconds + user time):
- "Reply to Sarah and schedule a meeting" → Master: 3-4, SubAgents: 5-8 total
- "Archive newsletters and show me important emails" → Master: 3-4, SubAgents: 5-7

### Optimization Strategy

**Phase 1 (MVP):**
- No optimizations, prove system works
- Target: <10 seconds for 80% of queries

**Phase 2 (Performance):**
- Cache common tool plans (don't re-plan same query type)
- Parallel tool execution where independent
- Streaming responses (show partial results while executing)

**Phase 3 (Scale):**
- Add vector search for semantic queries
- Persistent session state across sessions
- Proactive background queries (prefetch likely data)

---

## Adding New Services

**To add Slack support:**

1. **Create SlackAgent** following SubAgent pattern
2. **Define Slack tools:**
   - slack_get_channels
   - slack_search_messages
   - slack_send_message
   - slack_mark_read

3. **Update Master Agent context** to know about "slack" domain
4. **That's it.** Master Agent already knows how to route by domain.

**Example query:** "Show me unread Slack messages from today"

```
Master Agent Prompt 1:
  - Recognizes "slack" domain
  - Routes to SlackAgent with command: "Find unread messages from today"

SlackAgent Prompt 1:
  - Plans: slack_get_channels → slack_search_messages (unread, today)

SlackAgent Execution → Prompt 2 → Returns results

Master Agent Prompt 2 → Formats for user
```

**No changes to Master Agent routing logic needed.** It just routes by domain name.

---

## Why This Design Works

**Separation of Concerns:**
- Master Agent: Orchestration and high-level understanding
- SubAgents: Domain expertise and tool execution
- Session State: Memory and references

**Scalability:**
- Adding services = adding SubAgents (no Master Agent changes)
- SubAgents scale independently
- Tool sets can grow without affecting routing

**Flexibility:**
- Natural language at every layer (not brittle method calls)
- Adaptive execution (SubAgents handle unexpected results)
- Multi-turn conversations (session state enables references)

**Maintainability:**
- Clear responsibilities per component
- Consistent patterns (all SubAgents work the same way)
- Easy to debug (natural language traces)

**User Experience:**
- Fast for simple queries (minimal LLM calls)
- Flexible for complex queries (adaptive execution)
- Natural conversations (references work intuitively)
- Clear error handling (clarification loops)