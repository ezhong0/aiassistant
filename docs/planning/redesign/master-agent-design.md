# Master Agent Design - Enhanced Flow Chart

## Initial Analysis Phase

```
User Message Input
        ↓
┌─────────────────────────────────────┐
│ 1. Judge Past Message Context      │
│    - Analyze conversation history   │
│    - Understand ongoing context     │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 2. Safety & Risk Pre-Assessment    │
│    - Identify potential risks early │
│    - Flag sensitive operations      │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 3. Determine Intent                 │
│    - Classify user's primary goal   │
│    - Identify request type          │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 4. Identify Missing Context         │
│    - What information is needed?    │
│    - What gaps exist?               │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 5. Define Output Strategy           │
│    - Read commands → output style   │
│    - Write commands → draft proposal│
│    - Confirmations → execute + msg  │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 6. Create Workflow Steps            │
│    - Define concrete actions        │
│    - Set success criteria           │
│    - Add max iteration limit (10)   │
│    - Prioritize steps by:           │
│      1. Safety/Risk Assessment      │
│      2. Intent Clarification        │
│      3. Critical Context Gathering  │
│      4. Non-critical Context        │
│      5. Action Planning             │
│      6. Action Execution            │
│                                     │
│ Context Box Updates:                │
│ GOAL: [User intent clarified]       │
│ ENTITIES: [Key entities identified] │
│ CONSTRAINTS: [Risk/time factors]    │
│ PROGRESS: [Workflow planned]        │
│ NEXT: [First prioritized step]      │
│ Free-form Notes: [Planning details] │
└─────────────────────────────────────┘
```

## Main Execution Loop (Max 10 Iterations)

```
        ↓
┌─────────────────────────────────────┐
│ LOOP START (iteration_count = 0)    │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 7. Iteration Limit Check            │
│    - iteration_count < 10?          │
│    - If exceeded: force exit        │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 7.5 Check for User Interruptions    │
│     - Check for new user messages   │
│     - If new message exists:        │
│       → Save current workflow state │
│       → Start entirely new flow     │
│       → Previous context preserved  │
│         for potential resumption    │
│                                     │
│ Context Box Updates:                │
│ + Interruption detected             │
│ + Current workflow state saved      │
│ + New flow initiated                │
│ ? Still needed: Handle new request  │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 8. Check for User Input Needed      │
│    - Is there immediate info needed?│
│    - Can we proceed without user?   │
└─────────────────────────────────────┘
        ↓
    ┌─────────┐                    ┌─────────┐
    │  YES    │                    │   NO    │
    │  ↓      │                    │   ↓     │
    │ Ask User│                    │ Continue│
    │Question │                    │   ↓     │
    └─────────┘                    └─────────┘
        ↓                              ↓
        └──────────────┬─────────────────┘
                       ↓
┌─────────────────────────────────────┐
│ 9. Delegate to Domain Sub-Agents    │
│     (Natural Language Interface)    │
│     Agent Types:                    │
│     - Email Agent                   │
│     - Calendar Agent                │
│     - Contacts Agent                │
│                                     │
│     All other tasks (intent analysis,│
│     context gathering, risk         │
│     assessment, drafting) handled   │
│     by Master Agent directly        │
│                                     │
│     Sub-agents return:              │
│     - Success: Data + confidence    │
│     - Error: Error type + context   │
│     - Partial: Data + limitations   │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 10. Process Sub-Agent Response      │
│     - Analyze response type         │
│     - Extract data/error info       │
│     - Update confidence tracking    │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 11. Update Global Context Handler   │
│     - Integrate successful data     │
│     - Log error context             │
│     - Track failed attempts         │
│     - Revise predetermined data     │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ 12. Enhanced Completion Check       │
│     - Calculate confidence (0-100%) │
│     - Evaluate error impact         │
│     - Check for blocking issues     │
│     - Assess if goals still viable  │
└─────────────────────────────────────┘
        ↓
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │COMPLETE │    │PARTIAL  │    │ BLOCKED │
    │(90%+)   │    │(50-89%) │    │(<50%)   │
    │  ↓      │    │   ↓     │    │   ↓     │
    └─────────┘    └─────────┘    └─────────┘
        ↓              ↓              ↓
        │              ↓              ↓
        │      ┌─────────────────┐    ↓
        │      │ 12.1 Handle     │    ↓
        │      │     Partial     │    ↓
        │      │     Success     │    ↓
        │      │ - Notify user   │    ↓
        │      │ - Continue with │    ↓
        │      │   what we have  │    ↓
        │      └─────────────────┘    ↓
        │              ↓              ↓
        └──────────────┬──────────────┘
                       ↓
┌─────────────────────────────────────┐
│ 13. Intelligent Plan Adaptation     │
│                                     │
│     The Master Agent evaluates      │
│     errors, context, and user goals │
│     to determine optimal adaptation  │
│     strategy. Considers alternative │
│     approaches, user input needs,   │
│     and graceful degradation        │
│     options based on specific       │
│     circumstances rather than       │
│     predetermined patterns.         │
│                                     │
│     For High Risk/Write Operations: │
│     → Generate detailed preview     │
│     → Output preview as final result│
│     → User confirmations/revisions  │
│       come as entirely new flows    │
│     → New flow context includes     │
│       previous proposal + feedback  │
│                                     │
│ Context Box Updates:                │
│ + Plan adaptation strategy          │
│ + Alternative approaches identified │
│ + Decision reasoning                │
│ + Required user actions             │
│ + Preview/proposal details          │
│ ? Still needed: Final output format │
└─────────────────────────────────────┘
        ↓
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │ REVISE  │     │CONTINUE │     │  EXIT   │
    │  PLAN   │     │         │     │  LOOP   │
    │   ↓     │     │   ↓     │     │   ↓     │
    └─────────┘     └─────────┘     └─────────┘
        ↓               ↓               ↓
        │               │               │
        │ increment     │               │
        │ iteration_    │               │
        │ count ↓       │               │
        └──────────────┬┘               │
                       ↓                │
                                       │
                                       ↓
                                ┌─────────────────┐
                                │ Generate Final  │
                                │ Error Response  │
                                │ - Explain what  │
                                │   failed        │
                                │ - Why it failed │
                                │ - What user can │
                                │   do instead    │
                                └─────────────────┘
                                       ↓
                                    TO END
                       ↓
┌─────────────────────────────────────┐
│ 14. Loop Completion Check           │
│     - All steps complete?           │
│     - Confidence threshold met?     │
│     - Ready for final output?       │
│     - OR max iterations reached?    │
└─────────────────────────────────────┘
        ↓
    ┌─────────┐                    ┌─────────┐
    │  DONE   │                    │CONTINUE │
    │   ↓     │                    │   ↓     │
    └─────────┘                    └─────────┘
        ↓                              │
        │                              │
        └──────────────┬─────────────────┘
                       ↓               │
                                      │ LOOP BACK
                                      │ to step 7
                                      └─────────┐
                                                │
┌─────────────────────────────────────┐        │
│ 15. Final Output Generation         │        │
│     - Compare results to criteria   │        │
│     - Generate appropriate response │        │
│                                     │        │
│     Low/Medium Risk:                │        │
│     → Execute actions + show results│        │
│                                     │        │
│     High Risk:                      │        │
│     → Generate detailed preview     │        │
│     → Present to user               │        │
│     → End workflow (confirmations/  │        │
│       revisions start new flows)    │        │
│                                     │        │
│     - Report confidence levels      │        │
│     - Include any limitations       │        │
└─────────────────────────────────────┘        │
        ↓                                      │
┌─────────────────────────────────────┐        │
│ END                                 │        │
└─────────────────────────────────────┘        │
                                               │
                                              ↓
                                    ┌─────────────────┐
                                    │ LOOP CONTINUES  │
                                    │ Back to Step 7  │
                                    └─────────────────┘
```

## Key Decision Points

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

No Message Classification Needed:
- All interruptions treated equally
- No complex merging logic
- Clean separation of concerns
- Simpler state management

Example User Experience:
User: "Schedule board meeting next month"
Agent: [Working on scheduling...]

User: "Actually, check my calendar first"
Agent: [New flow] "I'll check your calendar now. I've paused the board meeting scheduling and can resume it later if needed."

User: "Never mind the board meeting"
Agent: [New flow] "Understood, I'll cancel the board meeting task. Your calendar check is complete."

Benefits:
- No workflow corruption
- No complex state merging
- Each flow is clean and focused
- User can naturally change direction
- Previous work is preserved but not blocking
```

### Enhanced Priority System
```
Master Agent handles internally:
1. Safety/Risk Assessment (highest):
   - "Is this action reversible?"
   - "Could this cause harm or embarrassment?"
   - "Does this involve sensitive data?"

2. Intent Clarification:
   - "What does 'vendor' refer to?"
   - "What type of meeting is this?"
   - "What's the user's goal?"

3. Context Analysis & Planning:
   - Analyze available information
   - Identify missing pieces
   - Plan delegation strategy
   - Draft content and responses

Delegate to Domain Agents:
4. Email Operations:
   - "Find emails from John about the project"
   - "Send this draft email to the team"
   - "Check if there are any replies to yesterday's message"

5. Calendar Operations:
   - "What times am I available next week?"
   - "Schedule a meeting with these participants"
   - "Find conflicts in my calendar for Thursday"

6. Contact Operations:
   - "Find David's email address"
   - "Get contact info for all team members"
   - "Update Sarah's phone number"
```

### Enhanced User Input Triggers
```
Ask User When:
- Multiple valid interpretations exist
- Critical information is missing
- Risk level is high
- User preference needed
- Confirmation required
- Sub-agent failures exceed retry limit
- Confidence level below 70%
- Ambiguous entity references (multiple "David"s)
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
- Need user input? → ASK USER
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

Benefits:
- Light structure for consistent tracking
- Free-form section for nuanced context
- Easy to scan and understand progress
- Natural evolution throughout workflow
- Preserves both facts and reasoning
```
