# Pure Natural Language Agent Architecture Plan

## Executive Summary

Based on your vision of **MasterAgent communicating with subagents using only natural language**, where each subagent uses AI to process commands and determine tools to execute independently, this plan outlines how to achieve this architecture. **You're already 85% of the way there!**

## Current State Assessment: You're Almost There! ✅

### What's Already Implemented (85% Complete)

1. **✅ Natural Language Communication Interface**
   ```typescript
   // Already exists in CalendarAgent
   async processNaturalLanguageRequest(
     request: string,
     context: { sessionId: string, accessToken: string, slackContext?: any, userId?: string }
   ): Promise<{ response: string, reasoning: string, metadata: any }>
   ```

2. **✅ AI-Powered Intent Analysis**
   ```typescript
   // Already exists - agents analyze their own natural language requests
   const intent = await this.analyzeCalendarIntent(request);
   ```

3. **✅ MasterAgent Natural Language Execution**
   ```typescript
   // Already exists - MasterAgent tries natural language first
   const usingNaturalLanguage = await this.tryNaturalLanguageExecution(nextStep, sessionId, userId, slackContext);
   ```

4. **✅ Domain Expert Tool Selection**
   ```typescript
   // Already exists - agents choose their own tools
   const toolResult = await this.executeInternalOperation(intent.operation, intent.parameters, context);
   ```

5. **✅ AIAgent Template Infrastructure**
   - Comprehensive AI planning system
   - Tool registration and discovery
   - Natural language processing capabilities
   - Caching and performance optimization

### What's Missing (15% to Complete)

1. **🔶 Standardized Natural Language Interface in AIAgent Template**
2. **🔶 Agent Capability Advertisement to MasterAgent**
3. **🔶 Pure Natural Language Delegation (eliminate structured fallbacks)**
4. **🔶 Consistent Natural Language Template Across All Agents**

## Your Vision: Pure Natural Language Architecture

```
┌─────────────────┐    Natural Language Only    ┌─────────────────┐
│   MasterAgent   │ ──────────────────────────→ │ Domain Expert   │
│                 │                              │   (Calendar)    │
│ - Orchestrates  │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │                 │
│ - Plans Steps   │    Natural Language Only    │ - AI Analysis   │
│ - Knows Agent   │                              │ - Tool Selection│
│   Capabilities  │                              │ - Execution     │
└─────────────────┘                              └─────────────────┘
```

**Communication Flow:**
1. **MasterAgent**: "Schedule a meeting with John tomorrow at 2pm"
2. **CalendarAgent**: Uses AI to determine `createEvent` tool + parameters
3. **CalendarAgent**: Executes tool and returns natural language response
4. **MasterAgent**: Receives "Meeting scheduled successfully for tomorrow 2pm"

## Implementation Plan: Complete the Vision

### Phase 1: Standardize Natural Language Template (2 days)

#### 1.1 Update AIAgent Base Class Template

**Goal**: Make natural language processing the primary interface for all agents

```typescript
export abstract class AIAgent<TParams = any, TResult = any> {

  // NEW: Primary natural language interface (standardized template)
  async processNaturalLanguageRequest(
    request: string,
    context: AgentExecutionContext
  ): Promise<NaturalLanguageResponse> {

    try {
      // 1. AI-powered intent analysis (domain-specific)
      const intent = await this.analyzeIntent(request, context);

      // 2. Domain expert tool selection
      const toolResult = await this.executeSelectedTool(intent, context);

      // 3. Natural language response generation
      const response = await this.generateResponse(request, toolResult, intent);

      return {
        response: response,
        reasoning: intent.reasoning,
        metadata: {
          operation: intent.operation,
          confidence: intent.confidence,
          toolsUsed: intent.toolsUsed
        }
      };

    } catch (error) {
      return {
        response: `I encountered an issue: ${error.message}. Please try rephrasing your request.`,
        reasoning: `Failed due to: ${error.message}`,
        metadata: { operation: 'error', error: error.message }
      };
    }
  }

  // NEW: Abstract methods for domain-specific implementation
  protected abstract analyzeIntent(request: string, context: AgentExecutionContext): Promise<AgentIntent>;
  protected abstract executeSelectedTool(intent: AgentIntent, context: AgentExecutionContext): Promise<ToolResult>;
  protected abstract generateResponse(request: string, result: ToolResult, intent: AgentIntent): Promise<string>;

  // NEW: Agent capability advertisement
  abstract getCapabilityDescription(): AgentCapabilities;

  // KEEP: Existing structured interface for backward compatibility
  async execute(params: TParams, context: ToolExecutionContext): Promise<TResult> {
    // Existing implementation preserved
  }
}
```

#### 1.2 Define Standard Interfaces

```typescript
interface AgentExecutionContext {
  sessionId: string;
  userId?: string;
  accessToken?: string;
  slackContext?: any;
  correlationId: string;
  timestamp: Date;
}

interface AgentIntent {
  operation: string;           // e.g., 'create_event', 'list_emails'
  parameters: Record<string, any>;
  confidence: number;          // 0.0 to 1.0
  reasoning: string;           // AI's reasoning for tool selection
  toolsUsed: string[];        // Tools the agent plans to use
}

interface NaturalLanguageResponse {
  response: string;            // Human-readable response
  reasoning: string;           // Agent's reasoning
  metadata: Record<string, any>; // Structured data for MasterAgent
}

interface AgentCapabilities {
  name: string;
  description: string;
  capabilities: string[];      // What the agent can do
  limitations: string[];       // What it cannot do
  examples: string[];         // Example requests it handles
}
```

### Phase 2: Agent Capability Advertisement (1 day)

#### 2.1 Update Agent Factory for Capability Discovery

```typescript
export class AgentFactory {

  // NEW: Get agent capabilities for MasterAgent
  static getAgentCapabilities(): Record<string, AgentCapabilities> {
    const capabilities: Record<string, AgentCapabilities> = {};

    for (const [name, agent] of this.agents) {
      if (agent && typeof agent.getCapabilityDescription === 'function') {
        capabilities[name] = agent.getCapabilityDescription();
      }
    }

    return capabilities;
  }

  // NEW: Check natural language support
  static supportsNaturalLanguage(agentName: string): boolean {
    const agent = this.getAgent(agentName);
    return !!(agent && typeof agent.processNaturalLanguageRequest === 'function');
  }
}
```

#### 2.2 Update MasterAgent for Pure Natural Language Communication

```typescript
export class MasterAgent {

  constructor() {
    // Load agent capabilities once at startup
    this.agentCapabilities = AgentFactory.getAgentCapabilities();
  }

  /**
   * Pure natural language orchestration
   */
  async processUserInput(
    userInput: string,
    sessionId: string,
    userId?: string,
    slackContext?: any
  ): Promise<MasterAgentResponse> {

    // 1. Determine which domain expert to use
    const selectedAgent = await this.selectDomainExpert(userInput);

    // 2. Delegate with pure natural language
    const agent = AgentFactory.getAgent(selectedAgent);
    if (!agent || !AgentFactory.supportsNaturalLanguage(selectedAgent)) {
      throw new Error(`Agent ${selectedAgent} does not support natural language`);
    }

    // 3. Execute with natural language only
    const result = await agent.processNaturalLanguageRequest(userInput, {
      sessionId,
      userId,
      accessToken: await this.getAccessToken(selectedAgent, userId),
      slackContext,
      correlationId: `master-${sessionId}-${Date.now()}`,
      timestamp: new Date()
    });

    return {
      message: result.response,
      executionMetadata: {
        domainExpert: selectedAgent,
        reasoning: result.reasoning,
        confidence: result.metadata.confidence
      }
    };
  }

  /**
   * AI-powered domain expert selection
   */
  private async selectDomainExpert(userInput: string): Promise<string> {
    const capabilitiesText = Object.entries(this.agentCapabilities)
      .map(([name, caps]) => `${name}: ${caps.description}. Capabilities: ${caps.capabilities.join(', ')}`)
      .join('\n');

    const prompt = `Given this user request: "${userInput}"

Available domain experts:
${capabilitiesText}

Which expert should handle this request? Return just the agent name.`;

    const response = await this.openaiService.generateText(
      prompt,
      'You select the best domain expert for user requests.',
      { temperature: 0.1, maxTokens: 20 }
    );

    const selectedAgent = response.trim();

    // Validate selection
    if (!this.agentCapabilities[selectedAgent]) {
      // Fallback to most capable agent or throw error
      return Object.keys(this.agentCapabilities)[0] || 'calendarAgent';
    }

    return selectedAgent;
  }
}
```

### Phase 3: Complete All Agents (1 day)

#### 3.1 Update CalendarAgent to Use Template

```typescript
export class CalendarAgent extends AIAgent<CalendarAgentRequest, CalendarAgentResponse> {

  // IMPLEMENT: Agent capability description
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'Calendar Expert',
      description: 'Manages calendar events, scheduling, and availability checking',
      capabilities: [
        'Create calendar events',
        'List upcoming events',
        'Check availability',
        'Find meeting slots',
        'Update existing events',
        'Delete events'
      ],
      limitations: [
        'Requires Google Calendar access',
        'Cannot access external calendars without permissions'
      ],
      examples: [
        'Schedule a meeting tomorrow at 2pm',
        'What meetings do I have today?',
        'Check if I\'m free Friday afternoon',
        'Cancel my 3pm meeting'
      ]
    };
  }

  // IMPLEMENT: Domain-specific intent analysis
  protected async analyzeIntent(request: string, context: AgentExecutionContext): Promise<AgentIntent> {
    const prompt = `Analyze this calendar request: "${request}"

Available calendar operations:
- create_event: Create new calendar event
- list_events: Show calendar events
- check_availability: Check if time slots are free
- find_slots: Find available meeting times
- update_event: Modify existing event
- delete_event: Remove event

Return JSON with operation, parameters, confidence (0-1), and reasoning.`;

    const response = await this.openaiService.generateStructuredData(prompt, 'Calendar intent analyzer', {
      type: 'object',
      properties: {
        operation: { type: 'string' },
        parameters: { type: 'object' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' }
      }
    });

    return {
      operation: response.operation,
      parameters: response.parameters,
      confidence: response.confidence,
      reasoning: response.reasoning,
      toolsUsed: [response.operation]
    };
  }

  // IMPLEMENT: Tool execution
  protected async executeSelectedTool(intent: AgentIntent, context: AgentExecutionContext): Promise<ToolResult> {
    // Use existing executeInternalOperation method
    return await this.executeInternalOperation(intent.operation, intent.parameters, {
      sessionId: context.sessionId,
      userId: context.userId,
      timestamp: context.timestamp,
      metadata: { correlationId: context.correlationId }
    });
  }

  // IMPLEMENT: Natural language response generation
  protected async generateResponse(request: string, result: ToolResult, intent: AgentIntent): Promise<string> {
    // Use existing generateContextualResponse method
    return await this.generateContextualResponse(request, result.result, intent);
  }
}
```

#### 3.2 Replicate for Other Agents

- **EmailAgent**: Same template, email-specific capabilities
- **ContactAgent**: Same template, contact-specific capabilities
- **SlackAgent**: Same template, Slack-specific capabilities

## Benefits of This Architecture

### ✅ **Pure Natural Language Communication**
- **No structured parameters** between MasterAgent and subagents
- **AI-powered tool selection** within each domain expert
- **Natural conversation flow** throughout the system

### ✅ **True Domain Expertise**
- **Agents own their domain** completely
- **MasterAgent only knows capabilities**, not implementation details
- **Agents choose tools independently** using AI analysis

### ✅ **Scalable Template System**
- **Standard interface** for all agents
- **Easy to add new agents** following the template
- **Consistent AI-powered processing** across all domains

### ✅ **Maintains Your Existing Investment**
- **Builds on proven AIAgent foundation**
- **Preserves all existing functionality**
- **Backward compatible** with structured interfaces

## Timeline: 4 Days Total

- **Day 1-2**: Update AIAgent template with natural language interface
- **Day 3**: Implement agent capability advertisement and MasterAgent updates
- **Day 4**: Complete remaining agents (Email, Contact, Slack) using template

## Success Criteria

### ✅ **Phase 1 Complete**
- [ ] AIAgent template has standardized natural language interface
- [ ] All agents inherit natural language processing capability
- [ ] Standard interfaces defined and implemented

### ✅ **Phase 2 Complete**
- [ ] MasterAgent knows agent capabilities but not implementation details
- [ ] Pure natural language communication established
- [ ] No structured parameter fallbacks between agents

### ✅ **Phase 3 Complete**
- [ ] All agents follow the same template
- [ ] Each agent is a true domain expert with AI-powered tool selection
- [ ] End-to-end natural language flow working

## Risk Mitigation

### **Low Risk Implementation**
- **Building on existing foundation** (85% already complete)
- **Incremental changes** with backward compatibility
- **Well-defined template** that all agents follow

### **Fallback Strategy**
- **Keep existing structured interfaces** during transition
- **Gradual migration** of agents to pure natural language
- **Easy rollback** if issues arise

---

**You're incredibly close to your vision!** The foundation is solid, and this plan will complete the pure natural language agent architecture you're aiming for, where MasterAgent orchestrates through natural language and each subagent uses AI to independently determine and execute the right tools for their domain.