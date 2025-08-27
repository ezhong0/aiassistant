# 🧠 Multi-Agent System - AI Development Guide

## 🎯 **Agent System Vision**

This document describes the **multi-agent orchestration system** that powers the AI assistant. The system uses a plugin-based architecture where specialized agents handle specific domains while a master agent coordinates complex workflows.

## 🏗️ **Agent Architecture Overview**

### **System Architecture**
```
User Input → Master Agent → Tool Call Generation → Agent Execution → Result Aggregation
     ↓              ↓              ↓                ↓              ↓
Natural      OpenAI + Rule-    ToolCall[]      BaseAgent      ToolResult[]
Language    Based Routing     Generation      Execution      Collection
```

### **Core Components**
1. **Master Agent**: Intelligent routing and workflow orchestration
2. **Specialized Agents**: Domain-specific task execution
3. **Agent Factory**: Plugin registration and discovery
4. **Tool Executor**: Sequential agent execution and result management
5. **Base Agent Framework**: Consistent agent implementation patterns

## 🧠 **Master Agent System**

### **Dual Routing Architecture**
The Master Agent uses two routing strategies for reliability:

#### **1. OpenAI-Powered Routing (Primary)**
```typescript
// Uses GPT-4o-mini for intelligent tool selection
if (this.useOpenAI && this.openaiService) {
  try {
    const response = await this.openaiService.generateToolCalls(
      userInput, 
      systemPromptWithContext, 
      sessionId
    );
    
    toolCalls = response.toolCalls;
    message = response.message;
  } catch (openaiError) {
    // Fall back to rule-based routing
    logger.warn('OpenAI failed, falling back to rule-based routing:', openaiError);
    toolCalls = this.determineToolCalls(userInput);
    message = this.generateResponse(userInput, toolCalls);
  }
}
```

#### **2. Rule-Based Routing (Fallback)**
```typescript
// Keyword-based tool matching when OpenAI is unavailable
private determineToolCalls(userInput: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Use registry to find matching tools
  const matchingTools = AgentFactory.findMatchingTools(userInput);
  
  if (matchingTools.length > 0) {
    const primaryTool = matchingTools[0];
    
    // Check if we need contact lookup first
    if (this.needsContactLookup(userInput, primaryTool.name)) {
      const contactName = this.extractContactName(userInput);
      if (contactName) {
        toolCalls.push({
          name: 'contactAgent',
          parameters: { query: `get contact information for ${contactName}` }
        });
      }
    }
    
    // Add the primary tool
    toolCalls.push({
      name: primaryTool.name,
      parameters: { query: userInput }
    });
  }
  
  // Always add Think tool for verification
  toolCalls.push({
    name: 'Think',
    parameters: { 
      query: `Verify that the correct steps were taken for the user request: "${userInput}"`,
      previousActions: toolCalls.slice(0, -1)
    }
  });
  
  return toolCalls;
}
```

### **Smart Contact Resolution**
The Master Agent automatically detects when contact lookup is needed:

```typescript
private needsContactLookup(userInput: string, toolName: string): boolean {
  const input = userInput.toLowerCase();
  
  // Only email and calendar agents typically need contact lookup
  if (!['emailAgent', 'calendarAgent'].includes(toolName)) {
    return false;
  }
  
  // Don't need lookup if email address is already provided
  if (input.includes('@')) {
    return false;
  }
  
  // Check for name patterns in email/calendar contexts
  const hasNameReference = /\b(?:send|email|meeting|schedule|invite).*?(?:to|with)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i.test(input);
  
  return hasNameReference;
}
```

## 🔧 **Specialized Agent System**

### **Agent Categories**

#### **1. Communication Agents**
- **Email Agent**: Gmail operations and email management
- **Contact Agent**: Contact resolution and management

#### **2. Productivity Agents**
- **Calendar Agent**: Event scheduling and calendar management with Google Calendar API
- **Content Creator**: AI-powered content generation

#### **3. Intelligence Agents**
- **Think Agent**: Verification and reasoning
- **Tavily Agent**: Web search and information retrieval

### **Agent Implementation Pattern**

#### **Base Agent Framework**
```typescript
export abstract class BaseAgent<TParams = any, TResult = any> {
  protected logger: Logger;
  protected config: AgentConfig;
  
  constructor(config: AgentConfig) {
    this.config = config;
    this.logger = logger.child({ agent: config.name });
  }

  // Template method - handles all common concerns
  async execute(params: TParams, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Pre-execution hooks
      await this.beforeExecution(params, context);
      this.validateParams(params);
      
      this.logger.info('Agent execution started', { 
        params: this.sanitizeForLogging(params),
        sessionId: context.sessionId,
        userId: context.userId 
      });
      
      // Core business logic (implemented by subclass)
      const result = await this.processQuery(params, context);
      
      // Post-execution hooks
      await this.afterExecution(result, context);
      
      return this.createSuccessResult(result, Date.now() - startTime);
      
    } catch (error) {
      return this.createErrorResult(error as Error, Date.now() - startTime);
    }
  }
  
  // ABSTRACT METHODS - Must be implemented by subclasses
  protected abstract processQuery(params: TParams, context: ToolExecutionContext): Promise<TResult>;
  
  // OPTIONAL OVERRIDES - Can be customized by subclasses
  protected validateParams(params: TParams): void
  protected async beforeExecution(params: TParams, context: ToolExecutionContext): Promise<void>
  protected async afterExecution(result: TResult, context: ToolExecutionContext): Promise<void>
  protected sanitizeForLogging(params: TParams): any
}
```

#### **Agent Configuration**
```typescript
export interface AgentConfig {
  name: string;
  description: string;
  enabled: boolean;
  timeout: number;
  retryCount: number;
}

// Example agent configuration
const emailAgentConfig: AgentConfig = {
  name: 'emailAgent',
  description: 'Handles email operations via Gmail API',
  enabled: true,
  timeout: 30000,  // 30 seconds
  retryCount: 3
};
```

### **Individual Agent Implementations**

#### **1. Email Agent**
**File**: `backend/src/agents/email.agent.ts`

**Capabilities**:
- Send emails with natural language processing
- Reply to email threads
- Search and retrieve emails
- Create and manage drafts
- Get email threads and conversations

**Implementation**:
```typescript
export class EmailAgent extends BaseAgent<EmailAgentRequest, EmailResult> {
  constructor() {
    super({
      name: 'emailAgent',
      description: 'Handles email operations via Gmail API',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });
  }
  
  protected async processQuery(params: EmailAgentRequest, context: ToolExecutionContext): Promise<EmailResult> {
    const { query, accessToken, contacts } = params;
    
    // Determine action type from query
    const action = this.determineAction(query);
    
    switch (action.type) {
      case 'SEND_EMAIL':
        return await this.handleSendEmail(params, action.params);
      case 'REPLY_EMAIL':
        return await this.handleReplyEmail(params, action.params);
      case 'SEARCH_EMAILS':
        return await this.handleSearchEmails(params, action.params);
      case 'CREATE_DRAFT':
        return await this.handleCreateDraft(params, action.params);
      case 'GET_EMAIL':
        return await this.handleGetEmail(params, action.params);
      case 'GET_THREAD':
        return await this.handleGetThread(params, action.params);
      default:
        throw this.createError(`Unknown email action: ${action.type}`, 'UNKNOWN_ACTION');
    }
  }
}
```

#### **2. Contact Agent**
**File**: `backend/src/agents/contact.agent.ts`

**Capabilities**:
- Search contacts with fuzzy matching
- Resolve names to email addresses
- Access Google Contacts and People APIs
- Analyze email interaction history

**Implementation**:
```typescript
export class ContactAgent extends BaseAgent<ContactAgentRequest, ContactResult> {
  constructor() {
    super({
      name: 'contactAgent',
      description: 'Search and manage contacts from Google Contacts and email history',
      enabled: true,
      timeout: 15000,
      retryCount: 2
    });
  }
  
  protected async processQuery(params: ContactAgentRequest, context: ToolExecutionContext): Promise<ContactResult> {
    const { query, accessToken } = params;
    
    // Determine the operation type
    const operation = params.operation || this.determineOperation(query);
    
    switch (operation) {
      case 'search':
        return await this.handleSearchContacts(params);
      case 'create':
        return await this.handleCreateContact(params);
      case 'update':
        return await this.handleUpdateContact(params);
      default:
        return await this.handleSearchContacts(params);
    }
  }
}
```

#### **3. Think Agent**
**File**: `backend/src/agents/think.agent.ts`

**Capabilities**:
- Analyze tool usage appropriateness
- Verify workflow correctness
- Provide reasoning for decisions
- Suggest improvements

**Implementation**:
```typescript
export class ThinkAgent extends BaseAgent<ThinkParams, ThinkAgentResponse> {
  constructor() {
    super({
      name: 'Think',
      description: 'Analyze and reason about user requests, verify correct actions were taken',
      enabled: true,
      timeout: 15000,
      retryCount: 2
    });
  }
  
  private readonly systemPrompt = `# Think Agent - Reflection and Verification
You are a specialized thinking and verification agent that analyzes whether the correct steps were taken for user requests.

## Core Responsibilities
1. **Reflection**: Analyze if the right tools were selected and used appropriately
2. **Verification**: Determine if the actions taken align with the user's intent
3. **Reasoning**: Provide clear explanations for tool usage decisions
4. **Suggestions**: Offer improvements when suboptimal approaches were taken

## Analysis Framework
When analyzing tool usage, consider:

### Tool Appropriateness
- **Correct**: Tool perfectly matches the user's intent and need
- **Incorrect**: Wrong tool chosen, will not achieve the desired outcome
- **Suboptimal**: Tool works but there's a better approach available

### Verification Status
- **correct**: All steps taken were appropriate and complete
- **incorrect**: Major errors in tool selection or approach
- **partial**: Some correct steps but missing critical components
- **unclear**: Insufficient information to determine correctness
`;
}
```

## 🏭 **Agent Factory System**

### **Factory Architecture**
```typescript
export class AgentFactory {
  private static agents = new Map<string, BaseAgent>();
  private static toolMetadata = new Map<string, ToolMetadata>();
  private static initialized = false;
  
  // Agent registration
  static registerAgent(name: string, agent: BaseAgent): void
  static registerAgentClass<TParams, TResult>(
    name: string, 
    AgentClass: new () => BaseAgent<TParams, TResult>
  ): void
  
  // Tool metadata management
  static registerToolMetadata(metadata: ToolMetadata): void
  static getToolMetadata(name: string): ToolMetadata | undefined
  
  // Agent discovery
  static getAgent(name: string): BaseAgent | undefined
  static getAllAgents(): BaseAgent[]
  static findMatchingTools(userInput: string): ToolMetadata[]
  
  // Statistics and monitoring
  static getStats(): AgentFactoryStats
  static generateOpenAIFunctions(): OpenAI.Function[]
}
```

### **Tool Metadata Structure**
```typescript
export interface ToolMetadata {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  keywords: string[];
  requiresConfirmation: boolean;
  isCritical: boolean;
  isReadOnly?: boolean;
  requiresAuth?: boolean;
  hasExternalEffects?: boolean;
}
```

### **Factory Initialization**
```typescript
export const initializeAgentFactory = (): void => {
  try {
    logger.info('Initializing AgentFactory...');
    
    // Register core agents
    AgentFactory.registerAgentClass('emailAgent', EmailAgent);
    AgentFactory.registerAgentClass('contactAgent', ContactAgent);
    AgentFactory.registerAgentClass('Think', ThinkAgent);
    AgentFactory.registerAgentClass('calendarAgent', CalendarAgent);
    AgentFactory.registerAgentClass('contentCreator', ContentCreatorAgent);
    AgentFactory.registerAgentClass('Tavily', TavilyAgent);
    
    // Register tool metadata for all agents
    AgentFactory.registerToolMetadata({
      name: 'Think',
      description: 'Analyze and reason about user requests, verify correct actions were taken',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The query or request to analyze and think about'
          },
          context: {
            type: 'string',
            description: 'Additional context for analysis',
            nullable: true
          },
          previousActions: {
            type: 'array',
            description: 'Previous tool calls that were executed',
            items: { type: 'object' },
            nullable: true
          }
        },
        required: ['query']
      },
      keywords: AGENT_CONFIG.think.keywords,
      requiresConfirmation: AGENT_CONFIG.think.requiresConfirmation,
      isCritical: AGENT_CONFIG.think.isCritical
    });
    
    logger.info('AgentFactory initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize AgentFactory:', error);
    throw error;
  }
};
```

## ⚙️ **Tool Execution System**

### **Tool Executor Service**
```typescript
export class ToolExecutorService implements IService {
  private sessionService: SessionService;
  
  constructor() {
    this.sessionService = getService<SessionService>('sessionService')!;
  }
  
  async executeToolCalls(toolCalls: ToolCall[], context: ToolExecutionContext): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (const toolCall of toolCalls) {
      try {
        const startTime = Date.now();
        
        // Get agent from factory
        const agent = AgentFactory.getAgent(toolCall.name);
        if (!agent) {
          results.push(this.createErrorResult(
            new Error(`Agent not found: ${toolCall.name}`),
            context
          ));
          continue;
        }
        
        // Execute agent
        const result = await agent.execute(toolCall.parameters, context);
        results.push(result);
        
        // Stop on critical failures
        if (result.error && this.isCriticalTool(toolCall.name)) {
          logger.error(`Critical tool ${toolCall.name} failed, stopping execution`);
          break;
        }
        
        const executionTime = Date.now() - startTime;
        logger.info(`Tool ${toolCall.name} executed in ${executionTime}ms`);
        
      } catch (error) {
        results.push(this.createErrorResult(error as Error, context));
      }
    }
    
    return results;
  }
  
  private isCriticalTool(toolName: string): boolean {
    const metadata = AgentFactory.getToolMetadata(toolName);
    return metadata?.isCritical || false;
  }
}
```

## 🔄 **Workflow Patterns**

### **1. Simple Single-Agent Workflow**
```typescript
// User: "What's the weather today?"
const toolCalls = [
  {
    name: 'Tavily',
    parameters: { query: 'current weather' }
  },
  {
    name: 'Think',
    parameters: { query: 'Verify weather information was retrieved' }
  }
];
```

### **2. Multi-Agent Sequential Workflow**
```typescript
// User: "Send an email to John about the quarterly review meeting"
const toolCalls = [
  {
    name: 'contactAgent',
    parameters: { query: 'get contact information for John' }
  },
  {
    name: 'emailAgent',
    parameters: { query: 'send email to John about quarterly review meeting' }
  },
  {
    name: 'Think',
    parameters: { 
      query: 'Verify contact was found and email was sent',
      previousActions: [/* previous tool calls */]
    }
  }
];
```

### **3. Conditional Workflow**
```typescript
// User: "Schedule a meeting with the team and send them the agenda"
const toolCalls = [
  {
    name: 'contactAgent',
    parameters: { query: 'get team contact information' }
  },
  {
    name: 'calendarAgent',
    parameters: { query: 'schedule team meeting' }
  },
  {
    name: 'contentCreator',
    parameters: { query: 'create meeting agenda' }
  },
  {
    name: 'emailAgent',
    parameters: { query: 'send agenda to team' }
  },
  {
    name: 'Think',
    parameters: { 
      query: 'Verify meeting scheduled and agenda sent',
      previousActions: [/* previous tool calls */]
    }
  }
];
```

## 🧪 **Testing Agent System**

### **Test Structure**
```
tests/ai-behavior/
├── context-continuity/      # Conversation context tests
├── decision-quality/         # Agent decision validation
├── error-recovery/          # Error handling tests
├── intent-recognition/      # Intent understanding tests
└── workflow-validation/     # Multi-agent workflow tests
```

### **Testing Patterns**

#### **1. Agent Behavior Testing**
```typescript
describe('Master Agent Routing', () => {
  it('should route email requests to emailAgent', async () => {
    const response = await masterAgent.processUserInput(
      'Send an email to john about the meeting',
      'test-session-id'
    );
    
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({ name: 'emailAgent' })
    );
  });
  
  it('should include contact lookup for name-based email requests', async () => {
    const response = await masterAgent.processUserInput(
      'Send an email to john about the meeting',
      'test-session-id'
    );
    
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({ name: 'contactAgent' })
    );
    
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({ name: 'emailAgent' })
    );
  });
});
```

#### **2. Workflow Validation Testing**
```typescript
describe('Multi-Agent Workflows', () => {
  it('should execute contact lookup before email sending', async () => {
    const toolCalls = [
      { name: 'contactAgent', parameters: { query: 'get contact for john' } },
      { name: 'emailAgent', parameters: { query: 'send email to john' } }
    ];
    
    const results = await toolExecutor.executeToolCalls(toolCalls, context);
    
    expect(results[0].error).toBeFalsy(); // contactAgent should succeed
    expect(results[1].error).toBeFalsy(); // emailAgent should succeed
  });
});
```

## 📊 **Agent Performance Monitoring**

### **Execution Metrics**
```typescript
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  metadata?: {
    agentName: string;
    sessionId: string;
    userId?: string;
    timestamp: string;
  };
}
```

### **Performance Tracking**
```typescript
// Track execution times for optimization
logger.info(`Tool ${toolCall.name} executed in ${executionTime}ms`, {
  agentName: toolCall.name,
  executionTime,
  sessionId: context.sessionId,
  success: !result.error
});

// Monitor agent success rates
const successRate = results.filter(r => !r.error).length / results.length;
logger.info(`Workflow execution completed with ${(successRate * 100).toFixed(1)}% success rate`);
```

## 🔍 **Debugging and Troubleshooting**

### **Agent Debugging**
```typescript
// Enable debug logging for specific agents
logger.debug(`Agent ${agentName} execution details`, {
  params: toolCall.parameters,
  context: {
    sessionId: context.sessionId,
    userId: context.userId,
    timestamp: new Date().toISOString()
  }
});

// Log agent state and configuration
logger.debug(`Agent ${agentName} configuration`, {
  config: agent.getConfig(),
  enabled: agent.isEnabled(),
  timeout: agent.getConfig().timeout
});
```

### **Workflow Debugging**
```typescript
// Log complete workflow execution
logger.info(`Workflow execution started`, {
  toolCalls: toolCalls.map(tc => ({ name: tc.name, parameters: tc.parameters })),
  sessionId: context.sessionId,
  userId: context.userId
});

// Log intermediate results
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  const toolCall = toolCalls[i];
  
  logger.info(`Tool ${toolCall.name} result`, {
    success: !result.error,
    executionTime: result.executionTime,
    error: result.error,
    data: result.data
  });
}
```

## 🚀 **Extending the Agent System**

### **Adding New Agents**
1. **Create Agent Class**: Extend BaseAgent
2. **Implement processQuery**: Core business logic
3. **Register with Factory**: Add to AgentFactory.initialize()
4. **Add Metadata**: Register tool metadata
5. **Write Tests**: Comprehensive test coverage

### **Example: New Calendar Agent**
```typescript
export class CalendarAgent extends BaseAgent<CalendarAgentRequest, CalendarResult> {
  constructor() {
    super({
      name: 'calendarAgent',
      description: 'Create, update, and manage calendar events',
      enabled: true,
      timeout: 20000,
      retryCount: 2
    });
  }
  
  protected async processQuery(params: CalendarAgentRequest, context: ToolExecutionContext): Promise<CalendarResult> {
    // Implementation for calendar operations
    const { query, accessToken } = params;
    
    // Parse calendar intent from query
    const intent = this.parseCalendarIntent(query);
    
    switch (intent.action) {
      case 'CREATE_EVENT':
        return await this.createEvent(intent, accessToken);
      case 'UPDATE_EVENT':
        return await this.updateEvent(intent, accessToken);
      case 'DELETE_EVENT':
        return await this.deleteEvent(intent, accessToken);
      default:
        throw this.createError(`Unknown calendar action: ${intent.action}`, 'UNKNOWN_ACTION');
    }
  }
  
  private parseCalendarIntent(query: string): CalendarIntent {
    // Natural language parsing for calendar operations
    // Implementation details...
  }
}
```

### **Agent Configuration Updates**
```typescript
// Add to agent-config.ts
export const AGENT_CONFIG = {
  // ... existing agents
  calendar: {
    keywords: ['calendar', 'meeting', 'schedule', 'event', 'appointment', 'book'],
    description: 'Create, update, and manage calendar events',
    requiresConfirmation: true,
    isCritical: true,
    requiresAuth: true,
    hasExternalEffects: true
  }
};

// Add to agent-factory-init.ts
AgentFactory.registerAgentClass('calendarAgent', CalendarAgent);
```

This multi-agent system provides a robust, extensible foundation for AI-powered task execution with clear patterns for development and testing.
