# Sub-Agent Design - Simplified Intent-Driven Architecture

## Overview

Sub-agents are focused, single-domain agents that execute tool calls directly. Unlike the Master Agent which delegates to sub-agents, sub-agents call tools directly to accomplish specific tasks. They use a simplified 3-phase architecture optimized for quick intent assessment and direct execution.

## Core Architecture

```
Natural Language Request from Master Agent
        ↓
┌─────────────────────────────────────┐
│ Phase 1: Intent Assessment & Response Planning │
│                                     │
│ What does Master Agent Want?        │
│ • Parse the specific request        │
│ • Identify expected response format │
│ • Determine success criteria        │
│ • Assess risk level for operation   │
│                                     │
│ Tool Execution Planning:            │
│ • Map request to specific tools     │
│ • Determine tool call sequence      │
│ • Identify required parameters      │
│ • Plan error handling approach     │
│                                     │
│ Simple Context:                     │
│ REQUEST: [What master agent asked for]│
│ TOOLS: [Tools needed to fulfill request]│
│ PARAMS: [Parameters for tool calls]│
│ STATUS: [Current execution status] │
│ RESULT: [Data collected so far]     │
│                                     │
│ Notes: [Brief execution context]    │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ Phase 2: Direct Tool Execution (Max 3 Iterations) │
│                                     │
│ Pre-execution Check:                │
│ • Verify authentication/permissions│
│ • Validate tool parameters         │
│ • Check rate limits and constraints │
│                                     │
│ Tool Call Execution:                │
│ • Call domain-specific tools directly│
│ • Process tool responses           │
│ • Handle tool errors gracefully    │
│ • Collect and structure results    │
│                                     │
│ Progress Check:                     │
│ • Assess if request is fulfilled   │
│ • Determine if more tools needed   │
│ • Update result data               │
│                                     │
│ Context Updates:                    │
│ STATUS: [Execution progress]        │
│ RESULT: [Updated result data]       │
│ Notes: [Tool execution details]     │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ Phase 3: Response Formatting        │
│                                     │
│ Format Response for Master Agent:   │
│ • Structure collected data          │
│ • Create natural language summary  │
│ • Include relevant metadata        │
│ • Add confidence and status info   │
│                                     │
│ Response Package:                   │
│ • Success/failure indicator        │
│ • Structured data result           │
│ • Human-readable summary           │
│ • Tool execution metadata          │
│ • Error details (if any)           │
│                                     │
│ Final Context:                      │
│ STATUS: [Complete/Failed]           │
│ RESULT: [Final structured data]     │
│ SUMMARY: [Natural language summary] │
│ Notes: [Complete execution log]     │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ END - Return to Master Agent        │
└─────────────────────────────────────┘
```

## Domain-Specific Implementations

### Email Agent - Intent-Driven Tool Execution

**Phase 1 - Intent Assessment:**
```
Master Agent Request: "Send project update to john@company.com and sarah@client.com"

Intent Analysis:
- What: Send an email
- To Whom: john@company.com, sarah@client.com
- Expected Response: Confirmation of successful delivery
- Risk Level: Medium (external recipients)

Tool Mapping:
- gmail_send_email tool with recipient validation
- gmail_get_delivery_status for confirmation

Simple Context:
REQUEST: Send project update email to specified recipients
TOOLS: [gmail_send_email, gmail_get_delivery_status]
PARAMS: {recipients: [...], subject: "Project Update", body: "..."}
STATUS: Planning
RESULT: {}
Notes: External recipients require careful validation
```

**Available Email Tools:**
- `gmail_send_email` - Send emails directly
- `gmail_search_messages` - Search email content
- `gmail_get_message` - Retrieve specific emails
- `gmail_create_draft` - Create draft emails
- `gmail_reply_to_message` - Reply to emails

### Calendar Agent - Intent-Driven Tool Execution

**Phase 1 - Intent Assessment:**
```
Master Agent Request: "Schedule a meeting with team next Tuesday 2pm"

Intent Analysis:
- What: Create calendar event
- When: Next Tuesday 2pm
- Expected Response: Event details with conflicts if any
- Risk Level: Low (internal team meeting)

Tool Mapping:
- calendar_check_availability for conflict detection
- calendar_create_event for event creation

Simple Context:
REQUEST: Schedule team meeting next Tuesday 2pm
TOOLS: [calendar_check_availability, calendar_create_event]
PARAMS: {datetime: "2024-01-16T14:00:00", attendees: ["team"], title: "Team Meeting"}
STATUS: Planning
RESULT: {}
Notes: Check for conflicts before creating
```

**Available Calendar Tools:**
- `calendar_create_event` - Create new events
- `calendar_check_availability` - Check time conflicts
- `calendar_list_events` - List calendar events
- `calendar_update_event` - Modify existing events
- `calendar_delete_event` - Remove events

### Contact Agent - Intent-Driven Tool Execution

**Phase 1 - Intent Assessment:**
```
Master Agent Request: "Find contact info for people at Acme Corp"

Intent Analysis:
- What: Search for contacts by organization
- Criteria: Organization = "Acme Corp"
- Expected Response: List of contacts with details
- Risk Level: Low (read-only search)

Tool Mapping:
- contacts_search with organization filter

Simple Context:
REQUEST: Find contacts at Acme Corp
TOOLS: [contacts_search]
PARAMS: {organization: "Acme Corp", fields: ["name", "email", "phone"]}
STATUS: Planning
RESULT: {}
Notes: Organization-based search
```

**Available Contact Tools:**
- `contacts_search` - Search contact database
- `contacts_get_by_id` - Retrieve specific contact
- `contacts_list_organizations` - List organizations
- `contacts_validate_email` - Validate email addresses

### Slack Agent - Intent-Driven Tool Execution

**Phase 1 - Intent Assessment:**
```
Master Agent Request: "Summarize recent discussions in #project-alpha channel"

Intent Analysis:
- What: Analyze and summarize channel messages
- Where: #project-alpha channel
- Expected Response: Summary of key discussion points
- Risk Level: Low (read-only analysis)

Tool Mapping:
- slack_get_channel_messages for recent messages
- slack_analyze_conversation for summarization

Simple Context:
REQUEST: Summarize #project-alpha channel discussions
TOOLS: [slack_get_channel_messages, slack_analyze_conversation]
PARAMS: {channel: "#project-alpha", time_range: "7d", limit: 100}
STATUS: Planning
RESULT: {}
Notes: Focus on key discussion points and decisions
```

**Available Slack Tools:**
- `slack_get_channel_messages` - Retrieve channel messages
- `slack_search_messages` - Search across channels
- `slack_get_thread_replies` - Get thread conversations
- `slack_analyze_conversation` - Summarize discussions
- `slack_get_user_info` - Get user details

## Key Design Principles

### 1. Intent-First Assessment

Sub-agents always start by understanding:
- **What exactly** the Master Agent is asking for
- **What response format** is expected (data, confirmation, summary, etc.)
- **What success** looks like for this specific request
- **Risk level** of the operation (read-only vs. modification)

### 2. Direct Tool Execution

Unlike Master Agent which delegates to sub-agents, sub-agents:
- **Call tools directly** - No further delegation
- **Map requests to specific tools** - Clear tool selection
- **Execute in sequence** - Simple, linear tool calling
- **Collect results immediately** - No complex state management

### 3. Simplified Context Management

```
Simple Context Structure:
REQUEST: [Clear description of what master agent wants]
TOOLS: [List of tools needed to fulfill request]
PARAMS: [Parameters for tool execution]
STATUS: [Planning/Executing/Complete/Failed]
RESULT: [Data collected from tool calls]
Notes: [Brief execution context]
```

### 4. Risk-Based Operation Classification

**Low Risk (Read-Only):**
- Searches, retrievals, status checks
- No data modification or external communication
- Fast execution, minimal validation needed

**Medium Risk (Controlled Modification):**
- Internal operations with limited scope
- Single recipient emails, personal calendar events
- Requires parameter validation

**High Risk (External/Bulk Operations):**
- External recipient emails, public calendar events
- Bulk operations, data exports
- Requires additional confirmation steps

### 5. Tool-Centric Error Handling

```
Tool Call Failure Patterns:
- Authentication Error → Request token refresh, retry once
- Parameter Error → Log error, return structured failure response
- Rate Limit → Apply backoff, retry up to 2 times
- Network Error → Retry with exponential backoff
- Permission Error → Return clear error message to Master Agent
```

### 6. Response Optimization

Sub-agents optimize responses for Master Agent consumption:
- **Structured Data** - Consistent format across domains
- **Natural Language Summary** - Human-readable description
- **Execution Metadata** - Success/failure, tools used, timing
- **Error Details** - Actionable error information when applicable

## Context Evolution Example

### Phase 1 - Intent Assessment & Planning
```
REQUEST: Send project update to john@company.com and sarah@client.com
TOOLS: [gmail_send_email, gmail_get_delivery_status]
PARAMS: {
  recipients: ["john@company.com", "sarah@client.com"],
  subject: "Project Update",
  body: "Please find the project update attached."
}
STATUS: Planning
RESULT: {}
Notes: Medium risk - external recipients, need delivery confirmation
```

### Phase 2 - Tool Execution in Progress
```
REQUEST: Send project update to john@company.com and sarah@client.com
TOOLS: [gmail_send_email, gmail_get_delivery_status]
PARAMS: {
  recipients: ["john@company.com", "sarah@client.com"],
  subject: "Project Update",
  body: "Please find the project update attached."
}
STATUS: Executing
RESULT: {
  email_sent: true,
  message_id: "msg_12345",
  recipients_processed: ["john@company.com", "sarah@client.com"]
}
Notes: Email sent successfully, checking delivery status
```

### Phase 3 - Complete Response Ready
```
REQUEST: Send project update to john@company.com and sarah@client.com
TOOLS: [gmail_send_email, gmail_get_delivery_status]
PARAMS: {
  recipients: ["john@company.com", "sarah@client.com"],
  subject: "Project Update",
  body: "Please find the project update attached."
}
STATUS: Complete
RESULT: {
  email_sent: true,
  message_id: "msg_12345",
  recipients_processed: ["john@company.com", "sarah@client.com"],
  delivery_status: "delivered",
  timestamp: "2024-01-15T10:30:00Z"
}
Notes: Email successfully delivered to both recipients
```

## Master Agent Integration

### Simplified Sub-Agent Response Format
```typescript
interface SubAgentResponse {
  success: boolean;
  domain: 'email' | 'calendar' | 'contacts' | 'slack';
  request: string;              // Original request from Master Agent
  result: {
    data: any;                  // Tool execution results
    summary: string;            // Natural language summary
    tools_used: string[];       // Tools that were called
    execution_time: number;     // Time taken in seconds
  };
  error?: {
    type: 'auth' | 'params' | 'network' | 'rate_limit' | 'permission' | 'tool_error';
    message: string;
    tool: string;               // Which tool failed
    recoverable: boolean;
  };
}
```

### Request/Response Flow
```
Master Agent → Sub-Agent:
- Simple natural language request
- Domain selection (email/calendar/contacts/slack)
- User context (userId, sessionId)

Sub-Agent → Master Agent:
- Success/failure status
- Structured tool execution results
- Human-readable summary
- Error details if failed
```

### Example Response
```typescript
// Successful email send
{
  success: true,
  domain: 'email',
  request: 'Send project update to john@company.com and sarah@client.com',
  result: {
    data: {
      message_id: 'msg_12345',
      recipients: ['john@company.com', 'sarah@client.com'],
      delivery_status: 'delivered',
      timestamp: '2024-01-15T10:30:00Z'
    },
    summary: 'Successfully sent project update email to 2 recipients. All emails delivered.',
    tools_used: ['gmail_send_email', 'gmail_get_delivery_status'],
    execution_time: 3.2
  }
}

// Failed contact search
{
  success: false,
  domain: 'contacts',
  request: 'Find contact info for people at Acme Corp',
  result: {
    data: null,
    summary: 'Contact search failed due to authentication error.',
    tools_used: ['contacts_search'],
    execution_time: 1.1
  },
  error: {
    type: 'auth',
    message: 'Google Contacts API authentication expired',
    tool: 'contacts_search',
    recoverable: true
  }
}
```

## Benefits of Simplified Sub-Agent Architecture

### Intent-Driven Clarity
- **Clear Purpose**: Each sub-agent understands exactly what Master Agent wants
- **Direct Execution**: No complex planning phases, straight to tool execution
- **Fast Response**: Simplified workflow reduces execution time
- **Focused Results**: Responses optimized for Master Agent consumption

### Simplified Implementation
- **Minimal Context**: Simple 6-field context structure instead of complex domain modeling
- **Direct Tool Mapping**: Clear request → tool → response flow
- **Reduced Overhead**: 3 iterations max vs 10 in Master Agent
- **Easy Debugging**: Linear execution flow makes issues easy to trace

### Master Agent Integration
- **Clean Delegation**: Master Agent delegates specific requests and gets structured responses
- **Consistent Interface**: All sub-agents use same response format
- **Error Transparency**: Clear error types and recovery information
- **Performance Tracking**: Execution time and tool usage metadata

### Tool-Centric Design
- **Direct Tool Access**: Sub-agents call domain tools without abstraction layers
- **Tool Expertise**: Each sub-agent knows exactly which tools solve which problems
- **Efficient Execution**: No delegation overhead, direct API calls
- **Clear Boundaries**: Each sub-agent owns specific tool sets

## Implementation Architecture

### Shared Infrastructure (All Sub-Agents)

#### Simple Base Sub-Agent
```typescript
abstract class BaseSubAgent {
  // Core 3-phase workflow
  async execute(request: string, userId: string): Promise<SubAgentResponse> {
    const context = await this.assessIntent(request);
    const result = await this.executeTools(context);
    return this.formatResponse(result);
  }

  // Phase 1: Intent Assessment
  protected abstract assessIntent(request: string): Promise<SimpleContext>;

  // Phase 2: Tool Execution
  protected abstract executeTools(context: SimpleContext): Promise<SimpleContext>;

  // Phase 3: Response Formatting
  protected abstract formatResponse(context: SimpleContext): Promise<SubAgentResponse>;

  // Shared utilities
  protected handleToolError(error: Error, toolName: string): ToolError;
  protected validateParams(params: any): boolean;
  protected createResponse(success: boolean, context: SimpleContext): SubAgentResponse;
}

interface SimpleContext {
  request: string;          // Original Master Agent request
  tools: string[];          // Tools needed for execution
  params: any;              // Parameters for tool calls
  status: 'planning' | 'executing' | 'complete' | 'failed';
  result: any;              // Collected tool results
  notes: string;            // Brief execution notes
}
```

#### Shared Services
- **Authentication**: Token management for Google/Slack APIs
- **Logging**: Unified logging with execution metadata
- **Error Handling**: Common error types and retry logic
- **Rate Limiting**: Shared rate limiting across all tools
- **Response Formatting**: Consistent response structure

#### Common Tool Error Handling
```typescript
enum ToolErrorType {
  AUTH = 'auth',
  PARAMS = 'params',
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  PERMISSION = 'permission',
  TOOL_ERROR = 'tool_error'
}

interface ToolError {
  type: ToolErrorType;
  message: string;
  tool: string;
  recoverable: boolean;
  retryAfter?: number;
}
```

### Agent-Specific Components

#### Tool Set Ownership
```typescript
// Each agent owns specific tools
class EmailSubAgent extends BaseSubAgent {
  private toolSet = [
    'gmail_send_email',
    'gmail_search_messages',
    'gmail_get_message',
    'gmail_create_draft',
    'gmail_reply_to_message',
    'gmail_get_delivery_status'
  ];

  protected async assessIntent(request: string): Promise<SimpleContext> {
    // Email-specific intent assessment
    // Map request to email tools
  }
}

class CalendarSubAgent extends BaseSubAgent {
  private toolSet = [
    'calendar_create_event',
    'calendar_check_availability',
    'calendar_list_events',
    'calendar_update_event',
    'calendar_delete_event'
  ];

  protected async assessIntent(request: string): Promise<SimpleContext> {
    // Calendar-specific intent assessment
    // Map request to calendar tools
  }
}

class ContactSubAgent extends BaseSubAgent {
  private toolSet = [
    'contacts_search',
    'contacts_get_by_id',
    'contacts_list_organizations',
    'contacts_validate_email'
  ];
}

class SlackSubAgent extends BaseSubAgent {
  private toolSet = [
    'slack_get_channel_messages',
    'slack_search_messages',
    'slack_get_thread_replies',
    'slack_analyze_conversation',
    'slack_get_user_info'
  ];
}
```

#### Domain-Specific Intent Patterns
```typescript
// Each agent recognizes domain-specific request patterns
interface IntentPattern {
  pattern: RegExp;
  tools: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

// Email intent patterns
const EmailIntentPatterns: IntentPattern[] = [
  {
    pattern: /send.*email.*to/i,
    tools: ['gmail_send_email', 'gmail_get_delivery_status'],
    riskLevel: 'medium'
  },
  {
    pattern: /search.*email/i,
    tools: ['gmail_search_messages'],
    riskLevel: 'low'
  }
];

// Calendar intent patterns
const CalendarIntentPatterns: IntentPattern[] = [
  {
    pattern: /schedule.*meeting/i,
    tools: ['calendar_check_availability', 'calendar_create_event'],
    riskLevel: 'medium'
  },
  {
    pattern: /check.*availability/i,
    tools: ['calendar_check_availability'],
    riskLevel: 'low'
  }
];
```

## Implementation Strategy

### Phase 1: Core Infrastructure
1. **BaseSubAgent Class**: Simple 3-phase workflow (intent → tools → response)
2. **SimpleContext Interface**: 6-field context structure
3. **Common Error Handling**: Tool error types and retry logic
4. **Authentication Layer**: Shared token management

### Phase 2: Domain Agents
1. **Tool Set Definition**: Each agent owns specific tools
2. **Intent Pattern Matching**: Domain-specific request recognition
3. **Tool Execution Logic**: Direct API calls with error handling
4. **Response Formatting**: Consistent structured responses

### Phase 3: Master Agent Integration
1. **Single Message Interface**: One natural language request in, one structured response out
2. **No Back-and-forth**: All context must be extracted from initial message
3. **Unified Response Format**: All sub-agents return same response structure

## Critical Design Constraint

### ⚠️ SINGLE MESSAGE INTERFACE ⚠️

**Master Agent ↔ Sub-Agent communication MUST be through exactly ONE natural language message each way:**

```
Master Agent → Sub-Agent:
✅ Single natural language request: "Send project update to john@company.com and sarah@client.com"
❌ No follow-up questions or clarifications
❌ No complex context objects
❌ No back-and-forth communication

Sub-Agent → Master Agent:
✅ Single structured response with success/failure, data, and summary
❌ No requests for additional information
❌ No partial responses requiring follow-up
```

**This means sub-agents must:**
1. **Extract ALL context** from the single natural language message
2. **Make intelligent assumptions** when information is ambiguous
3. **Return complete responses** with clear success/failure status
4. **Handle missing information gracefully** with appropriate error messages

### Sub-Agent Response Format (Final)
```typescript
interface SubAgentResponse {
  success: boolean;
  domain: 'email' | 'calendar' | 'contacts' | 'slack';
  request: string;              // Echo back the original request
  result: {
    data: any;                  // Tool execution results
    summary: string;            // Human-readable summary of what was accomplished
    tools_used: string[];       // Tools that were executed
    execution_time: number;     // Time taken in seconds
  };
  error?: {
    type: 'auth' | 'params' | 'network' | 'rate_limit' | 'permission' | 'tool_error';
    message: string;            // Clear error description for Master Agent
    tool: string;               // Which tool failed
    recoverable: boolean;       // Whether Master Agent can retry
  };
}
```

This simplified, intent-driven architecture eliminates complex context management while maintaining the clear delegation pattern between Master Agent and domain-specific sub-agents.
