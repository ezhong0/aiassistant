# Master Agent Prompt Requirements

## Overview

This document outlines all the prompts needed for the Master Agent system based on the redesign architecture. Every prompt outputs an updated context as a single text field, with additional fields only when the logical flow depends on them.

## Core Context Format

All prompts use this context structure (as formatted text):
```
GOAL: [Primary user intent and desired outcome]
ENTITIES: [People, companies, meetings, emails referenced]
CONSTRAINTS: [Time limits, approval requirements, risk factors]
DATA: [Information gathered from domain agents]
PROGRESS: [Actions completed, decisions made]
BLOCKERS: [Current issues preventing progress]
NEXT: [Immediate next action in workflow]

Free-form Notes: [Additional context, reasoning, edge cases]
```

## Phase 1: Understanding & Planning

### 1. Situation Analysis Prompt
**Purpose**: Analyze user request, assess risk, determine intent, identify context gaps, determine output strategy
**Input**: User message, conversation history, user profile
**Response Format**:
```typescript
{
  context: string; // Updated context with initial analysis
  riskLevel: 'low' | 'medium' | 'high'; // Only if affects flow
  outputStrategy: 'direct' | 'preview' | 'confirmation'; // Only if affects flow
}
```

### 2. Workflow Planning Prompt
**Purpose**: Create specific execution steps that will be looped over
**Input**: Situation analysis, available services, user preferences
**Response Format**:
```typescript
{
  context: string; // Updated context with workflow plan
  steps: string[]; // Specific steps to execute in order
}
```

## Phase 2: Execution Loop

### 3. Environment Check Prompt
**Purpose**: Check for interruptions, evaluate user input needs, assess readiness
**Input**: Current context, iteration count, user messages
**Response Format**:
```typescript
{
  context: string; // Updated context with readiness assessment
  needsUserInput: boolean; // Only if true
  requiredInfo?: string; // Only if needsUserInput is true
}
```

### 4. Action Execution Prompt
**Purpose**: Determine which agent to use and what request to send for a specific step
**Input**: Current context, step string from workflow planning
**Response Format**:
```typescript
{
  context: string; // Updated context with execution plan
  agent: 'email' | 'calendar' | 'contact'; // Agent to send request to
  request: string; // Specific request string to send to the agent
}
```

### 5. Progress Assessment Prompt
**Purpose**: Assess progress and update workflow steps if needed
**Input**: Current context, agent execution results, error analysis
**Response Format**:
```typescript
{
  context: string; // Updated context with progress assessment
  newSteps?: string[]; // Only if workflow steps need to be updated
}
```

## Phase 3: Final Output

### 6. Final Response Prompt
**Purpose**: Generate final output when workflow is complete
**Input**: Final context, user preferences
**Response Format**:
```typescript
{
  context: string; // Final updated context
  response: string;
}
```


## Summary

**Total Prompts**: 6
- **Core Workflow**: 6 (Planning, Execution, Output)

## Implementation Notes

1. **Context Consistency**: Every prompt must output an updated context
2. **Conditional Fields**: Additional fields only when logical flow depends on them
   - `requiredInfo` describes what information is needed from the user (not a specific question)
3. **Error Handling**: All prompts should handle errors gracefully
4. **Type Safety**: All responses must extend BaseAIResponse interface
5. **Schema Requirements**: All schemas must include 'context' as required string field

## Usage Examples

```typescript
// Situation Analysis
const situationBuilder = new SituationAnalysisPromptBuilder(aiService);
const result = await situationBuilder.execute({
  userInput: "Schedule a board meeting next month",
  conversationHistory: [],
  userId: "user123"
});
// result.context contains updated context
// result.riskLevel only if affects flow
// result.outputStrategy only if affects flow

// Workflow Planning
const planningBuilder = new WorkflowPlanningPromptBuilder(aiService);
const result = await planningBuilder.execute({
  context: "GOAL: Schedule board meeting...",
  availableServices: ["email", "calendar", "contact"]
});
// result.context contains updated context
// result.steps = ["Check calendar availability", "Send invites", "Follow up on RSVPs"]

// Action Execution
const actionBuilder = new ActionExecutionPromptBuilder(aiService);
const actionResult = await actionBuilder.execute({
  context: "GOAL: Schedule board meeting...",
  step: "Check calendar availability"
});
// actionResult.context contains updated context
// actionResult.agent = "calendar"
// actionResult.request = "Find available 2-hour slots next month for 8 board members"

// Progress Assessment
const progressBuilder = new ProgressAssessmentPromptBuilder(aiService);
const progressResult = await progressBuilder.execute({
  context: "GOAL: Schedule board meeting...",
  agentResults: calendarAgentResult
});
// progressResult.context contains updated context
// progressResult.newSteps = ["Send invites", "Follow up on RSVPs"] // Only if steps need updating

```
