# Agent Development Guide

Complete guide for developing AI agents using the BaseAgent framework.

## Overview

The BaseAgent framework eliminates boilerplate code and provides consistent patterns for AI agent development. It uses the Template Method pattern to handle common concerns while allowing customization of business logic.

## Quick Start

### Creating a New Agent

```typescript
import { BaseAgent } from '../framework/base-agent';
import { ToolExecutionContext, ToolResult } from '../types/tools';

// Define your parameter and result types
interface WeatherParams {
  location: string;
  accessToken?: string;
}

interface WeatherResult {
  temperature: number;
  condition: string;
  forecast: string;
}

export class WeatherAgent extends BaseAgent<WeatherParams, WeatherResult> {
  constructor() {
    super({
      name: 'weatherAgent',
      description: 'Provides weather information and forecasts',
      enabled: true,
      timeout: 15000,    // 15 seconds
      retryCount: 3      // 3 retry attempts
    });
  }

  // Only business logic needed - no boilerplate!
  protected async processQuery(params: WeatherParams, context: ToolExecutionContext): Promise<WeatherResult> {
    const weatherData = await this.fetchWeatherData(params.location);
    
    return {
      temperature: weatherData.temp,
      condition: weatherData.condition,
      forecast: weatherData.forecast
    };
  }

  // Private business logic methods
  private async fetchWeatherData(location: string) {
    // Your weather API integration
    const response = await fetch(`https://api.weather.com/v1/current?q=${location}`);
    return response.json();
  }
}
```

### Registering the Agent

```typescript
// In agent-factory.ts or your initialization code
import { AgentFactory } from '../framework/agent-factory';
import { WeatherAgent } from '../agents/weather.agent';

// Register the agent class
AgentFactory.registerAgentClass('weatherAgent', WeatherAgent);

// Now you can use it
const result = await AgentFactory.executeAgent('weatherAgent', 
  { location: 'New York' }, 
  context
);
```

## BaseAgent Framework

### What BaseAgent Provides

The BaseAgent framework automatically handles:

✅ **Error Handling** - Consistent error catching and formatting  
✅ **Logging** - Structured logging with metadata  
✅ **Parameter Validation** - Basic and custom validation  
✅ **Execution Tracking** - Timing and performance metrics  
✅ **Retry Logic** - Configurable retry mechanisms  
✅ **Timeout Handling** - Operation timeouts  
✅ **Pre/Post Hooks** - Setup and cleanup logic  
✅ **Response Formatting** - Standardized tool results  

### BaseAgent Methods

#### Required Implementation

```typescript
// MUST implement - your core business logic
protected abstract processQuery(params: TParams, context: ToolExecutionContext): Promise<TResult>;
```

#### Optional Overrides

```typescript
// Custom parameter validation
protected validateParams(params: TParams): void {
  super.validateParams(params); // Call parent validation
  
  // Add your specific validation
  if (!params.location) {
    throw this.createError('Location is required', 'MISSING_LOCATION');
  }
}

// Setup logic before execution
protected async beforeExecution(params: TParams, context: ToolExecutionContext): Promise<void> {
  await super.beforeExecution(params, context);
  
  // Custom setup logic
  await this.initializeAPI();
  await this.checkPermissions(context);
}

// Cleanup logic after execution  
protected async afterExecution(result: TResult, context: ToolExecutionContext): Promise<void> {
  await super.afterExecution(result, context);
  
  // Custom cleanup logic
  await this.cacheResult(result);
  await this.sendNotification(result);
}

// Sanitize sensitive data from logs
protected sanitizeForLogging(params: TParams): any {
  return {
    ...params,
    accessToken: '[REDACTED]',
    apiKey: '[REDACTED]',
    password: '[REDACTED]'
  };
}
```

## Agent Configuration

### Configuration Options

```typescript
interface AgentConfig {
  name: string;           // Unique agent identifier
  description: string;    // Human-readable description
  enabled: boolean;       // Whether agent is active
  timeout?: number;       // Execution timeout (ms)
  retryCount?: number;    // Number of retry attempts
}
```

### AI Configuration Integration

Agents can also integrate with the AI configuration system:

```typescript
export class EmailAgent extends BaseAgent<EmailParams, EmailResult> {
  // Get configuration from AI config system
  getTimeout(): number {
    try {
      const aiAgentConfig = aiConfigService.getAgentConfig(this.config.name);
      return aiAgentConfig.timeout;
    } catch (error) {
      return this.config.timeout || 30000; // Fallback
    }
  }
}
```

## Advanced Features

### Built-in Retry Logic

```typescript
protected async processQuery(params: MyParams, context: ToolExecutionContext): Promise<MyResult> {
  // Use built-in retry with custom settings
  return await this.withRetries(async () => {
    return await this.unreliableOperation(params);
  }, 5, 2000); // 5 retries, 2 second delay
}
```

### Built-in Timeout Handling

```typescript
protected async processQuery(params: MyParams, context: ToolExecutionContext): Promise<MyResult> {
  // Use built-in timeout with custom duration
  return await this.withTimeout(
    this.longRunningOperation(params),
    30000 // 30 second timeout
  );
}
```

### Error Creation

```typescript
protected async processQuery(params: MyParams, context: ToolExecutionContext): Promise<MyResult> {
  if (!this.isValidInput(params)) {
    // Create typed errors with codes
    throw this.createError('Invalid input provided', 'VALIDATION_ERROR', {
      provided: params,
      expected: 'valid input format'
    });
  }
}
```

## Real-World Examples

### Email Agent

```typescript
export class EmailAgent extends BaseAgent<EmailParams, EmailResult> {
  constructor() {
    super({
      name: 'emailAgent',
      description: 'Handles email operations via Gmail API',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });
  }

  protected async processQuery(params: EmailParams, context: ToolExecutionContext): Promise<EmailResult> {
    const { query, accessToken } = params;
    
    // Determine action type
    const action = this.determineAction(query);
    
    switch (action.type) {
      case 'SEND_EMAIL':
        return await this.handleSendEmail(params, action.params);
      case 'SEARCH_EMAILS':
        return await this.handleSearchEmails(params, action.params);
      default:
        throw this.createError(`Unknown action type: ${action.type}`, 'UNKNOWN_ACTION');
    }
  }

  protected validateParams(params: EmailParams): void {
    super.validateParams(params);
    
    if (!params.accessToken) {
      throw this.createError('Access token required for email operations', 'MISSING_ACCESS_TOKEN');
    }
  }

  protected async beforeExecution(params: EmailParams, context: ToolExecutionContext): Promise<void> {
    await super.beforeExecution(params, context);
    
    // Validate access token
    const tokenValid = await this.validateGoogleToken(params.accessToken!);
    if (!tokenValid) {
      throw this.createError('Invalid or expired access token', 'INVALID_TOKEN');
    }
  }

  protected sanitizeForLogging(params: EmailParams): any {
    return {
      ...params,
      accessToken: params.accessToken ? '[PRESENT]' : undefined,
      // Don't log full email content
      query: params.query.substring(0, 100) + (params.query.length > 100 ? '...' : '')
    };
  }

  // Private business logic methods
  private determineAction(query: string) {
    if (query.toLowerCase().includes('send')) {
      return { type: 'SEND_EMAIL', params: this.parseEmailParams(query) };
    }
    if (query.toLowerCase().includes('search') || query.toLowerCase().includes('find')) {
      return { type: 'SEARCH_EMAILS', params: this.parseSearchParams(query) };
    }
    return { type: 'SEARCH_EMAILS', params: { q: query } };
  }

  private async handleSendEmail(params: EmailParams, emailParams: any): Promise<EmailResult> {
    // Gmail API integration
    const gmail = await this.getGmailClient(params.accessToken!);
    
    // Check if this requires confirmation
    if (this.requiresConfirmation(emailParams)) {
      return {
        success: false,
        message: `Ready to send email to ${emailParams.to}. Confirm to proceed.`,
        awaitingConfirmation: true,
        actionId: this.generateActionId(),
        parameters: emailParams
      };
    }

    // Send the email
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: this.buildEmailMessage(emailParams)
    });

    return {
      success: true,
      message: `Email sent successfully to ${emailParams.to}`,
      data: {
        messageId: result.data.id,
        status: 'sent'
      }
    };
  }
}
```

### Contact Agent

```typescript
export class ContactAgent extends BaseAgent<ContactParams, ContactResult> {
  constructor() {
    super({
      name: 'contactAgent',
      description: 'Search and manage contacts from Google Contacts',
      enabled: true,
      timeout: 20000,
      retryCount: 2
    });
  }

  protected async processQuery(params: ContactParams, context: ToolExecutionContext): Promise<ContactResult> {
    const operation = params.operation || this.determineOperation(params.query);
    
    switch (operation) {
      case 'search':
        return await this.handleSearchContacts(params);
      case 'create':
        return await this.handleCreateContact(params);
      default:
        return await this.handleSearchContacts(params);
    }
  }

  protected validateParams(params: ContactParams): void {
    super.validateParams(params);
    
    if (params.maxResults && params.maxResults > 50) {
      throw this.createError('Maximum 50 results allowed', 'LIMIT_EXCEEDED');
    }
  }

  private async handleSearchContacts(params: ContactParams): Promise<ContactResult> {
    const people = await this.getPeopleClient(params.accessToken!);
    
    const response = await people.people.searchContacts({
      query: params.query,
      pageSize: Math.min(params.maxResults || 10, 50)
    });

    const contacts = this.formatContacts(response.data.results || []);
    
    return {
      success: true,
      message: `Found ${contacts.length} contacts`,
      data: { contacts, total: contacts.length }
    };
  }
}
```

## Testing Agents

### Unit Testing Pattern

```typescript
describe('WeatherAgent', () => {
  let agent: WeatherAgent;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    agent = new WeatherAgent();
    mockContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      timestamp: new Date()
    };
  });

  describe('parameter validation', () => {
    it('should reject empty location', async () => {
      const params = { location: '' };
      
      const result = await agent.execute(params, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Location is required');
    });
  });

  describe('weather fetching', () => {
    it('should return weather data for valid location', async () => {
      const params = { location: 'New York' };
      
      // Mock the weather API
      jest.spyOn(global, 'fetch').mockResolvedValue({
        json: () => Promise.resolve({
          temp: 72,
          condition: 'sunny',
          forecast: 'Clear skies ahead'
        })
      } as Response);

      const result = await agent.execute(params, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        temperature: 72,
        condition: 'sunny',
        forecast: 'Clear skies ahead'
      });
    });
  });

  describe('error handling', () => {
    it('should handle API failures gracefully', async () => {
      const params = { location: 'InvalidCity' };
      
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('API Error'));

      const result = await agent.execute(params, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
    });
  });
});
```

### Integration Testing

```typescript
describe('WeatherAgent Integration', () => {
  beforeAll(() => {
    // Initialize AgentFactory
    AgentFactory.registerAgentClass('weatherAgent', WeatherAgent);
  });

  it('should execute through AgentFactory', async () => {
    const result = await AgentFactory.executeAgent('weatherAgent', 
      { location: 'San Francisco' }, 
      mockContext
    );
    
    expect(result.success).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
  });
});
```

## Best Practices

### 1. Agent Design

```typescript
// ✅ Good: Focused business logic
protected async processQuery(params: EmailParams, context: ToolExecutionContext): Promise<EmailResult> {
  const action = this.determineAction(params.query);
  return await this.executeAction(action, params);
}

// ❌ Bad: Mixed concerns
protected async processQuery(params: EmailParams, context: ToolExecutionContext): Promise<EmailResult> {
  // Don't handle logging manually - BaseAgent does this
  console.log('Processing email query...');
  
  // Don't handle errors manually - BaseAgent does this
  try {
    const result = await this.sendEmail(params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 2. Parameter Types

```typescript
// ✅ Good: Specific, well-defined types
interface EmailParams {
  query: string;
  accessToken?: string;
  to?: string[];
  subject?: string;
  body?: string;
  maxResults?: number;
}

interface EmailResult {
  success: boolean;
  message: string;
  data?: {
    messageId?: string;
    emails?: EmailData[];
    status?: string;
  };
  awaitingConfirmation?: boolean;
  actionId?: string;
  parameters?: any;
}

// ❌ Bad: Generic, unclear types
interface AgentParams {
  data: any;
  options?: any;
}
```

### 3. Error Handling

```typescript
// ✅ Good: Descriptive errors with codes
if (!params.accessToken) {
  throw this.createError('Access token required for email operations', 'MISSING_ACCESS_TOKEN');
}

if (emailParams.to.length > 100) {
  throw this.createError('Cannot send to more than 100 recipients', 'RECIPIENT_LIMIT_EXCEEDED', {
    provided: emailParams.to.length,
    maximum: 100
  });
}

// ❌ Bad: Generic errors
if (!params.accessToken) {
  throw new Error('Missing token');
}
```

### 4. Confirmation Flow

```typescript
// ✅ Good: Clear confirmation logic
private requiresConfirmation(emailParams: any): boolean {
  // Always confirm when sending to external domains
  const externalRecipients = emailParams.to.some(email => 
    !email.endsWith('@yourcompany.com')
  );
  
  // Always confirm bulk emails
  const isBulkEmail = emailParams.to.length > 5;
  
  return externalRecipients || isBulkEmail;
}

if (this.requiresConfirmation(emailParams)) {
  return {
    success: false,
    message: `Ready to send email to ${emailParams.to.join(', ')}. Confirm to proceed.`,
    awaitingConfirmation: true,
    actionId: this.generateActionId(),
    parameters: emailParams
  };
}
```

### 5. Logging Sanitization

```typescript
// ✅ Good: Comprehensive sanitization
protected sanitizeForLogging(params: EmailParams): any {
  return {
    ...params,
    accessToken: params.accessToken ? '[PRESENT]' : undefined,
    refreshToken: '[REDACTED]',
    apiKey: '[REDACTED]',
    password: '[REDACTED]',
    // Truncate long content
    body: params.body ? params.body.substring(0, 100) + '...' : undefined,
    // Mask email addresses except domain
    to: params.to?.map(email => this.maskEmail(email))
  };
}

private maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.substring(0, 2)}***@${domain}`;
}
```

## Migration Guide

### From Old Pattern to BaseAgent

The BaseAgent framework was designed to eliminate boilerplate code. For examples of migration from old patterns, see the code comparison examples above.

Key migration steps:
1. Extend BaseAgent instead of standalone class
2. Move business logic to `processQuery()`
3. Add parameter validation in `validateParams()`  
4. Use pre/post execution hooks
5. Remove manual error handling and logging
6. Register with AgentFactory

### Agent Creation Best Practices

#### ✅ **Use AgentFactory for Agent Creation**
```typescript
// ✅ Correct - Use AgentFactory for tool agents
const agent = AgentFactory.getAgent('emailAgent');
const result = await AgentFactory.executeAgent('emailAgent', params, context);

// ✅ Correct - Use createMasterAgent for orchestrator
const masterAgent = createMasterAgent(config);
```

#### ❌ **Avoid Direct Instantiation**
```typescript
// ❌ Avoid - Direct instantiation
const agent = new EmailAgent();

// ❌ Avoid - Singleton exports
export const emailAgent = new EmailAgent();
```

#### ✅ **Export Agent Classes**
```typescript
// ✅ Correct - Export the class
export { EmailAgent };
```

#### ❌ **Don't Export Singleton Instances**
```typescript
// ❌ Avoid - Exporting singleton instances
export const emailAgent = new EmailAgent();
```

### Session Management

The system now uses a unified session management approach through `SessionService`:

```typescript
// ✅ Correct - Use SessionService for all session operations
const sessionService = serviceManager.getService('sessionService') as SessionService;

// Get or create session
const session = await sessionService.getOrCreateSession(sessionId, userId);

// Store OAuth tokens
await sessionService.storeOAuthTokens(sessionId, tokens);

// Get OAuth tokens
const tokens = await sessionService.getOAuthTokens(sessionId);

// Slack-specific session operations
const slackSession = await sessionService.getSlackSession(teamId, userId);
await sessionService.storeSlackOAuthTokens(teamId, userId, tokens);
```

The BaseAgent framework provides a solid foundation for scalable, maintainable agent development while dramatically reducing boilerplate code and improving consistency across the system.