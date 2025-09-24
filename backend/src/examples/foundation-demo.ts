/**
 * Foundation Pattern Demo
 *
 * This example demonstrates all the new foundation types working together:
 * - AgentResult<T> for type-safe error handling
 * - AgentExecution for context management
 * - Agent utilities for safety and validation
 */

import {
  AgentResult,
  success,
  failure,
  AgentErrorCode,
  isSuccess,
} from '../types/agents/agent-result';
import {
  AgentExecution,
  createExecution,
  EventBus,
} from '../framework/agent-execution';
import {
  validateServiceAvailable,
  detectRepeatedFailures,
  validateAISchema,
  ensureErrorVisibility,
} from '../utils/agent-utilities';

// ============ Example 1: Type-Safe Results ============

interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
}

async function getCalendarEvents(
  userId: string,
  calendarService: any
): Promise<AgentResult<CalendarEvent[]>> {
  // Null safety check
  try {
    validateServiceAvailable(calendarService, 'calendarService');
  } catch (error) {
    return failure(
      {
        code: AgentErrorCode.SERVICE_UNAVAILABLE,
        message: 'Calendar service not available',
        suggestions: ['Check calendar integration', 'Verify OAuth tokens'],
      },
      false // not recoverable
    );
  }

  try {
    const events = await calendarService.getEvents(userId);
    return success(events, {
      operation: 'listEvents',
      requiresConfirmation: false,
    });
  } catch (error: any) {
    return failure(
      {
        code: AgentErrorCode.EXTERNAL_API_ERROR,
        message: error.message,
        originalError: error,
        suggestions: ['Retry the operation', 'Check API credentials'],
      },
      true // recoverable
    );
  }
}

// ============ Example 2: Execution Context ============

async function processUserRequest(
  request: string,
  execution: AgentExecution
): Promise<AgentResult<string>> {
  // Context is automatically available - no threading needed
  console.log(`Processing request for user: ${execution.userId}`);
  console.log(`Session: ${execution.sessionId}`);
  console.log(`Correlation: ${execution.correlationId}`);

  // Execute with automatic metrics and events
  return await execution.execute('process-request', async () => {
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (request.includes('error')) {
      return failure({
        code: AgentErrorCode.OPERATION_FAILED,
        message: 'Request contained error keyword',
      });
    }

    return success(`Processed: ${request}`);
  });
}

// ============ Example 3: Loop Prevention ============

async function autonomousAgent(
  goal: string,
  maxSteps: number = 5
): Promise<AgentResult<string>> {
  const steps: string[] = [];
  const results: string[] = [];

  for (let i = 0; i < maxSteps; i++) {
    // Check for repeated failures (from production fixes)
    if (steps.length >= 3) {
      if (detectRepeatedFailures(steps.slice(-3), results.slice(-3))) {
        return failure({
          code: AgentErrorCode.REPEATED_FAILURES_DETECTED,
          message: 'Detected infinite loop - stopping execution',
          context: { steps, results },
          suggestions: ['Review service configuration', 'Check permissions'],
        });
      }
    }

    // Simulate step execution
    const step = `Attempt ${i + 1}: ${goal}`;
    steps.push(step);

    // Simulate failure for demo
    if (i < 3) {
      results.push(`Error: wasn't able to complete ${goal}`);
    } else {
      results.push(`Successfully completed ${goal}`);
      return success(`Completed after ${i + 1} attempts`);
    }
  }

  return failure({
    code: AgentErrorCode.MAX_RETRIES_EXCEEDED,
    message: 'Max steps exceeded without completion',
  });
}

// ============ Example 4: AI Schema Validation ============

async function analyzeWithAI(
  input: string,
  aiService: any
): Promise<AgentResult<any>> {
  // Schema validation (from production fixes)
  const schema = {
    type: 'object' as const,
    properties: {
      intent: { type: 'string' },
      confidence: { type: 'number' },
      actions: {
        type: 'array',
        items: {
          // ✅ REQUIRED: items definition for arrays
          type: 'object',
          properties: {
            type: { type: 'string' },
            operation: { type: 'string' },
          },
        },
      },
    },
    required: ['intent', 'confidence'],
  };

  // Validate schema before sending to AI
  try {
    validateAISchema(schema);
  } catch (error: any) {
    return failure({
      code: AgentErrorCode.AI_SCHEMA_VALIDATION_FAILED,
      message: error.message,
    });
  }

  try {
    const result = await aiService.analyze(input, schema);
    return success(result);
  } catch (error: any) {
    const agentError = ensureErrorVisibility(error, 'AI analysis');
    return failure(agentError);
  }
}

// ============ Example 5: Complete Flow ============

async function completeWorkflow() {
  // Create event bus for tracking
  const events: any[] = [];
  const eventBus: EventBus = {
    emit: (event, data) => {
      events.push({ event, data });
      console.log(`📊 Event: ${event}`, data);
    },
  };

  // Create execution context
  const execution = createExecution(
    {
      userId: 'user-123',
      sessionId: 'session-456',
      accessToken: 'token-789',
    },
    eventBus
  );

  console.log('\n🚀 Starting Complete Workflow Demo\n');

  // Step 1: Process user request
  console.log('Step 1: Processing user request...');
  const requestResult = await processUserRequest('Get my calendar', execution);

  if (isSuccess(requestResult)) {
    console.log('✅ Request processed:', requestResult.value);
    console.log('⏱️  Duration:', requestResult.metadata?.duration, 'ms');
  } else {
    console.log('❌ Request failed:', requestResult.error.message);
    return;
  }

  // Step 2: Create child execution for sub-task
  console.log('\nStep 2: Creating child execution...');
  const childExecution = execution.createChild({ subtask: 'calendar-fetch' });
  console.log('👶 Child correlation ID:', childExecution.correlationId);

  // Step 3: Get execution summary
  console.log('\nStep 3: Execution summary:');
  const summary = execution.getSummary();
  console.log(JSON.stringify(summary, null, 2));

  // Step 4: Demonstrate error handling
  console.log('\nStep 4: Error handling demo...');
  const errorResult = await processUserRequest(
    'trigger error',
    execution
  );

  if (!errorResult.ok) {
    console.log('✅ Error properly caught:', errorResult.error.code);
    console.log('🔄 Recoverable:', errorResult.recoverable);
  }

  console.log('\n✨ Workflow complete!');
  console.log(`📊 Total events emitted: ${events.length}`);
}

// ============ Run Demo ============

if (require.main === module) {
  completeWorkflow()
    .then(() => {
      console.log('\n✅ Foundation demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error);
      process.exit(1);
    });
}

export {
  getCalendarEvents,
  processUserRequest,
  autonomousAgent,
  analyzeWithAI,
  completeWorkflow,
};