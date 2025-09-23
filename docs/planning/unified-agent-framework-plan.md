# Unified Agent Framework Plan

## Executive Summary

This document outlines a comprehensive plan to unify all agents under a consistent interface and framework structure. The current system has inconsistencies in service initialization, natural language processing, OAuth token management, and error handling across different agents.

## Current State Analysis

### Inconsistencies Identified

1. **Service Initialization**
   - Calendar Agent: Uses `ensureServices()` in natural language flow
   - Email Agent: Uses `initializeServices()` in constructor only
   - Other agents: Mixed approaches

2. **Natural Language Processing**
   - Calendar Agent: Has `processNaturalLanguageRequest()` method
   - Email Agent: Missing natural language processing
   - Other agents: Inconsistent implementation

3. **OAuth Token Management**
   - Different patterns across agents
   - Inconsistent token passing mechanisms
   - Missing token validation

4. **Error Handling**
   - Inconsistent error response formats
   - Different logging approaches
   - Varying error recovery strategies

5. **Capabilities Definition**
   - Different ways to define and expose agent capabilities
   - Inconsistent limitation documentation
   - Missing capability validation

### What Currently Works

- `AIAgent` base class provides foundation
- `INaturalLanguageAgent` interface exists
- `AgentFactory` handles registration
- Master agent orchestration works
- Service manager provides service discovery

## Unified Framework Design

### Phase 1: Enhanced Base Class

#### 1.1 Standardized Service Management

```typescript
// Enhanced AIAgent base class
export abstract class AIAgent {
  protected services: Map<string, any> = new Map();
  protected serviceManager: ServiceManager;
  protected isInitialized: boolean = false;

  // Standardized service initialization
  protected async ensureServices(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await this.initializeRequiredServices();
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Service initialization failed', { error });
      throw new ServiceInitializationError('Failed to initialize required services');
    }
  }

  // Abstract method for agent-specific service requirements
  protected abstract initializeRequiredServices(): Promise<void>;
  
  // Standardized service access
  protected getService<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new ServiceNotAvailableError(`Service ${serviceName} not available`);
    }
    return service as T;
  }
}
```

#### 1.2 Unified Natural Language Interface

```typescript
// Enhanced natural language interface
export interface INaturalLanguageAgent {
  // Standardized natural language processing
  processNaturalLanguageRequest(
    request: NaturalLanguageRequest,
    context: AgentContext
  ): Promise<NaturalLanguageResponse>;

  // Capability introspection
  getCapabilities(): AgentCapabilities;
  getLimitations(): AgentLimitations;
  
  // Intent analysis
  analyzeIntent(request: string): Promise<IntentAnalysis>;
  
  // Operation routing
  routeOperation(intent: IntentAnalysis): Promise<OperationResult>;
}
```

#### 1.3 Standardized Context and Response Types

```typescript
// Unified context structure
export interface AgentContext {
  sessionId: string;
  userId: string;
  accessToken?: string;
  slackContext?: SlackContext;
  correlationId: string;
  metadata?: Record<string, any>;
}

// Standardized response format
export interface NaturalLanguageResponse {
  success: boolean;
  data?: any;
  error?: string;
  operation: string;
  requiresConfirmation?: boolean;
  nextSteps?: string[];
  metadata?: Record<string, any>;
}

// Capability definitions
export interface AgentCapabilities {
  operations: string[];
  supportedIntents: string[];
  requiredServices: string[];
  optionalServices: string[];
  dependencies: string[];
}

export interface AgentLimitations {
  unsupportedOperations: string[];
  constraints: string[];
  prerequisites: string[];
}
```

### Phase 2: Agent-Specific Implementations

#### 2.1 Calendar Agent Refactoring

```typescript
export class CalendarAgent extends AIAgent implements INaturalLanguageAgent {
  protected async initializeRequiredServices(): Promise<void> {
    const calendarService = this.serviceManager.getService('calendarService');
    this.services.set('calendarService', calendarService);
  }

  async processNaturalLanguageRequest(
    request: NaturalLanguageRequest,
    context: AgentContext
  ): Promise<NaturalLanguageResponse> {
    await this.ensureServices();
    
    const intent = await this.analyzeIntent(request.text);
    const result = await this.routeOperation(intent);
    
    return {
      success: true,
      data: result,
      operation: intent.operation,
      requiresConfirmation: this.requiresConfirmation(intent.operation)
    };
  }

  getCapabilities(): AgentCapabilities {
    return {
      operations: ['listEvents', 'createEvent', 'updateEvent', 'deleteEvent', 'checkAvailability', 'findSlots'],
      supportedIntents: ['schedule', 'meeting', 'calendar', 'availability'],
      requiredServices: ['calendarService'],
      optionalServices: [],
      dependencies: ['google-calendar-api']
    };
  }

  getLimitations(): AgentLimitations {
    return {
      unsupportedOperations: ['contact-support', 'change-calendar-app'],
      constraints: ['Requires Google Calendar integration', 'Limited to user\'s primary calendar'],
      prerequisites: ['Valid OAuth tokens', 'Calendar API access']
    };
  }
}
```

#### 2.2 Email Agent Refactoring

```typescript
export class EmailAgent extends AIAgent implements INaturalLanguageAgent {
  protected async initializeRequiredServices(): Promise<void> {
    const gmailService = this.serviceManager.getService('gmailService');
    this.services.set('gmailService', gmailService);
  }

  async processNaturalLanguageRequest(
    request: NaturalLanguageRequest,
    context: AgentContext
  ): Promise<NaturalLanguageResponse> {
    await this.ensureServices();
    
    const intent = await this.analyzeIntent(request.text);
    const result = await this.routeOperation(intent);
    
    return {
      success: true,
      data: result,
      operation: intent.operation,
      requiresConfirmation: this.requiresConfirmation(intent.operation)
    };
  }

  getCapabilities(): AgentCapabilities {
    return {
      operations: ['sendEmail', 'readEmails', 'searchEmails', 'draftEmail', 'replyToEmail'],
      supportedIntents: ['send', 'email', 'message', 'reply'],
      requiredServices: ['gmailService'],
      optionalServices: ['draftManager'],
      dependencies: ['gmail-api']
    };
  }

  getLimitations(): AgentLimitations {
    return {
      unsupportedOperations: ['bulk-operations', 'email-forwarding'],
      constraints: ['Gmail only', 'Rate limited by Gmail API'],
      prerequisites: ['Valid OAuth tokens', 'Gmail API access']
    };
  }
}
```

### Phase 3: Framework Enhancements

#### 3.1 Enhanced Agent Factory

```typescript
export class AgentFactory {
  private static agents: Map<string, new () => AIAgent> = new Map();
  private static capabilities: Map<string, AgentCapabilities> = new Map();

  static registerAgent<T extends AIAgent>(
    name: string,
    agentClass: new () => T,
    capabilities: AgentCapabilities
  ): void {
    this.agents.set(name, agentClass);
    this.capabilities.set(name, capabilities);
  }

  static async createAgent(name: string, context: AgentContext): Promise<AIAgent> {
    const AgentClass = this.agents.get(name);
    if (!AgentClass) {
      throw new AgentNotFoundError(`Agent ${name} not found`);
    }

    const agent = new AgentClass();
    await agent.initialize(context);
    return agent;
  }

  static getAgentCapabilities(name: string): AgentCapabilities {
    return this.capabilities.get(name) || { operations: [], supportedIntents: [], requiredServices: [], optionalServices: [], dependencies: [] };
  }

  static async executeAgentWithNaturalLanguage(
    agentName: string,
    request: string,
    context: AgentContext
  ): Promise<NaturalLanguageResponse> {
    const agent = await this.createAgent(agentName, context);
    
    if (!(agent instanceof INaturalLanguageAgent)) {
      throw new UnsupportedOperationError(`Agent ${agentName} does not support natural language processing`);
    }

    return await agent.processNaturalLanguageRequest(
      { text: request, timestamp: Date.now() },
      context
    );
  }
}
```

#### 3.2 Master Agent Orchestration

```typescript
export class MasterAgent extends AIAgent {
  private agentCapabilities: Map<string, AgentCapabilities> = new Map();

  async initialize(context: AgentContext): Promise<void> {
    await super.initialize(context);
    await this.loadAgentCapabilities();
  }

  private async loadAgentCapabilities(): Promise<void> {
    const agentNames = ['calendarAgent', 'emailAgent', 'contactAgent', 'slackAgent'];
    
    for (const name of agentNames) {
      const capabilities = AgentFactory.getAgentCapabilities(name);
      this.agentCapabilities.set(name, capabilities);
    }
  }

  async processRequest(request: string, context: AgentContext): Promise<NaturalLanguageResponse> {
    // Enhanced intent analysis with capability awareness
    const intent = await this.analyzeIntentWithCapabilities(request);
    
    if (!intent.agent) {
      return this.handleUnsupportedRequest(request);
    }

    // Validate agent can handle the operation
    const capabilities = this.agentCapabilities.get(intent.agent);
    if (!capabilities.operations.includes(intent.operation)) {
      return this.handleUnsupportedOperation(intent.agent, intent.operation);
    }

    // Execute with proper error handling
    try {
      const result = await AgentFactory.executeAgentWithNaturalLanguage(
        intent.agent,
        request,
        context
      );
      
      return result;
    } catch (error) {
      return this.handleAgentError(intent.agent, error);
    }
  }

  private async analyzeIntentWithCapabilities(request: string): Promise<IntentAnalysis> {
    // Use AI to analyze intent while considering available agent capabilities
    const capabilities = Array.from(this.agentCapabilities.entries())
      .map(([name, caps]) => `${name}: ${caps.operations.join(', ')}`)
      .join('\n');

    const prompt = `
Analyze this request and determine the best agent to handle it.

Available agents and their capabilities:
${capabilities}

Request: "${request}"

Return the agent name and operation that best matches this request.
`;

    // Implementation would use OpenAI to analyze intent
    return await this.openaiService.analyzeIntent(prompt);
  }
}
```

### Phase 4: Migration Strategy

#### 4.1 Implementation Order

1. **Week 1-2: Base Class Enhancement**
   - Implement enhanced `AIAgent` base class
   - Create standardized interfaces
   - Add comprehensive error handling

2. **Week 3-4: Calendar Agent Migration**
   - Refactor calendar agent to new structure
   - Implement capability definitions
   - Add comprehensive testing

3. **Week 5-6: Email Agent Migration**
   - Refactor email agent to new structure
   - Add natural language processing
   - Implement service initialization

4. **Week 7-8: Other Agents Migration**
   - Migrate contact agent
   - Migrate slack agent
   - Update master agent orchestration

5. **Week 9-10: Testing and Optimization**
   - Comprehensive integration testing
   - Performance optimization
   - Documentation updates

#### 4.2 Backward Compatibility

- Maintain existing agent interfaces during transition
- Gradual migration with feature flags
- Comprehensive testing at each step
- Rollback plan for each phase

#### 4.3 Testing Strategy

```typescript
// Example test structure
describe('Unified Agent Framework', () => {
  describe('Calendar Agent', () => {
    it('should initialize services correctly', async () => {
      const agent = new CalendarAgent();
      await agent.ensureServices();
      expect(agent.isInitialized).toBe(true);
    });

    it('should process natural language requests', async () => {
      const agent = new CalendarAgent();
      const response = await agent.processNaturalLanguageRequest(
        { text: 'Show me my calendar for tomorrow' },
        mockContext
      );
      expect(response.success).toBe(true);
      expect(response.operation).toBe('listEvents');
    });

    it('should expose correct capabilities', () => {
      const agent = new CalendarAgent();
      const capabilities = agent.getCapabilities();
      expect(capabilities.operations).toContain('listEvents');
      expect(capabilities.requiredServices).toContain('calendarService');
    });
  });
});
```

## Benefits of Unified Framework

### 1. Consistency
- All agents follow the same patterns
- Standardized error handling
- Uniform response formats
- Consistent logging

### 2. Maintainability
- Single source of truth for agent behavior
- Easier to add new agents
- Simplified debugging
- Better code reuse

### 3. Reliability
- Comprehensive error handling
- Proper service initialization
- Consistent OAuth token management
- Better error recovery

### 4. Extensibility
- Easy to add new capabilities
- Standardized agent registration
- Consistent natural language processing
- Better orchestration

### 5. Developer Experience
- Clear interfaces and contracts
- Comprehensive documentation
- Better testing support
- Easier debugging

## Risk Mitigation

### 1. Technical Risks
- **Service initialization failures**: Comprehensive error handling and fallback mechanisms
- **OAuth token issues**: Standardized token management and validation
- **Performance impact**: Gradual migration with performance monitoring

### 2. Business Risks
- **Feature regression**: Comprehensive testing and gradual rollout
- **User experience impact**: Backward compatibility and feature flags
- **Development timeline**: Phased approach with clear milestones

## Success Metrics

### 1. Technical Metrics
- **Code consistency**: All agents follow same patterns
- **Error reduction**: 50% reduction in agent-related errors
- **Performance**: No degradation in response times
- **Test coverage**: 90%+ test coverage for all agents

### 2. Business Metrics
- **User satisfaction**: Maintained or improved user experience
- **Development velocity**: Faster agent development and deployment
- **Maintenance cost**: Reduced time spent on agent maintenance
- **Feature delivery**: Faster delivery of new agent capabilities

## Conclusion

This unified agent framework plan provides a comprehensive approach to standardizing all agents under a consistent interface and structure. The phased implementation approach ensures minimal disruption while delivering significant improvements in consistency, maintainability, and reliability.

The framework addresses all identified inconsistencies while providing a solid foundation for future agent development and enhancement.
