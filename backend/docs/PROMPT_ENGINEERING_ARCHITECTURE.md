# Prompt Engineering & Context Management Architecture

## Executive Summary

This document details the **4 core prompts** that power the email/calendar assistant and how **context is managed** to prevent bloat while maintaining intelligence.

**Key Principle**: Each agent (Master and SubAgents) maintains its own **internal context** privately. Communication between agents is pure **natural language strings**. No structured data passes between agents - only natural language in, natural language out.

**The 4 Core Prompts:**
1. **Master Agent Prompt 1**: Intent Understanding & Command List Creation (or Draft Proposal for write commands)
2. **Master Agent Prompt 2**: Context Update & Command List Modification (or Confirmation Recognition for write commands)
3. **SubAgent Prompt 1**: Command Interpretation & Tool Call List Creation
4. **SubAgent Prompt 2**: Tool Reassessment & Tool Call List Modification

**The List Pattern**: Both Master and SubAgents create lists (commands or tool calls) and modify them dynamically based on execution results. These lists are **internal context** - not exposed across agent boundaries.

**Context Boundaries**:
- **Master Agent internal context**: command_list, accumulated knowledge from previous SubAgent responses
- **SubAgent internal context**: tool_call_list, working_data, executed_tools
- **Communication**: Pure natural language strings (command → response)

**Reference Resolution (MVP Approach):** The system does NOT maintain saved references. Instead, the LLM resolves references on-demand by scanning conversation history and making additional queries when needed.

**Intelligence Through Reasoning, Not Hardcoding:** The system has NO hardcoded patterns for semantic understanding, sentiment analysis, or commitment detection. Instead, Master Agent sends high-level intent (e.g., "find emails the user may be forgetting") and SubAgents use chain-of-thought reasoning to determine how to execute (multiple search queries, reading recent emails, analyzing threads, etc.).

**The Two SubAgents:**
- **EmailAgent**: Handles all email operations (search, read, send, reply, drafts)
- **CalendarAgent**: Handles all calendar operations (list events, create, update, delete, availability)
- **Both** have access to contact tools for resolving names to email addresses

---

## Available Tools (MVP)

SubAgents have access to these tools for executing commands.

**Both EmailAgent and CalendarAgent can use:**

**👥 Contact Tools (6 tools)** - Available to both agents
- `search_contacts` - Search for contacts by name or email
- `get_contact` - Get a specific contact by ID
- `list_contacts` - List all contacts
- `create_contact` - Create a new contact
- `update_contact` - Update an existing contact
- `delete_contact` - Delete a contact

**📧 Email Tools (12 tools)** - EmailAgent only
- `send_email` - Send an email to one or more recipients
- `search_emails` - Search for emails using a query (supports account_ids array for cross-account search)
- `get_email` - Get a specific email by message ID
- `reply_to_email` - Reply to a specific email
- `get_email_thread` - Get an email thread by thread ID (returns full conversation with replies and timestamps)
- `archive_email` - Archive an email (reversible)
- `mark_read` / `mark_unread` - Change email read status
- `star_email` / `unstar_email` - Star or unstar an email
- `create_label` - Create a new label/folder
- `add_label_to_email` - Add label to an email
- `remove_label_from_email` - Remove label from an email
- `manage_attachments` - Upload or download email attachments

**📅 Calendar Tools (8 tools)** - CalendarAgent only
- `create_event` - Create a new calendar event
- `list_events` - List calendar events in a date range (supports calendar_ids array for cross-account)
- `get_event` - Get a specific calendar event by ID
- `update_event` - Update an existing calendar event
- `delete_event` - Delete a calendar event
- `respond_to_event` - Accept, decline, or tentatively accept a meeting invite
- `check_availability` - Check availability for attendees
- `find_available_slots` - Find available time slots for a meeting
- `list_calendars` - List available calendars
---

## Context Management Philosophy

### The Agent Boundary Model

**SubAgents are API-like black boxes:**

```
Input:  Natural language command string
Output: Natural language response string

Internal context (private):
- tool_call_list
- working_data
- executed_tools
```

**Example:**
```javascript
// Master Agent sends command (natural language string)
const command = "Find emails from Sarah about budget from last week";

// SubAgent executes internally (private context)
const response = await EmailAgent.execute(command);

// SubAgent returns response (natural language string ONLY)
console.log(response);
// "Found 5 emails from Sarah Chen about Q4 budget from Dec 15-28.
//
//  1. Q4 Budget Review (Dec 15) - Sarah asks about timeline
//  2. Budget Questions (Dec 20) - Clarifying line items
//  3. Follow-up (Dec 22) - Additional context needed
//  4. Budget Approval (Dec 26) - Requesting final sign-off
//  5. Final Numbers (Dec 28) - Latest figures attached
//
//  The most recent email is from Dec 28 with updated budget figures."
```

**Master Agent then extracts information from this natural language response** during Prompt 2 reasoning. No structured data passed.

**Note on Thread Intelligence:** The `get_email_thread` tool returns the full conversation including all replies with timestamps. The LLM parses this data to determine:
- Who replied last in the conversation
- Time since last message
- Whether user has responded
- Conversation flow and waiting state

This enables queries like "What emails haven't I responded to?" or "Show me threads where I'm the blocker."

### Why Natural Language Boundaries?

1. **Clean abstraction**: SubAgents are replaceable modules
2. **No coupling**: Master doesn't depend on SubAgent internal schema
3. **LLM strength**: Extracting structure from natural language is what LLMs do best
4. **Context efficiency**: Natural language responses are already filtered/summarized

### The Problem with Naive Context Handling

**Bad approach (dumping raw tool results into context):**
```
SubAgent executes contact_lookup → dumps full API response in context:
{
  "results": [
    {"id": "123", "name": "Sarah Chen", "email": "sarah@company.com",
     "phone": "+1-555...", "title": "VP Finance", ...},
    // 50 more fields
  ],
  "metadata": {...},
  // hundreds of lines
}

Context explodes to 3000+ tokens...
```

**Good approach (LLM filtering within agent's internal context):**
```
SubAgent executes contact_lookup → Prompt 2 receives raw result (internal) → filters to:
{
  "sarah_email": "sarah@company.com",
  "contact_confirmed": true
}
(Internal working_data: 2 lines instead of 50)

Then generates natural language response:
"Found Sarah Chen's contact: sarah@company.com"
(Passes to Master: ~10 tokens)
```

**The LLM acts as an intelligent filter** within each agent's private context.

---

## Master Agent Internal Context

**The Master Agent maintains:**

```javascript
{
  // The user's original query
  original_query: "What meetings do I have tomorrow that I'm not prepared for?",

  // The command list (created by Prompt 1, modified by Prompt 2)
  command_list: [
    {
      agent: "calendar",
      command: "Get meetings for tomorrow and identify which lack agendas",
      order: 1,
      status: "completed"
    },
    {
      agent: "email",
      command: "For these 5 specific meetings, check for email context...",
      order: 2,
      status: "pending"
    }
  ],

  // Accumulated knowledge (extracted from SubAgent natural language responses)
  accumulated_knowledge: {
    meetings_without_agendas: 5,
    specific_meeting_titles: ["Acme client call", "Product review", ...],
    // Minimal facts extracted during Prompt 2 reasoning
  }
}
```

**This context is PRIVATE** - SubAgents never see it.

---

## SubAgent Internal Context

**Each SubAgent maintains:**

```javascript
{
  // The command from Master Agent
  original_command: "Find emails from Sarah about budget from last week",

  // The tool call list (created by Prompt 1, modified by Prompt 2)
  tool_call_list: [
    {
      tool: "contact_lookup",
      params: {name: "Sarah"},
      order: 1,
      status: "completed"
    },
    {
      tool: "gmail_search",
      params: {query: "from:sarah@company.com budget after:2024-12-22"},
      order: 2,
      status: "completed"
    }
  ],

  // Working data (accumulated during tool execution)
  working_data: {
    sarah_email: "sarah@company.com",
    emails_found: 5,
    date_range: "Dec 15-28"
  },

  // Executed tools (for reference during reassessment)
  executed_tools: [
    {tool: "contact_lookup", result_summary: "Found sarah@company.com"},
    {tool: "gmail_search", result_summary: "5 emails found"}
  ]
}
```

**This context is PRIVATE** - Master Agent never sees it.

**SubAgent returns ONLY:**
```
"Found 5 emails from Sarah Chen about Q4 budget from Dec 15-28.

1. Q4 Budget Review (Dec 15) - Sarah asks about timeline
2. Budget Questions (Dec 20) - Clarifying line items
..."
```

A pure natural language string.

---

## Master Agent Prompt 1: Intent Understanding & Command List Creation (or Draft Proposal)

### Purpose

Transform user's natural language query into:
- **Read queries**: A list of commands for SubAgents to execute
- **Write commands**: A draft proposal for user approval (don't execute yet)

This prompt creates the initial execution plan OR prepares a draft for user confirmation.

### Input

```javascript
{
  user_query: "Reply to the first email",

  conversation_history: [
    {
      user: "Show me emails from Sarah",
      assistant: "You have 5 emails from Sarah:\n1. Q4 Budget Review (Dec 15)\n2. Project Update (Dec 20)\n..."
    }
    // Last 3-5 turns
  ],

  user_context: {
    email_accounts: [
      {email: "john@company.com", type: "work", primary: true}
    ],
    preferences: {
      working_hours: "9am-6pm PST",
      default_account: "work"
    }
  }
}
```

### Prompt Structure

```
You are the Master Agent for an email/calendar assistant. Your job is to understand the user's intent and create a LIST OF COMMANDS for specialized SubAgents to execute sequentially.

SubAgents are API-like modules:
- You send: Natural language command string
- You receive: Natural language response string
- You don't see their internal workings

# Chain of Thought Process

1. INTENT ANALYSIS
   - What is the user trying to accomplish?
   - Is this a read query or write action?
   - What's the core need?

2. REFERENCE RESOLUTION
   - Does the query reference previous conversation?
   - Scan conversation_history and extract what you can
   - What still needs SubAgent to resolve?

3. READ vs. WRITE DETECTION
   - Is this a read query (fetch information) or write command (take action)?
   - If WRITE: What's the scope? (single vs. bulk)
   - If WRITE: What's the risk level? (reversible vs. irreversible)
   - If WRITE: Prepare for confirmation flow
   - If READ: Create command list for execution

4. DOMAIN DETECTION
   - What SubAgents are needed? (EmailAgent | CalendarAgent)
   - Single-domain or multi-domain?
   - What's the dependency order?
   - Cross-account intent? ("across all accounts", "show me everything")

5. AMBIGUITY CHECK
   - Is anything unclear?
   - Need clarification from user?

6. COMMAND LIST CREATION (Read queries) or DRAFT PROPOSAL (Write commands)
   - For READ: Generate natural language commands for SubAgents
   - For WRITE: Create command for SubAgent to generate draft/preview
   - Commands execute sequentially
   - Later commands may be modified based on earlier results

# Output Format

## For Read Queries:
{
  "command_list": [
    {
      "agent": "email",
      "command": "Find emails from Sarah about Q4 Budget from last week",
      "order": 1
    }
  ],
  "clarifications": []
}

## For Write Commands (generates natural language draft, not structured data):
Master Agent returns a natural language description of the draft to the user.
The draft details are embedded in this natural language text, which will be
parsed from conversation_history when user confirms.
```

### Chain-of-Thought Example: Reference Resolution (Write Command)

**User query:** "Reply to the first email saying I'll review it by Friday"

```
Step 1 - Intent Analysis:
User wants to compose a reply. This is a WRITE action.

Step 2 - Reference Resolution:
"The first email" refers to previous conversation.

Scanning conversation_history:
- Previous turn: "Show me emails from Sarah"
- Assistant listed 5 emails:
  1. Q4 Budget Review (Dec 15)
  2. Project Update (Dec 20)
  ...

"The first email" = "Q4 Budget Review (Dec 15)" from Sarah

Step 3 - READ vs. WRITE DETECTION:
This is WRITE - need to draft before executing.

Step 4 - Domain Detection:
EmailAgent (for email operations)

Step 5 - Ambiguity Check:
Subject + date + sender should uniquely identify the email. No ambiguity.

Step 6 - Command List Creation:
For WRITE commands, Master Agent sends command to SubAgent to create draft.
SubAgent will gather context and compose the draft.

Command: "Draft a reply to Sarah's Q4 Budget Review email from Dec 15 saying I'll review it by Friday"
```

**Output:**
```json
{
  "command_list": [
    {
      "agent": "email",
      "command": "Draft a reply to Sarah's Q4 Budget Review email from Dec 15 saying I'll review it by Friday",
      "order": 1
    }
  ],
  "clarifications": []
}
```

### What Happens Next

**For Read Queries:**
Master Agent sends the command string to EmailAgent:

```javascript
const response = await EmailAgent.execute(
  "Find emails from Sarah about Q4 Budget from last week"
);
```

**For Write Commands:**
Master Agent generates a natural language draft description and returns it to user.

The draft information is embedded in the natural language text (not a structured object).

Example:
```
I'll send this reply to Sarah Chen about the Q4 budget:

"Hi Sarah,

Thanks for sending over the Q4 budget review. I've reviewed the numbers
and the timeline looks good. I'll have the updated projections ready by
Friday as discussed.

Best,
John"

Reply "send it" to confirm, or suggest changes.
```

This natural language text becomes part of conversation_history.
User's next message goes back through Master Agent Prompt 1.

---

## Write Command Flow: Draft → Confirm → Execute

**Turn 1: User requests action**
```
User: "Reply to Sarah saying I'll have the budget ready by Friday"

Master Agent Prompt 1:
→ Detects WRITE command
→ Scans conversation_history: previous turn listed Sarah's email about budget
→ Needs EmailAgent to gather context and compose draft

Creates command_list:
{
  "command_list": [
    {
      "agent": "email",
      "command": "Draft a reply to Sarah's Q4 Budget email saying the budget will be ready by Friday",
      "order": 1
    }
  ]
}

EmailAgent executes:
→ Searches for Sarah's email
→ Gets thread context
→ Composes draft body
→ Returns natural language draft to Master Agent

Master Agent returns to user:
"I'll send this reply to Sarah Chen about the Q4 budget:

'Hi Sarah,

Thanks for your email. I'll have the budget ready by Friday.

Best,
John'

Reply 'send it' to confirm, or suggest changes."

This text is now in conversation_history.
```

**Turn 2: User confirms**
```
User: "send it" (or "looks good" or "yes")

Master Agent Prompt 1:
→ Scans conversation_history
→ Sees draft text from previous turn
→ Detects confirmation intent
→ Extracts details: recipient (Sarah Chen), body (the composed text)
→ Creates command to execute

{
  "command_list": [
    {
      "agent": "email",
      "command": "Send the reply to Sarah Chen with body: 'Hi Sarah, Thanks for your email. I'll have the budget ready by Friday. Best, John'",
      "order": 1
    }
  ]
}

EmailAgent executes → Sends email
Returns: "Sent reply to Sarah Chen"
```

**Turn 2 Alternative: User edits**
```
User: "change it to say I'll have it ready by Monday"

Master Agent Prompt 1:
→ Scans conversation_history
→ Sees draft from previous turn
→ Detects edit intent
→ Sends command to EmailAgent to create revised draft

{
  "command_list": [
    {
      "agent": "email",
      "command": "Revise the draft to Sarah: change Friday to Monday",
      "order": 1
    }
  ]
}

EmailAgent returns revised draft to user (new draft in conversation_history)
```

**Key insight:** Draft details are in natural language text in conversation_history, not structured data. Master Agent parses this text when user confirms.

---

## Cross-Account Coordination Pattern

**The multi-account challenge**: Users have work, personal, and side-project email/calendar accounts. They want unified queries across all accounts.

### Pattern: Single SubAgent Call with Account Array

**Master Agent doesn't create multiple commands** - it passes multi-account intent to SubAgent in natural language.

**Example: Cross-Account Email Search**

```
User: "Show me all emails from today across all my accounts"

Master Agent Prompt 1:
→ Detects multi-account intent ("across all")
→ Creates command: "Find all emails from today across all connected accounts"

EmailAgent receives: "Find all emails from today across all connected accounts"

EmailAgent Prompt 1:
→ Sees "all connected accounts" in command
→ Has access to user_context.email_accounts: ["work@company.com", "personal@gmail.com", "consulting@domain.com"]
→ Creates tool_call_list:
   {
     tool: "search_emails",
     params: {
       query: "after:today",
       account_ids: ["work@company.com", "personal@gmail.com", "consulting@domain.com"]
     },
     order: 1
   }

Tool returns unified results from all 3 accounts

EmailAgent Prompt 2:
→ Result: 24 emails (12 work, 8 personal, 4 consulting)
→ Update working_data:
   {
     total_emails: 24,
     by_account: {
       "work@company.com": 12,
       "personal@gmail.com": 8,
       "consulting@domain.com": 4
     }
   }

→ Natural language response:
   "You have 24 emails from today across 3 accounts:

   Work (12 emails):
   • Client meeting notes from Sarah
   • Q4 budget review
   ... (top 5)

   Personal (8 emails):
   • Bank statement
   • Newsletter from TechCrunch
   ... (top 3)

   Consulting (4 emails):
   • Invoice from client
   ... (all 4)"
```

**Master Agent receives only the natural language summary**, not the internal account breakdown.

### Pattern: Account-Specific Queries

**User specifies account explicitly:**

```
User: "Show me work emails only from today"

Master Agent Prompt 1:
→ Detects account filter ("work emails")
→ Command: "Find emails from today in work account only"

EmailAgent Prompt 1:
→ Filters user_context.email_accounts to work account
→ Creates search with account_ids: ["work@company.com"]
```

### Pattern: Cross-Account Calendar Conflicts

```
User: "Do I have conflicts between my calendars?"

Master Agent Prompt 1:
→ Multi-domain query (requires CalendarAgent)
→ Command: "Check for overlapping events across all calendars"

CalendarAgent Prompt 1:
→ Creates tool_call_list:
   {
     tool: "list_events",
     params: {
       start: today,
       end: end_of_week,
       calendar_ids: ["work_calendar", "personal_calendar"]
     },
     order: 1
   }

CalendarAgent Prompt 2:
→ Analyzes all events for time overlaps
→ Finds: 2pm Tuesday - work meeting conflicts with dentist appointment
→ Returns: "You have 1 conflict on Tuesday at 2pm: 'Product Review' (work) overlaps with 'Dentist' (personal)"
```

**Key principle:** Tools accept `account_ids` or `calendar_ids` arrays. SubAgent reasons about which accounts to query based on Master Agent's natural language command.

---

## Bulk Operations Pattern

**The bulk challenge**: "Archive all newsletters from today" could be 50+ emails. Need confirmation before executing.

### Core Pattern: Search → Accumulate → Propose (Write) or Return (Read)

**Bulk is just "Regular Operation × N"** - no special bulk mode. SubAgent internally handles the loop.

### Example: Bulk Archive with Confirmation

**Turn 1: Search & Preview**

```
User: "Archive all newsletters from today"

Master Agent Prompt 1:
→ Detects WRITE bulk operation
→ Command: "Find all newsletters from today and prepare to archive them"

EmailAgent Prompt 1:
→ Creates tool_call_list:
   [
     {tool: "search_emails", params: {query: "category:newsletters after:today"}, order: 1}
   ]

EmailAgent executes: search_emails → 23 newsletters found

EmailAgent Prompt 2:
Step 1 - Result Analysis:
Found 23 newsletters from today

Step 2 - Information Extraction:
Update working_data:
{
  newsletters_found: 23,
  email_ids: ["id1", "id2", ..., "id23"],
  pending_action: {
    type: "bulk_archive",
    count: 23,
    confirmed: false
  },
  preview_senders: ["Morning Brew", "TechCrunch", "Product Hunt", ...]
}

Step 3 - Safety Decision (NEW):
This is a WRITE bulk operation with 23 items.
- Destructive? No (archive is reversible)
- Large count? Medium (23 items)
- Clear selection? Yes (newsletters is specific)
Decision: Require confirmation with preview

Step 4 - Next Action:
Don't add archive tool calls yet. Return preview and wait for confirmation.

Natural language response:
"Found 23 newsletters from today:

• Morning Brew (8:32am)
• TechCrunch Daily (9:15am)
• Product Hunt (10:00am)
... (showing first 10)

Archive all 23? Reply 'yes' to confirm."

EmailAgent returns to Master Agent
Master Agent returns to user
```

**Turn 2: User Confirms**

```
User: "yes"

Master Agent Prompt 1:
→ Scans conversation_history
→ Sees "Archive all 23?" from previous turn
→ Detects confirmation intent
→ Command: "Archive the 23 newsletters we just found"

EmailAgent receives: "Archive the 23 newsletters we just found"

EmailAgent Prompt 1:
→ Checks working_data - still has email_ids and pending_action
→ User confirmed, create archive tool calls:
   [
     {tool: "archive_email", params: {email_id: "id1"}, order: 1},
     {tool: "archive_email", params: {email_id: "id2"}, order: 2},
     ...
     {tool: "archive_email", params: {email_id: "id23"}, order: 23}
   ]

EmailAgent executes all 23 archive calls

EmailAgent Prompt 2:
Step 1 - Result Analysis:
23 successful, 0 failed

Step 2 - Information Extraction:
Update working_data:
{
  archived_count: 23,
  failed_count: 0,
  last_action: {
    type: "bulk_archive",
    count: 23,
    timestamp: "2024-12-29T10:15:00Z",
    affected_items: ["id1", "id2", ..., "id23"],
    reversible: true,
    undo_available_until: "2024-12-29T10:20:00Z"  // 5 min window
  }
}

Step 3 - Next Action:
Complete. Offer undo option.

Natural language response:
"Archived 23 newsletters. Undo?"

EmailAgent returns to Master Agent → User sees confirmation
```

### Alternative: Batch Tool Optimization

**Some tools support native batch operations:**

```javascript
// SubAgent Prompt 1 reasoning:
"I need to archive 23 emails.

Option 1: Call archive_email 23 times
Option 2: Use batch archive_emails tool (checking available_tools...)

Tool 'archive_emails' supports batch: true
Use batch for efficiency."

// Creates single tool call:
{
  tool: "archive_emails",
  params: {email_ids: ["id1", ..., "id23"]},
  order: 1
}
```

This is **emergent optimization** from chain-of-thought, not hardcoded logic.

### Example: User Modifies Bulk Request Mid-Flight

```
User: "Archive all automated emails from last week"

EmailAgent finds 156 emails, returns preview:
"Found 156 automated emails:
• GitHub notifications (89)
• Jira updates (34)
• Build reports (21)
• Other automated (12)

Some might be important (e.g., failed builds).
Archive all 156? Reply 'yes' to confirm."

User: "actually just archive the GitHub ones"

Master Agent Prompt 1:
→ Not a confirmation, user is modifying request
→ Command: "Archive only the 89 GitHub notification emails from the previous search"

EmailAgent Prompt 1:
→ Checks working_data - has breakdown by category
→ Filters email_ids to GitHub subset only
→ Creates archive calls for 89 emails (not 156)

EmailAgent executes → Archives 89

EmailAgent Prompt 2:
Returns: "Archived 89 GitHub notifications from last week.

The other 67 automated emails (Jira, builds, etc.) remain in your inbox.

Undo?"
```

**Key insight:** working_data preserves email breakdown, enabling user to refine bulk operation mid-flow.

---

## Safety Patterns

**The safety principle**: All write commands follow preview → confirm → execute → undo. Safety emerges from chain-of-thought reasoning, not hardcoded rules.

### Safety Pattern 1: Preview Before Execute

**Already in your architecture!** (Write Command Flow, lines 432-525)

All write commands return natural language description in Turn 1, wait for confirmation in Turn 2.

**Extends to bulk operations** as shown above.

### Safety Pattern 2: Destructive Action Confirmation

**SubAgent Prompt 2 reasons about risk:**

```
EmailAgent Prompt 2 - Chain of Thought:

Step 3 - Safety Decision (for write operations):
Is this action:
- Reversible? (Archive = yes, Delete = no, Send = no)
- High impact? (Count? Who's involved? External recipients?)
- Ambiguous selection? (Clear criteria or vague?)

Examples:

Action: Archive 5 emails
→ Reversible ✓, Low count ✓, Clear selection ✓
→ Decision: Simple confirmation "Archive these 5?"

Action: Archive 156 automated emails
→ Reversible ✓, High count ⚠️, Ambiguous (might include important) ⚠️
→ Decision: Detailed preview with breakdown, explicit confirmation

Action: Delete 50 emails permanently
→ Irreversible ❌, High count ⚠️
→ Decision: Strong warning + sample preview + explicit typed confirmation

Action: Send email to 20 external clients
→ Irreversible ❌, External recipients ⚠️
→ Decision: Show full draft, list all recipients, require explicit confirmation
```

**Progressive Confirmation Examples:**

```
Low risk (single email):
"Archive this email?"

Medium risk (bulk, reversible):
"Archive 23 newsletters? Reply 'yes' to confirm."

High risk (bulk, ambiguous):
"Found 156 automated emails. Here's the breakdown:
• GitHub (89)
• Jira (34)
• Builds (21)
• Other (12)

Some might be important. Archive all 156?
Reply 'yes 156' to confirm."

Very high risk (irreversible):
"Delete 50 emails permanently? This CANNOT be undone.

Preview of first 10:
• Email from CEO about budget
• Client contract discussion
...

Type 'delete 50' to confirm."
```

**This emerges from SubAgent reasoning**, not hardcoded thresholds like "if count > 10."

### Safety Pattern 3: Undo Mechanism

**Stored in SubAgent's working_data (private context):**

```javascript
working_data: {
  // ... other data ...

  last_action: {
    type: "bulk_archive",
    count: 23,
    timestamp: "2024-12-29T10:15:00Z",
    affected_items: ["id1", "id2", ..., "id23"],
    reversible: true,
    undo_command: "unarchive_emails",  // or "move_to_inbox"
    undo_available_until: "2024-12-29T10:20:00Z"  // 5-minute window
  }
}
```

**Undo Flow:**

```
User: "actually, undo that"

Master Agent Prompt 1:
→ Detects undo intent
→ Command: "Undo the last action (archived 23 newsletters)"

EmailAgent Prompt 1:
→ Checks working_data.last_action
→ Validates timestamp (within 5-minute window?)
→ If valid, creates undo tool calls:
   [
     {tool: "unarchive_email", params: {email_id: "id1"}},
     {tool: "unarchive_email", params: {email_id: "id2"}},
     ...
   ]

EmailAgent executes undo

EmailAgent Prompt 2:
Returns: "Unarchived 23 newsletters. They're back in your inbox."
```

**Time window check (SubAgent Prompt 1 reasoning):**

```
User wants to undo. Checking last_action...
- Timestamp: 2024-12-29T10:15:00Z
- Current time: 2024-12-29T10:17:00Z
- Elapsed: 2 minutes
- Undo window: 5 minutes
- Status: WITHIN WINDOW ✓
- Proceed with undo
```

Or if too late:

```
- Elapsed: 2 hours
- Status: OUTSIDE WINDOW ❌
- Return: "Sorry, undo is only available for 5 minutes after an action."
```

### Safety Pattern 4: Graceful Failures

**SubAgent Prompt 2 handles partial failures:**

```
EmailAgent Prompt 2 - After bulk archive:

Step 1 - Result Analysis:
Attempted to archive 23 emails
Results: 21 successful, 2 failed

Failed emails:
- Email ID "abc123": Permission denied (admin-locked)
- Email ID "def456": Cannot archive (legal hold)

Step 2 - Information Extraction:
working_data: {
  archived_count: 21,
  failed_count: 2,
  failed_details: [
    {email_id: "abc123", from: "CEO", subject: "Q4 Strategy", reason: "admin-locked"},
    {email_id: "def456", from: "Legal", subject: "Contract Review", reason: "legal hold"}
  ]
}

Step 3 - Next Action:
Partial success. User needs context about failures.

Natural language response:
"Archived 21 of 23 newsletters.

Could not archive:
• Email from CEO: Q4 Strategy (locked by admin)
• Email from Legal: Contract Review (legal hold)

These 2 emails remain in your inbox."
```

**Key:** SubAgent provides **context about failures**, not just "error: operation failed."

### Safety Pattern 5: Ambiguity Handling

**SubAgent Prompt 1 detects risky ambiguity:**

```
Command from Master: "Archive all emails from Sarah"

EmailAgent Prompt 1 reasoning:
"All emails from Sarah" is potentially HUGE.
- Could be 1000+ emails spanning years
- User probably means "recent emails from Sarah"
- This is dangerously ambiguous for bulk operation

Decision: CLARIFY before searching

Output:
{
  "status": "needs_clarification",
  "clarification": {
    "question": "Do you mean all emails from Sarah ever, or from a specific time period?",
    "suggestions": [
      "All emails from Sarah from this week",
      "All unread emails from Sarah",
      "All emails from Sarah from last month"
    ]
  }
}
```

**Natural language response:**

```
"Do you mean:
1. All emails from Sarah ever (could be hundreds)
2. Recent emails from Sarah (this week)
3. Unread emails from Sarah

Which did you mean?"
```

### Safety Pattern 6: Undo Affordance

**After every write action, offer undo:**

```
Simple write:
"Sent reply to Jeff. Undo?"

Bulk write:
"Archived 23 newsletters. Undo?"

Complex multi-step:
"Sent reply to Jeff and scheduled meeting for Tuesday 2pm. Undo?"
```

User can say: "undo", "wait undo that", "actually nevermind", etc.

Master Agent Prompt 1 detects these variations and routes to undo flow.

### Working_Data Schema for Safety

**SubAgent maintains safety metadata (private internal context):**

```javascript
working_data: {
  // Regular query data
  emails_found: 23,
  email_ids: [...],

  // Safety tracking for write operations
  pending_action: {
    type: "bulk_archive",
    count: 23,
    confirmed: false,
    risk_level: "medium",  // assessed by Prompt 2 reasoning
    preview_shown: true,
    requires_explicit_confirmation: true
  },

  last_action: {
    type: "bulk_archive",
    count: 23,
    timestamp: "2024-12-29T10:15:00Z",
    affected_items: ["id1", ..., "id23"],
    reversible: true,
    undo_command: "unarchive_emails",
    undo_available_until: "2024-12-29T10:20:00Z"
  }
}
```

**This is private SubAgent context.** Master Agent only sees natural language: "Archived 23 newsletters. Undo?"

---

## SubAgent Prompt 1: Command Interpretation & Tool Call List Creation

### Purpose

Transform Master Agent's natural language command into a **list of tool calls**. Create the initial tool execution plan.

### Input (SubAgent's Internal Context)

```javascript
{
  // Command from Master Agent (natural language string)
  command: "Find emails from Sarah about Q4 Budget from last week",

  // Available tools (subset shown, see "Available Tools" section for full list)
  available_tools: [
    {
      name: "search_contacts",
      params: {query: "string"},
      description: "Search for contacts by name or email"
    },
    {
      name: "search_emails",
      params: {query: "string"},
      description: "Search emails using Gmail query syntax"
    },
    {
      name: "get_email_thread",
      params: {thread_id: "string"},
      description: "Get full email thread with all replies and timestamps"
    },
    {
      name: "reply_to_email",
      params: {message_id: "string", body: "string"},
      description: "Send a reply to an email"
    }
  ],

  // User context (passed from Master Agent)
  user_context: {
    work_account: "john@company.com",
    current_date: "2024-12-29"
  },

  // SubAgent's working data (initially empty)
  working_data: {}
}
```

### Prompt Structure

```
You are an ActionAgent. The Master Agent sent you a command. Your job is to plan a LIST OF TOOL CALLS to execute sequentially.

Your internal context is private. You will return a natural language response to Master Agent.

# Chain of Thought Process

1. COMMAND INTERPRETATION
   - What am I being asked to do?
   - What data do I need?
   - What do I have vs. what must I discover?
   - Is this a read query or write operation?

2. TOOL CALL LIST PLANNING
   - Which tools provide the data I need?
   - What's the dependency order?
   - What parameters can I set now vs. later?
   - For cross-account queries: Which account_ids should I include?

3. PARAMETER INITIALIZATION
   - For first tool, what parameters can I set immediately?
   - What will come from tool results?

4. EXECUTION STRATEGY
   - What's the expected flow?
   - Is this a write operation? Should I plan for confirmation stage?
   - Estimate scope (single vs. bulk operation)
   - What could go wrong?
   - The list may be modified after each execution

# Output Format

{
  "tool_call_list": [
    {
      "tool": "contact_lookup",
      "params": {"name": "Sarah"},
      "reason": "Resolve 'Sarah' to email address",
      "order": 1
    },
    {
      "tool": "gmail_search",
      "params": {
        "query": "from:{email} subject:'Q4 Budget Review' after:2024-12-14 before:2024-12-16",
        "account_ids": ["{user_account}"]
      },
      "reason": "Find the specific email thread",
      "order": 2
    },
    // ... more tools
  ],
  "next_tool_order": 1
}
```

### Chain-of-Thought Example

**Command:** "Find emails from Sarah about Q4 Budget from last week"

```
Step 1 - Command Interpretation:
Need to find emails matching: sender (Sarah), topic (Q4 Budget), timeframe (last week).

Data needed:
- Sarah's email address
- Search query with topic + date filter

What I have:
- Sender name: "Sarah"
- Topic: "Q4 Budget"
- Timeframe: "last week" → Dec 22-28 (if today is Dec 29)

What I must discover:
- Sarah's email address → search_contacts

Step 2 - Tool Call List Planning:
Sequence:
1. search_contacts("Sarah") → get email address
2. search_emails(from:email, keywords, date range) → get matching emails

Step 3 - Parameter Initialization:
Tool 1: query = "Sarah" ✓
Tool 2: query needs email from Tool 1, date filter based on "last week"

Step 4 - Execution Strategy:
Expected: search_contacts → 1 Sarah → search_emails → N emails matching criteria

Potential issues (handle in Prompt 2):
- Multiple Sarahs → clarification or search all Sarah emails
- No contact found → try searching emails by first name only
- No emails match → try broader query without exact subject
```

**Output (stored in SubAgent's internal context):**
```json
{
  "tool_call_list": [
    {
      "tool": "search_contacts",
      "params": {"query": "Sarah"},
      "order": 1
    },
    {
      "tool": "search_emails",
      "params": {
        "query": "from:{email} (Q4 OR budget OR quarterly) after:2024-12-22 before:2024-12-28"
      },
      "order": 2
    }
  ],
  "next_tool_order": 1
}
```

**This tool_call_list is INTERNAL** - Master Agent never sees it.

---

## SubAgent Prompt 2: Tool Reassessment & Tool Call List Modification

### Purpose

After each tool execution:
1. Analyze raw tool results
2. Extract essential info into working_data
3. Modify the tool_call_list if needed
4. Decide: continue, complete, or ask clarification

**Critical**: This prompt filters tool results to keep working_data lean AND adapts the plan.

### Input (SubAgent's Internal Context)

```javascript
{
  original_command: "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15",

  // Tool call list with execution status
  tool_call_list: [
    {
      tool: "contact_lookup",
      params: {name: "Sarah"},
      order: 1,
      status: "completed"
    },
    {
      tool: "gmail_search",
      order: 2,
      status: "pending"
    },
    // ... more
  ],

  // Latest tool execution (raw result - LARGE)
  latest_tool_execution: {
    tool: "contact_lookup",
    params: {name: "Sarah"},
    raw_result: {
      success: true,
      data: {
        contacts: [
          {
            id: "contact_123",
            name: "Sarah Chen",
            email: "sarah@company.com",
            title: "VP Finance",
            department: "Finance",
            phone: "+1-555-0123",
            office: "Building 2",
            last_contact: "2024-12-27",
            relationship: "manager",
            notes: "Weekly 1:1s on Fridays",
            // ... many more fields
          },
          {
            id: "contact_456",
            name: "Sarah Johnson",
            email: "sjohnson@clientcorp.com",
            title: "Account Manager",
            company: "ClientCorp",
            // ... many more fields
          }
        ],
        total_found: 2
      }
    }
  },

  // Working data accumulated so far
  working_data: {}
}
```

### Prompt Structure

```
You are an ActionAgent executing a command. You just executed a tool and received results.

Your internal context is private. You will eventually return a natural language response to Master Agent.

# Chain of Thought Process

1. RESULT ANALYSIS
   - What did this tool reveal?
   - Successful, empty, ambiguous, or error?
   - Key intelligence gained?

2. INFORMATION EXTRACTION (CRITICAL FILTERING)
   - What are the ESSENTIAL facts? (not everything!)
   - What's needed for next tool?
   - What can I discard? (metadata, redundant info)
   - UPDATE working_data with ONLY essentials

3. SAFETY DECISION (for write operations)
   - Is this a write operation that needs user confirmation?
   - Assess risk: Reversible? High impact? Ambiguous selection?
   - What level of confirmation is needed?
   - What preview should I show the user?
   - Should I store this in pending_action for Turn 2 execution?

4. TOOL LIST MODIFICATION ASSESSMENT
   - Does remaining tool_call_list still make sense?
   - UPDATE parameters for upcoming tools?
   - ADD new tools (different approach)?
   - REMOVE tools (already have what I need)?
   - For write operations: Add execution tools ONLY if already confirmed

5. NEXT ACTION DECISION
   - Continue to next tool?
   - Complete and generate natural language response?
   - Ask for clarification?
   - Return preview and wait for confirmation?

# Output Format

## If continuing:

{
  "continue_execution": true,
  "status": "in_progress",

  "working_data_updates": {
    // ONLY essential facts to add to working_data
    "sarah_email": "sarah@company.com",
    "contact_resolved": true
  },

  "tool_list_modifications": [
    {
      "action": "update",
      "tool_order": 2,
      "updated_params": {
        "query": "from:sarah@company.com subject:'Q4 Budget Review' after:2024-12-14 before:2024-12-16"
      }
    }
  ],

  "next_tool_order": 2
}

## If need clarification:

{
  "continue_execution": false,
  "status": "needs_clarification",

  "clarification": {
    "question": "Which Sarah did you mean?",
    "options": [
      "Sarah Chen (manager, sarah@company.com)",
      "Sarah Johnson (client, sjohnson@clientcorp.com)"
    ]
  }
}

## If complete:

{
  "continue_execution": false,
  "status": "complete",

  "natural_language_response": "I've drafted a reply to Sarah Chen's Q4 Budget Review email from Dec 15. The draft addresses her questions about the timeline and includes the updated figures she requested. You can review and send it from your drafts folder."
}
```

### Chain-of-Thought Example 1: Ambiguous Result → Clarification

**Tool executed:** search_contacts("Sarah")
**Raw result:** 2 contacts found (see large raw_result above)

```
Step 1 - Result Analysis:
search_contacts succeeded but returned 2 contacts:
- Sarah Chen (manager)
- Sarah Johnson (client)

This is AMBIGUOUS. Cannot proceed.

Step 2 - Information Extraction:
From the large raw_result with many fields, extract ONLY:
- 2 Sarahs found
- Sarah Chen: manager, sarah@company.com, last contact 2 days ago
- Sarah Johnson: client, sjohnson@clientcorp.com, last contact 1 week ago

Discard: phone, office, notes, all other metadata (don't need for clarification)

Update working_data:
{
  "contact_lookup_ambiguous": true,
  "sarah_options": [
    {name: "Sarah Chen", role: "manager", email: "sarah@company.com"},
    {name: "Sarah Johnson", role: "client", email: "sjohnson@clientcorp.com"}
  ]
}

Step 3 - Tool List Modification Assessment:
Cannot continue with current plan. Need user clarification.
Pause tool execution.

Step 4 - Next Action Decision:
Return clarification request to Master Agent.
```

**Output:**
```json
{
  "continue_execution": false,
  "status": "needs_clarification",

  "clarification": {
    "question": "Which Sarah did you mean?",
    "options": [
      "Sarah Chen (manager, sarah@company.com) - last contact 2 days ago",
      "Sarah Johnson (client, sjohnson@clientcorp.com) - last contact 1 week ago"
    ]
  }
}
```

**SubAgent returns to Master Agent (natural language string):**
```
"I found 2 contacts named Sarah. Which one did you mean?

1. Sarah Chen (manager, sarah@company.com) - last contact 2 days ago
2. Sarah Johnson (client, sjohnson@clientcorp.com) - last contact 1 week ago"
```

**Master Agent receives ONLY this natural language string.** It doesn't see the internal tool_call_list, working_data, or raw_result.

### Chain-of-Thought Example 2: No Results → Strategy Change

**Tool executed:** search_contacts("Sarah")
**Raw result:** 0 contacts found

```
Step 1 - Result Analysis:
search_contacts returned 0 results. Sarah not in saved contacts.

But user is asking about "Sarah's email from Dec 15", implying Sarah has emailed before.
She's probably in email history even if not in contacts.

Step 2 - Information Extraction:
Update working_data:
{
  "contact_lookup_failed": true,
  "trying_fallback": "email_search"
}

No other data to extract from empty result.

Step 3 - Tool List Modification Assessment:
Current plan assumed search_contacts would return an email. It didn't.

MODIFY tool_call_list:
- REMOVE tool 2 (depends on email address from contacts)
- ADD new search_emails that searches by first name only

New tool:
{
  tool: "search_emails",
  params: {
    query: "(from:Sarah OR to:Sarah) (Q4 OR budget OR quarterly) after:2024-12-22 before:2024-12-28"
  },
  reason: "Contact search failed, searching email history by first name",
  order: 2
}

Step 4 - Next Action Decision:
Continue with modified tool list.
```

**Output:**
```json
{
  "continue_execution": true,
  "status": "in_progress",

  "working_data_updates": {
    "contact_lookup_failed": true,
    "trying_fallback": "email_search_by_name"
  },

  "tool_list_modifications": [
    {
      "action": "replace",
      "remove_orders": [2, 3, 4],
      "add_tools": [
        {
          "tool": "search_emails",
          "params": {
            "query": "(from:Sarah OR to:Sarah) (Q4 OR budget OR quarterly) after:2024-12-22 before:2024-12-28"
          },
          "order": 2
        }
      ]
    }
  ],

  "next_tool_order": 2
}
```

**SubAgent continues execution internally.** Master Agent doesn't see this modification - it's happening inside the SubAgent's private context.

### Chain-of-Thought Example 3: Success → Update & Continue

**Tool executed:** search_contacts("Sarah") after user clarified "the manager"
**Raw result:** 1 contact found (Sarah Chen with many fields)

```
Step 1 - Result Analysis:
search_contacts succeeded. Found 1 contact: Sarah Chen.

Step 2 - Information Extraction:
From the raw result with 15+ fields, extract ONLY what's needed:

Update working_data:
{
  "sarah_email": "sarah@company.com",
  "contact_resolved": true
}

Discard: title, department, phone, office, notes, last_contact, relationship, id
(Not needed for email search)

Step 3 - Tool List Modification Assessment:
Next tool (order 2) is search_emails with placeholder:
- query: "from:{email} (Q4 OR budget)..."

UPDATE parameter with actual email:
- query: "from:sarah@company.com (Q4 OR budget OR quarterly) after:2024-12-22 before:2024-12-28"

Step 4 - Next Action Decision:
Continue to next tool with updated parameters.
```

**Output:**
```json
{
  "continue_execution": true,
  "status": "in_progress",

  "working_data_updates": {
    "sarah_email": "sarah@company.com",
    "contact_resolved": true
  },

  "tool_list_modifications": [
    {
      "action": "update",
      "tool_order": 2,
      "updated_params": {
        "query": "from:sarah@company.com (Q4 OR budget OR quarterly) after:2024-12-22 before:2024-12-28"
      }
    }
  ],

  "next_tool_order": 2
}
```

**SubAgent internal context now has:**
```javascript
{
  working_data: {
    sarah_email: "sarah@company.com",
    contact_resolved: true
  },
  tool_call_list: [
    {tool: "search_contacts", order: 1, status: "completed"},
    {
      tool: "search_emails",
      params: {
        query: "from:sarah@company.com (Q4 OR budget OR quarterly) after:2024-12-22 before:2024-12-28"
      },
      order: 2,
      status: "pending"
    }
  ]
}
```

**SubAgent executes next tool.** Master Agent still doesn't see any of this - it's waiting for the final natural language response.

### Chain-of-Thought Example 4: Multi-Email Summary Synthesis

**Command:** "Catch me up on the Johnson project"

**SubAgent executes multiple searches and email reads:**
```
Tool 1: search_emails(query: "Johnson project") → 12 emails
Tool 2: get_email(id: email_1) → Full content
Tool 3: get_email(id: email_2) → Full content
...
Tool 8: get_email(id: email_7) → Full content (recent ones)
```

**SubAgent Prompt 2 - Synthesizing accumulated data:**

```
Step 1 - Result Analysis:
Executed 8 tools total. Found 12 emails about Johnson project, read 7 most recent.

Step 2 - Information Extraction & Accumulation:
As I read each email, I've been updating working_data with key facts:

working_data (accumulated across all tool executions):
{
  "project_name": "Johnson Corp Integration",
  "status": "delayed",
  "key_decisions": [
    "Switched vendors on Dec 20 due to pricing",
    "Timeline pushed from Jan 15 to Feb 1",
    "Budget increased by $25k"
  ],
  "current_blocker": "Waiting on Johnson's legal team for contract review",
  "next_steps": "Contract expected by Jan 5, then 2-week implementation",
  "key_people": ["Sarah (PM)", "Mike (tech lead)", "Jennifer at Johnson Corp"],
  "last_update": "Dec 28 - contract still in legal review"
}

Step 3 - Tool List Modification Assessment:
All relevant emails read. Have enough context to summarize.

Step 4 - Next Action Decision:
COMPLETE. Generate natural language summary from accumulated working_data.

Compose response:
"The Johnson Corp integration project is currently delayed. Key updates:

**Timeline**: Originally planned for Jan 15, now targeting Feb 1 launch

**Recent Changes**:
- Switched vendors on Dec 20 due to pricing issues
- Budget increased by $25k to accommodate new vendor
- Timeline pushed by 2 weeks

**Current Status**: Waiting on Johnson's legal team to complete contract review.
Expected by Jan 5, then 2-week implementation window.

**Next Steps**: Contract signature → 2-week implementation → Feb 1 launch

**Key Contacts**: Sarah (PM), Mike (tech lead), Jennifer at Johnson Corp

Last update from Dec 28 indicates contract still in legal review."
```

**Key insight:** SubAgent's working_data accumulated facts across 7 email reads. Prompt 2 synthesizes this accumulated context into coherent summary. No separate summarization tool needed - it's emergent from SubAgent intelligence.

---

### Chain-of-Thought Example 5: Thread Analysis for Response Tracking

**Command:** "Show me emails I haven't responded to from clients this week"

**SubAgent Prompt 1 reasoning:**
```
To find unanswered emails:
1. Search for client emails this week
2. For each, get full thread to check if user replied
3. Filter to only threads where user hasn't responded

This requires get_email_thread to analyze conversation flow.
```

**Tool execution:**
```
Tool 1: search_emails(query: "from:@clientdomain.com after:2024-12-22") → 8 emails
Tool 2: get_email_thread(thread_id: thread_1) → Full conversation with timestamps
Tool 3: get_email_thread(thread_id: thread_2) → Full conversation
...
Tool 9: get_email_thread(thread_id: thread_8) → Full conversation
```

**SubAgent Prompt 2 - Analyzing thread data:**

```
Step 1 - Result Analysis:
Retrieved 8 threads. Each thread contains message list with senders and timestamps.

Step 2 - Information Extraction from get_email_thread results:

For thread_1:
Raw result: {
  messages: [
    {from: "client@acme.com", timestamp: "2024-12-23T10:00:00Z"},
    {from: "user@company.com", timestamp: "2024-12-23T14:30:00Z"},
    {from: "client@acme.com", timestamp: "2024-12-24T09:15:00Z"}
  ]
}

Analysis: Last message from client. User replied once but client responded again.
Status: UNANSWERED (client waiting)

For thread_2:
Raw result: {
  messages: [
    {from: "client@widgetco.com", timestamp: "2024-12-22T11:00:00Z"},
    {from: "user@company.com", timestamp: "2024-12-22T16:00:00Z"}
  ]
}

Analysis: Last message from user.
Status: ANSWERED (user responded)

... repeat for all 8 threads ...

Update working_data:
{
  "unanswered_threads": [
    {
      "sender": "client@acme.com",
      "subject": "Q4 Budget Question",
      "last_message_time": "2024-12-24T09:15:00Z",
      "days_waiting": 5
    },
    {
      "sender": "client@newcorp.com",
      "subject": "Contract Amendment",
      "last_message_time": "2024-12-26T14:00:00Z",
      "days_waiting": 3
    },
    // ... 3 more unanswered threads
  ],
  "answered_count": 3
}

Step 3 - Tool List Modification:
All threads analyzed. No more tools needed.

Step 4 - Next Action:
COMPLETE. Generate response listing unanswered emails.
```

**Natural language response:**
```
"You have 5 unanswered emails from clients this week:

1. **Acme Corp** - Q4 Budget Question (Dec 24, 5 days ago)
2. **NewCorp** - Contract Amendment (Dec 26, 3 days ago)
3. **WidgetCo** - Pricing Discussion (Dec 27, 2 days ago)
4. **TechPartners** - Integration Timeline (Dec 28, 1 day ago)
5. **GlobalInc** - Follow-up on Proposal (Dec 28, 1 day ago)

The oldest is from Acme Corp, waiting 5 days for response."
```

**Key insight:** `get_email_thread` provides conversation structure. SubAgent Prompt 2 parses this to determine who replied last and whether user has responded. Enables "unanswered email" queries without hardcoded logic.

---

### Example 6: Complete → Generate Natural Language Response

After executing search and reads:

```
Step 1 - Result Analysis:
Found 5 emails from Sarah about Q4 budget from last week.

Step 2 - Information Extraction:
Update working_data:
{
  "emails_found": 5,
  "sender": "Sarah Chen <sarah@company.com>",
  "topics": ["Q4 budget review", "Budget timeline", "Expense projections"],
  "date_range": "Dec 22-28",
  "most_recent": "Dec 28 - Latest expense projections"
}

Step 3 - Tool List Modification Assessment:
All searches complete. Have all matching emails.

Step 4 - Next Action Decision:
COMPLETE. Generate natural language response listing results.

Compose response:
"Found 5 emails from Sarah Chen about Q4 budget from last week (Dec 22-28):

1. Q4 Budget Review (Dec 22) - Initial review request
2. Budget Timeline Question (Dec 23) - Asking about deadlines
3. Expense Categories (Dec 26) - Clarifying line items
4. Revised Projections (Dec 27) - Updated estimates
5. Latest Expense Projections (Dec 28) - Final numbers

The most recent email from Dec 28 contains the latest expense projections."
```

**Output:**
```json
{
  "continue_execution": false,
  "status": "complete",

  "natural_language_response": "I've drafted a reply to Sarah Chen's Q4 Budget Review email from Dec 15. The draft addresses her questions about the timeline and includes the updated figures she requested. You can review and send it from your drafts folder."
}
```

**SubAgent returns to Master Agent:**
```javascript
const response = "Found 5 emails from Sarah Chen about Q4 budget from last week...";

return response; // Natural language string ONLY
```

**Master Agent receives ONLY this string.** It doesn't see:
- ❌ tool_call_list
- ❌ working_data
- ❌ executed_tools
- ❌ raw tool results
- ❌ email IDs or thread IDs

All of that is SubAgent's private internal context.

---

### Chain-of-Thought Example 7: Multi-Query Strategy for Semantic Search

**Command:** "Find emails where I made commitments that I haven't followed up on"

**SubAgent Prompt 1 reasoning:**
```
This is a complex semantic query. To find unfulfilled commitments:

1. Search MY sent emails (not inbox) for commitment language
2. Look for time-based promises
3. Check if I followed up in subsequent emails
4. Analyze threads to see if commitment was fulfilled

Commitment indicators:
- "I'll...", "I will...", "I'll send..."
- "by [date]", "before [day]"
- "I'll get back to you", "I'll follow up"

Strategy:
- Multiple search queries for different commitment patterns
- Read the emails to extract what was promised
- Check thread to see if promise was kept
```

**Creates tool_call_list:**
```json
[
  {
    "tool": "search_emails",
    "params": {"query": "from:me (I'll send OR I will send OR I'll have)"},
    "order": 1
  },
  {
    "tool": "search_emails",
    "params": {"query": "from:me (by Friday OR by Monday OR by end of week OR by tomorrow)"},
    "order": 2
  },
  {
    "tool": "search_emails",
    "params": {"query": "from:me (I'll get back OR I'll follow up OR I'll circle back)"},
    "order": 3
  }
]
```

**SubAgent Prompt 2 after executing all 3 searches:**
```
Step 1 - Result Analysis:
Query 1: 8 emails where I said "I'll send/have something"
Query 2: 6 emails where I mentioned specific deadlines
Query 3: 12 emails where I promised to follow up

Total: 26 emails (some overlap)

Step 2 - Information Extraction:
Need to read promising emails and check if commitments were kept.

ADD more tools to list:
- get_email(id) for each promising result (read ~10 most recent)
- For each commitment found, get_email_thread to see if I followed up

Step 3 - Tool List Modification:
ADD 10 get_email calls
ADD get_email_thread calls for threads with unfulfilled commitments

[Continues execution...]

After reading emails and threads:

working_data (accumulated):
{
  "commitments_found": 14,
  "fulfilled": 9,
  "unfulfilled": 5,
  "unfulfilled_list": [
    {
      "to": "Jeff",
      "commitment": "Send updated proposal",
      "promised_by": "end of last week",
      "status": "overdue by 3 days",
      "email_date": "Dec 20"
    },
    {
      "to": "Sarah",
      "commitment": "Get back about timeline",
      "promised_by": "Monday",
      "status": "overdue by 1 day",
      "email_date": "Dec 27"
    },
    // ... 3 more
  ]
}

Step 4 - Next Action:
COMPLETE. Generate response listing unfulfilled commitments.
```

**Natural language response:**
```
"Found 5 commitments you haven't followed up on:

1. **To Jeff** (Dec 20) - You said you'd send the updated proposal by end of last week
   → Overdue by 3 days

2. **To Sarah** (Dec 27) - You said you'd get back about the timeline by Monday
   → Overdue by 1 day

3. **To Mike** (Dec 22) - You promised to share the budget numbers before Friday
   → Overdue by 4 days

4. **To Lisa** (Dec 26) - You said you'd follow up on the vendor contract
   → No deadline specified, 3 days since promise

5. **To Client Team** (Dec 23) - You committed to sending meeting notes by EOD
   → Overdue by 5 days

The oldest unfulfilled commitment is to the Client Team from Dec 23."
```

**Key insights:**
- NO hardcoded commitment detection logic
- SubAgent reasoned about commitment patterns and created multiple searches
- SubAgent read actual emails and analyzed content
- SubAgent checked threads to verify if commitments were kept
- Entirely flexible - would work for different phrasings, languages, contexts

---

## Master Agent Prompt 2: Context Update & Command List Modification

### Purpose

After SubAgent returns its natural language response:
1. Absorb the response into Master's understanding
2. Modify remaining command_list if needed
3. Decide: continue to next command or synthesize final user response

### Input (Master Agent's Internal Context)

```javascript
{
  original_query: "What meetings do I have tomorrow that I'm not prepared for?",

  // Command list with execution status
  command_list: [
    {
      agent: "calendar",
      command: "Get all meetings scheduled for tomorrow (Dec 30) and identify which ones lack agendas",
      order: 1,
      status: "completed"
    },
    {
      agent: "email",
      command: "For meetings without agendas, check if there are related emails",
      order: 2,
      status: "pending"
    }
  ],

  // Latest SubAgent response (NATURAL LANGUAGE STRING)
  latest_subagent_response: {
    agent: "calendar",
    response: "You have 8 meetings tomorrow. 3 have agendas, 5 do not:

1. Client call with Acme Corp (2pm) - attendees: Alice Smith
2. Product review (10am) - attendees: entire team
3. 1:1 with Sarah (3pm) - attendees: Sarah Chen
4. Budget discussion (11am) - attendees: finance team
5. Partnership planning (2pm) - attendees: Bob Chen

The 3 meetings with agendas are: Team standup, Executive review, and Engineering sync."
  },

  // Accumulated knowledge (extracted from previous SubAgent responses)
  accumulated_knowledge: {}
}
```

### Prompt Structure

```
You are the Master Agent. A SubAgent returned a natural language response. You must:

1. Extract essential information from the response
2. Assess if remaining command_list needs modification
3. Decide if more commands needed or respond to user

Remember: You only see SubAgent's natural language response, not their internal workings.

# Chain of Thought Process

1. RESPONSE ANALYSIS & EXTRACTION
   - What did the SubAgent discover?
   - Extract key facts from natural language response
   - Update accumulated_knowledge with essentials ONLY
   - Is SubAgent waiting for user confirmation?
   - Did user just confirm or reject an action?
   - Is there an undo request?

2. SAFETY ASSESSMENT (for write operations)
   - Is SubAgent proposing a write action?
   - Is it destructive or reversible?
   - Is the scope clear to user?
   - Did SubAgent already ask for confirmation? (good)
   - Validate user confirmation matches what's being confirmed
   - Check for ambiguous confirmations (e.g., "yes" to risky bulk delete)

3. COMMAND LIST MODIFICATION ASSESSMENT
   - Are there remaining commands?
   - Do they need updating based on what was learned?
   - Should I add/remove commands?

4. COMPLETION ASSESSMENT
   - Can I answer user's query now?
   - Or need more SubAgent information?
   - Is there a pending action waiting for confirmation?
   - Any safety concerns?
   - Any clarification needed?

5. RESPONSE SYNTHESIS (if complete)
   - For pending actions: Present clearly what will happen
   - For confirmations: Extract and validate user intent
   - For completed actions: Confirm what happened + offer undo
   - How to present to user?
   - Format for easy follow-up

# Output Format

## If continuing:

{
  "continue_execution": true,

  "accumulated_knowledge_updates": {
    // Extract essentials from natural language response
    "meetings_without_agendas": 5,
    "meeting_titles": ["Acme client call", "Product review", ...],
    "attendees_by_meeting": {
      "Acme client call": ["Alice Smith"],
      "Product review": ["team"],
      ...
    }
  },

  "command_list_modifications": [
    {
      "action": "update",
      "command_order": 2,
      "updated_command": "For these 5 specific meetings, check emails: 1) Acme client call with Alice Smith, 2) Product review with team, 3) 1:1 with Sarah Chen, 4) Budget discussion with finance, 5) Partnership planning with Bob Chen"
    }
  ],

  "next_command_order": 2
}

## If complete:

{
  "continue_execution": false,

  "user_response": "You have **5 meetings tomorrow** that you're not prepared for:

1. **Client call with Acme Corp** (2pm)
   Attendees: Alice Smith
   Missing: agenda

2. **Product review** (10am)
   Attendees: entire team
   Missing: agenda

[... 3 more]

Would you like me to search for background emails about any of these?"
}
```

### Chain-of-Thought Example: Extracting from Natural Language

**SubAgent response (natural language string):**
```
"You have 8 meetings tomorrow. 3 have agendas, 5 do not:

1. Client call with Acme Corp (2pm) - attendees: Alice Smith
2. Product review (10am) - attendees: entire team
3. 1:1 with Sarah (3pm) - attendees: Sarah Chen
4. Budget discussion (11am) - attendees: finance team
5. Partnership planning (2pm) - attendees: Bob Chen

The 3 meetings with agendas are: Team standup, Executive review, and Engineering sync."
```

```
Step 1 - Response Analysis & Extraction:
The SubAgent (CalendarAgent) found:
- 8 total meetings tomorrow
- 3 have agendas (prepared)
- 5 lack agendas (potentially unprepared)

Extract from natural language:

5 meetings without agendas:
1. "Client call with Acme Corp (2pm)" - Alice Smith
2. "Product review (10am)" - entire team
3. "1:1 with Sarah (3pm)" - Sarah Chen
4. "Budget discussion (11am)" - finance team
5. "Partnership planning (2pm)" - Bob Chen

Update accumulated_knowledge (ONLY essentials):
{
  "total_meetings": 8,
  "meetings_without_agendas": 5,
  "unprepared_meetings": [
    {title: "Client call with Acme Corp", time: "2pm", attendees: ["Alice Smith"]},
    {title: "Product review", time: "10am", attendees: ["team"]},
    {title: "1:1 with Sarah", time: "3pm", attendees: ["Sarah Chen"]},
    {title: "Budget discussion", time: "11am", attendees: ["finance team"]},
    {title: "Partnership planning", time: "2pm", attendees: ["Bob Chen"]}
  ]
}

This is PARTIAL information. I know which meetings lack agendas, but not if they have email context.

Step 2 - Command List Modification Assessment:
Current command list:
- Command 1: CalendarAgent → COMPLETED ✓
- Command 2: EmailAgent → "For meetings without agendas, check if there are related emails"

Command 2 is too VAGUE now. I have specific meeting details.

UPDATE Command 2 to be specific:
"For these 5 specific meetings, check emails from the past week:
1) Acme client call with Alice Smith - search emails from/to Alice about Acme
2) Product review with team - search emails about product or review
3) 1:1 with Sarah Chen - search emails from/to Sarah
4) Budget discussion with finance - search budget emails
5) Partnership planning with Bob Chen - search emails from/to Bob about partnership

Identify which meetings have NO email context."

Step 3 - Completion Assessment:
Cannot answer user yet. User asked "What meetings am I not prepared for?"

I know: 5 meetings lack agendas
I don't know: which have email context

A meeting without agenda but WITH email context might still be "prepared".

Decision: CONTINUE with MODIFIED command

Step 4 - Response Synthesis:
N/A (not complete yet)
```

**Output:**
```json
{
  "continue_execution": true,

  "accumulated_knowledge_updates": {
    "total_meetings": 8,
    "meetings_without_agendas": 5,
    "unprepared_meetings": [
      {"title": "Client call with Acme Corp", "time": "2pm", "attendees": ["Alice Smith"]},
      {"title": "Product review", "time": "10am", "attendees": ["team"]},
      {"title": "1:1 with Sarah", "time": "3pm", "attendees": ["Sarah Chen"]},
      {"title": "Budget discussion", "time": "11am", "attendees": ["finance team"]},
      {"title": "Partnership planning", "time": "2pm", "attendees": ["Bob Chen"]}
    ]
  },

  "command_list_modifications": [
    {
      "action": "update",
      "command_order": 2,
      "updated_command": "For these 5 specific meetings tomorrow, search emails from the past week for context: 1) Acme client call with Alice Smith - search emails from/to Alice about Acme, 2) Product review with team - search emails about product or review, 3) 1:1 with Sarah Chen - search emails from/to Sarah, 4) Budget discussion with finance - search budget emails, 5) Partnership planning with Bob Chen - search emails from/to Bob about partnership. Identify which meetings have NO email context."
    }
  ],

  "next_command_order": 2
}
```

**Master Agent then sends MODIFIED command to EmailAgent:**
```javascript
const response = await EmailAgent.execute(
  "For these 5 specific meetings tomorrow, search emails from the past week for context: 1) Acme client call with Alice Smith - search emails from/to Alice about Acme, 2) Product review with team..."
);
```

**Key point:** Master Agent extracted structured information (meeting list with details) from EmailAgent's natural language response during its chain-of-thought reasoning. This extraction happens IN THE PROMPT, not via structured data passing.

---

## The Complete Flow: Natural Language All The Way

### Example: "Reply to the first email"

**Turn 1:**
```
User: "Show me emails from Sarah"

Master Agent Prompt 1:
→ Creates command: "Find all emails from Sarah"

EmailAgent receives: "Find all emails from Sarah"
EmailAgent Prompt 1: Creates tool_call_list [search_contacts, search_emails]
EmailAgent executes tools (internal context management)
EmailAgent Prompt 2: Filters results, generates response

EmailAgent returns: "Found 5 emails from Sarah Chen about various topics:

1. Q4 Budget Review (Dec 15) - Asking about timeline
2. Project Update (Dec 20) - Status on deliverables
3. Meeting Recap (Dec 22) - Notes from planning session
4. Timeline Question (Dec 24) - When can we finalize?
5. Action Items Follow-up (Dec 28) - Checking on progress

The most recent is from Dec 28."

Master Agent Prompt 2:
→ No more commands
→ Returns to user

User sees: [EmailAgent's response]
```

**Turn 2:**
```
User: "Reply to the first one saying I'll have answers by Friday"

Master Agent Prompt 1:
→ Detects WRITE command
→ Scans conversation_history
→ Extracts: "first one" = "Q4 Budget Review (Dec 15)" from Sarah
→ Creates command for EmailAgent to draft

EmailAgent receives: "Draft a reply to Sarah's Q4 Budget Review email from Dec 15 saying I'll have answers by Friday"
EmailAgent Prompt 1: Creates tool_call_list [search_contacts, search_emails, get_email_thread, compose_body]
EmailAgent executes tools internally
EmailAgent Prompt 2: Composes draft, returns natural language

EmailAgent returns: "I'll send this reply to Sarah Chen:

'Hi Sarah,

Thanks for your email about the Q4 budget review. I'll have answers to your timeline questions by Friday.

Best,
John'

Say 'send it' to confirm."

Master Agent Prompt 2:
→ No more commands (draft stage)
→ Returns EmailAgent's draft to user

User sees: [Draft preview]
```

**Turn 3:**
```
User: "send it"

Master Agent Prompt 1:
→ Scans conversation_history
→ Sees draft from previous turn
→ Detects confirmation
→ Extracts recipient + body from natural language text
→ Creates command to execute

EmailAgent receives: "Send reply to Sarah Chen with body: 'Hi Sarah, Thanks for your email about the Q4 budget review. I'll have answers to your timeline questions by Friday. Best, John'"
EmailAgent executes: reply_to_email()

EmailAgent returns: "Sent reply to Sarah Chen <sarah@company.com>"

User sees: "Sent reply to Sarah Chen"
```

**Information flow:**
- User → Master: Natural language query
- Master → SubAgent (EmailAgent or CalendarAgent): Natural language command
- SubAgent (internal): Tool calls, working_data, filtering
- SubAgent → Master: Natural language response
- Master (internal): Extract info from response, update accumulated_knowledge
- Master → User: Natural language response

**No structured data crosses agent boundaries.** Only natural language strings.

**For write commands:**
- Draft stage: SubAgent composes draft, returns as natural language text
- Confirmation stage: Master extracts details from conversation_history text, sends execute command to SubAgent

---

## Context Efficiency in Action

### Example: Multi-Step Query

**User query:** "What meetings do I have tomorrow that I'm not prepared for?"

**Master Agent Prompt 1** (Intent & Command List Creation)
- Input: 200 tokens (query + user context)
- Chain of thought: 300 tokens (internal, not passed)
- Output: command_list (internal context)
- Sends to CalendarAgent: ~50 tokens (command string)

**CalendarAgent Prompt 1** (Tool Planning - Internal)
- Receives: 50 tokens (command string)
- Internal context: 100 tokens (tools, user_context)
- Chain of thought: 200 tokens (not saved)
- Output: tool_call_list (internal)

**CalendarAgent executes:** calendar_get_events
- Raw result: 1200 tokens (8 meeting objects, all fields)

**CalendarAgent Prompt 2** (Reassessment - Internal)
- Input: 1200 tokens (raw result)
- Chain of thought: 400 tokens (filtering logic - not saved)
- Updates working_data: 180 tokens (5 meetings, essential fields only)
- **Context reduction: 1200 → 180 tokens (85% reduction)**
- Generates response: 200 tokens (natural language)

**CalendarAgent returns to Master:** 200 tokens (natural language string)
```
"You have 8 meetings tomorrow. 3 have agendas, 5 do not:
1. Client call with Acme Corp (2pm) - attendees: Alice Smith
..."
```

**Master Agent Prompt 2** (Context Update)
- Receives: 200 tokens (natural language response)
- Internal accumulated_knowledge: 150 tokens
- Chain of thought: 300 tokens (extracting from natural language - not saved)
- Updates command_list: modifies Command 2 with specific details
- Sends to EmailAgent: 120 tokens (modified command string)

**EmailAgent Prompt 1** (Tool Planning - Internal)
- Receives: 120 tokens (modified command)
- Creates tool_call_list with 5 searches

**EmailAgent executes:** 5 gmail_search calls
- Raw results: 2800 tokens (30 emails across 5 searches)

**EmailAgent Prompt 2** (Reassessment - Internal)
- Input: 2800 tokens (raw results)
- Chain of thought: 500 tokens (analyzing which meetings have context - not saved)
- Updates working_data: 220 tokens (analysis summary)
- **Context reduction: 2800 → 220 tokens (92% reduction)**
- Generates response: 250 tokens (natural language)

**EmailAgent returns to Master:** 250 tokens (natural language string)
```
"Checked email context for the 5 meetings:

1. Acme client call - Found 5 relevant emails from Alice about the account
2. Product review - No emails found
3. 1:1 with Sarah - Found 2 emails discussing topics
4. Budget discussion - No emails found
5. Partnership planning - No emails found

Meetings without preparation: Product review, Budget discussion, Partnership planning"
```

**Master Agent Prompt 2** (Final Synthesis)
- Receives: 250 tokens (natural language response)
- Internal accumulated_knowledge: 400 tokens total
- Chain of thought: 400 tokens (synthesizing - not saved)
- Generates user response: 300 tokens

**User sees:** 300 tokens (natural language response)

#### Total Context Accounting:

**Without filtering (naive approach):**
- Raw calendar data: 1200 tokens
- Raw email data: 2800 tokens
- Total: 4000+ tokens accumulating

**With filtering + natural language boundaries:**
- Master Agent internal: 400 tokens (accumulated_knowledge)
- CalendarAgent internal: 180 tokens (working_data) - PRIVATE
- EmailAgent internal: 220 tokens (working_data) - PRIVATE
- Communication: Natural language strings (50-250 tokens each)
- **Total exposed context: ~900 tokens**
- **78% reduction while maintaining intelligence**

**Key insight:** SubAgent internal context (working_data, tool_call_list) doesn't bloat Master Agent's context because it's never passed across boundaries. Only natural language responses pass through.

---

## Key Principles Summary

### 1. Agent Boundaries are Natural Language

**Communication:**
- Master → SubAgent: Natural language command string
- SubAgent → Master: Natural language response string
- NO structured data crosses boundaries

**Why this works:**
- Clean abstraction
- LLMs excel at extracting structure from natural language
- Context stays lean (natural language is already filtered/summarized)

### 2. Internal Context is Private

**Each agent maintains:**
- Master Agent: command_list, accumulated_knowledge
- SubAgent: tool_call_list, working_data, executed_tools

**These never cross boundaries.**

### 3. The List Pattern

**Master Agent:**
- Creates command_list (Prompt 1)
- Modifies command_list after each SubAgent response (Prompt 2)

**SubAgent:**
- Creates tool_call_list (Prompt 1)
- Modifies tool_call_list after each tool execution (Prompt 2)

Both are internal context modifications.

### 4. Chain-of-Thought Stays in the Prompt

- LLM does extensive reasoning
- Reasoning is NOT saved or passed
- Only conclusions pass forward

### 5. Filtering Happens Internally

**SubAgent Prompt 2:**
- Receives raw tool result (1200 tokens)
- Filters to essentials (180 tokens) in working_data
- Generates natural language response (200 tokens)
- Master Agent sees ONLY the 200 token response

### 6. Information Extraction from Natural Language

**Master Agent Prompt 2:**
- Receives natural language response
- During chain-of-thought, extracts structured info
- Updates accumulated_knowledge with essentials
- This happens IN THE PROMPT, not via data passing

### 7. Fallbacks Emerge from Reassessment

**SubAgent Prompt 2:**
```
contact_lookup returns 0 results
→ LLM reasons: "user mentioned Sarah's email, must be in history"
→ Modifies tool_call_list to try email_search instead
→ This is LLM intelligence, not hardcoded fallback
```

### 8. Plans Adapt to Reality

- Initial plans are educated guesses
- Reassessment prompts modify plans based on actual results
- Eliminates need for perfect upfront planning
- All modifications happen in internal context

### 9. Semantic Intelligence Through Chain-of-Thought

**No hardcoded patterns.** The system has zero hardcoded logic for:
- Sentiment analysis (urgency, frustration, politeness)
- Commitment detection ("I'll do X by Friday")
- Semantic search (finding emails "about the product launch" without exact keywords)
- Pattern recognition (multiple follow-ups, waiting state, etc.)

**How it works:**
- Master Agent sends **high-level intent**: "Find emails the user may be forgetting"
- SubAgent Prompt 1 **reasons about execution strategy**: "I should search for recent emails with commitment language, read threads where user replied last, check for deadlines mentioned..."
- SubAgent creates **multiple tool calls** based on reasoning (not templates)
- SubAgent Prompt 2 **synthesizes results** from accumulated data

**Example - "What am I forgetting?":**
```
Master → SubAgent: "Find emails where the user made commitments that may not be fulfilled"

SubAgent Prompt 1 reasoning:
"To find forgotten commitments, I should:
1. Search sent emails for commitment language patterns
2. Check recent threads where user promised something
3. Look for deadline mentions in user's replies
4. Cross-reference with calendar for time-based commitments"

Creates tool_call_list:
- search_emails(query: "from:me (I'll|I will|I'll send|I'll have)")
- search_emails(query: "from:me (by Friday|by end of week|by tomorrow)")
- list_events(range: this_week) // to find meeting commitments
- get_email_thread() calls for promising threads

SubAgent Prompt 2:
Reads each result, extracts commitments into working_data, checks if fulfilled,
generates natural language response listing unfulfilled commitments.
```

**Example - "Show me frustrated follow-ups":**
```
Master → SubAgent: "Find emails where senders are frustrated about lack of response"

SubAgent Prompt 1 reasoning:
"Frustration indicators: multiple follow-ups, language like 'still waiting',
'haven't heard back', '3rd time reaching out', urgent tone"

Creates tool_call_list:
- search_emails(query: "still waiting OR haven't heard OR following up again")
- search_emails(query: "second time OR third time OR multiple times")
- For each result → get_email_thread() to check if it's actually a follow-up

SubAgent Prompt 2:
Analyzes thread history, counts follow-ups, detects tone from language,
filters to only genuinely frustrated senders, responds with list.
```

This approach is **infinitely flexible** - supports any query pattern without code changes.

### 10. Multi-Query Strategies for Semantic Search

**SubAgents create multiple search queries** to handle conceptual requests.

**Example - "Find emails about the product launch":**
```
SubAgent Prompt 1 reasoning:
"Product launch could be mentioned many ways. I should search for:
- Explicit mentions: 'product launch'
- Related terms: 'release', 'go-live', 'launch date'
- Product name: [if known from context]
- Related activities: 'launch plan', 'launch timeline', 'pre-launch'"

Creates tool_call_list:
- search_emails(query: "product launch")
- search_emails(query: "product release OR go-live")
- search_emails(query: "launch timeline OR launch plan")
- search_emails(query: "[product_name]") // if known

SubAgent Prompt 2:
Deduplicates results, synthesizes into response.
```

**No vector search needed for MVP.** Chain-of-thought reasoning generates synonym queries.

---

## Context Size Comparison

### Traditional Approach (No Filtering, Structured Passing):
```
User query (200 tokens)
↓
CalendarAgent returns structured data (1200 tokens)
→ Master Agent context: 1400 tokens
↓
EmailAgent returns structured data (2800 tokens)
→ Master Agent context: 4200 tokens
↓
Response
→ Total: 4500 tokens
```

### This Architecture (Filtered + Natural Language Boundaries):
```
User query (200 tokens)
↓
CalendarAgent returns natural language (200 tokens)
→ Master Agent context: 400 tokens (accumulated_knowledge only)
→ CalendarAgent internal: 180 tokens (private)
↓
EmailAgent returns natural language (250 tokens)
→ Master Agent context: 650 tokens (accumulated_knowledge only)
→ EmailAgent internal: 220 tokens (private)
↓
Response (300 tokens)
→ Master Agent total: 950 tokens
→ SubAgent contexts: private, never seen by Master
```

**For complex multi-step queries:**
- Traditional: 10,000+ tokens in Master Agent context
- This architecture: 1,500-2,000 tokens in Master Agent context
- **80-85% reduction**
- SubAgent internal contexts are bounded and private

---

## Conclusion

The intelligence of this system comes from **4 prompts working in harmony** with **clear context boundaries** and **emergent safety patterns**:

1. **Master Prompt 1**: User intent → command_list (internal) + safety detection
2. **Master Prompt 2**: Natural language responses → accumulated_knowledge → command_list modifications + confirmation handling
3. **SubAgent Prompt 1**: Command → tool_call_list (internal) + cross-account coordination + risk assessment
4. **SubAgent Prompt 2**: Tool results → working_data → tool_call_list modifications + safety decisions → natural language response

**Each agent:**
- Maintains private internal context (working_data, pending_action, last_action)
- Communicates only via natural language
- Filters aggressively before responding
- Modifies plans dynamically based on reality
- Reasons about safety without hardcoded rules

**Key patterns integrated:**
- **Cross-Account Coordination**: Tools accept account_ids arrays, SubAgent reasons about which accounts to query
- **Bulk Operations**: Search → Accumulate → Preview → Confirm → Execute, with user able to refine mid-flight
- **Safety Mechanisms**: Progressive confirmation based on risk assessment, 5-minute undo window, graceful failure handling
- **Write Command Flow**: Preview (Turn 1) → User confirms (Turn 2) → Execute + offer undo

**The result:** A system that handles complex queries with semantic understanding, adaptive planning, minimal context bloat, and user-safe write operations—all while maintaining clean abstraction boundaries.

**The magic is in the prompts and the boundaries, not the tools.** Safety, bulk operations, and cross-account coordination all emerge from chain-of-thought reasoning within the existing 4-prompt architecture.

---

## Advanced Query Patterns: How Chain-of-Thought Handles Complexity

The architecture's power comes from **LLM reasoning about execution strategy**, not hardcoded query templates.

### Pattern 1: Frustrated Follow-Ups

**User query:** "Show me frustrated follow-ups"

**Master → SubAgent command:** "Find emails where senders are frustrated about lack of response"

**SubAgent Prompt 1 reasoning:**
```
Frustration indicators in email:
- Multiple follow-ups in same thread
- Language: "still waiting", "haven't heard back", "following up again"
- Urgency escalation: "URGENT", "ASAP", "need response"
- Formality shift: getting more terse or formal

Strategy:
1. Search for explicit frustration language
2. For matches, get full thread to count follow-ups
3. Analyze if user has responded
4. Filter to genuinely frustrated (not just friendly reminders)
```

**Tool calls created:**
```
- search_emails("still waiting OR haven't heard OR following up again")
- search_emails("second time OR third time OR multiple times reaching")
- search_emails("URGENT response OR need to hear OR waiting for reply")
- For each result → get_email_thread to analyze conversation
- Parse threads to count follow-ups and check user response status
```

**NO sentiment classifier needed.** LLM reads emails and judges tone from content.

---

### Pattern 2: What Am I Forgetting?

**User query:** "What am I forgetting?"

**Master → SubAgent command:** "Find commitments, deadlines, or action items the user may have forgotten"

**SubAgent Prompt 1 reasoning:**
```
"Forgetting" could mean:
- Commitments I made but didn't fulfill
- Deadlines approaching that I haven't addressed
- Meetings I'm not prepared for
- Emails I haven't responded to in a while
- Projects I said I'd update on

This is multi-domain. Need to check:
- Sent emails for promises
- Calendar for upcoming events
- Inbox for old unanswered emails
```

**Tool calls created (multi-domain):**
```
Email domain (EmailAgent):
- search_emails("from:me (I'll OR I will OR I promise)")
- search_emails("from:me (by tomorrow OR by Friday OR by end of week)")
- search_emails("is:unread older_than:3d") // old unread emails
- For promising emails → get_email + get_email_thread

Calendar domain (CalendarAgent):
- list_events(range: next_3_days)
- For each event → check if there are related emails with context

Synthesis:
- Master Agent combines EmailAgent + CalendarAgent responses
- Generates unified "things you might be forgetting" response
```

**This is why Master Agent coordinates EmailAgent and CalendarAgent** - multi-domain query requires both.

---

### Pattern 3: Meeting Preparation Intelligence

**User query:** "What meetings am I not prepared for tomorrow?"

**Master Agent Prompt 1:**
```
This requires BOTH calendar and email data.

Command 1 (CalendarAgent): "Get tomorrow's meetings and identify which lack agendas or prep notes"
Command 2 (EmailAgent): "For meetings without agendas, search for email context"
```

**CalendarAgent Prompt 1:**
```
Need to:
1. Get tomorrow's events
2. Check event descriptions for agendas
3. Identify meetings that look unprepared

Tool calls:
- list_events(start: tomorrow_start, end: tomorrow_end)
- For each event → analyze description field for agenda content
```

**CalendarAgent Prompt 2 synthesis:**
```
Parse event data:
- Events with "Agenda:" or bullet points in description = prepared
- Events with just title/attendees = not prepared
- External meetings (non-company domains) = higher priority

Returns: "5 meetings lack preparation: [list with attendees]"
```

**Master Agent Prompt 2:**
```
CalendarAgent found 5 unprepared meetings.
Extract attendee names/emails from response.

Command 2 (EmailAgent): "For these specific meetings and attendees, find recent email context"
```

**EmailAgent executes multi-query strategy:**
```
For each unprepared meeting:
- Use search_contacts to resolve attendee names to emails
- search_emails("from:[attendee_email] OR to:[attendee_email]") with recent date filter
- search_emails("subject contains [meeting topic]")
- Synthesize findings
```

**Final response to user:**
```
"You have 5 meetings tomorrow without preparation:

1. **Client call with Acme Corp** (2pm)
   Attendees: Alice Smith
   Email context: 3 recent emails about Q4 budget questions

2. **Product review** (10am)
   Attendees: entire team
   Email context: No recent email thread found
   [NEEDS PREP]

..."
```

**All of this emerges from chain-of-thought.** No hardcoded "meeting prep detector."

---
The following can be added later to improve performance but are NOT required for MVP:

**Vector Search:**
- For even better semantic matching beyond keyword synonyms
- SubAgent could use vector_search tool in addition to multiple keyword searches
- But MVP works fine with multi-query keyword strategy

**Entity Tracking:**
- Saving frequently mentioned people/projects in database
- Would reduce need to re-resolve "Sarah" or "the Johnson project"
- But MVP works by scanning conversation history

**Commitment Database:**
- Persistent storage of extracted commitments with status tracking
- Would make "what did I forget?" faster
- But MVP works by re-analyzing emails each time

**Context Pruning:**
- Automatic pruning of old accumulated_knowledge
- Would prevent context bloat in very long conversations
- But MVP can handle 20-30 turn conversations fine

**Summarization Caching:**
- Caching summaries of long threads to avoid re-reading
- Would make repeat queries faster
- But MVP re-reads threads each time (acceptable for MVP)

The architecture is designed to work well **without** these optimizations for MVP, then scale up with them post-MVP.

---

## Complete Example: All Patterns Working Together

**This example demonstrates cross-account coordination, bulk operations, and safety patterns in a single interaction.**

### User Query: "Archive all newsletters from today across all my accounts"

**Turn 1: Master Agent Prompt 1**

```
Step 1 - Intent Analysis:
User wants to archive emails. This is a WRITE action.

Step 2 - Reference Resolution:
No previous conversation context needed.

Step 3 - READ vs. WRITE DETECTION:
- WRITE operation
- Scope: BULK (all newsletters from today)
- Risk: Medium (reversible archive, but bulk)
- Prepare for confirmation flow

Step 4 - Domain Detection:
- EmailAgent only
- Cross-account intent: "across all my accounts"

Step 5 - Ambiguity Check:
Query is clear: newsletters, today, all accounts

Step 6 - Command Creation:
Command: "Find all newsletters from today across all connected accounts and prepare to archive them"
```

**Master Agent sends command to EmailAgent**

---

**Turn 1: EmailAgent Prompt 1**

```
Step 1 - Command Interpretation:
- Find newsletters from today
- Across all accounts (check user_context for account list)
- This is a WRITE operation (prepare to archive)

Step 2 - Tool Call List Planning:
- Single search query across all accounts
- Will need user confirmation before archiving

Step 3 - Parameter Initialization:
account_ids: ["work@company.com", "personal@gmail.com", "consulting@domain.com"]
query: "category:newsletters after:today"

Step 4 - Execution Strategy:
- Execute search first
- Assess results for confirmation level needed
- Don't add archive calls yet (waiting for confirmation)

Creates tool_call_list:
[
  {
    tool: "search_emails",
    params: {
      query: "category:newsletters after:today",
      account_ids: ["work@company.com", "personal@gmail.com", "consulting@domain.com"]
    },
    order: 1
  }
]
```

**EmailAgent executes search → Returns 47 newsletters across 3 accounts**

---

**Turn 1: EmailAgent Prompt 2**

```
Step 1 - Result Analysis:
Found 47 newsletters across 3 accounts:
- work@company.com: 28 newsletters
- personal@gmail.com: 15 newsletters
- consulting@domain.com: 4 newsletters

Step 2 - Information Extraction:
Update working_data:
{
  newsletters_found: 47,
  email_ids: ["id1", "id2", ..., "id47"],
  by_account: {
    "work@company.com": {count: 28, ids: [...]},
    "personal@gmail.com": {count: 15, ids: [...]},
    "consulting@domain.com": {count: 4, ids: [...]}
  },
  top_senders: ["Morning Brew", "TechCrunch", "Product Hunt", "LinkedIn", ...],
  pending_action: {
    type: "bulk_archive",
    count: 47,
    confirmed: false
  }
}

Step 3 - Safety Decision:
This is a WRITE bulk operation with 47 items across multiple accounts.
- Reversible? Yes (archive is reversible)
- High impact? Medium (47 items is significant)
- Ambiguous selection? Somewhat ("newsletters" might catch important emails)
- Cross-account? Yes (adds complexity)

Risk assessment: MEDIUM
Decision: Require confirmation with detailed preview showing account breakdown

Step 4 - Tool List Modification:
Don't add archive calls yet. Wait for confirmation.

Step 5 - Next Action:
Return preview with account breakdown, wait for user confirmation.

Natural language response:
"Found 47 newsletters from today across 3 accounts:

Work (28):
• TechCrunch Daily (5 issues)
• LinkedIn Digest (8 emails)
• Morning Brew (3 issues)
... (and 12 more)

Personal (15):
• Product Hunt Daily (2 issues)
• Substack newsletters (7 emails)
• News alerts (6 emails)

Consulting (4):
• Industry newsletter (2 issues)
• Client updates (2 emails)

Archive all 47? Reply 'yes' to confirm or specify which accounts."
```

**EmailAgent returns to Master Agent**

---

**Turn 1: Master Agent Prompt 2**

```
Step 1 - Response Analysis:
EmailAgent found 47 newsletters across 3 accounts.
EmailAgent is asking for confirmation (good - safety protocol).

Step 2 - Safety Assessment:
- SubAgent proposing bulk archive of 47 emails
- Already asked for confirmation ✓
- Provided breakdown by account ✓
- User can refine selection ✓
- This is appropriate safety handling

Step 3 - Completion Assessment:
Cannot complete - waiting for user confirmation.

Step 4 - Response Synthesis:
Return EmailAgent's preview to user.
```

**User sees preview**

---

**Turn 2: User refines request: "just archive the work ones"**

---

**Turn 2: Master Agent Prompt 1**

```
Step 1 - Intent Analysis:
User is not confirming all 47. User is refining to work account only.

Step 2 - Reference Resolution:
Scanning conversation_history:
- Previous turn showed 28 work newsletters

Step 3 - READ vs. WRITE DETECTION:
Still WRITE, but refined scope (28 instead of 47)

Command: "Archive only the 28 newsletters from work account from the previous search"
```

**Master Agent sends refined command to EmailAgent**

---

**Turn 2: EmailAgent Prompt 1**

```
Step 1 - Command Interpretation:
User confirmed work account only (28 newsletters).

Checking working_data - still has email IDs by account.

Step 2 - Tool Call List Planning:
Filter to work account emails only.
Create archive calls for those 28 emails.

Creates tool_call_list:
[
  {tool: "archive_email", params: {email_id: "work_id1"}, order: 1},
  {tool: "archive_email", params: {email_id: "work_id2"}, order: 2},
  ...
  {tool: "archive_email", params: {email_id: "work_id28"}, order: 28}
]
```

**EmailAgent executes 28 archive calls**

---

**Turn 2: EmailAgent Prompt 2**

```
Step 1 - Result Analysis:
28 successful, 0 failed

Step 2 - Information Extraction:
Update working_data:
{
  archived_count: 28,
  failed_count: 0,
  last_action: {
    type: "bulk_archive",
    count: 28,
    account: "work@company.com",
    timestamp: "2024-12-29T10:15:00Z",
    affected_items: ["work_id1", ..., "work_id28"],
    reversible: true,
    undo_command: "unarchive_emails",
    undo_available_until: "2024-12-29T10:20:00Z"
  }
}

Step 3 - Next Action:
Complete. Offer undo.

Natural language response:
"Archived 28 newsletters from your work account.

The other 19 newsletters (15 personal, 4 consulting) remain in your inbox.

Undo?"
```

**EmailAgent returns to Master Agent**

---

**Turn 2: Master Agent Prompt 2**

```
Step 1 - Response Analysis:
EmailAgent successfully archived 28 emails.
EmailAgent offering undo (good - safety protocol).

Extract accumulated_knowledge:
{
  action_completed: "archived 28 work newsletters",
  remaining: "19 newsletters in personal and consulting",
  undo_available: true
}

Step 2 - Completion Assessment:
Action complete. Return result to user.

Step 3 - Response Synthesis:
EmailAgent handled it perfectly. Return response as-is.
```

**User sees: "Archived 28 newsletters from your work account. The other 19 newsletters (15 personal, 4 consulting) remain in your inbox. Undo?"**

---

### What This Example Demonstrates

**Cross-Account Coordination:**
- EmailAgent queried all 3 accounts in single tool call
- Breakdown by account preserved in working_data
- User could refine to specific account mid-flow

**Bulk Operations:**
- Search → Accumulate (47 emails)
- Preview with breakdown
- User refined scope (47 → 28)
- Execute refined set
- All without re-searching

**Safety Patterns:**
- Progressive confirmation (medium risk = detailed preview)
- User could refine before execution
- Graceful partial execution (28 of original 47)
- Clear confirmation of what happened
- Undo offered with 5-minute window

**Natural Language Boundaries:**
- Master Agent never saw email_ids or by_account breakdown
- Only saw natural language: "Found 47 newsletters across 3 accounts..."
- All complexity handled in SubAgent's private working_data

**Context Efficiency:**
- Raw search results: ~2000 tokens (47 email objects)
- Working_data: ~300 tokens (filtered essentials)
- Natural language response: ~150 tokens
- Master Agent context: ~150 tokens
- **92% context reduction while maintaining full intelligence**

**Emergent Intelligence:**
- No hardcoded "if bulk > 40 then confirm" rule
- EmailAgent reasoned: "47 items, cross-account, medium risk"
- No hardcoded "archive work account first" logic
- EmailAgent preserved account breakdown, user refined

**This is the architecture in action.** All patterns working together through chain-of-thought reasoning within the 4-prompt system.

---
