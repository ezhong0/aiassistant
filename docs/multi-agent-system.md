# 🧠 Multi-Agent System

The AI Assistant Platform's core intelligence comes from a sophisticated multi-agent system where specialized agents handle specific domains while a Master Agent orchestrates complex workflows.

## 🎯 **System Overview**

The multi-agent system uses **AI-first architecture** with OpenAI GPT-4o-mini for intelligent routing and tool selection, combined with rule-based fallbacks for reliability.

### **Agent Hierarchy**

```
                    Master Agent
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Email Agent    Calendar Agent    Contact Agent
        │                │                │
   Gmail Service   Calendar Service  Contact Service
        │                │                │
   Google APIs     Google APIs      Google APIs
```

## 🤖 **Agent Specifications**

### **Master Agent**
- **Purpose**: Workflow orchestration and intelligent routing
- **AI Model**: OpenAI GPT-4o-mini
- **Capabilities**: 
  - Natural language understanding
  - Tool call generation
  - Workflow orchestration
  - Context management
- **Confirmation Required**: No
- **External APIs**: OpenAI API

### **Email Agent**
- **Purpose**: Gmail operations and email management
- **Capabilities**:
  - Send emails with natural language
  - Search and filter emails
  - Reply to emails
  - Draft management
  - Attachment handling
- **Confirmation Required**: Yes (for send operations)
- **External APIs**: Gmail API

### **Calendar Agent**
- **Purpose**: Calendar events and scheduling
- **Capabilities**:
  - Create calendar events
  - Update existing events
  - Check availability
  - Find meeting times
  - Manage attendees
- **Confirmation Required**: Yes (for create/update operations)
- **External APIs**: Google Calendar API

### **Contact Agent**
- **Purpose**: Contact search and management
- **Capabilities**:
  - Search contacts by name
  - Find email addresses
  - Contact information lookup
  - Email history analysis
- **Confirmation Required**: No
- **External APIs**: Google People API

### **Slack Agent**
- **Purpose**: Message reading and confirmation handling
- **Capabilities**:
  - Read message history
  - Detect draft messages
  - Handle confirmations
  - Thread management
- **Confirmation Required**: No
- **External APIs**: Slack API

### **Think Agent**
- **Purpose**: Verification and quality assurance
- **Capabilities**:
  - Analyze tool usage correctness
  - Verify action appropriateness
  - Provide reasoning explanations
  - Suggest improvements
- **Confirmation Required**: No
- **External APIs**: OpenAI API

## 🔄 **Agent Communication Flow**

### **Request Processing Pipeline**

1. **User Input Reception**
   - Natural language command received
   - Context and session information gathered
   - Input validation and sanitization

2. **Master Agent Analysis**
   - Intent analysis using OpenAI GPT-4o-mini
   - Tool call generation based on capabilities
   - Workflow planning and sequencing

3. **Tool Execution**
   - Sequential execution of generated tool calls
   - Dependency resolution (e.g., contact lookup before email)
   - Error handling and retry logic

4. **Result Aggregation**
   - Collection of results from all executed tools
   - Data formatting and normalization
   - Context preservation for follow-up requests

5. **Think Agent Verification**
   - Analysis of executed actions
   - Verification of correctness
   - Quality assurance and improvement suggestions

6. **Response Generation**
   - Natural language response creation
   - User-friendly formatting
   - Action confirmation requests (if needed)

### **Agent Orchestration Patterns**

#### **Sequential Execution**
```
User: "Send an email to John about the meeting"
Master Agent → Contact Agent (find John's email)
Contact Agent → Email Agent (send email with John's address)
Email Agent → Think Agent (verify correct execution)
```

#### **Parallel Execution**
```
User: "Check my calendar and find John's email"
Master Agent → [Calendar Agent, Contact Agent] (parallel execution)
Both Agents → Think Agent (verify both results)
```

#### **Conditional Execution**
```
User: "Send email to John if he's available tomorrow"
Master Agent → Contact Agent (find John)
Contact Agent → Calendar Agent (check John's availability)
Calendar Agent → Email Agent (send only if available)
```

## 🛠️ **Agent Development Framework**

### **Base Agent Class**

All agents extend the `AIAgent` base class which provides:

```typescript
export abstract class AIAgent<TParams, TResult> {
  protected abstract systemPrompt: string;
  protected abstract processQuery(params: TParams, context: ToolExecutionContext): Promise<TResult>;
  
  // Common functionality
  public async execute(params: TParams, context: ToolExecutionContext): Promise<ToolResult>;
  public isEnabled(): boolean;
  public getConfig(): AgentConfig;
  public getTimeout(): number;
  public getRetries(): number;
}
```

### **Agent Registration**

Agents are registered with the AgentFactory:

```typescript
// Agent registration
AgentFactory.registerAgentClass('emailAgent', EmailAgent);
AgentFactory.registerAgentClass('contactAgent', ContactAgent);
AgentFactory.registerAgentClass('calendarAgent', CalendarAgent);
AgentFactory.registerAgentClass('Think', ThinkAgent);
AgentFactory.registerAgentClass('slackAgent', SlackAgent);
```

### **Tool Metadata**

Each agent provides metadata for OpenAI function calling:

```typescript
interface ToolMetadata {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  requiresConfirmation: boolean;
  isCritical: boolean;
}
```

## 🎯 **AI-Powered Routing**

### **OpenAI Function Calling**

The Master Agent uses OpenAI's function calling feature to intelligently select tools:

```typescript
const response = await openaiService.generateToolCalls(
  userInput,
  systemPromptWithContext,
  sessionId
);
```

### **System Prompt Engineering**

The Master Agent uses dynamic system prompts that include:

- **Current Context**: Date, time, timezone information
- **Available Tools**: Dynamic list of registered agents
- **Capability Descriptions**: What each agent can do
- **Usage Guidelines**: Best practices for tool selection
- **Orchestration Rules**: When to use multiple agents

### **Fallback Mechanisms**

When OpenAI is unavailable, the system falls back to:

1. **Rule-Based Routing**: Keyword matching and pattern recognition
2. **Capability Mapping**: Direct mapping of user intent to agent capabilities
3. **Default Behaviors**: Safe defaults for common operations

## 🔍 **Agent Capabilities**

### **Email Agent Capabilities**

```typescript
const emailCapabilities = {
  send_email: 'Send emails with natural language descriptions',
  reply_email: 'Reply to existing email threads',
  search_email: 'Search and filter emails by criteria',
  draft_email: 'Create email drafts for later sending',
  manage_gmail: 'General Gmail account management'
};
```

### **Calendar Agent Capabilities**

```typescript
const calendarCapabilities = {
  create_events: 'Create new calendar events',
  schedule_meetings: 'Schedule meetings with attendees',
  manage_calendar: 'General calendar management',
  check_availability: 'Check user or attendee availability'
};
```

### **Contact Agent Capabilities**

```typescript
const contactCapabilities = {
  search_contacts: 'Search contacts by name or criteria',
  find_people: 'Find people across different sources',
  lookup_email: 'Lookup email addresses for contacts',
  contact_management: 'General contact management'
};
```

## 🧪 **Agent Testing**

### **Unit Testing**

Each agent has comprehensive unit tests:

```typescript
describe('EmailAgent', () => {
  it('should send email with natural language', async () => {
    const result = await emailAgent.execute({
      query: 'Send an email to john@example.com about the meeting'
    }, mockContext);
    
    expect(result.success).toBe(true);
    expect(result.result.messageId).toBeDefined();
  });
});
```

### **Integration Testing**

Multi-agent workflows are tested end-to-end:

```typescript
describe('Multi-Agent Workflow', () => {
  it('should find contact and send email', async () => {
    const result = await masterAgent.processUserInput(
      'Send an email to John about the meeting',
      sessionId,
      userId
    );
    
    expect(result.toolCalls).toContain('contactAgent');
    expect(result.toolCalls).toContain('emailAgent');
    expect(result.toolCalls).toContain('Think');
  });
});
```

## 🔧 **Configuration**

### **Agent Configuration**

Agents can be configured through the `AGENT_CONFIG`:

```typescript
export const AGENT_CONFIG = {
  email: {
    description: 'Send, reply to, search, and manage emails using Gmail API',
    capabilities: ['send_email', 'reply_email', 'search_email', 'draft_email'],
    requiresConfirmation: true,
    isCritical: true,
    requiresAuth: true,
    hasExternalEffects: true
  }
};
```

### **AI Configuration**

AI behavior is configured through the `AIConfigService`:

```typescript
const aiConfig = {
  model: 'gpt-4o-mini',
  temperature: 0.1,
  maxTokens: 1000,
  timeout: 30000,
  retries: 3
};
```

## 🚀 **Performance Optimization**

### **Caching Strategy**

- **Agent Results**: Cache frequently accessed data
- **OpenAI Responses**: Cache similar queries
- **External API Calls**: Cache contact lookups and calendar data

### **Parallel Execution**

- **Independent Operations**: Execute non-dependent agents in parallel
- **Batch Processing**: Group similar operations together
- **Async Processing**: Use async/await for non-blocking operations

### **Error Handling**

- **Circuit Breakers**: Prevent cascade failures
- **Retry Logic**: Automatic retry with exponential backoff
- **Graceful Degradation**: Fallback to simpler operations

## 📊 **Monitoring & Analytics**

### **Agent Performance Metrics**

- **Execution Time**: Track how long each agent takes
- **Success Rate**: Monitor agent success/failure rates
- **Tool Usage**: Analyze which agents are used most
- **Error Patterns**: Identify common failure modes

### **AI Model Performance**

- **Token Usage**: Monitor OpenAI API usage
- **Response Quality**: Track user satisfaction
- **Routing Accuracy**: Measure correct tool selection
- **Fallback Usage**: Track when fallbacks are used

---

**🧠 The multi-agent system provides intelligent, context-aware automation that can handle complex workflows while maintaining reliability and user safety.**
