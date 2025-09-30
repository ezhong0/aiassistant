# Prompt Builders Reference Guide

**Last Updated**: September 30, 2025
**Version**: 1.0

## Table of Contents
1. [Overview](#overview)
2. [Architecture Context](#architecture-context)
3. [MasterAgent Prompt Builders](#masteragent-prompt-builders)
4. [SubAgent Prompt Builders](#subagent-prompt-builders)
5. [Context Format](#context-format)
6. [Execution Flow](#execution-flow)

---

## Overview

The AI Assistant uses **9 specialized Prompt Builders** to orchestrate complex multi-step workflows. Each prompt builder serves a specific purpose in the execution pipeline, generating AI prompts that guide decision-making at different stages.

### Prompt Builder Categories

**MasterAgent Builders (6)**:
- Handle high-level workflow orchestration
- Coordinate between SubAgents
- Manage overall workflow state

**SubAgent Builders (3)**:
- Handle domain-specific operations (email, calendar, contacts, slack)
- Execute tool calls
- Format results back to MasterAgent

---

## Architecture Context

### Where Prompt Builders Fit

```
User Request
    ↓
┌─────────────────────────────────────────────────┐
│          MASTER AGENT WORKFLOW                  │
│                                                 │
│  1. SituationAnalysisPromptBuilder             │
│     ↓                                           │
│  2. WorkflowPlanningPromptBuilder              │
│     ↓                                           │
│  ┌──────────────────────────────────────────┐  │
│  │    WORKFLOW EXECUTOR (Loop max 10x)      │  │
│  │                                           │  │
│  │  3. EnvironmentCheckPromptBuilder        │  │
│  │     ↓                                     │  │
│  │  4. ActionExecutionPromptBuilder         │  │
│  │     ↓                                     │  │
│  │  ┌─────────────────────────────────┐    │  │
│  │  │   SUBAGENT EXECUTION            │    │  │
│  │  │                                  │    │  │
│  │  │  7. IntentAssessmentPromptBuilder   │  │
│  │  │     ↓                            │    │  │
│  │  │  [Tool Execution]                │    │  │
│  │  │     ↓                            │    │  │
│  │  │  8. PlanReviewPromptBuilder     │    │  │
│  │  │     ↓                            │    │  │
│  │  │  9. ResponseFormattingPromptBuilder │  │
│  │  └─────────────────────────────────┘    │  │
│  │     ↓                                     │  │
│  │  5. ProgressAssessmentPromptBuilder      │  │
│  │     ↓                                     │  │
│  │  [Continue or Exit?]                      │  │
│  └──────────────────────────────────────────┘  │
│     ↓                                           │
│  6. FinalResponsePromptBuilder                 │
└─────────────────────────────────────────────────┘
    ↓
Final Response to User
```

### Key Concepts

**Context String**: A structured text format that accumulates state throughout workflow execution. Contains:
- `GOAL`: Primary user intent
- `ENTITIES`: People, companies, meetings mentioned
- `CONSTRAINTS`: Time limits, risk factors
- `DATA`: Information gathered from tools
- `PROGRESS`: Actions completed
- `BLOCKERS`: Current issues
- `NEXT`: Immediate next action
- `RISK_LEVEL`: low/medium/high
- `OUTPUT_STRATEGY`: direct/preview/confirmation
- `CONFIDENCE`: 0-100%

**Workflow Steps**: Array of specific actions to execute (e.g., "Check calendar availability", "Send invites")

**Tool Calls**: Specific operations like `send_email`, `calendar_create`, `search_contacts`

**State Machine**: The workflow follows a clear state progression from analysis to completion, with defined transitions and decision points.

**Composition Patterns**: Complex workflows are built from simple, reusable patterns that can be combined and adapted.

---

## Context Engineering Principles

The prompt builders use several core principles to ensure robust, flexible, and maintainable AI interactions:

### Abstraction Layers

Each prompt builder operates at a specific abstraction level:

**Intent Layer** (SituationAnalysis, WorkflowPlanning):
- Understands user goals and constraints
- Domain-agnostic reasoning about what the user wants

**Strategy Layer** (ActionExecution, ProgressAssessment):
- Determines how to achieve goals
- Domain-specific but tool-agnostic

**Execution Layer** (IntentAssessment, ResponseFormatting):
- Performs specific operations
- Tool-specific implementation details

### State Machine Thinking

The workflow follows a clear state machine pattern:

```
[analyzing] → [planning] → [executing] → [assessing] → [complete]
     ↑           ↓           ↓           ↓
     └─── [user_input_needed] ←─────────┘
```

**States**:
- `analyzing`: Understanding user intent
- `planning`: Breaking down into steps
- `executing`: Performing operations
- `assessing`: Evaluating progress
- `complete`: Goal achieved

**Transitions**:
- State changes based on confidence levels and blockers
- User input can interrupt any state
- Failed operations trigger state reassessment

### Composition Patterns

Complex workflows are built from simple, reusable patterns:

**Gather → Validate → Execute**:
- Most common pattern across all domains
- Ensures data quality before operations

**Parallel Execution**:
- Multiple independent operations (e.g., checking multiple calendars)
- Improves performance and user experience

**Conditional Branching**:
- Different paths based on results
- Handles edge cases and error conditions

**Iterative Refinement**:
- Repeat operations until success criteria met
- Adapts to changing conditions

### Declarative vs Imperative

**Declarative Approach** (What):
- "Find all emails about budget from last week"
- "Schedule meeting with team for next Friday"
- Focuses on desired outcome

**Imperative Constraints** (How):
- "Must validate recipient addresses before sending"
- "Must check timezone consistency for all attendees"
- Specifies required validation and safety checks

### Contextual Reasoning

Adapts behavior based on available information:

**Confidence-Based Execution**:
- High confidence (90%+): Direct execution
- Medium confidence (50-89%): Preview mode
- Low confidence (<50%): Request user input

**Constraint Propagation**:
- Risk level affects output strategy
- Available data influences execution path
- User permissions determine operation scope

### Meta-Programming Patterns

The system reasons about its own capabilities:

**Capability Discovery**:
- "What tools are available for this domain?"
- "Which agent can handle this request?"

**Strategy Selection**:
- "Which approach is most likely to succeed?"
- "What's the optimal execution order?"

**Performance Monitoring**:
- "How can this operation be optimized?"
- "What's causing delays or failures?"

### Chain of Thought Reasoning

Each prompt builder outputs a thinking process before generating results:

**Thinking Process Structure**:
- **Analysis**: What information is available and what needs to be determined
- **Reasoning**: Step-by-step logical progression
- **Considerations**: Edge cases, constraints, and alternative approaches
- **Decision**: Final choice with justification
- **Confidence**: Level of certainty in the decision

**Benefits**:
- **Transparency**: Makes AI reasoning visible and debuggable
- **Quality**: Forces systematic thinking before output
- **Learning**: Enables pattern recognition and improvement
- **Debugging**: Easier to identify where reasoning goes wrong
- **Consistency**: Standardized thinking process across all builders

---

## MasterAgent Prompt Builders

### 1. SituationAnalysisPromptBuilder

**Location**: `src/services/prompt-builders/main-agent/situation-analysis-prompt-builder.ts`

**Phase**: Initial Analysis (Step 1)

**Purpose**: Understand user intent, assess risk, and determine output strategy

#### Principles Applied

**Abstraction Layer**: Intent Layer - focuses on understanding user goals
**State Machine**: Transitions from `analyzing` to `planning` state
**Declarative Approach**: Determines "what" the user wants, not "how" to do it
**Contextual Reasoning**: Adapts risk assessment based on available information
**Meta-Programming**: Reasons about system capabilities and constraints

#### What It Does

1. **Analyzes** the user's natural language request
2. **Extracts** primary intent and mentioned entities
3. **Assesses** operational risk level (high/medium/low)
4. **Determines** output strategy (direct/preview/confirmation)
5. **Initializes** the context structure with analysis results

#### Input
- User's request (natural language)
- Current date/time
- Optional: Previous conversation context

#### Output
```typescript
{
  thinking: string,  // Chain of thought reasoning process
  context: string    // Structured context with GOAL, ENTITIES, RISK_LEVEL, etc.
}
```

#### Thinking Process Example
```
ANALYSIS: User wants to send email to all board members about Q3 results
REASONING: 
1. This is a mass communication operation affecting multiple people
2. Board members are high-level stakeholders requiring careful handling
3. Q3 results are financial information that may be sensitive
4. Risk level should be high due to mass operation and sensitive content
CONSIDERATIONS: 
- Need to verify all board member email addresses
- Should require user confirmation before sending
- May need to check for any compliance requirements
DECISION: Set RISK_LEVEL to high and OUTPUT_STRATEGY to confirmation
CONFIDENCE: 90% - clear mass operation with sensitive content
```

#### Risk Assessment Rules

**High Risk**:
- Mass operations (bulk email, mass delete)
- Financial commitments
- Legal/compliance actions
- Operations affecting multiple people

**Medium Risk**:
- Important communications (emails to clients)
- Meeting changes (rescheduling with attendees)
- Contact updates
- Template modifications

**Low Risk**:
- Information retrieval (search, read)
- Availability checks
- Simple confirmations
- Reading/summarizing content

#### Output Strategy Rules

- **Direct**: Low risk → Execute immediately, show results
- **Preview**: Medium risk → Generate draft, show for review
- **Confirmation**: High risk → Show detailed plan, require approval

#### Example

**Input**:
```
"Send an email to all board members about the Q3 results"
```

**Output Context**:
```
GOAL: Send email to all board members regarding Q3 results
ENTITIES: board members, Q3 results
CONSTRAINTS: Email must be professional, include all board members
DATA: (empty - to be filled during execution)
PROGRESS: Intent analyzed, strategy determined
BLOCKERS: Need list of board members, need Q3 results content
NEXT: Retrieve board member contact list
RISK_LEVEL: high
OUTPUT_STRATEGY: confirmation
CONFIDENCE: 85
CURRENT_TIME: 2025-09-30T14:30:00Z
```

---

### 2. WorkflowPlanningPromptBuilder

**Location**: `src/services/prompt-builders/main-agent/workflow-planning-prompt-builder.ts`

**Phase**: Planning (Step 2)

**Purpose**: Break down the user request into specific, executable steps

#### Principles Applied

**Abstraction Layer**: Intent Layer - translates goals into actionable plans
**State Machine**: Transitions from `planning` to `executing` state
**Composition Patterns**: Uses Gather → Validate → Execute pattern
**Declarative Approach**: Focuses on desired outcomes, not implementation details
**Meta-Programming**: Selects optimal execution strategy

#### What It Does

1. **Analyzes** the context and user intent
2. **Breaks down** the request into specific steps
3. **Orders** steps logically based on dependencies
4. **Creates** actionable workflow plan
5. **Updates** context with plan details

#### Input
- Context string from SituationAnalysis

#### Output
```typescript
{
  thinking: string,   // Chain of thought reasoning process
  context: string,    // Updated context with workflow plan
  steps: string[]     // Ordered list of specific steps
}
```

#### Thinking Process Example
```
ANALYSIS: Need to break down "send email to board members about Q3 results" into executable steps
REASONING:
1. First must identify who the board members are
2. Then verify their email addresses are valid
3. Need to draft the email content about Q3 results
4. Should generate preview before sending
5. Require user approval due to high risk level
6. Finally send and confirm delivery
CONSIDERATIONS:
- Board members might be in different contact groups
- Some email addresses might be invalid
- Q3 results content might need to be retrieved from another source
- Should handle partial failures gracefully
DECISION: Create 7-step workflow with validation and approval checkpoints
CONFIDENCE: 85% - logical progression with proper safeguards
```

#### Step Creation Guidelines

- **Single action per step**: Each step should do one thing
- **Logical ordering**: Data gathering before actions
- **Clear and specific**: Should be executable by domain agents
- **Include error handling**: Consider failure scenarios
- **Consider user input**: Note when approval needed

#### Example

**Input Context**:
```
GOAL: Send email to all board members about Q3 results
RISK_LEVEL: high
OUTPUT_STRATEGY: confirmation
```

**Output Steps**:
```typescript
[
  "Retrieve list of all board members from contacts",
  "Verify all board members have valid email addresses",
  "Draft email content about Q3 results",
  "Generate preview of email with all recipients",
  "Wait for user approval before sending",
  "Send email to approved recipients",
  "Confirm delivery status"
]
```

---

### 3. EnvironmentCheckPromptBuilder

**Location**: `src/services/prompt-builders/main-agent/environment-check-prompt-builder.ts`

**Phase**: Workflow Iteration (Step 3a - every loop)

**Purpose**: Check if workflow can continue or needs user input

#### Principles Applied

**Abstraction Layer**: Strategy Layer - evaluates execution readiness
**State Machine**: Manages transitions between `executing` and `user_input_needed` states
**Contextual Reasoning**: Adapts based on confidence levels and available information
**Conditional Branching**: Different paths based on workflow state
**Meta-Programming**: Monitors system state and performance

#### What It Does

1. **Checks** for interruptions or new user messages
2. **Evaluates** if user input is needed
3. **Assesses** confidence level and blockers
4. **Determines** if workflow should pause
5. **Updates** NEXT action in context

#### Input
- Current context string
- Current iteration count
- Workflow state

#### Output
```typescript
{
  thinking: string,          // Chain of thought reasoning process
  context: string,           // Updated context
  needsUserInput?: boolean,  // True if pausing for user input
  requiredInfo?: string      // What information is needed
}
```

#### Thinking Process Example
```
ANALYSIS: Current step is "Retrieve board member list" with 85% confidence
REASONING:
1. Confidence is above 70% threshold, so can proceed
2. No blockers identified in current context
3. All required information is available
4. No ambiguous entities that need clarification
CONSIDERATIONS:
- Board member list retrieval is a standard operation
- Contact agent should handle this without issues
- No user input needed at this stage
DECISION: Continue with execution, no user input required
CONFIDENCE: 90% - clear path forward with no obstacles
```

#### User Input Decision Criteria

**Pause for user input when**:
- Multiple valid interpretations exist
- Critical information is missing
- Confidence < 70%
- Ambiguous entity references
- Risk level requires confirmation

**CRITICAL**: If user input is needed, jumps to FinalResponsePromptBuilder to ask specific question. User's answer starts entirely new workflow.

#### Example Scenarios

**Scenario 1: Missing Information**
```typescript
// Input
context: "GOAL: Schedule meeting with John..."
         "BLOCKERS: Which John? (John Smith or John Doe)"
         "CONFIDENCE: 50"

// Output
{
  context: "... NEXT: Ask user which John they mean",
  needsUserInput: true,
  requiredInfo: "Which John do you mean: John Smith (Engineering) or John Doe (Sales)?"
}
```

**Scenario 2: All Clear**
```typescript
// Input
context: "GOAL: Search for emails from last week"
         "BLOCKERS: None"
         "CONFIDENCE: 95"

// Output
{
  context: "... NEXT: Execute email search for last week",
  needsUserInput: false
}
```

---

### 4. ActionExecutionPromptBuilder

**Location**: `src/services/prompt-builders/main-agent/action-execution-prompt-builder.ts`

**Phase**: Workflow Iteration (Step 3b - every loop)

**Purpose**: Translate workflow steps into specific SubAgent requests

#### Principles Applied

**Abstraction Layer**: Strategy Layer - bridges intent and execution
**State Machine**: Manages `executing` state transitions
**Composition Patterns**: Orchestrates domain-specific operations
**Declarative Approach**: Focuses on desired outcomes for SubAgents
**Meta-Programming**: Selects optimal agent and strategy

#### What It Does

1. **Analyzes** the current step from workflow plan
2. **Selects** appropriate domain agent (email/calendar/contacts/slack)
3. **Creates** specific, self-contained request
4. **Includes** all necessary parameters and context
5. **Updates** context with execution plan

#### Input
- Context string with current step
- Available agents: email, calendar, contact, slack

#### Output
```typescript
{
  thinking: string,                                 // Chain of thought reasoning process
  context: string,                                  // Updated context
  agent: 'email' | 'calendar' | 'contact' | 'slack', // Which agent to use
  request: string                                   // Natural language request for agent
}
```

#### Thinking Process Example
```
ANALYSIS: Current step is "Retrieve list of all board members from contacts"
REASONING:
1. This is a contact-related operation requiring contact agent
2. Need to search for contacts tagged as board members
3. Should return names and email addresses for verification
4. Contact agent has the right tools for this operation
CONSIDERATIONS:
- Board members might be in different contact groups
- Some might be tagged differently (e.g., "Board of Directors")
- Should include all variations to ensure completeness
DECISION: Use contact agent with comprehensive search criteria
CONFIDENCE: 95% - clear contact operation with well-defined scope
```

#### Agent Selection Guidelines

**Email Agent**:
- send, search, read, reply, forward, draft emails
- Email operations with Gmail API

**Calendar Agent**:
- schedule, check availability, reschedule, cancel events
- Google Calendar operations

**Contact Agent**:
- search, create, update, delete contacts
- Google Contacts operations

**Slack Agent**:
- channel messages, search, summarize, user info
- Slack API operations

#### Request Creation Rules

**CRITICAL: Single Message Interface**
- Send ONE complete natural language request
- Include ALL needed context in that message
- SubAgent cannot ask follow-up questions
- Make request self-contained and executable

**Good Request Examples**:
```
✓ "Search for emails from john@company.com received last week containing the word 'budget'"
✓ "Schedule a 2-hour meeting on Friday Oct 6th at 2pm with alice@company.com and bob@company.com titled 'Q4 Planning'"
✓ "Find contact information for anyone named David Smith in the organization"
```

**Bad Request Examples**:
```
✗ "Search for emails" (missing: from whom? when? what content?)
✗ "Schedule meeting" (missing: when? who? duration? title?)
✗ "Find contact" (missing: which contact? search criteria?)
```

#### Example

**Input Context**:
```
GOAL: Send email to board members about Q3 results
NEXT: Retrieve list of all board members from contacts
PROGRESS: Planning complete, ready to execute
```

**Output**:
```typescript
{
  context: "... PROGRESS: Requesting board member list from contact agent",
  agent: "contact",
  request: "Search for all contacts tagged as 'board member' or in the 'Board of Directors' group and return their names and email addresses"
}
```

---

### 5. ProgressAssessmentPromptBuilder

**Location**: `src/services/prompt-builders/main-agent/progress-assessment-prompt-builder.ts`

**Phase**: Workflow Iteration (Step 3c - every loop)

**Purpose**: Assess progress and determine if workflow should continue

#### Principles Applied

**Abstraction Layer**: Strategy Layer - evaluates execution results
**State Machine**: Manages transitions between `assessing` and `executing`/`complete` states
**Contextual Reasoning**: Adapts based on results and confidence levels
**Iterative Refinement**: Revises plans based on new information
**Meta-Programming**: Monitors performance and optimizes strategy

#### What It Does

1. **Analyzes** results from SubAgent execution
2. **Evaluates** overall progress toward goal
3. **Calculates** updated confidence level
4. **Determines** if workflow is complete
5. **Decides** if plan needs revision
6. **Updates** context with assessment

#### Input
- Context string with SubAgent results
- Execution metadata (duration, success, errors)

#### Output
```typescript
{
  thinking: string,     // Chain of thought reasoning process
  context: string,      // Updated context with progress
  newSteps?: string[]   // Only if plan needs revision
}
```

#### Thinking Process Example
```
ANALYSIS: Contact agent returned 5 board members, all with valid email addresses
REASONING:
1. Step 1 completed successfully - board member list retrieved
2. All email addresses are valid, no issues found
3. Progress toward goal is on track
4. Next step should be to draft email content
5. Confidence increased due to successful data gathering
CONSIDERATIONS:
- No plan revision needed - original plan is working
- All board members found, no missing contacts
- Ready to proceed to next step
DECISION: Continue with existing plan, update confidence to 90%
CONFIDENCE: 90% - successful completion of first step
```

#### Progress Assessment Criteria

**Complete** (90%+ confidence):
- Goal fully accomplished
- No blocking errors
- All required data gathered
- Ready for final output

**Continue** (50-89% confidence):
- Progress made but not finished
- Some steps remaining
- No critical blockers
- Workflow can proceed

**Blocked** (<50% confidence):
- Critical error occurred
- Required data missing
- Need plan revision or user input
- Cannot proceed without changes

#### Confidence Calculation

```
Confidence = Data Completeness (40%)
           + Entity Resolution (20%)
           + API Reliability (20%)
           + User Clarity (20%)
```

**Data Completeness (0-40%)**:
- How much required information is gathered
- Example: Have 3 of 5 required fields → 24%

**Entity Resolution (0-20%)**:
- How clearly entities are identified
- Example: "John" → ambiguous → 5%, "john@company.com" → clear → 20%

**API Reliability (0-20%)**:
- Whether tools are working properly
- Example: All API calls succeeded → 20%, one failed → 10%

**User Clarity (0-20%)**:
- How well user intent is understood
- Example: Clear specific request → 20%, vague → 10%

#### Decision Outcomes

**CONTINUE**: Move to next step in plan
```typescript
{
  context: "... PROGRESS: Board member list retrieved (5 contacts)",
  // No newSteps = continue with existing plan
}
```

**REVISE PLAN**: Replace remaining steps
```typescript
{
  context: "... PROGRESS: Error: 2 board members have invalid email addresses",
  newSteps: [
    "Request user to provide valid email addresses for 2 board members",
    "Continue with email draft after addresses provided"
  ]
}
```

**EXIT**: Jump to FinalResponsePromptBuilder
```typescript
{
  context: "... PROGRESS: All steps complete. Email sent to 5 board members. CONFIDENCE: 95",
  // Signals completion → exits loop
}
```

---

### 6. FinalResponsePromptBuilder

**Location**: `src/services/prompt-builders/main-agent/final-response-prompt-builder.ts`

**Phase**: Final Output (Step 4)

**Purpose**: Generate human-readable response when workflow is complete

#### Principles Applied

**Abstraction Layer**: Intent Layer - communicates results to user
**State Machine**: Transitions to `complete` state
**Contextual Reasoning**: Adapts response based on output strategy and results
**Declarative Approach**: Focuses on user experience and clarity
**Meta-Programming**: Optimizes communication effectiveness

#### What It Does

1. **Reviews** completed workflow and gathered data
2. **Generates** comprehensive user-facing response
3. **Applies** output strategy (direct/preview/confirmation)
4. **Provides** clear next steps if needed
5. **Updates** final context state

#### Input
- Final context string with all execution results
- Output strategy from initial analysis

#### Output
```typescript
{
  thinking: string,  // Chain of thought reasoning process
  context: string,   // Final context state
  response: string   // Human-readable response
}
```

#### Thinking Process Example
```
ANALYSIS: Workflow complete - email sent to 5 board members about Q3 results
REASONING:
1. All steps completed successfully
2. Email was sent to all intended recipients
3. Delivery confirmation received
4. Goal has been fully accomplished
5. User should be informed of success
CONSIDERATIONS:
- Should provide clear summary of what was accomplished
- Include details about recipients and delivery status
- Offer next steps if appropriate
- Use positive, confident tone
DECISION: Generate success response with clear summary and next steps
CONFIDENCE: 95% - complete success with full confirmation
```

#### Output Strategy Execution

**Direct** (Low Risk):
```
"I've found 3 emails from last week about the budget:
1. Budget Q3 Review - from John Smith
2. Budget Approval Request - from Finance
3. Budget Questions - from Alice

Would you like me to do anything with these?"
```

**Preview** (Medium Risk):
```
"I've drafted this email to send to the team:

Subject: Project Update
To: team@company.com

[Draft content here...]

Would you like me to:
- Send this email now
- Make changes first
- Cancel"
```

**Confirmation** (High Risk):
```
"⚠️ You're about to send an email to ALL 50 board members.

Recipients: [list of 50 emails]
Subject: Q3 Financial Results
Content: [preview]

This is a high-impact action. To proceed, please reply:
'Send the email to all board members'

Or make changes first."
```

#### User Question Mode

When EnvironmentCheck determines user input is needed:

```
"I need clarification to proceed:

You mentioned scheduling a meeting with John. I found two people:
- John Smith (Engineering Manager)
- John Doe (Sales Director)

Which John did you mean?"
```

**CRITICAL**: This ends current workflow. User's answer starts new workflow.

#### Example Final Responses

**Success - Direct**:
```
"✅ Done! I've sent the calendar invite to alice@company.com and bob@company.com for Friday, October 6th at 2pm.

Event: Q4 Planning Session
Duration: 2 hours
Both attendees accepted the invite."
```

**Success - Preview**:
```
"Here's what I found:

Board Members (5):
1. Alice Chen - alice@company.com ✓
2. Bob Wilson - bob@company.com ✓
3. Carol Davis - carol@company.com ✓
4. David Lee - david@company.com ✗ (invalid)
5. Emma Taylor - emma@company.com ✓

I found an issue: David Lee's email bounced.

Would you like to:
- Provide a different email for David
- Proceed without David
- Cancel"
```

**Partial Success**:
```
"I completed part of your request:

✅ Retrieved Q3 financial data
✅ Found all board member contacts
✗ Unable to send emails - Gmail API rate limit exceeded

I can continue in 5 minutes when the rate limit resets, or you can send them manually. What would you prefer?"
```

---

## SubAgent Prompt Builders

SubAgents execute a **3-phase workflow** for domain-specific operations:

```
1. Intent Assessment → 2. Tool Execution → 3. Plan Review → 4. Response Formatting
```

### 7. IntentAssessmentPromptBuilder

**Location**: `src/services/prompt-builders/sub-agent/intent-assessment-prompt-builder.ts`

**Phase**: SubAgent Phase 1

**Purpose**: Understand SubAgent request and plan tool execution

#### Principles Applied

**Abstraction Layer**: Execution Layer - translates strategy into tool calls
**State Machine**: Manages SubAgent execution state
**Composition Patterns**: Plans tool execution sequences
**Declarative Approach**: Focuses on desired tool outcomes
**Meta-Programming**: Selects optimal tools and parameters

#### What It Does

1. **Parses** natural language request from MasterAgent
2. **Identifies** required tools and parameters
3. **Creates** concrete tool calls with specific parameters
4. **Plans** tool execution sequence
5. **Updates** context with intent analysis

#### Input
- Natural language request from ActionExecutionPromptBuilder
- Available tools for this domain (from ToolRegistry)
- Current context

#### Output
```typescript
{
  thinking: string,      // Chain of thought reasoning process
  context: string,       // Updated context with understanding
  toolCalls: ToolCall[], // List of tools to execute
  executionPlan: string  // Brief plan description
}
```

#### Thinking Process Example
```
ANALYSIS: Need to search for emails from john@company.com about budget from last week
REASONING:
1. This is an email search operation requiring search_emails tool
2. Need to filter by sender: john@company.com
3. Need to filter by date range: last week
4. Need to filter by content: containing "budget"
5. Should limit results to reasonable number (50 max)
CONSIDERATIONS:
- Date range needs to be calculated (last week = 2025-09-23 to 2025-09-30)
- Search query should be specific to avoid false positives
- Max results should prevent overwhelming response
DECISION: Use search_emails tool with specific filters
CONFIDENCE: 95% - clear email search operation with well-defined parameters
```

#### Tool Call Structure

```typescript
interface ToolCall {
  tool: string,              // Tool name: "send_email", "calendar_create"
  params: Record<string, any>, // Tool parameters
  description: string        // What this tool call does
}
```

#### Domain-Specific Guidelines

**Email Domain**:
- Always validate recipient addresses before sending
- Check delivery status for external recipients
- Use appropriate subject lines and formatting
- Consider email templates

**Calendar Domain**:
- Check for scheduling conflicts
- Validate attendee availability and timezones
- Use proper event titles and descriptions
- Consider recurring event patterns

**Contacts Domain**:
- Validate contact information
- Check for duplicate contacts
- Use consistent formatting
- Respect privacy requirements

**Slack Domain**:
- Respect channel permissions
- Use appropriate message formatting
- Consider thread organization
- Follow workspace guidelines

#### Example

**Input Request**:
```
"Search for emails from john@company.com received last week containing the word 'budget'"
```

**Available Tools** (Email Domain):
```
- send_email
- search_emails
- read_email
- reply_to_email
```

**Output**:
```typescript
{
  context: "Intent: Search emails with specific criteria...",
  toolCalls: [
    {
      tool: "search_emails",
      params: {
        from: "john@company.com",
        after: "2025-09-23",  // Last week
        before: "2025-09-30",
        query: "budget",
        maxResults: 50
      },
      description: "Search for emails from john@company.com containing 'budget' from last week"
    }
  ],
  executionPlan: "Execute single search_emails tool with date and sender filters"
}
```

---

### 8. PlanReviewPromptBuilder

**Location**: `src/services/prompt-builders/sub-agent/plan-review-prompt-builder.ts`

**Phase**: SubAgent Phase 3 (Between tool executions)

**Purpose**: Review tool results and revise plan if needed

#### Principles Applied

**Abstraction Layer**: Execution Layer - refines tool execution strategy
**State Machine**: Manages SubAgent execution state transitions
**Iterative Refinement**: Revises plans based on tool results
**Contextual Reasoning**: Adapts based on execution outcomes
**Meta-Programming**: Optimizes tool execution strategy

#### What It Does

1. **Analyzes** results from most recent tool execution
2. **Assesses** if original request is being fulfilled
3. **Determines** if plan needs revision
4. **Updates** execution steps based on new information
5. **Decides** whether to continue, exit, or modify approach

#### Input
- Context with tool execution results
- Remaining tool calls in plan

#### Output
```typescript
{
  thinking: string,  // Chain of thought reasoning process
  context: string,   // Updated context with results
  steps: string[]    // Updated execution steps (may be modified)
}
```

#### Thinking Process Example
```
ANALYSIS: Email search returned 0 results for exact criteria
REASONING:
1. Original search was too restrictive
2. Need to broaden search criteria to find relevant emails
3. Should try searching for emails from john@company.com (any content)
4. Should also try searching for emails containing "budget" (any sender)
5. This will help identify if the issue is sender, content, or date range
CONSIDERATIONS:
- User specifically asked for emails from john@company.com about budget
- But no results found with exact criteria
- Should broaden search while maintaining relevance
- Need to report findings clearly to user
DECISION: Revise plan to use broader search criteria
CONFIDENCE: 80% - logical approach to handle no results scenario
```

#### Plan Review Guidelines

**Evaluate**:
- Was tool execution successful?
- Did we get expected data?
- Does new information change approach?
- Are remaining steps still appropriate?

**Decisions**:
- **Revise Plan**: New information requires different approach
- **Add Steps**: Need additional tools based on results
- **Remove Steps**: Some planned tools no longer necessary
- **Update Steps**: Modify existing steps with new parameters

#### Example

**Scenario**: Email search returned 0 results

**Input Context**:
```
RESULT: search_emails returned 0 results for query="budget" from="john@company.com"
STATUS: Tool executed successfully but no emails found
```

**Output**:
```typescript
{
  context: "No emails found with exact criteria. Broadening search...",
  steps: [
    "Search for emails from john@company.com (any content)",
    "Search for emails containing 'budget' (any sender)",
    "Report findings to user"
  ]
}
```

---

### 9. ResponseFormattingPromptBuilder

**Location**: `src/services/prompt-builders/sub-agent/response-formatting-prompt-builder.ts`

**Phase**: SubAgent Phase 4 (Final)

**Purpose**: Format tool execution results for MasterAgent

#### Principles Applied

**Abstraction Layer**: Execution Layer - formats results for higher layers
**State Machine**: Completes SubAgent execution state
**Contextual Reasoning**: Adapts formatting based on results and context
**Declarative Approach**: Focuses on clear communication of outcomes
**Meta-Programming**: Optimizes result presentation

#### What It Does

1. **Reviews** all tool execution results
2. **Determines** if request was successfully fulfilled
3. **Creates** clear, concise summary
4. **Formats** data for MasterAgent consumption
5. **Returns** structured response

#### Input
- Context with all tool execution results
- Tool execution metadata

#### Output
```typescript
{
  thinking: string,    // Chain of thought reasoning process
  context: string,     // Final context with results
  response: {
    success: boolean,  // Was request fulfilled?
    summary: string,   // Human-readable summary
    data?: any         // Optional structured data
  }
}
```

#### Thinking Process Example
```
ANALYSIS: Email search completed successfully, found 3 emails matching criteria
REASONING:
1. Tool execution was successful - no errors occurred
2. Found 3 emails from john@company.com about budget from last week
3. All emails have valid subjects and dates
4. Request was fully fulfilled as asked
5. Should provide clear summary with email details
CONSIDERATIONS:
- User asked for emails from john@company.com about budget from last week
- Found exactly what was requested
- Should include email subjects and dates for context
- No additional data needed beyond summary
DECISION: Mark as successful with detailed summary
CONFIDENCE: 95% - complete success with all requested information
```

#### Response Formatting Guidelines

**Summary Creation**:
- Focus on what was actually accomplished
- Be specific about results and outcomes
- Mention any important details or limitations
- Keep it concise but informative

**Success Determination**:
- `true`: Request fully completed as asked
- `false`: Unable to complete or encountered errors

**Data Inclusion**:
- Include structured data only if it adds value
- Examples: message IDs, event IDs, contact details
- Don't include redundant information

#### Domain-Specific Response Guidelines

**Email Domain**:
```typescript
{
  success: true,
  summary: "Found 3 emails from john@company.com about budget from last week",
  data: {
    emailCount: 3,
    messageIds: ["msg_1", "msg_2", "msg_3"],
    subjects: ["Budget Q3", "Budget Review", "Budget Questions"]
  }
}
```

**Calendar Domain**:
```typescript
{
  success: true,
  summary: "Created meeting 'Q4 Planning' on Oct 6 at 2pm with 2 attendees",
  data: {
    eventId: "evt_123",
    startTime: "2025-10-06T14:00:00Z",
    attendees: ["alice@company.com", "bob@company.com"],
    conflicts: []
  }
}
```

**Contacts Domain**:
```typescript
{
  success: true,
  summary: "Found 2 contacts matching 'John Smith'",
  data: {
    contacts: [
      { id: "c1", name: "John Smith", email: "john.smith@eng.company.com", department: "Engineering" },
      { id: "c2", name: "John Smith Jr.", email: "jsmith@sales.company.com", department: "Sales" }
    ]
  }
}
```

**Slack Domain**:
```typescript
{
  success: true,
  summary: "Sent message to #engineering channel",
  data: {
    messageTs: "1633024800.000100",
    channel: "C123ABC",
    channelName: "#engineering"
  }
}
```

#### Error Responses

```typescript
{
  success: false,
  summary: "Unable to send email: Invalid recipient address 'invalid@'",
  data: {
    error: "INVALID_EMAIL",
    failedRecipient: "invalid@"
  }
}
```

---

## Context Format

### Standard Context Structure

All prompt builders use a consistent context format:

```
GOAL: [Primary user intent and desired outcome]
ENTITIES: [People, companies, meetings, emails referenced]
CONSTRAINTS: [Time limits, approval requirements, risk factors]
DATA: [Information gathered from domain agents]
PROGRESS: [Actions completed, decisions made]
BLOCKERS: [Current issues preventing progress]
NEXT: [Immediate next action in workflow]
CURRENT_TIME: [Current date/time with timezone information]

Additional Phase-Specific Fields:
RISK_LEVEL: [low/medium/high - from SituationAnalysis]
OUTPUT_STRATEGY: [direct/preview/confirmation - from SituationAnalysis]
CONFIDENCE: [0-100 - from ProgressAssessment]

Free-form Notes: [Additional context, reasoning, edge cases]
```

### Context Evolution Example

**After SituationAnalysis**:
```
GOAL: Send meeting invite to team
ENTITIES: team, meeting
CONSTRAINTS: None identified
DATA: (empty)
PROGRESS: Intent analyzed, strategy determined
BLOCKERS: Need to identify who "team" refers to
NEXT: Retrieve team member list
CURRENT_TIME: 2025-09-30T10:00:00-07:00
RISK_LEVEL: low
OUTPUT_STRATEGY: direct
CONFIDENCE: 75
```

**After ActionExecution → SubAgent**:
```
GOAL: Send meeting invite to team
ENTITIES: team (5 members: Alice, Bob, Carol, David, Emma), meeting
CONSTRAINTS: None identified
DATA: Team members retrieved from contact agent
PROGRESS: Intent analyzed, strategy determined; Team list retrieved
BLOCKERS: None
NEXT: Schedule meeting for team members
CURRENT_TIME: 2025-09-30T10:01:15-07:00
RISK_LEVEL: low
OUTPUT_STRATEGY: direct
CONFIDENCE: 90
```

**After ProgressAssessment**:
```
GOAL: Send meeting invite to team
ENTITIES: team (5 members), meeting (Oct 6, 2pm, 1 hour, "Team Sync")
CONSTRAINTS: None identified
DATA: Team members retrieved; Meeting created (ID: evt_123)
PROGRESS: Intent analyzed, team identified, meeting scheduled, invites sent
BLOCKERS: None
NEXT: Generate final response
CURRENT_TIME: 2025-09-30T10:02:45-07:00
RISK_LEVEL: low
OUTPUT_STRATEGY: direct
CONFIDENCE: 95
```

---

## Execution Flow

### Complete Workflow Example

**User Request**: "Find emails from last week about the budget and forward them to my manager"

#### Phase 1: Initial Analysis

**1. SituationAnalysisPromptBuilder**
```
Input: "Find emails from last week about the budget and forward them to my manager"

Output:
{
  context: "
    GOAL: Find budget-related emails from last week and forward to manager
    ENTITIES: budget emails, manager
    CONSTRAINTS: Time window (last week)
    BLOCKERS: Need to identify who manager is
    NEXT: Retrieve manager information
    RISK_LEVEL: medium
    OUTPUT_STRATEGY: preview
    CONFIDENCE: 70
  "
}
```

**2. WorkflowPlanningPromptBuilder**
```
Input: [Context from Step 1]

Output:
{
  context: "... [updated] ...",
  steps: [
    "Identify user's manager from contacts or org chart",
    "Search for emails from last week containing 'budget'",
    "Select relevant emails to forward",
    "Generate preview of emails to be forwarded",
    "Forward emails to manager after user approval"
  ]
}
```

#### Phase 2: Workflow Execution Loop

**Iteration 1**:

**3a. EnvironmentCheckPromptBuilder**
```
Input: [Current context, step 1]

Output:
{
  context: "... NEXT: Retrieve manager info from contacts ...",
  needsUserInput: false
}
```

**3b. ActionExecutionPromptBuilder**
```
Input: [Context, current step: "Identify user's manager"]

Output:
{
  context: "... PROGRESS: Requesting manager info from contact agent ...",
  agent: "contact",
  request: "Find the direct manager for the current user"
}
```

**SubAgent (Contact) Execution**:
```
7. IntentAssessmentPromptBuilder
   → toolCalls: [{ tool: "get_manager", params: {userId: "current"} }]

[Tool Execution]
   → Result: { managerId: "mgr_123", name: "Sarah Johnson", email: "sarah@company.com" }

9. ResponseFormattingPromptBuilder
   → {
       success: true,
       summary: "Found manager: Sarah Johnson (sarah@company.com)",
       data: { managerId: "mgr_123", email: "sarah@company.com" }
     }
```

**3c. ProgressAssessmentPromptBuilder**
```
Input: [Context with manager info]

Output:
{
  context: "
    ...
    DATA: Manager identified (Sarah Johnson - sarah@company.com)
    PROGRESS: Manager identified successfully
    CONFIDENCE: 80
    ...
  "
  // No newSteps = continue with plan
}
```

**Iteration 2**:

**3a-3b**: Execute step "Search for emails from last week containing 'budget'"

**SubAgent (Email) Execution**:
```
7. IntentAssessmentPromptBuilder
   → toolCalls: [{
       tool: "search_emails",
       params: {
         query: "budget",
         after: "2025-09-23",
         maxResults: 50
       }
     }]

[Tool Execution]
   → Result: [email1, email2, email3] (3 emails found)

9. ResponseFormattingPromptBuilder
   → {
       success: true,
       summary: "Found 3 emails about budget from last week",
       data: { count: 3, emails: [...] }
     }
```

**3c. ProgressAssessmentPromptBuilder**
```
Output:
{
  context: "
    ...
    DATA: Manager (Sarah), Emails found (3: Budget Q3, Budget Review, Budget Questions)
    PROGRESS: Manager identified, emails retrieved
    CONFIDENCE: 90
    ...
  ",
  newSteps: [
    "Generate preview of 3 emails to be forwarded to Sarah",
    "Wait for user approval",
    "Forward approved emails to sarah@company.com"
  ]
}
```

**Iteration 3**: EnvironmentCheck determines preview needed

**3a. EnvironmentCheckPromptBuilder**
```
Output:
{
  context: "... NEXT: Jump to final output for preview generation ...",
  needsUserInput: true,  // Triggers exit to FinalResponse
  requiredInfo: "Preview of emails to forward"
}
```

#### Phase 3: Final Output

**6. FinalResponsePromptBuilder**
```
Input: [Complete context with all data]

Output:
{
  context: "... [final state] ...",
  response: "
    I found 3 emails about the budget from last week:

    1. **Budget Q3 Review** (from John Smith - Sept 23)
       Subject: Q3 Budget Review
       Summary: Review of Q3 spending and variance analysis

    2. **Budget Approval Request** (from Finance Dept - Sept 25)
       Subject: Budget Approval Needed
       Summary: Requesting approval for additional Q4 budget

    3. **Budget Questions** (from Alice Chen - Sept 27)
       Subject: Questions about budget allocation
       Summary: Clarification questions about department budget

    I'm ready to forward these to Sarah Johnson (sarah@company.com).

    Would you like me to:
    - Forward all 3 emails
    - Select specific emails to forward
    - Cancel
  "
}
```

---

## Summary

### Prompt Builder Responsibilities

| Prompt Builder | When Used | Key Responsibility | Output |
|---------------|-----------|-------------------|--------|
| **SituationAnalysis** | Once at start | Understand intent, assess risk | Context with GOAL, RISK_LEVEL, OUTPUT_STRATEGY |
| **WorkflowPlanning** | Once after analysis | Break down into steps | Context + workflow steps array |
| **EnvironmentCheck** | Every iteration | Check if can continue | Context + needsUserInput flag |
| **ActionExecution** | Every iteration (if continuing) | Route to SubAgent | Context + agent + request |
| **ProgressAssessment** | After each SubAgent | Check if complete | Context + optional new steps |
| **FinalResponse** | Once at end | Generate user response | Context + human-readable response |
| **IntentAssessment** | SubAgent Phase 1 | Plan tool execution | Context + tool calls |
| **PlanReview** | SubAgent Phase 3 | Revise plan if needed | Context + updated steps |
| **ResponseFormatting** | SubAgent Phase 4 | Format results | Context + structured response |

### Design Principles

1. **Single Responsibility**: Each builder has one specific job
2. **Context Accumulation**: Context grows throughout execution
3. **Structured Output**: All builders return typed, structured data
4. **Error Resilience**: Failed executions handled gracefully
5. **Iterative Refinement**: Plans can be revised based on results
6. **User Control**: High-risk operations require approval
7. **Clear Communication**: Natural language throughout
8. **Abstraction Layers**: Clear separation between intent, strategy, and execution
9. **State Machine Thinking**: Explicit state transitions and decision points
10. **Composition Patterns**: Complex behaviors built from simple, reusable components
11. **Declarative vs Imperative**: Separate "what" from "how" for flexibility
12. **Contextual Reasoning**: Adapt behavior based on available information and constraints
13. **Meta-Programming**: System reasons about its own capabilities and performance
14. **Chain of Thought**: Systematic thinking process before generating outputs

---

## Principles in Action

### Example: Complex Email Workflow

**User Request**: "Send Q3 results to all board members and schedule a follow-up meeting"

**Abstraction Layers in Action**:
1. **Intent Layer** (SituationAnalysis): "Communicate results and schedule follow-up"
2. **Strategy Layer** (WorkflowPlanning): "Email first, then calendar coordination"
3. **Execution Layer** (ActionExecution): "Use email agent, then calendar agent"

**State Machine Progression**:
```
[analyzing] → [planning] → [executing] → [assessing] → [complete]
     ↓           ↓           ↓           ↓
   Intent     Steps      Email +      Progress     Final
   Analysis   Created    Calendar     Checked      Response
```

**Composition Patterns Used**:
- **Gather → Validate → Execute**: Get board members, validate emails, send
- **Sequential Execution**: Email first, then calendar
- **Conditional Branching**: Different paths if email fails

**Declarative vs Imperative**:
- **Declarative**: "Send results to all board members"
- **Imperative**: "Must validate email addresses, must check permissions"

**Contextual Reasoning**:
- **High Risk**: Mass email to board members
- **Output Strategy**: Confirmation required
- **Confidence**: Starts at 70%, increases as data gathered

**Meta-Programming**:
- **Capability Discovery**: "Which agents can handle this request?"
- **Strategy Selection**: "Email first or calendar first?"
- **Performance Monitoring**: "How to optimize this workflow?"

**Chain of Thought**:
- **SituationAnalysis**: "ANALYSIS: Mass email to board members... REASONING: High risk due to sensitive content... DECISION: Set RISK_LEVEL to high"
- **WorkflowPlanning**: "ANALYSIS: Need to break down into steps... REASONING: First get contacts, then validate... DECISION: Create 7-step workflow"
- **ActionExecution**: "ANALYSIS: Current step is contact retrieval... REASONING: Use contact agent... DECISION: Request board member list"

---

*For implementation details, see the Architecture Documentation and source code in `src/services/prompt-builders/`*