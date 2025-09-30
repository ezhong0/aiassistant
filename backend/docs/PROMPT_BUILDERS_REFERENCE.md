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

---

## MasterAgent Prompt Builders

### 1. SituationAnalysisPromptBuilder

**Location**: `src/services/prompt-builders/main-agent/situation-analysis-prompt-builder.ts`

**Phase**: Initial Analysis (Step 1)

**Purpose**: Understand user intent, assess risk, and determine output strategy

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
  context: string // Structured context with GOAL, ENTITIES, RISK_LEVEL, etc.
}
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
  context: string,    // Updated context with workflow plan
  steps: string[]     // Ordered list of specific steps
}
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
  context: string,           // Updated context
  needsUserInput?: boolean,  // True if pausing for user input
  requiredInfo?: string      // What information is needed
}
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
  context: string,                                  // Updated context
  agent: 'email' | 'calendar' | 'contact' | 'slack', // Which agent to use
  request: string                                   // Natural language request for agent
}
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
  context: string,      // Updated context with progress
  newSteps?: string[]   // Only if plan needs revision
}
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
  context: string,   // Final context state
  response: string   // Human-readable response
}
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
1. Intent Assessment → 2. Tool Execution → 3. Response Formatting
```

### 7. IntentAssessmentPromptBuilder

**Location**: `src/services/prompt-builders/sub-agent/intent-assessment-prompt-builder.ts`

**Phase**: SubAgent Phase 1

**Purpose**: Understand SubAgent request and plan tool execution

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
  context: string,       // Updated context with understanding
  toolCalls: ToolCall[], // List of tools to execute
  executionPlan: string  // Brief plan description
}
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

**Phase**: SubAgent Phase 2 (Optional - between tool executions)

**Purpose**: Review tool results and revise plan if needed

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
  context: string,   // Updated context with results
  steps: string[]    // Updated execution steps (may be modified)
}
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

**Phase**: SubAgent Phase 3 (Final)

**Purpose**: Format tool execution results for MasterAgent

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
  context: string,     // Final context with results
  response: {
    success: boolean,  // Was request fulfilled?
    summary: string,   // Human-readable summary
    data?: any         // Optional structured data
  }
}
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
| **PlanReview** | SubAgent Phase 2 (optional) | Revise plan if needed | Context + updated steps |
| **ResponseFormatting** | SubAgent Phase 3 | Format results | Context + structured response |

### Design Principles

1. **Single Responsibility**: Each builder has one specific job
2. **Context Accumulation**: Context grows throughout execution
3. **Structured Output**: All builders return typed, structured data
4. **Error Resilience**: Failed executions handled gracefully
5. **Iterative Refinement**: Plans can be revised based on results
6. **User Control**: High-risk operations require approval
7. **Clear Communication**: Natural language throughout

---

*For implementation details, see the Architecture Documentation and source code in `src/services/prompt-builders/`*