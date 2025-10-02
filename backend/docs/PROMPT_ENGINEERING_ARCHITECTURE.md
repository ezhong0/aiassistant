# Prompt Engineering & Context Management Architecture

## Executive Summary

This document details the **4 core prompts** that power the email/calendar assistant and how **context is managed** to prevent bloat while maintaining intelligence.

**Key Principle**: Each agent (Master and SubAgents) maintains its own **internal context** privately. Communication between agents is pure **natural language strings**. No structured data passes between agents - only natural language in, natural language out.

**The 4 Core Prompts:**
1. **Master Agent Prompt 1**: Intent Understanding & Command List Creation
2. **Master Agent Prompt 2**: Context Update & Command List Modification
3. **SubAgent Prompt 1**: Command Interpretation & Tool Call List Creation
4. **SubAgent Prompt 2**: Tool Reassessment & Tool Call List Modification

**The List Pattern**: Both Master and SubAgents create lists (commands or tool calls) and modify them dynamically based on execution results. These lists are **internal context** - not exposed across agent boundaries.

**Context Boundaries**:
- **Master Agent internal context**: command_list, accumulated knowledge from previous SubAgent responses
- **SubAgent internal context**: tool_call_list, working_data, executed_tools
- **Communication**: Pure natural language strings (command → response)

**Reference Resolution (MVP Approach):** The system does NOT maintain saved references. Instead, the LLM resolves references on-demand by scanning conversation history and making additional queries when needed.

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

## Master Agent Prompt 1: Intent Understanding & Command List Creation

### Purpose

Transform user's natural language query into a **list of commands** for SubAgents. This prompt creates the initial execution plan.

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

3. DOMAIN DETECTION
   - What SubAgents are needed? (email | calendar | actions)
   - Single-domain or multi-domain?
   - What's the dependency order?

4. AMBIGUITY CHECK
   - Is anything unclear?
   - Need clarification from user?

5. COMMAND LIST CREATION
   - Generate natural language commands for SubAgents
   - Commands execute sequentially
   - Later commands may be modified based on earlier results

# Output Format

{
  "command_list": [
    {
      "agent": "actions",
      "command": "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15",
      "order": 1
    }
  ],
  "clarifications": []
}
```

### Chain-of-Thought Example: Reference Resolution

**User query:** "Reply to the first email"

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

What I know: sender (Sarah), subject (Q4 Budget Review), date (Dec 15)
What I don't know: email_id, Sarah's email address
→ ActionAgent will resolve these via queries

Step 3 - Domain Detection:
ActionAgent (for email draft)

Step 4 - Ambiguity Check:
Subject + date + sender should uniquely identify the email. No ambiguity.

Step 5 - Command List Creation:
Command: "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15"

This is a natural language command. ActionAgent will:
- Look up Sarah's email address
- Find the specific email thread
- Draft the reply
```

**Output:**
```json
{
  "command_list": [
    {
      "agent": "actions",
      "command": "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15",
      "order": 1
    }
  ],
  "clarifications": []
}
```

### What Happens Next

Master Agent sends the command string to ActionAgent:

```javascript
const response = await ActionAgent.execute(
  "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15"
);
```

ActionAgent receives **only the command string**. It doesn't see Master Agent's internal context (command_list, conversation_history, etc.).

---

## SubAgent Prompt 1: Command Interpretation & Tool Call List Creation

### Purpose

Transform Master Agent's natural language command into a **list of tool calls**. Create the initial tool execution plan.

### Input (SubAgent's Internal Context)

```javascript
{
  // Command from Master Agent (natural language string)
  command: "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15",

  // Available tools
  available_tools: [
    {
      name: "contact_lookup",
      params: {name: "string"},
      description: "Find contact information by name"
    },
    {
      name: "gmail_search",
      params: {query: "string", account_ids: "array"},
      description: "Search emails"
    },
    {
      name: "gmail_get_thread",
      params: {thread_id: "string"},
      description: "Get full thread"
    },
    {
      name: "gmail_draft_reply",
      params: {thread_id: "string", body: "string"},
      description: "Create draft reply"
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

2. TOOL CALL LIST PLANNING
   - Which tools provide the data I need?
   - What's the dependency order?
   - What parameters can I set now vs. later?

3. PARAMETER INITIALIZATION
   - For first tool, what parameters can I set immediately?
   - What will come from tool results?

4. EXECUTION STRATEGY
   - What's the expected flow?
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

**Command:** "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15"

```
Step 1 - Command Interpretation:
Need to draft a reply to a specific email.

Data needed:
- Sarah's email address
- Specific thread_id
- Thread content (for contextual reply)

What I have:
- Sender name: "Sarah"
- Subject: "Q4 Budget Review"
- Date: "Dec 15"

What I must discover:
- Sarah's email address → contact_lookup
- Thread ID → gmail_search
- Thread content → gmail_get_thread

Step 2 - Tool Call List Planning:
Sequence:
1. contact_lookup("Sarah") → get email
2. gmail_search(from:email, subject, date) → get thread_id
3. gmail_get_thread(thread_id) → get context
4. gmail_draft_reply(thread_id, body) → create draft

Step 3 - Parameter Initialization:
Tool 1: name = "Sarah" ✓
Tool 2: query needs email from Tool 1
Tool 3: thread_id from Tool 2
Tool 4: thread_id from Tool 2, body from Tool 3

Step 4 - Execution Strategy:
Expected: contact_lookup → 1 Sarah → search → 1 email → draft

Potential issues (handle in Prompt 2):
- Multiple Sarahs → clarification
- No contact found → try email search
- Multiple emails match → clarification
```

**Output (stored in SubAgent's internal context):**
```json
{
  "tool_call_list": [
    {
      "tool": "contact_lookup",
      "params": {"name": "Sarah"},
      "order": 1
    },
    {
      "tool": "gmail_search",
      "params": {
        "query": "from:{email} subject:'Q4 Budget Review' after:2024-12-14 before:2024-12-16"
      },
      "order": 2
    },
    {
      "tool": "gmail_get_thread",
      "params": {"thread_id": "{from_search}"},
      "order": 3
    },
    {
      "tool": "gmail_draft_reply",
      "params": {"thread_id": "{from_search}", "body": "{composed}"},
      "order": 4
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

3. TOOL LIST MODIFICATION ASSESSMENT
   - Does remaining tool_call_list still make sense?
   - UPDATE parameters for upcoming tools?
   - ADD new tools (different approach)?
   - REMOVE tools (already have what I need)?

4. NEXT ACTION DECISION
   - Continue to next tool?
   - Complete and generate natural language response?
   - Ask for clarification?

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

**Tool executed:** contact_lookup("Sarah")
**Raw result:** 2 contacts found (see large raw_result above)

```
Step 1 - Result Analysis:
contact_lookup succeeded but returned 2 contacts:
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

**Tool executed:** contact_lookup("Sarah")
**Raw result:** 0 contacts found

```
Step 1 - Result Analysis:
contact_lookup returned 0 results. Sarah not in saved contacts.

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
Current plan assumed contact_lookup would return an email. It didn't.

MODIFY tool_call_list:
- REMOVE tools 2, 3, 4 (depend on email address)
- ADD new gmail_search that searches by name in email history

New tool:
{
  tool: "gmail_search",
  params: {
    query: "(from:Sarah OR to:Sarah) subject:'Q4 Budget Review' after:2024-12-14 before:2024-12-16"
  },
  reason: "Contact lookup failed, searching email history by name",
  order: 2
}

Then re-add get_thread and draft_reply after the new search.

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
          "tool": "gmail_search",
          "params": {
            "query": "(from:Sarah OR to:Sarah) subject:'Q4 Budget Review' after:2024-12-14 before:2024-12-16"
          },
          "order": 2
        },
        {
          "tool": "gmail_get_thread",
          "params": {"thread_id": "{from_search}"},
          "order": 3
        },
        {
          "tool": "gmail_draft_reply",
          "params": {"thread_id": "{from_search}", "body": "{composed}"},
          "order": 4
        }
      ]
    }
  ],

  "next_tool_order": 2
}
```

**SubAgent continues execution internally.** Master Agent doesn't see this modification - it's happening inside the SubAgent's private context.

### Chain-of-Thought Example 3: Success → Update & Continue

**Tool executed:** contact_lookup("Sarah") after user clarified "the manager"
**Raw result:** 1 contact found (Sarah Chen with many fields)

```
Step 1 - Result Analysis:
contact_lookup succeeded. Found 1 contact: Sarah Chen.

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
Next tool (order 2) is gmail_search with placeholder:
- query: "from:{email} subject:'Q4 Budget Review'..."

UPDATE parameter with actual email:
- query: "from:sarah@company.com subject:'Q4 Budget Review' after:2024-12-14 before:2024-12-16"

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
        "query": "from:sarah@company.com subject:'Q4 Budget Review' after:2024-12-14 before:2024-12-16",
        "account_ids": ["john@company.com"]
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
    {tool: "contact_lookup", order: 1, status: "completed"},
    {
      tool: "gmail_search",
      params: {
        query: "from:sarah@company.com subject:'Q4 Budget Review' after:2024-12-14 before:2024-12-16"
      },
      order: 2,
      status: "pending"
    },
    // ... more tools
  ]
}
```

**SubAgent executes next tool.** Master Agent still doesn't see any of this - it's waiting for the final natural language response.

### Example 4: Complete → Generate Natural Language Response

After executing all tools (contact_lookup, gmail_search, gmail_get_thread, gmail_draft_reply):

```
Step 1 - Result Analysis:
gmail_draft_reply succeeded. Draft created with ID: draft_789.

Step 2 - Information Extraction:
Update working_data:
{
  "sarah_email": "sarah@company.com",
  "contact_resolved": true,
  "email_found": true,
  "thread_id": "thread_456",
  "draft_created": true,
  "draft_id": "draft_789"
}

Step 3 - Tool List Modification Assessment:
All tools complete. Command fulfilled.

Step 4 - Next Action Decision:
COMPLETE. Generate natural language response for Master Agent.

Compose response:
"I've drafted a reply to Sarah Chen's Q4 Budget Review email from Dec 15. The draft addresses her questions about the timeline and includes the updated figures she requested. You can review and send it from your drafts folder."
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
const response = "I've drafted a reply to Sarah Chen's Q4 Budget Review email from Dec 15. The draft addresses her questions about the timeline and includes the updated figures she requested. You can review and send it from your drafts folder.";

return response; // Natural language string ONLY
```

**Master Agent receives ONLY this string.** It doesn't see:
- ❌ tool_call_list
- ❌ working_data
- ❌ executed_tools
- ❌ raw tool results
- ❌ draft_id

All of that is SubAgent's private internal context.

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

2. COMMAND LIST MODIFICATION ASSESSMENT
   - Are there remaining commands?
   - Do they need updating based on what was learned?
   - Should I add/remove commands?

3. COMPLETION ASSESSMENT
   - Can I answer user's query now?
   - Or need more SubAgent information?
   - Any clarification needed?

4. RESPONSE SYNTHESIS (if complete)
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
EmailAgent Prompt 1: Creates tool_call_list [contact_lookup, gmail_search]
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
User: "Reply to the first one"

Master Agent Prompt 1:
→ Scans conversation_history
→ Extracts: "first email" = "Q4 Budget Review (Dec 15)" from Sarah
→ Creates command: "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15"

ActionAgent receives: "Draft a reply to Sarah's email about Q4 Budget Review from Dec 15"
ActionAgent Prompt 1: Creates tool_call_list [contact_lookup, gmail_search, gmail_get_thread, gmail_draft_reply]
ActionAgent executes tools (internal context management)
ActionAgent Prompt 2: Filters results, generates response

ActionAgent returns: "I've drafted a reply to Sarah Chen's Q4 Budget Review email from Dec 15. The draft addresses her questions about the timeline and includes the updated figures she requested. You can review and send it from your drafts folder."

Master Agent Prompt 2:
→ No more commands
→ Returns to user

User sees: [ActionAgent's response]
```

**Information flow:**
- User → Master: Natural language query
- Master → SubAgent: Natural language command
- SubAgent (internal): Tool calls, working_data, filtering
- SubAgent → Master: Natural language response
- Master (internal): Extract info from response, update accumulated_knowledge
- Master → User: Natural language response

**No structured data crosses agent boundaries.** Only natural language strings.

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

The intelligence of this system comes from **4 prompts working in harmony** with **clear context boundaries**:

1. **Master Prompt 1**: User intent → command_list (internal)
2. **Master Prompt 2**: Natural language responses → accumulated_knowledge → command_list modifications
3. **SubAgent Prompt 1**: Command → tool_call_list (internal)
4. **SubAgent Prompt 2**: Tool results → working_data → tool_call_list modifications → natural language response

**Each agent:**
- Maintains private internal context
- Communicates only via natural language
- Filters aggressively before responding
- Modifies plans dynamically based on reality

**The result:** A system that handles complex queries with semantic understanding, adaptive planning, and minimal context bloat, all while maintaining clean abstraction boundaries.

**The magic is in the prompts and the boundaries, not the tools.**
