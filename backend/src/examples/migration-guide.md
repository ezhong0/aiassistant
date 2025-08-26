# BaseAgent Framework Migration Guide

## Overview

The new BaseAgent framework eliminates boilerplate code and provides consistent patterns across all agents. Here's how to migrate existing agents to the new framework.

## Quick Migration Steps

### 1. Update imports and extend BaseAgent

```typescript
// BEFORE
export class MyAgent {
  private systemPrompt = "...";
  
  async processQuery(request: MyRequest): Promise<MyResponse> {
    try {
      // validation logic
      // logging setup
      // business logic
      // error handling
      // response formatting
    } catch (error) {
      // manual error handling
    }
  }
}

// AFTER  
import { BaseAgent } from '../framework/base-agent';
import { ToolExecutionContext } from '../types/tools';

export class MyAgent extends BaseAgent<MyParams, MyResult> {
  constructor() {
    super({
      name: 'myAgent',
      description: 'What this agent does',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });
  }
  
  // Only business logic needed!
  protected async processQuery(params: MyParams, context: ToolExecutionContext): Promise<MyResult> {
    // Pure business logic - no boilerplate!
    return await this.doMyWork(params);
  }
}
```

### 2. Add parameter validation (optional override)

```typescript
protected validateParams(params: MyParams): void {
  super.validateParams(params); // Gets basic validation
  
  // Add specific validation
  if (!params.specificField) {
    throw this.createError('Specific field is required', 'MISSING_FIELD');
  }
}
```

### 3. Add pre/post execution hooks (optional)

```typescript
protected async beforeExecution(params: MyParams, context: ToolExecutionContext): Promise<void> {
  await super.beforeExecution(params, context);
  
  // Setup, auth checks, etc.
  await this.checkPermissions(context);
}

protected async afterExecution(result: MyResult, context: ToolExecutionContext): Promise<void> {
  await super.afterExecution(result, context);
  
  // Cleanup, notifications, caching, etc.
  await this.sendNotification(result);
}
```

### 4. Sanitize sensitive data from logs

```typescript
protected sanitizeForLogging(params: MyParams): any {
  return {
    ...params,
    password: '[REDACTED]',
    accessToken: '[REDACTED]',
    sensitiveData: params.sensitiveData ? '[PRESENT]' : undefined
  };
}
```

## Real Example: ContactAgent Migration

### Before (Original ContactAgent)
```typescript
export class ContactAgent {
  async processQuery(request: ContactAgentRequest, accessToken: string): Promise<ContactAgentResponse> {
    try {
      logger.info('ContactAgent processing query', { query: request.query });

      if (!accessToken) {
        return {
          success: false,
          message: 'Access token required for contact operations',
          error: 'MISSING_ACCESS_TOKEN'
        };
      }

      // Determine the operation type
      const operation = request.operation || this.determineOperation(request.query);
      
      switch (operation) {
        case 'search':
          return await this.handleSearchContacts(request, accessToken);
        // ... more cases
        default:
          return await this.handleSearchContacts(request, accessToken);
      }

    } catch (error) {
      logger.error('Error in ContactAgent.processQuery:', error);
      return {
        success: false,
        message: 'An error occurred while processing your contact request',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }
  
  // ... 200+ more lines of boilerplate
}
```

### After (Using BaseAgent)
```typescript
export class ContactAgent extends BaseAgent<ContactParams, ContactResult> {
  constructor() {
    super({
      name: 'contactAgent',
      description: 'Search and manage contacts from Google Contacts',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });
  }
  
  // Only business logic!
  protected async processQuery(params: ContactParams, context: ToolExecutionContext): Promise<ContactResult> {
    const operation = this.determineOperation(params.query);
    
    switch (operation) {
      case 'search':
        return await this.handleSearchContacts(params, context);
      case 'create':
        return await this.handleCreateContact(params, context);
      default:
        return await this.handleSearchContacts(params, context);
    }
  }
  
  protected validateParams(params: ContactParams): void {
    super.validateParams(params);
    
    if (params.maxResults && params.maxResults > 50) {
      throw this.createError('Maximum 50 results allowed', 'LIMIT_EXCEEDED');
    }
  }
  
  protected async beforeExecution(params: ContactParams, context: ToolExecutionContext): Promise<void> {
    await super.beforeExecution(params, context);
    
    const accessToken = this.getAccessToken(context);
    if (!accessToken) {
      throw this.createError('Access token required for contact operations', 'MISSING_ACCESS_TOKEN');
    }
  }
  
  protected sanitizeForLogging(params: ContactParams): any {
    return {
      ...params,
      accessToken: '[REDACTED]'
    };
  }
  
  // Private business logic methods...
  private async handleSearchContacts(params: ContactParams, context: ToolExecutionContext): Promise<ContactResult> {
    // Pure business logic
  }
}
```

## Benefits of Migration

### Code Reduction
- **Before**: 200-500 lines per agent (including boilerplate)
- **After**: 50-150 lines per agent (only business logic)
- **Reduction**: 60-80% less code per agent

### Consistency
- Standardized error handling across all agents
- Consistent logging format and metadata
- Uniform execution patterns and timeouts
- Standardized parameter validation

### Reliability
- Built-in retry mechanisms with exponential backoff
- Automatic timeout handling
- Structured error reporting
- Execution time tracking

### Maintainability
- Single place to update common patterns
- Type-safe with generics
- Clear separation of concerns
- Easy to test and mock

### Developer Experience
- Less boilerplate to write
- Consistent patterns to learn
- Better IDE support with types
- Clear hooks for customization

## Migration Checklist

- [ ] Create agent config with name, description, timeout, etc.
- [ ] Move business logic to `processQuery()` method
- [ ] Add parameter validation in `validateParams()` if needed
- [ ] Add setup logic in `beforeExecution()` if needed
- [ ] Add cleanup logic in `afterExecution()` if needed
- [ ] Sanitize sensitive data in `sanitizeForLogging()`
- [ ] Update agent registration to use new BaseAgent
- [ ] Test agent execution and error handling
- [ ] Verify logging output and metrics
- [ ] Update any tests to work with new structure

## Advanced Features

### Using Built-in Retry Logic
```typescript
protected async processQuery(params: MyParams, context: ToolExecutionContext): Promise<MyResult> {
  // Automatic retries for unreliable operations
  return await this.withRetries(async () => {
    return await this.callExternalAPI(params);
  }, 3, 1000); // 3 retries, 1 second delay
}
```

### Using Built-in Timeout Logic
```typescript
protected async processQuery(params: MyParams, context: ToolExecutionContext): Promise<MyResult> {
  // Automatic timeout handling
  return await this.withTimeout(
    this.longRunningOperation(params),
    15000 // 15 second timeout
  );
}
```

### AgentFactory Usage
```typescript
import { AgentFactory } from '../framework/agent-factory';

// Agents are automatically registered during initialization
// Access agents through the factory
const emailAgent = AgentFactory.getAgent('emailAgent');
if (emailAgent?.isEnabled()) {
  const result = await emailAgent.execute(params, context);
}
```

This framework provides a solid foundation for scalable, maintainable agent development while dramatically reducing boilerplate code!
