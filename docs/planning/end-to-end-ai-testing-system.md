# End-to-End AI Testing System Design

## Overview

This document outlines a comprehensive end-to-end testing system that uses AI to generate test inputs, mock API calls, and evaluate the entire master agent workflow. The system provides automated testing that can assess both functional correctness and quality of AI-generated responses.

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    E2E Testing Orchestrator                    │
├─────────────────────────────────────────────────────────────────┤
│  • Test Scenario Generator (AI)                                │
│  • API Mock Manager                                            │
│  • Master Agent Executor                                       │
│  • Response Evaluator (AI)                                     │
│  • Test Result Aggregator                                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Master Agent System                         │
├─────────────────────────────────────────────────────────────────┤
│  • Master Agent (Orchestrator)                                 │
│  • Prompt Builders (6 types)                                   │
│  • Workflow Executor                                           │
│  • Domain Agents (Email, Calendar, Contact, Slack)             │
│  • Domain Services (with mocked APIs)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Component Design

### 1. Test Scenario Generator

**Purpose**: Generate realistic, diverse test inputs using AI to cover various user intents and edge cases.

**Implementation**:
- Uses GPT-4 or Claude to generate test scenarios
- Covers all domain areas: email, calendar, contacts, slack
- Generates both simple and complex multi-step requests
- Includes edge cases, ambiguous requests, and error conditions

**Input Categories**:
```typescript
interface TestScenario {
  id: string;
  category: 'email' | 'calendar' | 'contact' | 'slack' | 'multi-domain';
  complexity: 'simple' | 'medium' | 'complex';
  userInput: string;
  expectedAgents: string[];
  expectedApiCalls: ExpectedApiCall[];
  context?: {
    previousMessages?: string[];
    userProfile?: any;
    timeContext?: string;
  };
  successCriteria: {
    responseQuality: string;
    requiredActions: string[];
    forbiddenActions?: string[];
  };
}
```

**Example Generated Scenarios**:
- "Schedule a meeting with John next Tuesday at 2pm and send him a calendar invite"
- "Find all emails from last week about the project proposal and summarize the key points"
- "Create a contact for Sarah Johnson at TechCorp and add her to our client list"
- "Send a Slack message to the team channel about tomorrow's standup being moved to 10am"

### 2. API Mock Manager

**Purpose**: Intercept and mock all external API calls with realistic responses.

**Implementation**:
- Intercepts calls at the `BaseAPIClient` level
- Maintains a library of realistic mock responses
- Supports dynamic response generation based on request parameters
- Tracks all API calls for evaluation

**Mock Response Library**:
```typescript
interface MockResponseLibrary {
  google: {
    gmail: {
      search: (query: string) => MockEmailSearchResponse;
      send: (email: EmailRequest) => MockSendResponse;
      get: (messageId: string) => MockEmailResponse;
    };
    calendar: {
      list: (params: CalendarListParams) => MockCalendarListResponse;
      create: (event: CalendarEvent) => MockEventResponse;
      update: (eventId: string, event: CalendarEvent) => MockEventResponse;
    };
    contacts: {
      list: (params: ContactListParams) => MockContactListResponse;
      create: (contact: Contact) => MockContactResponse;
      search: (query: string) => MockContactSearchResponse;
    };
  };
  slack: {
    chat: {
      postMessage: (message: SlackMessage) => MockSlackResponse;
      update: (message: SlackMessage) => MockSlackResponse;
    };
    conversations: {
      history: (params: HistoryParams) => MockHistoryResponse;
    };
  };
}
```

**Dynamic Response Generation**:
- Calendar availability based on request parameters
- Email search results that match query terms
- Contact information that's contextually relevant
- Slack message history that supports the test scenario

### 3. Master Agent Executor

**Purpose**: Execute the complete master agent workflow with full instrumentation.

**Implementation**:
- Wraps the existing `MasterAgent` class
- Captures all intermediate states and decisions
- Records all prompt builder executions
- Tracks workflow iterations and agent delegations

**Execution Tracking**:
```typescript
interface ExecutionTrace {
  testScenarioId: string;
  startTime: Date;
  endTime: Date;
  stages: {
    messageHistory: {
      input: string;
      output: string;
      duration: number;
    };
    situationAnalysis: {
      input: string;
      output: SituationAnalysisResponse;
      duration: number;
    };
    workflowPlanning: {
      input: string;
      output: WorkflowPlanningResponse;
      duration: number;
    };
    workflowExecution: {
      iterations: WorkflowIteration[];
      totalIterations: number;
      finalContext: string;
    };
    finalResponse: {
      input: string;
      output: string;
      duration: number;
    };
  };
  apiCalls: ApiCallRecord[];
  agentExecutions: AgentExecutionRecord[];
}
```

### 4. Response Evaluator

**Purpose**: Use AI to evaluate the quality and correctness of responses at multiple levels.

**Evaluation Levels**:

#### 4.1 Individual Prompt Evaluation
```typescript
interface PromptEvaluation {
  promptType: 'situation_analysis' | 'workflow_planning' | 'environment_check' | 'action_execution' | 'progress_assessment' | 'final_response';
  input: string;
  output: any;
  evaluation: {
    relevance: number; // 1-10
    completeness: number; // 1-10
    accuracy: number; // 1-10
    reasoning: string;
    suggestions: string[];
  };
}
```

#### 4.2 API Call Evaluation
```typescript
interface ApiCallEvaluation {
  expectedCalls: ExpectedApiCall[];
  actualCalls: ApiCallRecord[];
  evaluation: {
    missingCalls: ExpectedApiCall[];
    unexpectedCalls: ApiCallRecord[];
    correctCalls: ApiCallRecord[];
    parameterAccuracy: number; // 1-10
    reasoning: string;
  };
}
```

#### 4.3 Final Response Evaluation
```typescript
interface FinalResponseEvaluation {
  userInput: string;
  finalResponse: string;
  expectedActions: string[];
  evaluation: {
    responseRelevance: number; // 1-10
    actionCompleteness: number; // 1-10
    userSatisfaction: number; // 1-10
    clarity: number; // 1-10
    overallScore: number; // 1-10
    reasoning: string;
    improvementSuggestions: string[];
  };
}
```

### 5. Test Result Aggregator

**Purpose**: Compile and analyze test results across multiple scenarios.

**Aggregation Features**:
- Performance metrics (response times, iteration counts)
- Quality scores across different dimensions
- Failure pattern analysis
- Regression detection
- Coverage analysis

## Test Execution Flow

### Phase 1: Test Generation
1. **Scenario Generation**: AI generates diverse test scenarios
2. **Scenario Validation**: Human review and approval of generated scenarios
3. **Mock Data Preparation**: Generate corresponding mock API responses

### Phase 2: Test Execution
1. **Environment Setup**: Initialize master agent with mocked services
2. **Scenario Execution**: Run each test scenario through the complete workflow
3. **Data Collection**: Capture all intermediate states, API calls, and responses

### Phase 3: Evaluation
1. **Prompt-Level Evaluation**: Assess each prompt builder's output
2. **API Call Validation**: Verify correct API calls were made
3. **Final Response Assessment**: Evaluate the overall response quality
4. **Cross-Reference Analysis**: Compare expected vs actual behavior

### Phase 4: Reporting
1. **Individual Test Reports**: Detailed analysis of each scenario
2. **Aggregate Analysis**: Overall system performance and quality metrics
3. **Regression Detection**: Identify performance degradation
4. **Improvement Recommendations**: AI-generated suggestions for enhancement

## System Architecture & Integration

### Testing System Location
The E2E testing system will be implemented as a **separate testing framework** within the existing `backend/tests/` directory structure:

```
backend/tests/
├── e2e/                          # New E2E testing framework
│   ├── framework/                # Core testing framework
│   │   ├── test-scenario-generator.ts
│   │   ├── api-mock-manager.ts
│   │   ├── master-agent-executor.ts
│   │   ├── response-evaluator.ts
│   │   └── test-result-aggregator.ts
│   ├── mocks/                    # Mock response libraries
│   │   ├── google-api-mocks.ts
│   │   ├── slack-api-mocks.ts
│   │   └── openai-api-mocks.ts
│   ├── scenarios/                # Generated test scenarios
│   │   ├── email-scenarios.ts
│   │   ├── calendar-scenarios.ts
│   │   ├── contact-scenarios.ts
│   │   └── multi-domain-scenarios.ts
│   ├── evaluators/               # AI evaluation prompts
│   │   ├── prompt-evaluator.ts
│   │   ├── api-call-evaluator.ts
│   │   └── response-evaluator.ts
│   └── e2e.test.ts              # Main E2E test runner
├── integration/                  # Existing integration tests
├── unit/                        # Existing unit tests
└── setup/                       # Existing test setup
```

### Required Changes to Main System

#### 1. API Client Modifications
**File**: `backend/src/services/api/base-api-client.ts`

**Changes Needed**:
- Add testing mode detection
- Implement mock interception layer
- Add execution tracking hooks

```typescript
// Add to BaseAPIClient class
private isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.E2E_TESTING === 'true';
}

// Modify makeRequest method
async makeRequest<T = any>(request: APIRequest): Promise<APIResponse<T>> {
  // Check if we're in E2E testing mode
  if (this.isTestMode()) {
    const mockManager = require('../../tests/e2e/framework/api-mock-manager').default;
    return mockManager.interceptRequest(this.name, request);
  }
  
  // Existing implementation...
}
```

#### 2. Master Agent Instrumentation
**File**: `backend/src/agents/master.agent.ts`

**Changes Needed**:
- Add execution tracking hooks
- Implement test mode detection
- Add performance metrics collection

```typescript
// Add to MasterAgent class
private isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.E2E_TESTING === 'true';
}

// Modify processUserInput method
async processUserInput(
  userInput: string,
  sessionId: string,
  userId?: string,
  slackContext?: SlackContext
): Promise<ProcessingResult> {
  const startTime = Date.now();
  
  // Initialize execution tracking if in test mode
  let executionTrace: ExecutionTrace | null = null;
  if (this.isTestMode()) {
    const { ExecutionTracker } = require('../../tests/e2e/framework/execution-tracker');
    executionTrace = new ExecutionTracker(sessionId, userInput);
  }
  
  try {
    // Existing implementation with tracking hooks...
    
    if (executionTrace) {
      executionTrace.recordStage('messageHistory', messageHistory, Date.now() - startTime);
    }
    
    // Continue with existing workflow...
    
  } catch (error) {
    if (executionTrace) {
      executionTrace.recordError(error);
    }
    throw error;
  }
}
```

#### 3. Prompt Builder Instrumentation
**File**: `backend/src/services/prompt-builders/base-prompt-builder.ts`

**Changes Needed**:
- Add execution tracking
- Implement response capture
- Add performance metrics

```typescript
// Add to BasePromptBuilder class
protected async executeWithTracking(context: TContext): Promise<AIResponse<TResult>> {
  const startTime = Date.now();
  
  if (this.isTestMode()) {
    const { PromptTracker } = require('../../../tests/e2e/framework/prompt-tracker');
    const tracker = new PromptTracker(this.constructor.name, context);
    
    try {
      const result = await this.execute(context);
      tracker.recordSuccess(result, Date.now() - startTime);
      return result;
    } catch (error) {
      tracker.recordError(error, Date.now() - startTime);
      throw error;
    }
  }
  
  return this.execute(context);
}

private isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.E2E_TESTING === 'true';
}
```

#### 4. Workflow Executor Instrumentation
**File**: `backend/src/services/workflow-executor.service.ts`

**Changes Needed**:
- Add iteration tracking
- Implement agent execution monitoring
- Add context change tracking

```typescript
// Add to WorkflowExecutor class
private async executeIterationWithTracking(context: WorkflowExecutionContext): Promise<WorkflowIterationResult> {
  if (this.isTestMode()) {
    const { WorkflowTracker } = require('../../tests/e2e/framework/workflow-tracker');
    const tracker = new WorkflowTracker(context.sessionId, context.iteration);
    
    try {
      const result = await this.executeIteration(context);
      tracker.recordIteration(result);
      return result;
    } catch (error) {
      tracker.recordIterationError(error);
      throw error;
    }
  }
  
  return this.executeIteration(context);
}

private isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.E2E_TESTING === 'true';
}
```

#### 5. Environment Configuration
**File**: `backend/.env.test`

**New Environment Variables**:
```bash
# E2E Testing Configuration
E2E_TESTING=true
E2E_MOCK_APIS=true
E2E_TRACK_EXECUTION=true
E2E_EVALUATION_MODE=ai
E2E_SCENARIO_GENERATION=ai
```

#### 6. Package.json Updates
**File**: `backend/package.json`

**New Scripts**:
```json
{
  "scripts": {
    "test:e2e": "NODE_ENV=test E2E_TESTING=true jest --testPathPattern=e2e",
    "test:e2e:generate": "NODE_ENV=test E2E_TESTING=true jest --testPathPattern=e2e --testNamePattern=scenario-generation",
    "test:e2e:evaluate": "NODE_ENV=test E2E_TESTING=true jest --testPathPattern=e2e --testNamePattern=evaluation"
  }
}
```

#### 7. Jest Configuration Updates
**File**: `backend/jest.config.js`

**New Configuration**:
```javascript
module.exports = {
  // Existing configuration...
  
  // E2E Testing specific configuration
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/e2e/**/*.test.ts'
  ],
  
  // E2E test timeout (longer for AI operations)
  testTimeout: 120000,
  
  // Setup files for E2E testing
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/e2e/setup.ts'
  ],
  
  // Module name mapping for test imports
  moduleNameMapping: {
    '^@/tests/e2e/(.*)$': '<rootDir>/tests/e2e/$1'
  }
};
```

### Integration Points

#### 1. Service Manager Integration
The testing framework will integrate with the existing service manager to:
- Replace real services with mocked versions during testing
- Maintain service dependency chains
- Ensure proper cleanup between tests

#### 2. Logger Integration
The testing framework will:
- Capture all log output during test execution
- Correlate logs with test scenarios
- Provide detailed execution traces

#### 3. Database Integration
For tests that require database state:
- Use the existing test database setup
- Create isolated test data
- Clean up after each test

## Implementation Strategy

### Phase 1: Foundation (Weeks 1-2)
- Implement API Mock Manager
- Create basic test scenario generator
- Set up execution tracking infrastructure
- **Add instrumentation hooks to main system**

### Phase 2: Core Testing (Weeks 3-4)
- Implement Master Agent Executor
- Create response evaluator
- Build test result aggregator
- **Integrate with existing test infrastructure**

### Phase 3: Advanced Features (Weeks 5-6)
- Enhance scenario generation with more complex cases
- Implement regression detection
- Add performance benchmarking
- **Optimize main system performance impact**

### Phase 4: Integration & Optimization (Weeks 7-8)
- Integrate with CI/CD pipeline
- Optimize evaluation accuracy
- Add comprehensive reporting
- **Production readiness and monitoring**

## Key Benefits

### 1. Comprehensive Coverage
- Tests the entire system end-to-end
- Covers all domain agents and their interactions
- Validates both functional and qualitative aspects

### 2. AI-Driven Quality Assessment
- Uses AI to evaluate AI responses
- Provides nuanced quality scoring
- Identifies subtle issues that rule-based tests miss

### 3. Realistic Testing
- Uses AI-generated scenarios that mirror real user requests
- Tests with realistic mock data
- Covers edge cases and ambiguous inputs

### 4. Continuous Improvement
- Identifies patterns in failures and quality issues
- Provides actionable improvement suggestions
- Enables data-driven optimization

### 5. Regression Prevention
- Detects performance degradation over time
- Validates that changes don't break existing functionality
- Maintains quality standards across releases

## Technical Considerations

### 1. Mock Response Realism
- Mock responses must be contextually appropriate
- Should reflect real API response patterns
- Need to handle various edge cases and error conditions

### 2. Evaluation Accuracy
- AI evaluators need to be calibrated for consistency
- Should use multiple evaluation criteria
- Need human validation of evaluation quality

### 3. Performance Impact
- Testing system should not significantly slow down development
- Need efficient mock response generation
- Should support parallel test execution

### 4. Maintenance Overhead
- Mock responses need to be updated as APIs change
- Test scenarios should be regularly refreshed
- Evaluation criteria may need refinement over time

## Success Metrics

### 1. Test Coverage
- Percentage of code paths tested
- Number of unique user scenarios covered
- API endpoint coverage

### 2. Quality Metrics
- Average response quality scores
- Percentage of tests passing quality thresholds
- Reduction in production issues

### 3. Development Efficiency
- Time to detect regressions
- Reduction in manual testing effort
- Faster release cycles

### 4. System Reliability
- Consistency of AI responses
- Stability of the master agent workflow
- Error handling effectiveness

## Simplified Testing Strategy

Focus on the core E2E testing system with minimal changes to the main application:

### 1. Minimal Main System Changes

**API Mocking**: Add simple test mode detection to `BaseAPIClient`:

```typescript
// Add to BaseAPIClient.makeRequest()
if (process.env.E2E_TESTING === 'true') {
  const mockManager = require('../../tests/e2e/api-mock-manager');
  return mockManager.interceptRequest(this.name, request);
}
```

**Test Environment**: Add E2E test script to package.json:

```json
{
  "scripts": {
    "test:e2e": "E2E_TESTING=true jest --testPathPattern=e2e"
  }
}
```

### 2. Core E2E Testing Components

**Test Structure**:
```
backend/tests/e2e/
├── api-mock-manager.ts      # Mock external API calls
├── scenario-generator.ts    # AI-generated test scenarios  
├── response-evaluator.ts    # AI evaluation of responses
├── e2e.test.ts             # Main test runner
└── setup.ts                # Test setup
```

**Key Features**:
- AI generates realistic test scenarios
- Mock all external API calls (Google, Slack, OpenAI)
- AI evaluates response quality and correctness
- Track which API calls were made vs expected

### 3. Implementation Focus

**Phase 1**: Basic E2E testing with mocked APIs
**Phase 2**: Add AI scenario generation
**Phase 3**: Add AI response evaluation

This keeps the scope focused on the core E2E testing system without over-engineering.
