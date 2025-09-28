# Master Agent Design - Refined Architecture

## Phase 1: Comprehensive Understanding & Planning

```
User Message Input
        ↓
┌─────────────────────────────────────┐
│ 1. Analyze Situation & Create Plan  │
│                                     │
│ Understanding:                      │
│ • Analyze conversation history      │
│ • Assess safety & risk early       │
│ • Determine user intent & goals     │
│ • Identify missing context gaps     │
│                                     │
│ Planning:                           │
│ • Define output strategy            │
│   - Read commands → direct output   │
│   - Write commands → preview first  │
│   - Confirmations → execute + show  │
│ • Create prioritized workflow:      │
│   1. Safety/Risk Assessment         │
│   2. Intent Clarification           │
│   3. Critical Context Gathering     │
│   4. Non-critical Context           │
│   5. Action Planning                │
│   6. Action Execution               │
│ • Set success criteria (max 10 iter)│
│                                     │
│ Context Box Initialization:         │
│ GOAL: [Primary user intent]         │
│ ENTITIES: [Key people/companies]    │
│ CONSTRAINTS: [Risk level, time limits]│
│ DATA: [Available information]       │
│ PROGRESS: [Situation analyzed, plan created]│
│ BLOCKERS: [Missing critical info]   │
│ NEXT: [First execution step]        │
│ Free-form Notes: [Context details]  │
└─────────────────────────────────────┘
```

## Phase 2: Execution Loop (Max 10 Iterations)

```
        ↓
┌─────────────────────────────────────┐
│ 2. Environment & Readiness Check    │
│                                     │
│ Interruption Handling:              │
│ • Check for new user messages       │
│ • If found: Save state → Start new flow│
│ • New flow gets fresh context +     │
│   reference to suspended work       │
│                                     │
│ Iteration Management:               │
│ • Check iteration count < 10        │
│ • If exceeded: Force graceful exit  │
│                                     │
│ User Input Assessment:              │
│ • Evaluate if user input needed:    │
│   - Multiple interpretations exist  │
│   - Critical information missing    │
│   - Confidence level below 70%     │
│   - Ambiguous entity references    │
│ • If needed: SHORTCUT → Jump to     │
│   Final Output to ask question      │
│                                     │
│ Context Box Updates:                │
│ PROGRESS: [Environment checked]     │
│ BLOCKERS: [User input needs/interruptions]│
│ NEXT: [Execute or ask question]     │
└─────────────────────────────────────┘
        ↓
   Need User Input? → SHORTCUT to Step 5
   Continue? → Step 3
        ↓
┌─────────────────────────────────────┐
│ 3. Execute Action & Process Results │
│                                     │
│ Domain Agent Delegation:            │
│ • Email Agent: Send/search/read emails│
│ • Calendar Agent: Schedule/check availability│
│ • Contacts Agent: Find/update contacts│
│ • Master Agent: Intent analysis, drafting,│
│   risk assessment, content creation │
│                                     │
│ Response Processing:                │
│ • Success: Extract data + confidence│
│ • Error: Analyze type + context     │
│ • Partial: Extract data + limitations│
│                                     │
│ Error Integration:                  │
│ Master Agent evaluates errors and   │
│ determines optimal adaptation:      │
│ • Can goal be achieved differently? │
│ • Is this temporary or permanent?   │
│ • Does this require user input?     │
│ • Should we try alternative approach?│
│                                     │
│ Context Integration:                │
│ • Integrate successful data         │
│ • Log error context & patterns      │
│ • Track failed attempts             │
│ • Update confidence tracking        │
│                                     │
│ Context Box Updates:                │
│ DATA: [New information gathered]    │
│ PROGRESS: [Actions completed]       │
│ BLOCKERS: [Errors/limitations found]│
│ Free-form Notes: [Detailed reasoning]│
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 4. Assess Progress & Adapt Strategy │
│                                     │
│ Comprehensive Assessment:           │
│ • Calculate confidence (0-100%):    │
│   - Data completeness (0-40%)       │
│   - Entity resolution (0-20%)       │
│   - API reliability (0-20%)         │
│   - User clarity (0-20%)            │
│ • Evaluate error impact on goals    │
│ • Check for blocking issues         │
│ • Assess if original goals viable   │
│                                     │
│ Completion Status:                  │
│ • COMPLETE (90%+): Ready for output │
│ • PARTIAL (50-89%): Continue with   │
│   limitations or ask for guidance   │
│ • BLOCKED (<50%): Need adaptation   │
│                                     │
│ Intelligent Plan Adaptation:        │
│ Master Agent evaluates errors,      │
│ context, and goals to determine     │
│ optimal strategy. Considers:        │
│ • Alternative approaches available  │
│ • User input requirements           │
│ • Graceful degradation options     │
│ • Risk mitigation strategies        │
│                                     │
│ High-Risk Operation Handling:       │
│ • Generate detailed preview         │
│ • Present with full context         │
│ • End workflow (user starts new    │
│   flow for confirmation/revision)   │
│                                     │
│ User Input Decision:                │
│ • If user input needed: SHORTCUT    │
│   → Jump to Final Output to ask     │
│                                     │
│ Adaptation Decisions:               │
│ • CONTINUE: Next iteration          │
│ • REVISE PLAN: Modify approach      │
│ • EXIT: Generate final response     │
│                                     │
│ Context Box Updates:                │
│ PROGRESS: [Confidence assessment]   │
│ BLOCKERS: [Adaptation needs]        │
│ NEXT: [Strategy decision]           │
│ Free-form Notes: [Reasoning details]│
└─────────────────────────────────────┘
        ↓
    Need User Input? → SHORTCUT to Step 5
    CONTINUE → Back to Step 2
    EXIT → Step 5
```

## Phase 3: Final Output Generation

```
        ↓
┌─────────────────────────────────────┐
│ 5. Generate Final Output            │
│                                     │
│ Output Strategy Execution:          │
│                                     │
│ User Question Mode (SHORTCUT):      │
│ • Generate specific question:       │
│   - Clear context explanation       │
│   - Specific information needed     │
│   - Why this is required            │
│   - Options/examples if helpful     │
│ • End workflow cleanly              │
│ • User answer starts entirely      │
│   new flow with answer in context   │
│                                     │
│ Low/Medium Risk Operations:         │
│ • Execute confirmed actions         │
│ • Show results with confidence      │
│ • Include any limitations           │
│ • Report what was accomplished      │
│                                     │
│ High Risk Operations:               │
│ • Generate detailed preview:        │
│   - Full action plan               │
│   - Expected outcomes              │
│   - Risk factors                   │
│   - Required approvals             │
│ • Present to user with explanation  │
│ • End workflow cleanly              │
│                                     │
│ Error Recovery:                     │
│ • Generate helpful error response:  │
│   - Explain what failed            │
│   - Why it failed                  │
│   - What user can do instead       │
│   - Alternative approaches         │
│                                     │
│ Context Preservation:               │
│ • Save final state for future ref  │
│ • Clean up temporary data           │
│ • Prepare for next user interaction │
│                                     │
│ Final Context Box:                  │
│ PROGRESS: [Final completion status] │
│ DATA: [All gathered information]    │
│ BLOCKERS: [Remaining limitations]   │
│ Free-form Notes: [Complete context]│
│ [Ready for next request]            │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ END                                 │
└─────────────────────────────────────┘
```

## Key Design Principles

### Enhanced Risk Assessment Matrix
```
High Risk → Generate Detailed Preview → Wait for User Acceptance
- Mass email sends (>10 recipients)
- Calendar changes affecting others
- Financial commitments
- Legal/compliance sensitive actions
- Write operations with significant impact

Medium Risk → Show Draft → Ask for Approval
- Important email responses
- Meeting rescheduling
- Contact information updates
- Template modifications

Low Risk → Execute Directly → Show Results
- Information retrieval
- Calendar availability checks
- Email reading/summarizing
- Simple confirmations

High Risk Preview Process:
1. Generate detailed preview with full context
2. Present to user with clear explanation
3. End current workflow
4. User response options (as new flows):
   - Accept: "Please execute the proposed plan"
   - Revise: "Change X to Y in the proposal"
   - Cancel: No further action needed

Confirmation/Revision Flow Handling:
- User confirmations/revisions start entirely new workflows
- New flow context automatically includes previous proposal + user feedback
- No workflow state carries over except context
```

### User Input Shortcut Strategy
```
Question Generation Decision Points:
1. Step 2: Environment & Readiness Check
   → If critical information missing: SHORTCUT to Step 5

2. Step 4: Assess Progress & Adapt Strategy
   → If user input needed for continuation: SHORTCUT to Step 5

Shortcut Process:
1. Identify specific information needed
2. Generate clear, contextual question
3. Jump directly to Step 5 (Final Output)
4. Present question with full context
5. End workflow cleanly
6. User answer triggers entirely new flow

New Flow Context Includes:
- Previous workflow context
- Specific question that was asked
- User's answer
- Continuation instructions
```

### Interruption Handling: New Flow Strategy
```
Any User Message During Active Workflow:
→ Immediately starts entirely new flow
→ Previous workflow state preserved but suspended
→ New flow gets fresh context + reference to previous work

Interruption Flow Process:
1. Detect new user message
2. Save current workflow state (context + progress)
3. Start completely new workflow for new message
4. New flow context includes: "Previous task: [description] was in progress"

Benefits:
- No workflow corruption
- No complex state merging
- Each flow is clean and focused
- User can naturally change direction
- Previous work is preserved but not blocking
```

### Domain Sub-Agents (Natural Language Interface)
```
Email Agent:
- Manages email API interactions
- Natural language interface:
  "Find all emails from john@company.com in the last week"
  "Send this email to the marketing team: [content]"
  "Check if the client replied to our proposal"
  "Search for emails containing 'budget approval'"
- Returns structured data or error messages
- Handles email sending, searching, reading

Calendar Agent:
- Manages calendar API interactions
- Natural language interface:
  "Find available 60-minute slots next Tuesday"
  "Schedule meeting with John and Sarah for tomorrow 2pm"
  "Check for conflicts on Friday afternoon"
  "Move the 3pm meeting to 4pm on Thursday"
- Returns availability, creates events, manages conflicts
- Handles scheduling optimization

Contacts Agent:
- Manages contacts/address book APIs
- Natural language interface:
  "Find contact information for David Smith"
  "Get all contacts with 'manager' in their title"
  "Update Sarah's email to sarah.new@company.com"
  "Find all contacts from Acme Corporation"
- Returns contact data, handles updates
- Manages contact searching and maintenance

Master Agent Responsibilities:
- Intent analysis and risk assessment
- Context synthesis and planning
- Content drafting and tone decisions
- User interaction and confirmation flows
- Error handling and plan adaptation
- All non-domain-specific logic
```

### Error Integration & Plan Adaptation
```
Sub-Agent Error Reporting:
- Success: { status: "success", data: {...}, confidence: 95 }
- Error: { status: "error", type: "api_down", message: "Email service unavailable", context: {...} }
- Partial: { status: "partial", data: {...}, limitations: ["missing contact info"], confidence: 70 }

Master Agent Error Response Strategy:
The Master Agent receives error messages from domain agents and makes intelligent decisions based on the specific error context, user goals, and available alternatives. The Master Agent evaluates:

- Can the original goal still be achieved through alternative means?
- Is this a temporary limitation that suggests trying a different approach?
- Does this require user input or clarification to proceed?
- Is this a fundamental blocker that requires exiting with explanation?

The Master Agent adapts its plan dynamically based on the error type, context, and impact on the overall workflow, rather than following predetermined response patterns.

Decision Matrix for Error Handling:
- Can adapt plan? → REVISE PLAN
- Need user input? → SHORTCUT TO QUESTION
- Temporary issue? → TRY DIFFERENT APPROACH
- Permanent blocker? → EXIT WITH EXPLANATION
```

## Context Manager Design

```
Context Manager: Lightly Structured Format

Context Box Structure:
GOAL: [Primary user intent and desired outcome]
ENTITIES: [People, companies, meetings, emails referenced]
CONSTRAINTS: [Time limits, approval requirements, risk factors]
DATA: [Information gathered from domain agents]
PROGRESS: [Actions completed, decisions made]
BLOCKERS: [Current issues preventing progress]
NEXT: [Immediate next action in workflow]

Free-form Notes: [Additional context, reasoning, edge cases]

Initialization Strategy:
The Master Agent analyzes each request and populates initial structure:

GOAL: Schedule board meeting next month
ENTITIES: Board members (8 executives), CEO, CFO
CONSTRAINTS: Next month timeframe, requires 2hr block, high-risk operation
DATA: [to be gathered]
PROGRESS: Intent determined, entities identified
BLOCKERS: [none yet]
NEXT: Check calendar availability for all participants

Context Evolution During Execution:
Structure gets populated and updated throughout workflow:

GOAL: Schedule board meeting next month
ENTITIES: CEO (traveling 15th-17th), CFO (earnings call 22nd), 6 other executives
CONSTRAINTS: 2hr duration, must be next month, requires approval
DATA: Calendar conflicts found, available slots identified
PROGRESS: Availability checked, alternatives generated
BLOCKERS: Multiple conflicts detected
NEXT: Present alternative dates to user

Free-form Notes: "CEO prefers morning meetings. CFO unavailable 22nd due to quarterly earnings. Conference room A preferred for board meetings."

Question Shortcut Context:
When shortcutting to ask questions, context includes:
GOAL: [Original goal maintained]
PROGRESS: [Stopped to ask question]
BLOCKERS: [Specific information needed]
NEXT: [Continue after answer received]
Free-form Notes: "Asked user: 'Which David do you mean - David Smith (CEO) or David Johnson (CTO)?' Waiting for clarification to proceed with meeting invitation."

Benefits:
- Light structure for consistent tracking
- Free-form section for nuanced context
- Easy to scan and understand progress
- Natural evolution throughout workflow
- Preserves both facts and reasoning
- Handles question shortcuts seamlessly
```

## Implementation Evaluation & Improvement Todos

### Implementation Status ✅
The current MasterAgent implementation successfully follows the core 3-phase architecture:
1. **Understanding & Planning**: Uses SituationAnalysisPromptBuilder and WorkflowPlanningPromptBuilder
2. **Execution Loop**: Implements max 10 iterations with EnvironmentCheckPromptBuilder, ActionExecutionPromptBuilder, and ProgressAssessmentPromptBuilder
3. **Final Output**: Uses FinalResponsePromptBuilder for response generation

**Strengths:**
- Modular prompt builder architecture enables easy customization
- Proper integration with domain agents via AgentFactory.executeAgentWithNaturalLanguage()
- Context management using structured format (GOAL, ENTITIES, CONSTRAINTS, etc.)
- Error handling and logging throughout the workflow
- Natural language interface for all domain agents

### Critical Improvements Needed

#### 1. Rate Limiting & Circuit Breakers
**Priority: HIGH** | **Effort: Medium**
- [ ] Implement rate limiting for AI service calls to prevent quota exhaustion
- [ ] Add circuit breakers for external APIs (Gmail, Calendar, Contacts)
- [ ] Implement exponential backoff for failed requests
- [ ] Add monitoring for API health and response times

#### 2. Interruption Handling
**Priority: HIGH** | **Effort: High**
- [ ] Implement "New Flow Strategy" for user interruptions during execution
- [ ] Add workflow state persistence and suspension capabilities
- [ ] Enable seamless context handoff between interrupted and new workflows
- [ ] Prevent workflow corruption from concurrent user inputs

#### 3. Enhanced User Input Shortcut Strategy
**Priority: MEDIUM** | **Effort: Medium**
- [ ] Improve confidence calculation logic (currently basic implementation)
- [ ] Add sophisticated ambiguity detection beyond basic parsing
- [ ] Implement better question generation with context awareness
- [ ] Add user input validation and guided input collection

#### 4. Advanced Error Recovery & Plan Adaptation
**Priority: MEDIUM** | **Effort: High**
- [ ] Implement intelligent error categorization (temporary vs permanent)
- [ ] Add automatic retry logic with different strategies per error type
- [ ] Build sophisticated plan adaptation based on partial success scenarios
- [ ] Implement graceful degradation paths for missing capabilities

#### 5. High-Risk Operation Management
**Priority: MEDIUM** | **Effort: Medium**
- [ ] Enhance preview generation with rich formatting and risk visualization
- [ ] Add confirmation workflow management (accept/revise/cancel flows)
- [ ] Implement proper risk assessment scoring beyond basic categorization
- [ ] Add audit logging for all high-risk operations

#### 6. Monitoring & Observability
**Priority: MEDIUM** | **Effort: Low**
- [ ] Add comprehensive workflow metrics (execution time, success rates, iteration counts)
- [ ] Implement real-time workflow state monitoring
- [ ] Add performance profiling for prompt builder execution
- [ ] Create dashboards for workflow health and agent utilization

#### 7. Context Persistence & Session Management
**Priority: LOW** | **Effort: Medium**
- [ ] Implement context persistence across sessions (currently lost on restart)
- [ ] Add conversation history integration with long-term memory
- [ ] Build context compression for long-running conversations
- [ ] Implement context search and retrieval capabilities

#### 8. Security & Compliance
**Priority: HIGH** | **Effort: Medium**
- [ ] Add input sanitization and validation for all user inputs
- [ ] Implement access control checks for sensitive operations
- [ ] Add data encryption for stored contexts and session data
- [ ] Build audit trails for compliance and debugging

#### 9. Performance Optimization
**Priority: LOW** | **Effort: Medium**
- [ ] Implement prompt caching to reduce AI service calls
- [ ] Add parallel execution for independent agent operations
- [ ] Optimize context size to reduce token usage
- [ ] Implement lazy loading for non-critical context information

#### 10. Testing & Quality Assurance
**Priority: MEDIUM** | **Effort: High**
- [ ] Add comprehensive integration tests for all workflow scenarios
- [ ] Implement chaos testing for error handling robustness
- [ ] Create automated testing for prompt builder effectiveness
- [ ] Build regression testing suite for workflow reliability

## Coding Patterns & Architecture Analysis

### ✅ Strengths in Current Implementation

#### 1. **Clean Separation of Concerns**
```typescript
// Good: Each prompt builder handles one specific workflow phase
private situationAnalysisBuilder: SituationAnalysisPromptBuilder;
private workflowPlanningBuilder: WorkflowPlanningPromptBuilder;
private environmentCheckBuilder: EnvironmentCheckPromptBuilder;
// etc...
```
**Why this works:** Single Responsibility Principle applied correctly, making each component testable and maintainable.

#### 2. **Proper Dependency Injection Pattern**
```typescript
// Good: Services injected via service manager, not hardcoded
this.aiService = serviceManager.getService<GenericAIService>('genericAIService');
this.contextManager = serviceManager.getService<ContextManager>('contextManager');
```
**Why this works:** Enables testing with mocks, reduces coupling, follows IoC principles.

#### 3. **Defensive Programming with Null Safety**
```typescript
// Good: Explicit null checks with meaningful error messages
if (!this.aiService) {
  throw new Error('GenericAIService not available for NewMasterAgent');
}
```
**Why this works:** Fails fast with clear error messages rather than mysterious null reference errors.

#### 4. **Structured Error Handling**
```typescript
// Good: Consistent error logging with context
logger.error('Agent execution failed', error as Error, {
  sessionId,
  agent: actionResult.parsed.agent,
  request: actionResult.parsed.request
});
```
**Why this works:** Provides debugging context without exposing sensitive data.

#### 5. **Template Method Pattern Implementation**
```typescript
// Good: Clear workflow phases with consistent structure
const workflowContext = await this.analyzeAndPlan(messageHistory, sessionId, userId);
const executionResult = await this.executeWorkflow(workflowContext, sessionId, userId);
const finalResult = await this.generateFinalResponse(executionResult, processingStartTime);
```
**Why this works:** Makes the algorithm structure explicit and easy to follow.

### ⚠️ Architecture Concerns & Improvements

#### 1. **String-Based Context Management**
**Issue:** Context is passed as plain strings between phases
```typescript
// Current: Context as string - fragile and hard to validate
let currentContext = workflowContext;
currentContext = `${currentContext}\n\nAgent Execution Result:\nAgent: ${actionResult.parsed.agent}...`;
```

**Better Approach:** Structured context objects
```typescript
// Improved: Type-safe context management
interface WorkflowContext {
  goal: string;
  entities: Entity[];
  constraints: Constraint[];
  data: Record<string, any>;
  progress: ProgressStep[];
  blockers: Blocker[];
  next: string;
  notes: string;
}

class ContextManager {
  updateWithAgentResult(context: WorkflowContext, result: AgentResult): WorkflowContext {
    return {
      ...context,
      data: { ...context.data, [result.agent]: result.data },
      progress: [...context.progress, { phase: 'agent_execution', agent: result.agent, timestamp: Date.now() }]
    };
  }
}
```

#### 2. **Non-null Assertion Operator Overuse**
**Issue:** Unsafe use of `!` operator
```typescript
// Risky: Could cause runtime errors
const environmentResult = await this.environmentCheckBuilder!.execute(currentContext);
```

**Better Approach:** Proper null handling
```typescript
// Safer: Explicit null checks with early returns
if (!this.environmentCheckBuilder) {
  throw new Error('Environment check builder not initialized');
}
const environmentResult = await this.environmentCheckBuilder.execute(currentContext);
```

#### 3. **Monolithic Execution Loop**
**Issue:** 70-line executeWorkflow method with multiple responsibilities
```typescript
// Current: Single method handles too many concerns
private async executeWorkflow(workflowContext: string, sessionId: string, userId?: string): Promise<string> {
  // Environment check
  // Action execution
  // Agent delegation
  // Progress assessment
  // Context updates
  // Iteration management
}
```

**Better Approach:** Extract smaller methods
```typescript
// Improved: Decomposed into focused methods
private async executeWorkflow(context: WorkflowContext, sessionId: string, userId?: string): Promise<WorkflowContext> {
  for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
    context = await this.checkEnvironmentReadiness(context);

    if (this.needsUserInput(context)) {
      return this.pauseForUserInput(context);
    }

    context = await this.executeActions(context, sessionId, userId);
    context = await this.assessProgress(context);

    if (this.isComplete(context)) {
      return context;
    }
  }

  return this.handleMaxIterationsReached(context);
}
```

#### 4. **Magic String Dependencies**
**Issue:** Hardcoded service names and agent names
```typescript
// Fragile: Service names as magic strings
this.aiService = serviceManager.getService<GenericAIService>('genericAIService');

// Fragile: Agent names passed as strings
await AgentFactory.executeAgentWithNaturalLanguage(agentName, request, ...);
```

**Better Approach:** Type-safe service and agent references
```typescript
// Improved: Enum-based service registration
enum ServiceType {
  GENERIC_AI = 'genericAIService',
  CONTEXT_MANAGER = 'contextManager'
}

enum AgentType {
  EMAIL = 'emailAgent',
  CALENDAR = 'calendarAgent',
  CONTACT = 'contactAgent'
}
```

#### 5. **Incomplete Token Management**
**Issue:** TODO comments in production code
```typescript
// TODO: Get access token from token manager
// For now, we'll proceed without it
```

**Better Approach:** Proper abstraction for token management
```typescript
// Improved: Dedicated token management
class TokenManager {
  async getAccessToken(userId: string, service: string): Promise<string | null>;
  async refreshToken(userId: string, service: string): Promise<string>;
  async isTokenValid(token: string): Promise<boolean>;
}
```

#### 6. **Lack of Circuit Breaker Pattern**
**Issue:** No protection against cascading failures
```typescript
// Current: Direct agent calls without protection
const result = await AgentFactory.executeAgentWithNaturalLanguage(...);
```

**Better Approach:** Circuit breaker for external calls
```typescript
// Improved: Protected external calls
class CircuitBreaker {
  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.isOpen(operationName)) {
      throw new CircuitBreakerOpenError(`${operationName} circuit breaker is open`);
    }

    try {
      const result = await operation();
      this.recordSuccess(operationName);
      return result;
    } catch (error) {
      this.recordFailure(operationName);
      throw error;
    }
  }
}
```

#### 7. **Insufficient Type Safety in Agent Communication**
**Issue:** `any` return types from agent calls
```typescript
// Weak typing: No compile-time guarantees about agent responses
private async executeAgentAction(...): Promise<any> {
```

**Better Approach:** Strongly typed agent contracts
```typescript
// Improved: Type-safe agent responses
interface AgentResponse<TData = any> {
  success: boolean;
  data?: TData;
  error?: AgentError;
  metadata: {
    agent: string;
    operation: string;
    duration: number;
    confidence: number;
  };
}

private async executeAgentAction<TData>(
  agentName: string,
  request: string,
  sessionId: string,
  userId?: string
): Promise<AgentResponse<TData>> {
```

### 🔧 Specific Refactoring Recommendations

#### 1. **Extract Context Management Service**
- Move string-based context manipulation to a dedicated service
- Implement type-safe context updates
- Add context validation and sanitization

#### 2. **Implement Strategy Pattern for Prompt Builders**
- Create `PromptBuilderStrategy` interface
- Enable runtime switching of prompt strategies
- Support A/B testing of different prompt approaches

#### 3. **Add Workflow State Machine**
- Replace manual iteration tracking with proper state machine
- Enable workflow pause/resume capabilities
- Support workflow branching and conditional paths

#### 4. **Implement Command Pattern for Agent Actions**
- Encapsulate agent calls as command objects
- Enable undo/redo capabilities
- Support queuing and batching of agent operations

#### 5. **Add Metrics and Telemetry**
- Instrument all workflow phases with metrics
- Add performance monitoring for prompt builders
- Implement SLA tracking for end-to-end workflows