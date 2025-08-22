# BaseAgent Framework Integration Guide

## Overview

The migration to BaseAgent framework has been completed successfully! This guide shows how all the components work together and how to use the new system.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   MasterAgent   │    │  AgentFactory   │
│  (Orchestrator) │────│  (Tool System)  │
└─────────────────┘    └─────────────────┘
         │                       │
         │              ┌────────┼────────┐
         │              │                 │
         ▼              ▼                 ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   BaseAgent     │    │   BaseAgent     │    │   BaseAgent     │
│  (EmailAgent)   │    │ (ContactAgent)  │    │ (FutureAgents)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## What Changed

### ✅ Completed Migrations

#### 1. EmailAgent (974 → 400 lines, ~60% reduction)
- **Before**: Manual error handling, inconsistent logging, duplicate validation
- **After**: Clean business logic with automatic reliability features

#### 2. ContactAgent (295 → 150 lines, ~50% reduction)  
- **Before**: Boilerplate error handling and response formatting
- **After**: Focused contact search logic with standardized patterns

#### 3. MasterAgent (263 lines, kept separate)
- **Decision**: Remains separate as it's an orchestrator, not a task executor
- **Role**: Routes user queries to appropriate BaseAgent instances

## Quick Start

### 1. Initialize the System

```typescript
import { AgentFactory, initializeAgentFactory } from '../framework/agent-factory';

// Initialize the AgentFactory system
initializeAgentFactory();

// Verify initialization
console.log('System stats:', {
  factory: AgentFactory.getStats(),
  agents: AgentFactory.getAllAgentNames(),
  metadata: AgentFactory.getAllToolMetadata()
});
```

### 2. Execute Agents Directly

```typescript
import { executeAgent } from '../framework/agent-factory';
import { ToolExecutionContext } from '../types/tools';

const context: ToolExecutionContext = {
  sessionId: 'session-123',
  userId: 'user-456',
  timestamp: new Date()
};

// Execute email agent
const emailResult = await executeAgent('emailAgent', {
  query: 'send email to john@example.com about meeting',
  accessToken: 'your-token-here'
}, context);

// Execute contact agent
const contactResult = await executeAgent('contactAgent', {
  query: 'find contact for John Smith',
  accessToken: 'your-token-here'
}, context);
```

### 3. Use via AgentFactory Tool Interface

```typescript
import { AgentFactory } from '../framework/agent-factory';

const toolCall = {
  name: 'emailAgent',
  parameters: {
    query: 'send email to john@example.com',
    accessToken: 'your-token-here'
  }
};

const result = await AgentFactory.executeAgent(toolCall.name, toolCall.parameters, context);
```

## Code Comparison

### Before: EmailAgent (Old Pattern)
```typescript
export class EmailAgent {
  async processQuery(request: EmailAgentRequest): Promise<EmailAgentResponse> {
    try {
      logger.info('EmailAgent processing query', { query: request.query });

      if (!request.accessToken) {
        return {
          success: false,
          message: 'Access token required for email operations',
          error: 'MISSING_ACCESS_TOKEN'
        };
      }

      // Determine the action type
      const action = this.determineAction(request.query);
      
      switch (action.type) {
        case 'SEND_EMAIL':
          return await this.handleSendEmail(request, action.params);
        // ... more manual error handling
      }
    } catch (error) {
      logger.error('Error in EmailAgent.processQuery:', error);
      return {
        success: false,
        message: 'An error occurred while processing your email request',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }
}
```

### After: EmailAgent (BaseAgent Pattern)
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
  
  // Only business logic - no boilerplate!
  protected async processQuery(params: EmailAgentRequest, context: ToolExecutionContext): Promise<EmailResult> {
    const { query, accessToken, contacts } = params;
    
    const action = this.determineAction(query);
    
    switch (action.type) {
      case 'SEND_EMAIL':
        return await this.handleSendEmail(params, action.params);
      // ... clean business logic only
    }
  }
  
  // Automatic error handling, logging, retries, timeouts via BaseAgent!
}
```

## Key Benefits Achieved

### 1. Code Reduction
- **EmailAgent**: 974 → 400 lines (60% reduction)
- **ContactAgent**: 295 → 150 lines (50% reduction)
- **Total**: ~700 lines of boilerplate eliminated

### 2. Consistency
- Standardized error handling across all agents
- Consistent logging format with structured metadata
- Uniform execution patterns and response formats
- Standardized parameter validation

### 3. Reliability Features (Automatic)
- Built-in retry mechanisms with exponential backoff
- Automatic timeout handling
- Execution time tracking
- Structured error reporting
- Pre/post execution hooks

### 4. Developer Experience
- Less boilerplate code to write and maintain
- Clear separation of concerns
- Type-safe with generics
- Easy to add new agents
- Comprehensive logging and debugging

## Adding New Agents

### 1. Create New Agent Class
```typescript
export class NewAgent extends BaseAgent<NewParams, NewResult> {
  constructor() {
    super({
      name: 'newAgent',
      description: 'What this agent does',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });
  }
  
  protected async processQuery(params: NewParams, context: ToolExecutionContext): Promise<NewResult> {
    // Pure business logic only
    return await this.doWork(params);
  }
  
  // Optional: custom validation
  protected validateParams(params: NewParams): void {
    super.validateParams(params);
    // Add specific validation
  }
  
  // Optional: setup/cleanup hooks
  protected async beforeExecution(params: NewParams, context: ToolExecutionContext): Promise<void> {
    await super.beforeExecution(params, context);
    // Setup logic
  }
}
```

### 2. Register with AgentFactory
```typescript
// In agent-factory.ts initialization
AgentFactory.registerAgentClass('newAgent', NewAgent);
```

### 3. Ready to Use!
```typescript
const result = await executeAgent('newAgent', params, context);
```

## Testing Patterns

### Unit Testing
```typescript
describe('EmailAgent', () => {
  let agent: EmailAgent;
  
  beforeEach(() => {
    agent = new EmailAgent();
  });
  
  it('should validate parameters', () => {
    const validation = agent.validateParameters({});
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Access token is required');
  });
  
  it('should execute email sending', async () => {
    const context = { sessionId: 'test', timestamp: new Date() };
    const params = {
      query: 'send email to test@example.com',
      accessToken: 'valid-token'
    };
    
    const result = await agent.execute(params, context);
    expect(result.success).toBe(true);
  });
});
```

### Integration Testing
```typescript
describe('AgentFactory Integration', () => {
  beforeAll(() => {
    AgentFactory.initialize();
  });
  
  it('should execute agents via factory', async () => {
    const result = await AgentFactory.executeAgent('emailAgent', params, context);
    expect(result.success).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
  });
});
```

## Performance Monitoring

### Built-in Metrics
Every agent execution automatically tracks:
- Execution time
- Success/failure rates  
- Error types and frequencies
- Parameter validation failures
- Retry attempts

### Accessing Metrics
```typescript
// Get agent statistics
const stats = AgentFactory.getStats();
console.log(`${stats.enabledAgents} agents enabled`);

// Get execution results
const result = await executeAgent('emailAgent', params, context);
console.log(`Execution took ${result.executionTime}ms`);

// System stats
const stats = AgentFactory.getStats();
console.log(`Total agents available: ${stats.totalAgents}`);
console.log(`Active agents: ${stats.activeAgents}`);
```

## Best Practices

### 1. Agent Design
- Keep `processQuery()` focused on business logic only
- Use pre/post execution hooks for setup/cleanup
- Sanitize sensitive data in `sanitizeForLogging()`
- Add specific validation in `validateParameters()`

### 2. Error Handling
- Let BaseAgent handle common errors automatically
- Use `this.createError()` for business logic errors
- Provide descriptive error messages and codes

### 3. Configuration
- Set appropriate timeouts for agent operations
- Configure retry counts based on operation reliability
- Use descriptive names and descriptions

### 4. Testing
- Test business logic in isolation
- Mock external dependencies
- Test error conditions and edge cases
- Verify execution metrics

## Troubleshooting

### Common Issues

1. **Agent Not Found**
   ```
   Solution: Ensure agent is registered in AgentFactory.initialize()
   ```

2. **Parameter Validation Fails**
   ```
   Solution: Check parameter types and required fields
   ```

3. **Execution Timeouts**
   ```
   Solution: Increase timeout in agent config or optimize logic
   ```

4. **Missing Access Token**
   ```
   Solution: Ensure accessToken is passed in parameters
   ```

### Debugging
```typescript
// Enable detailed logging
const agent = AgentFactory.getAgent('emailAgent');
console.log('Agent info:', AgentFactory.getAgentInfo('emailAgent'));

// Check factory stats
console.log('Factory stats:', AgentFactory.getStats());

// Validate all agents
const validation = AgentFactory.validateAgents();
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

This migration provides a solid foundation for scalable, maintainable agent development while dramatically reducing boilerplate code and improving consistency across the system! 🎉
