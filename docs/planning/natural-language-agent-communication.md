# Natural Language Agent Communication Architecture

## Overview

This document outlines the new architecture for agent communication using natural language instead of structured tool calls. This approach simplifies the system while maintaining AI-driven intelligence where it matters most.

## Current vs. Proposed Architecture

### Current Architecture (Complex)
```
MasterAgent → ToolCall → Subagent → AI Planning → Service Execution → AI Synthesis → MasterAgent
```

### Proposed Architecture (Simplified)
```
MasterAgent → Natural Language → Subagent → AI Analysis → Service Execution → AI Interpretation → MasterAgent → LLM Synthesis
```

## Communication Flow

### 1. MasterAgent → Subagent (Natural Language)
```typescript
// MasterAgent sends natural language request
const request = "Send an email to john@example.com about the meeting tomorrow at 2pm";

await emailAgent.execute({
  request: request,
  context: slackContext,
  accessToken: "oauth_token"
});
```

### 2. Subagent Processing (Two AI Calls)
```typescript
// EmailAgent receives natural language
async execute(params: { request: string, context: SlackContext, accessToken: string }) {
  
  // AI Call #1: Determine operation and extract parameters
  const analysis = await openaiService.generateStructuredData({
    prompt: `Email request: "${params.request}"
    
    Determine operation: send, search, reply, forward, delete
    Extract parameters: to, subject, body, etc.
    
    Return JSON with operation and parameters.`
  });
  
  // Execute the operation
  const rawResult = await this.executeOperation(analysis.operation, analysis.parameters);
  
  // AI Call #2: Interpret results in context of the MasterAgent's request
  const contextualResponse = await openaiService.generateText({
    prompt: `MasterAgent asked: "${params.request}"
    
    Email operation "${analysis.operation}" completed with result: ${JSON.stringify(rawResult)}
    
    Provide a focused, natural language response that directly addresses what the MasterAgent requested.
    Focus on the most relevant information for their specific ask.`
  });
  
  return {
    success: true,
    response: contextualResponse, // Contextual interpretation
    metadata: {
      operation: analysis.operation,
      serviceUsed: 'gmail',
      originalRequest: params.request
    }
  };
}
```

### 3. MasterAgent Receives Contextual Responses and Synthesizes Final Response
```typescript
// MasterAgent gets contextual responses from subagents
const emailResult = await emailAgent.execute(request);
const calendarResult = await calendarAgent.execute(request);

// MasterAgent synthesizes contextual responses into final user response
const finalResponse = await openaiService.generateText(`
User asked: "${userInput}"

Email Agent response: ${emailResult.response}
Calendar Agent response: ${calendarResult.response}

Combine these contextual responses into a single, coherent response to the user.
`);
```

## MasterAgent Transformation

### Current MasterAgent Role (Tool Orchestrator)
```typescript
// Current: MasterAgent generates tool calls and processes raw results
const toolCalls = await this.generateToolCalls(userInput);
const toolResults = await this.executeToolCalls(toolCalls);
const finalResponse = await this.processToolResultsWithLLM(userInput, toolResults);
```

### New MasterAgent Role (Context Synthesizer)
```typescript
// New: MasterAgent sends natural language requests and synthesizes contextual responses
const emailResponse = await emailAgent.execute({ request: userInput, context });
const calendarResponse = await calendarAgent.execute({ request: userInput, context });
const finalResponse = await this.synthesizeContextualResponses([emailResponse, calendarResponse]);
```

### MasterAgent Implementation Changes
```typescript
class MasterAgent {
  // NEW: Send natural language requests to subagents
  async processUserInput(userInput: string, context: SlackContext): Promise<MasterAgentResponse> {
    
    // 1. Determine which subagents to involve
    const relevantAgents = await this.determineRelevantAgents(userInput);
    
    // 2. Send natural language requests to each subagent
    const agentResponses = await Promise.all(
      relevantAgents.map(agent => 
        agent.execute({ 
          request: userInput, 
          context, 
          accessToken: this.getAccessToken() 
        })
      )
    );
    
    // 3. Synthesize contextual responses into final response
    const finalResponse = await this.synthesizeResponses(userInput, agentResponses);
    
    return {
      message: finalResponse,
      metadata: {
        agentsUsed: relevantAgents.map(a => a.name),
        responses: agentResponses
      }
    };
  }
  
  // NEW: Synthesize contextual responses from domain experts
  private async synthesizeResponses(
    userInput: string, 
    agentResponses: SubagentResponse[]
  ): Promise<string> {
    const openaiService = this.getOpenAIService();
    
    const prompt = `User asked: "${userInput}"

Here are the responses from domain experts:
${agentResponses.map(r => `${r.metadata?.serviceUsed}: ${r.response}`).join('\n')}

Synthesize these expert responses into a single, coherent response to the user.
Focus on what was accomplished and any important details they should know.`;

    return await openaiService.generateText(prompt);
  }
  
  // NEW: Determine which domain experts to consult
  private async determineRelevantAgents(userInput: string): Promise<Subagent[]> {
    const openaiService = this.getOpenAIService();
    
    const prompt = `User request: "${userInput}"

Available domain experts:
- EmailAgent: Handles email operations (send, search, reply, forward, delete)
- CalendarAgent: Handles calendar operations (create, search, update, delete, check availability)
- ContactAgent: Handles contact operations (search, create, update contacts)
- SlackAgent: Handles Slack operations (read messages, analyze conversations)

Which domain experts should be consulted for this request? Return a JSON array of agent names.`;

    const response = await openaiService.generateStructuredData(prompt);
    return this.getAgentsByName(response.agents);
  }
}
```

### MasterAgent Role Transformation

#### From Tool Orchestrator → Context Synthesizer
- **Current**: Generates structured tool calls with parameters
- **New**: Sends natural language requests to domain experts

#### From Raw Result Processor → Response Synthesizer  
- **Current**: Takes raw service results and makes them user-friendly
- **New**: Takes contextual responses from experts and synthesizes them

#### From Orchestrator → Coordinator
- **Current**: Controls execution flow, retries, error handling
- **New**: Coordinates between domain experts, handles high-level flow

### New MasterAgent Responsibilities

1. **Agent Selection**: Determine which domain experts to consult based on user request
2. **Request Coordination**: Send natural language requests to relevant subagents
3. **Response Synthesis**: Combine expert responses into coherent final response
4. **Cross-Domain Coordination**: Handle requests that span multiple domains
5. **Error Orchestration**: Manage partial failures and provide graceful degradation

## Subagent Interface

### Request Format
```typescript
interface SubagentRequest {
  request: string;           // Natural language request
  context?: SlackContext;   // Optional context
  accessToken: string;       // OAuth token
}
```

### Response Format
```typescript
interface SubagentResponse {
  success: boolean;
  response: string;        // Contextual natural language response
  metadata?: {            // Optional technical details
    operation?: string;
    executionTime?: number;
    serviceUsed?: string;
    originalRequest?: string;
  };
}
```

## Example Implementations

### EmailAgent
```typescript
async execute(params: SubagentRequest): Promise<SubagentResponse> {
  
  // AI Call #1: Determine operation and extract parameters
  const analysis = await openaiService.generateStructuredData({
    prompt: `Email request: "${params.request}"
    
    Determine operation: send, search, reply, forward, delete
    Extract parameters: to, subject, body, etc.
    
    Return structured JSON with operation and parameters.`
  });
  
  // Execute single operation
  let result;
  if (analysis.operation === 'send') {
    result = await this.gmailService.sendEmail(analysis.parameters);
  } else if (analysis.operation === 'search') {
    result = await this.gmailService.searchEmails(analysis.parameters);
  }
  // ... other operations
  
  // AI Call #2: Contextual interpretation of results
  const contextualResponse = await openaiService.generateText({
    prompt: `MasterAgent asked: "${params.request}"
    
    Email operation "${analysis.operation}" completed with result: ${JSON.stringify(result)}
    
    Provide a focused, natural language response that directly addresses what the MasterAgent requested.
    Focus on the most relevant information for their specific ask.`
  });
  
  return {
    success: true,
    response: contextualResponse, // Contextual interpretation
    metadata: { 
      operation: analysis.operation,
      executionTime: Date.now() - startTime, 
      serviceUsed: 'gmail',
      originalRequest: params.request
    }
  };
}
```

### CalendarAgent
```typescript
async execute(params: SubagentRequest): Promise<SubagentResponse> {
  
  // AI Call #1: Determine operation and extract parameters
  const analysis = await openaiService.generateStructuredData({
    prompt: `Calendar request: "${params.request}"
    
    Determine operation: create, search, update, delete, check_availability
    Extract: title, startTime, endTime, attendees, etc.
    
    Return structured JSON with operation and parameters.`
  });
  
  // Execute operation
  let result;
  if (analysis.operation === 'create') {
    result = await this.calendarService.createEvent(analysis.parameters);
  } else if (analysis.operation === 'search') {
    result = await this.calendarService.searchEvents(analysis.parameters);
  }
  // ... other operations
  
  // AI Call #2: Contextual interpretation of results
  const contextualResponse = await openaiService.generateText({
    prompt: `MasterAgent asked: "${params.request}"
    
    Calendar operation "${analysis.operation}" completed with result: ${JSON.stringify(result)}
    
    Provide a focused, natural language response that directly addresses what the MasterAgent requested.
    Focus on the most relevant information for their specific ask.`
  });
  
  return {
    success: true,
    response: contextualResponse, // Contextual interpretation
    metadata: { 
      operation: analysis.operation,
      executionTime: Date.now() - startTime, 
      serviceUsed: 'calendar',
      originalRequest: params.request
    }
  };
}
```

## Example Multi-Agent Scenario

### User Request
```
"Schedule a meeting with john@example.com and send him an email about it"
```

### CalendarAgent Contextual Response
```
"I've scheduled a meeting for tomorrow at 2pm with john@example.com. The event has been added to your calendar and john will receive an invitation."
```

### EmailAgent Contextual Response
```
"I've sent john@example.com an email about the meeting scheduled for tomorrow at 2pm. He'll receive the email notification with the meeting details."
```

### MasterAgent Final Synthesis
```
"I've taken care of both tasks! I scheduled a meeting with john@example.com for tomorrow at 2pm and sent him an email about it. He'll receive both the calendar invitation and the email notification."
```

## Cross-Domain Coordination

### Handling Multi-Agent Requests
```typescript
// User Request: "Schedule a meeting with john@example.com and send him an email about it"

// MasterAgent determines this needs both CalendarAgent and EmailAgent
const relevantAgents = ['CalendarAgent', 'EmailAgent'];

// Send requests to both agents
const calendarResponse = await calendarAgent.execute({
  request: "Schedule a meeting with john@example.com and send him an email about it",
  context: slackContext,
  accessToken: oauthToken
});

const emailResponse = await emailAgent.execute({
  request: "Schedule a meeting with john@example.com and send him an email about it", 
  context: slackContext,
  accessToken: oauthToken
});

// MasterAgent synthesizes responses
const finalResponse = await this.synthesizeResponses(userInput, [calendarResponse, emailResponse]);
```

### Context Sharing Between Agents
```typescript
// MasterAgent can pass context between agents
const calendarResult = await calendarAgent.execute(request);
const meetingDetails = calendarResult.metadata?.meetingDetails;

const emailRequest = `Send an email about the meeting: ${JSON.stringify(meetingDetails)}`;
const emailResult = await emailAgent.execute({
  request: emailRequest,
  context: slackContext,
  accessToken: oauthToken
});
```

## Benefits

### 1. Simpler Architecture
- **No multi-step planning** - subagents determine single operation
- **Contextual interpretation** - subagents understand what MasterAgent needs
- **Two AI calls per subagent** - operation detection + contextual interpretation
- **Focused responses** - each subagent addresses the specific request

### 2. Centralized Intelligence
- **MasterAgent handles final synthesis** - consistent user experience via LLM
- **Subagents provide contextual responses** - domain expertise + request focus
- **Better context awareness** - MasterAgent gets focused responses from experts
- **Simplified MasterAgent role** - transforms from tool orchestrator to context synthesizer
- **Natural coordination** - MasterAgent becomes conversational coordinator rather than technical orchestrator

### 3. Better Error Handling
- **Subagents interpret service errors contextually** - convert technical errors to relevant messages
- **Domain-specific error handling** - EmailAgent knows how to handle Gmail errors
- **Consistent error format** - all subagents return errors in same format

### 4. More Efficient
- **Focused AI processing** - subagents only interpret what's relevant to the request
- **Better response quality** - contextual interpretation vs generic formatting
- **Domain expertise** - each subagent understands its service results best

## Implementation Plan

### Phase 1: Refactor Subagent Interface
1. Update subagent base class to use natural language requests
2. Implement new `execute()` method signature
3. Update request/response types

### Phase 2: Implement AI Analysis
1. Add operation detection AI calls to each subagent
2. Implement parameter extraction logic
3. Add contextual interpretation AI calls for results

### Phase 3: Update MasterAgent
1. Modify MasterAgent to send natural language requests
2. Update response handling to work with contextual responses
3. Implement LLM-based synthesis of contextual responses for final user response

### Phase 4: Testing and Optimization
1. Test with various user requests
2. Optimize AI prompts for better accuracy
3. Performance testing and optimization

## Migration Strategy

### Backward Compatibility
- Keep existing tool call interface during transition
- Gradually migrate subagents to new interface
- Maintain fallback to old system if needed

### Testing Approach
- A/B test new vs. old architecture
- Monitor response quality and performance
- Gradual rollout to users

## Conclusion

This natural language communication architecture provides a cleaner, more efficient way for agents to communicate while maintaining the AI-driven intelligence that makes the system powerful. By having subagents provide contextual interpretations of their service results based on the MasterAgent's specific requests, we achieve focused responses that leverage domain expertise while allowing the MasterAgent to synthesize everything into a coherent final response. This approach balances efficiency with quality, ensuring each subagent addresses exactly what was asked while maintaining the natural user experience.
