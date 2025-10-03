# Migration to 4-Prompt Architecture

**Target Architecture**: PROMPT_ENGINEERING_ARCHITECTURE.md (4-prompt system with natural language boundaries, bulk operations, safety patterns, cross-account coordination)

**Migration Priority**: Cleanup and modernization over backward compatibility

**Assumption**: Most infrastructure exists, focus on prompt consolidation and data flow reorganization

---

## Executive Summary

### Current State Analysis

**Master Agent** currently uses a 4-stage workflow with 6 prompts:
- Stage 1: Situation Analysis (SituationAnalysisPromptBuilder)
- Stage 2: Workflow Planning (WorkflowPlanningPromptBuilder)
- Stage 3: Execution Loop via WorkflowExecutor with 3 sub-prompts per iteration:
  - Environment Check (EnvironmentCheckPromptBuilder)
  - Action Execution (ActionExecutionPromptBuilder)
  - Progress Assessment (ProgressAssessmentPromptBuilder)
- Stage 4: Final Response (FinalResponsePromptBuilder)

**SubAgents** (Email, Calendar, Contact, Slack) use 3-phase workflow with 3 prompts:
- Phase 1: Intent Assessment (IntentAssessmentPromptBuilder)
- Phase 2: Plan Review after each tool (PlanReviewPromptBuilder)
- Phase 3: Response Formatting (ResponseFormattingPromptBuilder)

### Target State

**Master Agent** with 2 prompts:
- Master Prompt 1: Intent Understanding & Command List Creation
- Master Prompt 2: Context Update & Command List Modification (iterates after each SubAgent response)

**SubAgents** (Email, Calendar only - Contact merged) with 2 prompts:
- SubAgent Prompt 1: Command Interpretation & Tool Call List Creation
- SubAgent Prompt 2: Tool Reassessment & Tool Call List Modification (runs after EACH tool execution)

### Migration Complexity: MEDIUM-HIGH

**Why Medium-High**: Major prompt consolidation, new data structures, significant flow changes, agent elimination, but strong existing infrastructure.

---

## Part 1: Agent Architecture Changes

### 1.1 Eliminate ContactAgent as Separate Agent

**Status**: ContactAgent exists as standalone BaseSubAgent at `/agents/contact.agent.ts`

**Action**: Delete ContactAgent, integrate contact tools into EmailAgent and CalendarAgent

**Rationale**: Architecture doc specifies contacts as tools available to both Email and Calendar agents, not a separate coordinator agent. Contact lookup is a utility function, not a domain.

**Impact**:
- Delete `/agents/contact.agent.ts`
- Remove ContactAgent from AgentFactory registration
- Remove ContactAgent from AGENT_CONFIG in `agent-config.ts`
- Update WorkflowExecutor to remove contact agent mapping
- EmailAgent and CalendarAgent will directly access ContactsDomainService for contact resolution
- Update ToolRegistry to assign contact tools to both email and calendar domains

**Data Flow Change**:
- BEFORE: Master → ContactAgent → ContactsDomainService → Response
- AFTER: Master → EmailAgent → (internally calls ContactsDomainService for email lookup) → Response

### 1.2 Evaluate SlackAgent Necessity

**Status**: SlackAgent exists for Slack-specific operations (read messages, detect drafts, manage confirmations, thread management)

**Decision Point**: Architecture doc only mentions EmailAgent and CalendarAgent. SlackAgent appears to be infrastructure for Slack as a front-end, not a domain agent.

**Recommendation**:
- If Slack is purely UI layer (conversation history, confirmation flow), keep SlackAgent but mark as infrastructure agent, not domain agent
- If Slack needs to send/read messages as domain operations, keep as domain agent
- Architecture doc does not explicitly include Slack in command routing

**Action**: Audit SlackAgent usage in next 48 hours. If only used for UI orchestration (which seems likely given "detect drafts" and "manage confirmations"), keep but exclude from Master Agent command routing.

### 1.3 Update Agent Configuration

**File**: `/config/agent-config.ts`

**Actions**:
- Remove contact agent entry from AGENT_CAPABILITIES and AGENT_CONFIG
- Keep email, calendar, slack (if retained)
- Update capability descriptions to reflect that email and calendar have contact tools
- Remove contact from getServiceTypeForAgent in WorkflowExecutor
- Remove contact from mapAgentName in WorkflowExecutor

---

## Part 2: Master Agent Prompt Consolidation

### 2.1 Eliminate 4-Stage Workflow

**Current Flow**: buildMessageHistory → analyzeAndPlan (Situation + Planning) → executeWorkflow (WorkflowExecutor with 3 prompts per iteration) → generateFinalResponse

**Target Flow**: buildMessageHistory → Master Prompt 1 (create command_list) → Execution Loop (Master Prompt 2 after each SubAgent) → Return final accumulated_knowledge as response

**Deleted Concepts**:
- "Situation Analysis" as separate stage
- "Workflow Planning" as separate stage
- "Environment Check" prompt
- "Progress Assessment" prompt
- "Final Response" prompt (just return accumulated_knowledge)

**Retained Concepts**:
- buildMessageHistory (good - provides conversation context)
- Execution loop with max iterations
- Action execution (but simplified to SubAgent delegation)

### 2.2 Delete Legacy Prompt Builders

**Delete These Files**:
- `/services/prompt-builders/main-agent/situation-analysis-prompt-builder.ts`
- `/services/prompt-builders/main-agent/workflow-planning-prompt-builder.ts`
- `/services/prompt-builders/main-agent/environment-check-prompt-builder.ts`
- `/services/prompt-builders/main-agent/progress-assessment-prompt-builder.ts`
- `/services/prompt-builders/main-agent/final-response-prompt-builder.ts`

Keep only:
- `/services/prompt-builders/main-agent/action-execution-prompt-builder.ts` (will be refactored into Master Prompt 1 and 2)

**Rationale**: Architecture uses only 2 Master prompts, not 6.

### 2.3 Delete WorkflowExecutor Service

**File**: `/services/workflow-executor.service.ts`

**Rationale**: WorkflowExecutor embeds 3 prompts per iteration (Environment, Action, Progress). Target architecture has execution loop directly in Master Agent with only Master Prompt 2 per iteration.

**Actions**:
- Delete WorkflowExecutor class
- Move executeAgentAction logic directly into Master Agent
- Move iteration loop logic directly into Master Agent
- Simplify to: loop { Master Prompt 2 → execute SubAgent if needed → update accumulated_knowledge }

**Critical**: DO NOT port Environment Check, Progress Assessment concepts. Architecture relies on Master Prompt 2's chain-of-thought to decide if complete or needs more commands.

### 2.4 Create New Master Prompt 1 Builder

**New File**: `/services/prompt-builders/master-agent/intent-understanding-prompt-builder.ts`

**Purpose**: Replace Situation Analysis + Workflow Planning

**Key Responsibilities**:
- Analyze user intent and conversation history
- Detect READ vs WRITE (including scope: single vs bulk)
- Detect cross-account intent
- Detect risk level for write operations
- Identify required domains (email, calendar)
- Create initial command_list (natural language commands for SubAgents)
- Detect multi-domain dependencies

**Input**:
- user_query (string)
- conversation_history (array of recent turns, max 3-5)
- user_context (email accounts, calendars, preferences)

**Output Schema**:
- command_list: Array of {agent: string, command: string, order: number}
- query_type: "read" | "write"
- write_metadata (if write): {scope: "single" | "bulk", risk_level: "low" | "medium" | "high"}
- cross_account: boolean

**Chain of Thought Steps** (from architecture doc):
1. Intent Analysis
2. Reference Resolution (scan conversation_history)
3. READ vs WRITE Detection (with scope and risk for writes)
4. Domain Detection (with cross-account detection)
5. Ambiguity Check
6. Command List Creation

### 2.5 Create New Master Prompt 2 Builder

**New File**: `/services/prompt-builders/master-agent/context-update-prompt-builder.ts`

**Purpose**: Replace Action Execution + Environment Check + Progress Assessment

**Key Responsibilities**:
- Extract essential information from SubAgent's natural language response
- Update accumulated_knowledge with only essentials (aggressive filtering)
- Modify command_list based on new information
- Detect if SubAgent is waiting for user confirmation
- Detect if user just confirmed/rejected an action
- Validate confirmations for safety
- Decide if workflow is complete or needs more commands

**Input**:
- accumulated_knowledge (string - natural language summary so far)
- command_list (array with execution status)
- latest_subagent_response (natural language string from SubAgent)
- conversation_history (for confirmation detection)

**Output Schema**:
- accumulated_knowledge (updated string)
- command_list (modified array)
- needs_user_confirmation: boolean
- confirmation_prompt (if waiting for user): string
- is_complete: boolean
- next_command_order (if continuing): number

**Chain of Thought Steps** (from architecture doc):
1. Response Analysis & Extraction
2. Safety Assessment (for write operations)
3. Command List Modification Assessment
4. Completion Assessment
5. Response Synthesis

**Critical Safety Logic**:
- Detect "Archive all 47?" patterns → set needs_user_confirmation = true
- Detect "yes" / "confirm" in user message when confirmation pending → validate matches context
- For completed write actions: detect "Undo?" pattern → preserve in accumulated_knowledge for next turn

### 2.6 Refactor MasterAgent Class

**File**: `/agents/master.agent.ts`

**Major Changes**:

**Delete**:
- analyzeAndPlan method (replaced by Prompt 1)
- executeWorkflow method (replaced by inline loop)
- generateFinalResponse method (just return accumulated_knowledge)
- Reference to WorkflowExecutor
- Reference to Situation, Planning, Final builders

**Add**:
- accumulated_knowledge: string (internal state)
- command_list: Array<{agent, command, order, status}> (internal state)
- intentUnderstandingBuilder: IntentUnderstandingPromptBuilder
- contextUpdateBuilder: ContextUpdatePromptBuilder

**New Flow**:
```
processUserInput(userInput, sessionId, userId, slackContext):
  1. messageHistory = buildMessageHistory(userInput, sessionId, slackContext)

  2. Master Prompt 1 → {command_list, query_type, write_metadata, cross_account}
     Store command_list, accumulated_knowledge = ""

  3. Execution Loop (max 10 iterations):
     a. Get next pending command from command_list
     b. If no pending commands → break
     c. Execute SubAgent via AgentFactory.executeAgentWithNaturalLanguage
     d. Master Prompt 2 → {accumulated_knowledge, command_list, is_complete, needs_user_confirmation}
     e. If needs_user_confirmation → return confirmation_prompt to user, exit loop
     f. If is_complete → break
     g. Loop

  4. Return accumulated_knowledge as final message
```

**Key Deletions**:
- No more "Situation → Planning → Workflow → Final" stages
- No more WorkflowExecutor delegation
- No more Environment Check per iteration
- No more Progress Assessment per iteration
- No more Final Response generation (accumulated_knowledge IS the response)

**Preserved**:
- buildMessageHistory (good existing code)
- AgentFactory.executeAgentWithNaturalLanguage (good existing code)
- TokenManager integration (good existing code)
- Max iteration safety limit
- Error handling patterns

---

## Part 3: SubAgent Prompt Consolidation

### 3.1 Eliminate 3-Phase Workflow

**Current**: Intent Assessment → Tool Execution Loop (with Plan Review after each tool) → Response Formatting

**Target**: Prompt 1 (create tool_call_list) → Tool Execution Loop (Prompt 2 after EACH tool) → Return natural language

**Key Change**: Response Formatting is DELETED. SubAgent Prompt 2 directly generates natural language response after final tool execution.

### 3.2 Delete Legacy SubAgent Prompt Builders

**Delete**:
- `/services/prompt-builders/sub-agent/response-formatting-prompt-builder.ts`

**Refactor**:
- `/services/prompt-builders/sub-agent/intent-assessment-prompt-builder.ts` → align with architecture's SubAgent Prompt 1
- `/services/prompt-builders/sub-agent/plan-review-prompt-builder.ts` → align with architecture's SubAgent Prompt 2

### 3.3 Refactor IntentAssessmentPromptBuilder → SubAgent Prompt 1

**File**: Rename to `/services/prompt-builders/sub-agent/command-interpretation-prompt-builder.ts`

**Current Behavior**: Already creates tool_call_list with parameters. GOOD.

**Enhancements Needed**:

**Add to Chain of Thought**:
1. Command Interpretation (existing)
2. Tool Call List Planning (existing)
3. Parameter Initialization (existing)
4. Execution Strategy (existing) + NEW ADDITIONS:
   - "Is this a read query or write operation?"
   - "Estimate scope (single vs bulk operation)"
   - "For cross-account queries: Which account_ids should I include?" (check user_context for accounts)
   - "Should I plan for confirmation stage?" (if write operation)

**Add to Input Context**:
- USER_CONTEXT with email_accounts array and calendars array
- MASTER_COMMAND indicating cross-account intent if present

**Output Schema** (already good, keep as is):
- context (string with structured info)
- toolCalls (array)
- executionPlan (string)

**Critical**: This prompt should NOT execute tools. It only creates tool_call_list.

### 3.4 Refactor PlanReviewPromptBuilder → SubAgent Prompt 2

**File**: Rename to `/services/prompt-builders/sub-agent/tool-reassessment-prompt-builder.ts`

**Current Behavior**: Reviews plan after tool execution, modifies tool list. CLOSE to target.

**Enhancements Needed**:

**Add to Chain of Thought** (new Step 3):
```
3. SAFETY DECISION (for write operations)
   - Is this a write operation that needs user confirmation?
   - Assess risk: Reversible? High impact? Ambiguous selection?
   - What level of confirmation is needed?
   - What preview should I show the user?
   - Should I store this in pending_action for Turn 2 execution?
```

**Key Logic**:
- If bulk write operation detected (e.g., search returned 47 emails, user wants to archive)
  - Store email_ids in working_data
  - Store pending_action: {type: "bulk_archive", count: 47, confirmed: false}
  - Return natural language preview: "Found 47 newsletters. Archive all? Reply 'yes' to confirm."
  - DO NOT add archive tool calls yet

- If confirmation received (Master Agent passes "Archive the 23 newsletters we just found")
  - Check working_data for pending_action and email_ids
  - Create archive tool calls for all stored IDs
  - Execute, then store last_action for undo

**Add to Output Schema**:
- pending_action (object, optional): {type, count, confirmed, risk_level}
- last_action (object, optional): {type, count, timestamp, affected_items, reversible, undo_available_until}
- needs_confirmation (boolean)
- confirmation_prompt (string, if needs_confirmation)

**Critical Enhancement**: This prompt now decides safety policy through reasoning, not hardcoded rules.

### 3.5 Delete Response Formatting Stage

**Rationale**: Architecture doc shows SubAgent Prompt 2 directly generates natural language response after final tool execution. No separate "formatting" stage.

**Current Code Location**: BaseSubAgent.formatResponse method calls ResponseFormattingPromptBuilder

**Action**:
- Delete ResponseFormattingPromptBuilder
- Modify BaseSubAgent.executeTools method: After final tool execution and final Prompt 2 call, extract natural language response from Prompt 2's output
- Prompt 2 should include in output: "response_message" (natural language summary for Master Agent)

### 3.6 Refactor BaseSubAgent Execution Flow

**File**: `/framework/base-subagent.ts`

**Current Flow**:
```
processNaturalLanguageRequest:
  1. assessIntent (Prompt 1) → context with tool calls
  2. executeTools (loop with Prompt 2 after each tool) → final context
  3. formatResponse (Prompt 3) → SubAgentResponse
```

**Target Flow**:
```
processNaturalLanguageRequest:
  1. Prompt 1 → {working_data, tool_call_list}
  2. Tool Execution Loop:
     - Execute next tool
     - Update working_data with tool result
     - Prompt 2 → {working_data, tool_call_list modifications, natural_language_response}
     - If needs_confirmation → return response with confirmation prompt, exit
     - If tool_call_list empty → break
     - Loop
  3. Return final natural_language_response from Prompt 2
```

**Key Changes**:
- Introduce working_data as private SubAgent context (initially empty object)
- Tool results are appended to working_data (not passed to Master Agent)
- After final tool: Prompt 2 generates response_message field → return as SubAgentResponse.message
- Delete formatResponse method entirely
- Delete Phase 3

**Working Data Structure** (internal, never sent to Master):
```
{
  // Query-specific data
  emails_found: 23,
  email_ids: ["id1", "id2", ...],
  by_account: {
    "work@company.com": {count: 12, ids: [...]},
    "personal@gmail.com": {count: 11, ids: [...]}
  },

  // Safety metadata
  pending_action: {
    type: "bulk_archive",
    count: 23,
    confirmed: false,
    risk_level: "medium"
  },

  last_action: {
    type: "bulk_archive",
    count: 23,
    timestamp: "2024-12-29T10:15:00Z",
    affected_items: ["id1", ...],
    reversible: true,
    undo_available_until: "2024-12-29T10:20:00Z"
  }
}
```

**Critical**: working_data never leaves SubAgent. Master Agent only sees natural language response.

---

## Part 4: Tool Registry Additions

### 4.1 Add Missing Email Tools

**File**: `/framework/tool-registry.ts`

**Add These Tools**:

1. archive_email
   - Parameters: messageId (required), userId (required)
   - Service method: archiveEmail
   - Domain: email
   - requiresConfirmation: false (reversible)
   - isCritical: false

2. mark_read / mark_unread
   - Parameters: messageId (required), userId (required)
   - Service methods: markRead, markUnread
   - Domain: email
   - requiresConfirmation: false
   - isCritical: false

3. star_email / unstar_email
   - Parameters: messageId (required), userId (required)
   - Service methods: starEmail, unstarEmail
   - Domain: email
   - requiresConfirmation: false
   - isCritical: false

4. create_label
   - Parameters: name (required), userId (required)
   - Service method: createLabel
   - Domain: email
   - requiresConfirmation: false
   - isCritical: false

5. add_label_to_email
   - Parameters: messageId (required), labelId (required), userId (required)
   - Service method: addLabel
   - Domain: email
   - requiresConfirmation: false
   - isCritical: false

6. remove_label_from_email
   - Parameters: messageId (required), labelId (required), userId (required)
   - Service method: removeLabel
   - Domain: email
   - requiresConfirmation: false
   - isCritical: false

7. manage_attachments (upload/download)
   - Parameters vary by operation
   - Service methods: uploadAttachment, downloadAttachment
   - Domain: email
   - requiresConfirmation: true (upload only)
   - isCritical: false

### 4.2 Add Missing Calendar Tools

**Add**:

1. respond_to_event
   - Parameters: eventId (required), response (enum: "accepted" | "declined" | "tentative"), userId (required)
   - Service method: respondToEvent
   - Domain: calendar
   - requiresConfirmation: false
   - isCritical: false

### 4.3 Add Cross-Account Support to Existing Tools

**Modify These Existing Tools**:

1. search_emails
   - ADD PARAMETER: account_ids (array of strings, optional)
   - If not provided, search default account only
   - If provided, search across all specified accounts

2. list_events
   - ADD PARAMETER: calendar_ids (array of strings, optional)
   - If not provided, list default calendar only
   - If provided, list across all specified calendars

**Note**: Tools already have userId parameter. account_ids is ADDITIONAL for multi-account queries.

### 4.4 Reassign Contact Tools to Multiple Domains

**Current**: Contact tools have domain: "contacts"

**Change**: Contact tools should be available to BOTH email and calendar

**Implementation Option 1**: Duplicate tool registrations
- Register search_contacts with domain: "email"
- Register search_contacts with domain: "calendar"

**Implementation Option 2**: Modify ToolRegistry.getToolsForDomain to support multi-domain tools
- Add domains (array) field to ToolDefinition
- getToolsForDomain returns tools where domain array includes requested domain

**Recommendation**: Option 2 (cleaner, avoids duplication)

**Contact Tools**:
- search_contacts
- get_contact
- create_contact (if exists)
- update_contact (if exists)

All should have domains: ["email", "calendar"]

---

## Part 5: Domain Service Additions

### 5.1 Add Methods to EmailDomainService

**File**: `/services/domain/email-domain.service.ts`

**Add These Methods**:

1. `async archiveEmail(messageId: string): Promise<void>`
   - Uses Gmail API: `gmail.users.messages.modify` with removeLabelIds: ["INBOX"]

2. `async markRead(messageId: string): Promise<void>`
   - Uses Gmail API: `gmail.users.messages.modify` with removeLabelIds: ["UNREAD"]

3. `async markUnread(messageId: string): Promise<void>`
   - Uses Gmail API: `gmail.users.messages.modify` with addLabelIds: ["UNREAD"]

4. `async starEmail(messageId: string): Promise<void>`
   - Uses Gmail API: `gmail.users.messages.modify` with addLabelIds: ["STARRED"]

5. `async unstarEmail(messageId: string): Promise<void>`
   - Uses Gmail API: `gmail.users.messages.modify` with removeLabelIds: ["STARRED"]

6. `async createLabel(userId: string, name: string): Promise<{id: string, name: string}>`
   - Uses Gmail API: `gmail.users.labels.create`

7. `async addLabel(messageId: string, labelId: string): Promise<void>`
   - Uses Gmail API: `gmail.users.messages.modify` with addLabelIds

8. `async removeLabel(messageId: string, labelId: string): Promise<void>`
   - Uses Gmail API: `gmail.users.messages.modify` with removeLabelIds

9. `async uploadAttachment(messageId: string, attachment: {filename: string, content: Buffer, contentType: string}): Promise<void>`
   - Uses Gmail API attachment handling

10. `async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer>`
    - Uses Gmail API: `gmail.users.messages.attachments.get`

**Cross-Account Enhancement**:

11. Modify `async searchEmails(userId: string, query: string, maxResults?: number)` signature:
    - ADD PARAMETER: `accountIds?: string[]`
    - If accountIds provided: iterate and aggregate results from multiple accounts
    - Return unified result with account source tagged

### 5.2 Add Method to CalendarDomainService

**File**: `/services/domain/calendar-domain.service.ts`

**Add**:

1. `async respondToEvent(userId: string, eventId: string, response: "accepted" | "declined" | "tentative"): Promise<void>`
   - Uses Google Calendar API: `calendar.events.patch` to update attendee response status

**Cross-Account Enhancement**:

2. Modify `async listEvents(userId: string, start: Date, end: Date)` signature:
   - ADD PARAMETER: `calendarIds?: string[]`
   - If calendarIds provided: iterate and aggregate events from multiple calendars
   - Return unified result with calendar source tagged

### 5.3 No Changes to ContactsDomainService

**Rationale**: Contact tools are already well-defined. Just reassign to multiple domains in ToolRegistry.

---

## Part 6: Data Structure Changes

### 6.1 Eliminate "SimpleContext" String Format

**Current**: SubAgents use structured string format with "GOAL:", "DATA:", "PROGRESS:", etc.

**Problem**: This is verbose. Architecture uses working_data (object) for SubAgents and accumulated_knowledge (natural language string) for Master.

**Action**:
- Delete CONTEXT_FORMAT constant from BasePromptBuilder
- Delete SUB_AGENT_CONTEXT_FORMAT from SubAgentBasePromptBuilder
- SubAgents now use working_data (plain JavaScript object)
- Master Agent uses accumulated_knowledge (natural language summary, not structured format)

**Migration**:
- Prompt 1 initializes working_data = {}
- Prompt 2 updates working_data by appending tool results
- No more "GOAL:", "DATA:", "BLOCKERS:" markers

### 6.2 Introduce working_data in SubAgents

**Location**: BaseSubAgent class

**Implementation**:
- Add private property: `private working_data: Record<string, unknown> = {}`
- Reset at start of each processNaturalLanguageRequest
- Pass to Prompt 1 and Prompt 2 as input
- Prompt 2 updates working_data after each tool execution
- working_data NEVER sent to Master Agent

**Structure** (example for bulk operation):
```typescript
{
  // Query results
  emails_found: number,
  email_ids: string[],
  by_account?: Record<string, {count: number, ids: string[]}>,

  // Safety tracking
  pending_action?: {
    type: string,
    count: number,
    confirmed: boolean,
    risk_level: "low" | "medium" | "high"
  },

  last_action?: {
    type: string,
    count: number,
    timestamp: string,
    affected_items: string[],
    reversible: boolean,
    undo_available_until: string
  }
}
```

### 6.3 Introduce accumulated_knowledge in Master Agent

**Location**: MasterAgent class

**Implementation**:
- Add private property: `private accumulated_knowledge: string = ""`
- Reset at start of each processUserInput
- Master Prompt 2 extracts info from SubAgent natural language response and appends to accumulated_knowledge
- accumulated_knowledge is lean summary, not full responses
- Final accumulated_knowledge IS the response to user (no Final Response formatting)

**Example**:
```
Turn 1:
User: "Show me emails from Sarah"
SubAgent: "Found 5 emails from Sarah Chen: Q4 Budget Review (Dec 15), Project Update (Dec 20)..."
accumulated_knowledge: "Sarah Chen has sent 5 emails. Most recent: Q4 Budget Review on Dec 15."

Turn 2:
User: "Reply to the first one"
SubAgent: "Draft: 'Hi Sarah, thanks for the Q4 budget review. I'll review and get back to you by end of week.'"
accumulated_knowledge: "Sarah Chen has sent 5 emails. Most recent: Q4 Budget Review on Dec 15. Draft reply prepared. Confirm to send?"
```

### 6.4 Introduce command_list in Master Agent

**Location**: MasterAgent class

**Implementation**:
- Add private property: `private command_list: Array<Command> = []`
  ```typescript
  interface Command {
    agent: "email" | "calendar",
    command: string,
    order: number,
    status: "pending" | "executing" | "completed" | "failed"
  }
  ```
- Master Prompt 1 creates initial command_list
- Master Prompt 2 can modify command_list (add, remove, update commands)
- Execution loop iterates through pending commands

### 6.5 Introduce tool_call_list in SubAgents

**Location**: BaseSubAgent class (internal to prompts)

**Current**: SubAgent Prompt 1 already outputs toolCalls array. KEEP THIS.

**Enhancement**: Prompt 2 can modify tool_call_list (add, remove, update tools)

**Example**:
```typescript
[
  {tool: "search_contacts", params: {name: "Sarah"}, order: 1},
  {tool: "search_emails", params: {query: "from:{email} subject:'Q4 Budget'"}, order: 2}
]
```

---

## Part 7: Safety Pattern Integration

### 7.1 Progressive Confirmation Logic

**Location**: SubAgent Prompt 2 (ToolReassessmentPromptBuilder)

**Implementation**: Prompt 2 includes safety decision reasoning step

**Example Prompt Section**:
```
Step 3 - Safety Decision (for write operations):
Is this a write operation that needs user confirmation?
- Reversible? (Archive = yes, Delete = no, Send = no)
- High impact? (Count? Who's involved? External recipients?)
- Ambiguous selection? (Clear criteria or vague?)

Examples:
- Archive 5 emails → Reversible ✓, Low count ✓ → Simple confirmation
- Archive 156 automated emails → Reversible ✓, High count ⚠️, Ambiguous ⚠️ → Detailed preview
- Delete 50 emails permanently → Irreversible ❌, High count ⚠️ → Strong warning
```

**Output**: needs_confirmation (bool) + confirmation_prompt (string with preview)

### 7.2 Undo Mechanism

**Location**: SubAgent working_data, persisted for 5 minutes after write action

**Implementation**:
- After executing write operation, Prompt 2 populates last_action in working_data
- last_action includes: type, affected_items, timestamp, undo_available_until
- Natural language response includes: "Undo?" affordance
- If user says "undo" in next turn, Master Agent sends "Undo the last action" command
- SubAgent checks last_action timestamp, executes reverse operation if within window

**Time Window**: 5 minutes (300 seconds)

**Storage**:
- Option 1: In-memory in BaseSubAgent instance (lost on restart)
- Option 2: CacheService with 5-minute TTL (survives restarts)
- Recommendation: Option 2 with cache key: `subagent:${domain}:${userId}:last_action`

### 7.3 Graceful Failure Handling

**Location**: BaseSubAgent.executeTools method

**Current**: Already has error handling in executeToolCallWithRetry. GOOD.

**Enhancement**: Prompt 2 should receive partial success info and explain failures

**Example**:
```
Attempted to archive 23 emails.
Results: 21 successful, 2 failed

Prompt 2 receives:
- success_count: 21
- failed_items: [
    {id: "abc123", reason: "admin-locked"},
    {id: "def456", reason: "legal hold"}
  ]

Prompt 2 generates response:
"Archived 21 of 23 newsletters. Could not archive:
• Email from CEO: Q4 Strategy (locked by admin)
• Email from Legal: Contract Review (legal hold)
These 2 emails remain in your inbox."
```

### 7.4 Ambiguity Handling

**Location**: SubAgent Prompt 1

**Enhancement**: Add ambiguity detection to chain of thought

**Example**:
```
Master command: "Archive all emails from Sarah"

Prompt 1 reasoning:
"All emails from Sarah" is potentially HUGE and ambiguous.
- Could be 1000+ emails spanning years
- User probably means "recent emails from Sarah"
- This is dangerously ambiguous for bulk operation

Decision: CLARIFY before searching
Output: needs_clarification = true
```

**Output Schema Addition**:
- needs_clarification (bool)
- clarification_question (string)
- suggested_interpretations (array of strings)

---

## Part 8: Context Efficiency Improvements

### 8.1 Aggressive Filtering in Master Prompt 2

**Current**: Master Agent accumulates full responses

**Target**: Master Prompt 2 extracts ONLY essential facts

**Example**:
```
SubAgent returns 500 tokens:
"Found 47 newsletters from today across 3 accounts:

Work (28):
• TechCrunch Daily (5 issues)
• LinkedIn Digest (8 emails)
• Morning Brew (3 issues)
... (25 more lines)

Personal (15):
• Product Hunt Daily (2 issues)
... (15 more lines)"

Master Prompt 2 extracts to accumulated_knowledge (50 tokens):
"Found 47 newsletters today across 3 accounts (28 work, 15 personal, 4 consulting). User can refine by account."
```

**Guideline for Prompt 2**: "Extract ONLY essential facts. Discard metadata, redundant info, full lists. Preserve key numbers and entities."

### 8.2 No Raw Tool Results in Master Context

**Enforcement**: Master Agent NEVER sees tool results. Only SubAgent's natural language summaries.

**Current Code**: Already correct. AgentFactory.executeAgentWithNaturalLanguage returns natural language. KEEP THIS.

### 8.3 Bounded Working Data in SubAgents

**Guideline for SubAgent Prompt 2**: "Store only what's needed for next tool or final response. Discard metadata after use."

**Example**:
```
GOOD:
{
  email_ids: ["id1", "id2", ...], // needed for bulk archive
  pending_action: {...}  // needed for confirmation flow
}

BAD:
{
  email_ids: [...],
  full_email_objects: [{subject, body, headers, ...}, ...], // NOT NEEDED, discard
  search_metadata: {query, duration, ...}  // NOT NEEDED, discard
}
```

---

## Part 9: Testing Strategy

### 9.1 Expected Test Breakage

**High Confidence**: 80-100 of 156 test files will break

**Categories**:
1. Master Agent tests (all prompts changed)
2. SubAgent tests (flow changed)
3. WorkflowExecutor tests (deleted)
4. Prompt builder tests (6 of 8 builders deleted/refactored)
5. Integration tests using old agent flow

### 9.2 Test Migration Priority

**Phase 1 - Critical Path** (do first):
1. Master Agent integration tests (processUserInput end-to-end)
2. SubAgent integration tests (processNaturalLanguageRequest end-to-end)
3. ToolRegistry tests (new tools added)
4. Domain service tests (new methods added)

**Phase 2 - Unit Tests**:
1. Master Prompt 1 and 2 builder tests
2. SubAgent Prompt 1 and 2 builder tests
3. BaseSubAgent unit tests

**Phase 3 - Delete Obsolete**:
1. Delete tests for WorkflowExecutor
2. Delete tests for deleted prompt builders
3. Delete tests for ContactAgent

### 9.3 Test Approach for New Architecture

**Master Agent Tests**:
- Test command_list creation from various user intents
- Test accumulated_knowledge extraction after SubAgent responses
- Test completion detection
- Test confirmation flow (wait for user, validate confirmation)
- Test cross-account detection

**SubAgent Tests**:
- Test working_data accumulation
- Test bulk operation preview generation
- Test confirmation flow (preview → wait → execute)
- Test undo mechanism
- Test graceful failure (partial success)
- Test cross-account tool calls

**Safety Tests**:
- Test progressive confirmation levels (low/medium/high risk)
- Test undo window expiration
- Test ambiguity detection

---

## Part 10: Migration Execution Plan

### Phase 1: Infrastructure (Week 1)

**Day 1-2: Domain Services**
- Add methods to EmailDomainService (archive, labels, star, attachments)
- Add respondToEvent to CalendarDomainService
- Add cross-account support (account_ids parameter) to searchEmails and listEvents
- Write unit tests for new methods

**Day 3-4: Tool Registry**
- Add 12 new tools (archive, labels, star, attachments, respond_to_event)
- Reassign contact tools to multi-domain
- Add account_ids parameter to search_emails and list_events
- Add cross-account examples

**Day 5: Agent Configuration**
- Delete ContactAgent from AGENT_CONFIG
- Update WorkflowExecutor agent mappings
- Update AgentFactory registrations

### Phase 2: SubAgent Refactor (Week 2)

**Day 1-2: Prompt Builders**
- Refactor IntentAssessmentPromptBuilder → CommandInterpretationPromptBuilder
- Refactor PlanReviewPromptBuilder → ToolReassessmentPromptBuilder
- Add safety decision logic to Prompt 2
- Add cross-account logic to Prompt 1
- Delete ResponseFormattingPromptBuilder

**Day 3-4: BaseSubAgent**
- Add working_data property
- Refactor executeTools to use working_data
- Delete formatResponse method
- Implement confirmation flow (preview → wait → execute)
- Implement undo mechanism with cache

**Day 5: Agent Classes**
- Delete ContactAgent
- Update EmailAgent and CalendarAgent to access ContactsDomainService directly
- Update agent tests

### Phase 3: Master Agent Refactor (Week 3)

**Day 1-2: Prompt Builders**
- Create IntentUnderstandingPromptBuilder (Master Prompt 1)
- Create ContextUpdatePromptBuilder (Master Prompt 2)
- Delete 5 legacy prompt builders

**Day 3-4: MasterAgent Class**
- Delete analyzeAndPlan, executeWorkflow, generateFinalResponse methods
- Delete WorkflowExecutor integration
- Add accumulated_knowledge and command_list properties
- Implement new 2-prompt flow
- Implement execution loop with Prompt 2

**Day 5: WorkflowExecutor Deletion**
- Delete WorkflowExecutor class
- Delete WorkflowExecutor tests
- Update DI container registrations

### Phase 4: Testing & Validation (Week 4)

**Day 1-2: Integration Tests**
- Write/update Master Agent integration tests
- Write/update SubAgent integration tests
- Test cross-account queries
- Test bulk operations

**Day 3-4: Safety Tests**
- Test confirmation flows
- Test undo mechanism
- Test ambiguity handling
- Test graceful failures

**Day 5: Regression Testing**
- Run full test suite
- Fix remaining breakages
- Validate against use cases in CHATBOT_COMMANDS_EXAMPLES.md

---

## Part 11: Rollback Plan

### Critical Preservation

**Before starting migration, create feature branch**: `feature/4-prompt-architecture`

**Tag current main**: `pre-4-prompt-migration`

**Critical files to backup** (in case partial rollback needed):
- `/agents/master.agent.ts`
- `/framework/base-subagent.ts`
- `/services/workflow-executor.service.ts`
- All prompt builders in `/services/prompt-builders/`

### Rollback Triggers

**Abort migration if**:
1. Week 3 completion and <50% integration tests passing
2. Unresolvable architectural issue discovered
3. Performance degradation >2x current latency
4. Core use cases (email send, calendar create) broken and unfixable within 2 days

### Partial Rollback Options

**If SubAgent refactor succeeds but Master Agent fails**:
- Keep SubAgent 2-prompt system
- Revert Master Agent to old WorkflowExecutor flow
- SubAgents can work with old Master (natural language interface is stable)

**If infrastructure succeeds but prompt consolidation fails**:
- Keep new domain service methods and tools
- Revert to old prompt builders
- Minor adapter layer to bridge new tools with old prompts

---

## Part 12: Success Criteria

### Functional Requirements (Must Pass)

1. **All 14 use case categories** from CHATBOT_COMMANDS_EXAMPLES.md work correctly
2. **Cross-account queries**: "Show me emails from today across all accounts" returns unified results
3. **Bulk operations**: "Archive all newsletters" → preview → user confirms → executes → offers undo
4. **Safety patterns**: High-risk operations require explicit confirmation with preview
5. **Undo mechanism**: User can undo write operations within 5 minutes
6. **Contact integration**: EmailAgent and CalendarAgent can resolve contacts without separate ContactAgent
7. **New tools**: Archive, labels, star, respond_to_event all functional

### Performance Requirements

1. **Context size reduction**: Master Agent context ≤50% of current size for complex multi-turn conversations
2. **Latency**: No regression >20% compared to current implementation
3. **Token usage**: SubAgent working_data not passed to Master → token savings on large tool results

### Code Quality Requirements

1. **Prompt consolidation**: 6 Master prompts + 3 SubAgent prompts → 2 Master + 2 SubAgent (8 deleted)
2. **Agent consolidation**: 4 agents (Email, Calendar, Contact, Slack) → 2 domain agents (Email, Calendar) + 1 optional infrastructure (Slack)
3. **Test coverage**: ≥80% coverage on new prompt builders and refactored agents
4. **No regression**: Existing working functionality (send email, create event) still works

### Documentation Requirements

1. Update PROMPT_ENGINEERING_ARCHITECTURE.md with any implementation deviations
2. Document working_data schema for each SubAgent
3. Document accumulated_knowledge format
4. Add architecture decision records (ADRs) for major choices

---

## Part 13: Risk Assessment

### High Risk Items

**Risk 1: Prompt Quality Degradation**
- **Impact**: New prompts perform worse than current 9-prompt system
- **Mitigation**: A/B test new prompts on sample queries before full migration
- **Contingency**: Revert to old prompts, investigate root cause, iterate

**Risk 2: LLM Fails to Parse Natural Language Responses**
- **Impact**: Master Prompt 2 cannot extract information from SubAgent natural language
- **Mitigation**: Provide structured examples in Prompt 2, use few-shot learning
- **Contingency**: Add optional structured output from SubAgent as fallback

**Risk 3: Working Data Grows Unbounded**
- **Impact**: SubAgent memory bloat on large bulk operations (1000+ emails)
- **Mitigation**: Add prompt guidance to store only essential IDs, add hard limit (max 1000 items in bulk)
- **Contingency**: Paginate bulk operations, store only first 1000 items

### Medium Risk Items

**Risk 4: Test Suite Takes >2 Weeks to Fix**
- **Impact**: Delays launch, integration tests remain broken
- **Mitigation**: Delete obsolete tests first (Week 3 Day 5), prioritize critical path
- **Contingency**: Accept lower coverage temporarily, fix incrementally post-launch

**Risk 5: Cross-Account Implementation Complexity**
- **Impact**: Gmail/Calendar APIs don't support batch multi-account queries as expected
- **Mitigation**: Research API capabilities before implementation
- **Contingency**: Implement as sequential calls per account, aggregate in service layer

### Low Risk Items

**Risk 6: Undo Cache Eviction**
- **Impact**: User tries to undo after cache expiry (5 min) or server restart
- **Mitigation**: Clear "Undo?" affordance with time limit, graceful error message
- **Contingency**: Extend to persistent storage if users demand longer window

---

## Part 14: Open Questions for Architectural Decision

### Question 1: SlackAgent Retention

**Context**: Architecture doc doesn't mention SlackAgent. Current implementation has SlackAgent for Slack-specific operations.

**Options**:
A. Delete SlackAgent (treat Slack as pure UI layer)
B. Keep SlackAgent as infrastructure agent (excluded from command routing)
C. Keep SlackAgent as domain agent (included in command routing)

**Recommendation**: B (keep as infrastructure, exclude from routing)

**Rationale**: Slack provides conversation history and confirmation flow (UI concerns), not domain operations like email/calendar.

**Action Required**: Audit SlackAgent usage in codebase, confirm it's UI-only.

### Question 2: Working Data Persistence

**Context**: working_data in SubAgents enables undo and confirmation flows. Currently in-memory.

**Options**:
A. Keep in-memory (lost on restart)
B. Persist to CacheService (survives restart, 5-min TTL)
C. Persist to database (permanent, requires cleanup)

**Recommendation**: B (CacheService with TTL)

**Rationale**: Undo window is 5 minutes. Cache TTL aligns perfectly. No need for permanent storage.

**Action Required**: Implement working_data serialization to cache after each SubAgent call.

### Question 3: Conversation History Integration

**Context**: ContextManager.gatherContext provides conversation history from Slack. Master Agent's buildMessageHistory uses this.

**Question**: Should accumulated_knowledge be stored in conversation history for future turns?

**Options**:
A. Store accumulated_knowledge in ContextManager after each turn (user can reference it)
B. Don't store (each turn is stateless)

**Recommendation**: A (store in context)

**Rationale**: Multi-turn conversations benefit from accumulated context. "Reply to the first email" references previous turn.

**Action Required**: Add ContextManager.storeAccumulatedKnowledge method, call after each MasterAgent.processUserInput.

### Question 4: Batch Tool Calls

**Context**: Architecture mentions SubAgents can optimize bulk operations with batch tools (e.g., archive_emails instead of 50x archive_email).

**Question**: Should we implement batch variants of tools?

**Options**:
A. Add batch tools (archive_emails, delete_emails, etc.)
B. SubAgent calls single-item tools in loop (simpler)

**Recommendation**: B for MVP, A for optimization later

**Rationale**: Single-item tools work for bulk via loop. Batch tools add complexity. Optimize only if performance issue.

**Action Required**: None for migration. Note as future optimization.

### Question 5: Error Recovery in Command List

**Context**: Master Prompt 2 can modify command_list after SubAgent errors.

**Question**: Should Master Agent auto-retry failed commands or ask user?

**Options**:
A. Auto-retry with different approach (e.g., try broader search if narrow search fails)
B. Report failure to user, don't retry
C. Ask user if they want to retry

**Recommendation**: A (auto-retry with reasoning)

**Rationale**: LLM can reason about alternative approaches. Don't bother user with retryable errors.

**Action Required**: Add retry logic to Master Prompt 2 chain of thought.

---

## Part 15: Final Checklist

### Pre-Migration
- [ ] Feature branch created: `feature/4-prompt-architecture`
- [ ] Current main tagged: `pre-4-prompt-migration`
- [ ] Team briefed on migration scope and timeline
- [ ] Backup critical files

### Week 1: Infrastructure
- [ ] Add 10 methods to EmailDomainService
- [ ] Add 1 method to CalendarDomainService
- [ ] Add cross-account support to searchEmails and listEvents
- [ ] Register 12 new tools in ToolRegistry
- [ ] Reassign contact tools to multi-domain
- [ ] Delete ContactAgent from AGENT_CONFIG
- [ ] Unit tests pass for new domain methods

### Week 2: SubAgent Refactor
- [ ] Refactor IntentAssessmentPromptBuilder → CommandInterpretationPromptBuilder
- [ ] Refactor PlanReviewPromptBuilder → ToolReassessmentPromptBuilder
- [ ] Delete ResponseFormattingPromptBuilder
- [ ] Add working_data to BaseSubAgent
- [ ] Delete formatResponse method
- [ ] Implement confirmation flow
- [ ] Implement undo mechanism
- [ ] Delete ContactAgent class
- [ ] Update EmailAgent and CalendarAgent
- [ ] SubAgent integration tests pass

### Week 3: Master Agent Refactor
- [ ] Create IntentUnderstandingPromptBuilder
- [ ] Create ContextUpdatePromptBuilder
- [ ] Delete 5 legacy prompt builders
- [ ] Delete WorkflowExecutor
- [ ] Refactor MasterAgent to 2-prompt flow
- [ ] Add accumulated_knowledge property
- [ ] Add command_list property
- [ ] Master Agent integration tests pass

### Week 4: Testing & Validation
- [ ] All 14 use case categories pass
- [ ] Cross-account queries work
- [ ] Bulk operations with confirmation work
- [ ] Undo mechanism works
- [ ] Safety patterns validated
- [ ] Performance benchmarks meet requirements
- [ ] ≥80% test coverage on new code
- [ ] Documentation updated
- [ ] Code review completed

### Post-Migration
- [ ] Merge to main
- [ ] Deploy to staging
- [ ] Smoke test production scenarios
- [ ] Monitor for 48 hours
- [ ] Retrospective on migration process

---

## Appendix A: File Inventory

### Files to Delete (13 files)

**Agent Files**:
1. `/agents/contact.agent.ts`

**Prompt Builder Files**:
2. `/services/prompt-builders/main-agent/situation-analysis-prompt-builder.ts`
3. `/services/prompt-builders/main-agent/workflow-planning-prompt-builder.ts`
4. `/services/prompt-builders/main-agent/environment-check-prompt-builder.ts`
5. `/services/prompt-builders/main-agent/progress-assessment-prompt-builder.ts`
6. `/services/prompt-builders/main-agent/final-response-prompt-builder.ts`
7. `/services/prompt-builders/sub-agent/response-formatting-prompt-builder.ts`

**Service Files**:
8. `/services/workflow-executor.service.ts`

**Test Files** (estimate):
9-13. ~5-10 test files for deleted components

### Files to Create (2 files)

1. `/services/prompt-builders/master-agent/intent-understanding-prompt-builder.ts`
2. `/services/prompt-builders/master-agent/context-update-prompt-builder.ts`

### Files to Refactor (8 files)

1. `/agents/master.agent.ts` (major refactor)
2. `/framework/base-subagent.ts` (major refactor)
3. `/agents/email.agent.ts` (add contact access)
4. `/agents/calendar.agent.ts` (add contact access)
5. `/services/domain/email-domain.service.ts` (add 10 methods)
6. `/services/domain/calendar-domain.service.ts` (add 1 method)
7. `/framework/tool-registry.ts` (add 12 tools)
8. `/config/agent-config.ts` (remove contact agent)

### Files to Rename (2 files)

1. `/services/prompt-builders/sub-agent/intent-assessment-prompt-builder.ts` → `command-interpretation-prompt-builder.ts`
2. `/services/prompt-builders/sub-agent/plan-review-prompt-builder.ts` → `tool-reassessment-prompt-builder.ts`

---

## Appendix B: Comparison Table

| Aspect | Current | Target | Change |
|--------|---------|--------|--------|
| **Master Prompts** | 6 (Situation, Planning, Environment, Action, Progress, Final) | 2 (Intent Understanding, Context Update) | -4 prompts |
| **SubAgent Prompts** | 3 (Intent, Plan Review, Response Formatting) | 2 (Command Interpretation, Tool Reassessment) | -1 prompt |
| **Total Prompts** | 9 | 4 | -5 prompts |
| **Domain Agents** | 4 (Email, Calendar, Contact, Slack) | 2 (Email, Calendar) | -2 agents |
| **Master Context** | Mixed (string format + accumulated responses) | accumulated_knowledge (lean natural language) | Simplified |
| **SubAgent Context** | SimpleContext (structured string) | working_data (object) + natural language output | Modernized |
| **Email Tools** | 5 | 12 | +7 tools |
| **Calendar Tools** | 7 | 8 | +1 tool |
| **Contact Tools Assignment** | Separate domain | Multi-domain (email + calendar) | Integrated |
| **Confirmation Flow** | Implicit in prompts | Explicit in working_data + Prompt 2 | Formalized |
| **Undo Mechanism** | None | 5-minute window via cache | New feature |
| **Cross-Account** | Not supported | Supported via account_ids parameter | New feature |
| **Bulk Operations** | Ad-hoc | Formalized (preview → confirm → execute → undo) | Standardized |

---

## Appendix C: Key Architectural Principles to Preserve

### From Current Implementation (Keep These)

1. **BaseSubAgent pattern**: Clean abstraction for SubAgents, reusable across domains
2. **ToolRegistry**: Single source of truth for tool definitions, excellent design
3. **Domain Services**: Separation of agent logic from API integration, maintain
4. **GenericAIService**: Abstraction over LLM provider, good for flexibility
5. **Natural language boundaries**: Master ↔ SubAgent communicate in natural language, not JSON
6. **AgentFactory pattern**: Clean dependency injection, keep
7. **TokenManager integration**: OAuth token management, works well
8. **Error classification**: BaseSubAgent.classifyError with retry logic, solid
9. **ContextManager**: Conversation history gathering from Slack, useful

### From Target Architecture (Add These)

1. **2-prompt system**: Consolidate to essential prompts only
2. **working_data isolation**: SubAgent internal context never leaks to Master
3. **accumulated_knowledge**: Master maintains lean summary, not full responses
4. **Command list**: Master creates and modifies natural language commands for SubAgents
5. **Tool call list**: SubAgent creates and modifies structured tool calls
6. **Safety reasoning**: Prompt 2 reasons about risk, not hardcoded rules
7. **Progressive confirmation**: Risk level determines confirmation detail
8. **Undo affordance**: Always offer undo after write operations
9. **Context efficiency**: Aggressive filtering, 80-85% token reduction target
10. **Chain-of-thought**: LLM reasons about execution strategy, no hardcoded templates

---

## End of Migration Document

**Total Estimated Effort**: 4 weeks (1 engineer full-time)

**Risk Level**: Medium-High (major architectural change, significant test breakage expected)

**Rollback Complexity**: Medium (clean feature branch, partial rollback possible)

**Business Value**: High (enables bulk operations, cross-account queries, safety patterns, 80% context reduction)

**Recommendation**: Proceed with migration. Architecture is sound, infrastructure mostly exists, risks are manageable.
