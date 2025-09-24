# How Agents Extract Parameters from Natural Language

## The Problem You're Asking About

**Question:** "How does each service know how to fill their read/write APIs if it's not inputted into them as fields?"

**Example:**
```typescript
// User says: "Send email to john@example.com about project update with subject 'Q4 Status'"

// How does the agent know to extract:
// - to: "john@example.com"
// - subject: "Q4 Status"
// - body: "project update"
```

---

## The Answer: LLM Parameter Extraction

The base class uses an **LLM to analyze natural language and extract structured parameters**. Here's the flow:

### Step-by-Step Flow

#### 1. User Input (Natural Language)
```typescript
await emailAgent.processNaturalLanguageRequest(
  "Send email to john@example.com about project update with subject 'Q4 Status'",
  context
);
```

#### 2. Base Class Analyzes Intent (LLM Call #1)

**Location:** `NaturalLanguageAgent.analyzeIntent()` (line 346)

**The Prompt Sent to LLM:**
```
You are a emailAgent that understands user requests.

System Context: You are an email management agent for Gmail...

Available Operations: send, search, reply, get, draft

User Query: "Send email to john@example.com about project update with subject 'Q4 Status'"

Analyze this request and determine:
1. Which operation to execute
2. What parameters are needed
3. Your confidence level
4. Your reasoning

Return JSON: {
  "operation": "operation_name",
  "parameters": { "param1": "value1", ... },
  "confidence": 0.95,
  "reasoning": "User wants to..."
}
```

**LLM Response (Parsed as JSON):**
```json
{
  "operation": "send",
  "parameters": {
    "to": "john@example.com",
    "subject": "Q4 Status",
    "body": "project update"
  },
  "confidence": 0.95,
  "reasoning": "User wants to send an email to john@example.com with subject 'Q4 Status' about project update"
}
```

#### 3. Base Class Calls Agent's executeOperation()

```typescript
// Base class extracts:
const operation = "send";
const parameters = {
  to: "john@example.com",
  subject: "Q4 Status",
  body: "project update"
};
const authToken = context.accessToken;

// Then calls:
await this.executeOperation(operation, parameters, authToken);
```

#### 4. Agent Maps to Service API

**Agent's Implementation:**
```typescript
protected async executeOperation(
  operation: string,
  parameters: any,
  authToken: string
): Promise<any> {
  const gmailService = this.getService('gmailService');

  switch (operation) {
    case 'send': {
      // Extract parameters that LLM provided
      const { to, subject, body, cc, bcc } = parameters;

      // Map to service API
      return await gmailService.sendEmail(
        authToken,
        to,
        subject || 'No Subject',
        body || '',
        { cc, bcc }
      );
    }
  }
}
```

#### 5. Service Executes

```typescript
// GmailService.sendEmail() receives:
async sendEmail(
  accessToken: string,        // "user-token-123"
  to: string,                 // "john@example.com"
  subject: string,            // "Q4 Status"
  body: string,               // "project update"
  options: { cc?, bcc? }      // {}
) {
  // Makes actual Gmail API call
}
```

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User: "Send email to john@example.com about project update" │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ NaturalLanguageAgent.processNaturalLanguageRequest()        │
│                                                              │
│  1. Calls analyzeIntent() with user query                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ analyzeIntent() - LLM Call                                  │
│                                                              │
│  Prompt: "Available operations: send, search, reply...      │
│           User query: 'Send email to john@example.com...'   │
│           Extract operation and parameters as JSON"         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ LLM Response (JSON):                                        │
│  {                                                           │
│    "operation": "send",                                     │
│    "parameters": {                                          │
│      "to": "john@example.com",                             │
│      "subject": null,                                       │
│      "body": "project update"                              │
│    },                                                        │
│    "confidence": 0.95                                       │
│  }                                                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Base class calls:                                           │
│  executeOperation("send", {to: "john@...", body: "..."}, token) │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ EmailAgentV2.executeOperation()                             │
│                                                              │
│  case 'send': {                                             │
│    const { to, subject, body } = parameters; // Destructure │
│    return gmailService.sendEmail(                           │
│      authToken, to, subject, body, {}                       │
│    );                                                        │
│  }                                                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ GmailService.sendEmail()                                    │
│                                                              │
│  Makes Gmail API call with all parameters                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Design: LLM Does the Heavy Lifting

### The Magic is in analyzeIntent()

**Location:** `src/framework/natural-language-agent.ts:346`

```typescript
private async analyzeIntent(
  query: string,
  context: AgentExecutionContext,
  config: AgentConfig
): Promise<AnalyzedIntent> {

  const prompt = `You are a ${config.name} that understands user requests.

System Context: ${config.systemPrompt}

Available Operations: ${config.operations.join(', ')}

User Query: "${query}"

Analyze this request and determine:
1. Which operation to execute
2. What parameters are needed
3. Your confidence level
4. Your reasoning

Return JSON: {
  "operation": "operation_name",
  "parameters": { "param1": "value1", ... },
  "confidence": 0.95,
  "reasoning": "User wants to..."
}`;

  const response = await this.openaiService.generateText(prompt, ...);

  // Parse JSON response
  const intent = JSON.parse(response) as AnalyzedIntent;

  return intent; // { operation: "send", parameters: { to: "...", ... } }
}
```

**The LLM figures out:**
1. Which operation to call (`send`, `search`, `reply`, etc.)
2. What parameters are needed (`to`, `subject`, `body`, etc.)
3. How confident it is
4. The reasoning

---

## Examples Across Different Agents

### Calendar Agent

**Input:**
```
"Schedule team meeting tomorrow at 2pm with John and Sarah"
```

**LLM Extracts:**
```json
{
  "operation": "create",
  "parameters": {
    "summary": "team meeting",
    "start": "2024-10-24T14:00:00",
    "end": "2024-10-24T15:00:00",
    "attendees": ["john@example.com", "sarah@example.com"]
  }
}
```

**Agent Maps to Service:**
```typescript
case 'create': {
  const { summary, start, end, attendees } = parameters;
  return await calendarService.createEvent({
    summary, start, end, attendees
  }, authToken);
}
```

---

### Slack Agent

**Input:**
```
"Get the latest 20 messages from #engineering about deployment"
```

**LLM Extracts:**
```json
{
  "operation": "get_recent_messages",
  "parameters": {
    "channelId": "engineering",
    "limit": 20,
    "topic": "deployment"
  }
}
```

**Agent Maps to Service:**
```typescript
case 'get_recent_messages': {
  const { channelId, limit, topic } = parameters;
  const messages = await slackService.getChannelHistory(channelId, limit);
  // Filter by topic and analyze
}
```

---

### Contact Agent

**Input:**
```
"Find John Smith's email address"
```

**LLM Extracts:**
```json
{
  "operation": "lookup",
  "parameters": {
    "name": "John Smith"
  }
}
```

**Agent Maps to Service:**
```typescript
case 'lookup': {
  const { name, email } = parameters;
  const result = await contactService.searchContacts(name, authToken);
  return result.contacts[0]; // First match
}
```

---

## Why This Works

### 1. **LLM is Smart About Context**
The LLM understands:
- "tomorrow at 2pm" → converts to timestamp
- "john@example.com" → recognizes as email
- "Q4 Status" → extracts as subject
- "about deployment" → topic/keyword filter

### 2. **System Prompt Guides Extraction**
Each agent's `systemPrompt` tells the LLM:
- What domain it's in (email, calendar, contacts)
- What kind of data to look for
- How to structure the response

### 3. **Agents Just Map Parameters**
Agents don't parse natural language - they just:
1. Receive structured parameters from LLM
2. Map to service API signature
3. Handle defaults/validation

---

## What If LLM Extracts Wrong Parameters?

### Agent Validation

Agents can validate before calling service:

```typescript
case 'send': {
  const { to, subject, body } = parameters;

  // Validate
  if (!to) {
    throw new Error('Recipient email is required');
  }

  if (!this.isValidEmail(to)) {
    throw new Error('Invalid email address');
  }

  // Then call service
  return await gmailService.sendEmail(...);
}
```

### LLM Refinement

The base class can also ask the LLM to refine:

```typescript
// If confidence is low, ask for clarification
if (intent.confidence < 0.7) {
  return {
    response: "I'm not sure I understand. Did you want to send an email or search for one?",
    needsConfirmation: true
  };
}
```

---

## Alternative: Schema-Based Extraction (Not Used Currently)

**Could also provide explicit schemas:**

```typescript
protected getAgentConfig(): AgentConfig {
  return {
    operations: [
      {
        name: 'send',
        parameters: {
          to: { type: 'email', required: true },
          subject: { type: 'string', required: false },
          body: { type: 'string', required: true }
        }
      }
    ]
  };
}
```

But **LLM extraction is more flexible** - it can:
- Infer missing fields
- Convert formats (relative dates → timestamps)
- Handle ambiguity
- Adapt to different phrasings

---

## Summary

**How parameters get from natural language to service APIs:**

1. **User speaks natural language** → "Send email to john@example.com about project"

2. **LLM analyzes and extracts** →
   ```json
   {
     "operation": "send",
     "parameters": { "to": "john@example.com", "body": "project" }
   }
   ```

3. **Base class calls agent** → `executeOperation("send", {to: "...", body: "..."}, token)`

4. **Agent maps to service** → `gmailService.sendEmail(token, to, subject, body, options)`

5. **Service executes** → Makes Gmail API call

**The LLM is the "glue" that converts natural language → structured parameters.**

This is why agents are so simple - they just map LLM-extracted parameters to service APIs! 🎯