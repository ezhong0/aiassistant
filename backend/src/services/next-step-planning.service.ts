import { BaseService } from './base-service';
import logger from '../utils/logger';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';

/**
 * Workflow context for step-by-step planning
 */
export interface WorkflowContext {
  originalRequest: string;
  currentStep: number;
  maxSteps: number;
  completedSteps: StepResult[];
  gatheredData: Record<string, any>;
  userContext?: any;
}

/**
 * Step result from execution
 */
export interface StepResult {
  stepNumber: number;
  agent: string;
  operation: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
  executedAt: Date;
}

/**
 * Next step planning result
 */
export interface NextStepPlan {
  stepNumber: number;
  description: string;
  agent: string;
  operation: string;
  parameters: Record<string, any>;
  reasoning: string;
  isComplete: boolean;
}

/**
 * NextStepPlanningService - Intelligent step-by-step workflow planning
 *
 * Replaces upfront planning with dynamic, context-aware step planning.
 * Plans one step at a time based on what has been accomplished so far.
 */
export class NextStepPlanningService extends BaseService {
  private openaiService: OpenAIService | null = null;
  // Dynamic agent inventory, refreshed from AgentFactory at runtime
  private agentInventory: Record<string, {
    capabilities: string[];
    limitations?: string[];
    schema?: any;
    enabled?: boolean;
  }> = {};

  constructor() {
    super('nextStepPlanningService');
  }

  protected async onInitialize(): Promise<void> {
    this.openaiService = getService<OpenAIService>('openaiService') || null;

    if (!this.openaiService) {
      throw new Error('OpenAIService is required for NextStepPlanningService');
    }

    // Preload dynamic agent inventory (best effort)
    await this.refreshAgentInventory().catch(() => undefined);

    logger.debug('NextStepPlanningService initialized', {
      correlationId: `next-step-planning-init-${Date.now()}`,
      operation: 'next_step_planning_init',
      metadata: {
        service: 'nextStepPlanningService',
        hasOpenAIService: !!this.openaiService,
        availableAgents: Object.keys(this.agentInventory)
      }
    });
  }

  /**
   * Plan the next step in the workflow based on current context
   */
  async planNextStep(context: WorkflowContext): Promise<NextStepPlan | null> {
    const correlationId = `planning-${Date.now()}`;

    logger.debug('Starting next step planning', {
      correlationId,
      operation: 'next_step_planning',
      metadata: {
        currentStep: context.currentStep,
        maxSteps: context.maxSteps,
        completedStepsCount: context.completedSteps.length
      }
    });

    if (!this.openaiService) {
      throw new Error('OpenAIService not available');
    }

    try {
      // Ensure agent inventory is fresh (non-blocking failure)
      await this.refreshAgentInventory().catch(() => undefined);

      logger.debug('Creating planning prompt', {
        correlationId,
        operation: 'planning_prompt_creation'
      });
      const planningPrompt = this.createNextStepPrompt(context);

      logger.debug('Calling OpenAI for step planning', {
        correlationId,
        operation: 'openai_planning_call'
      });
      const response = await this.openaiService.generateText(
        planningPrompt,
        'You are an intelligent workflow planner. Plan the next logical step based on context. Return only valid JSON.',
        { temperature: 0.2, maxTokens: 2000 }
      );

      logger.debug('Received OpenAI planning response', {
        correlationId,
        operation: 'openai_planning_response',
        metadata: { responseLength: response.length }
      });

      let nextStep;
      try {
        nextStep = JSON.parse(response);
        logger.debug('Successfully parsed next step', {
          correlationId,
          operation: 'step_parsing',
          metadata: {
            stepNumber: nextStep.stepNumber,
            agent: nextStep.agent,
            operation: nextStep.operation
          }
        });
      } catch (parseError) {
        throw new Error(`LLM returned invalid JSON for step planning: ${response.substring(0, 200)}... Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // If the task is marked as complete, return null
      if (nextStep.isComplete) {
        logger.debug('Workflow marked as complete', {
          correlationId,
          operation: 'workflow_complete',
          metadata: {
            originalRequest: context.originalRequest.substring(0, 100),
            completedSteps: context.completedSteps.length,
            currentStep: context.currentStep
          }
        });
        return null;
      }

      // Validate and enhance the next step
      logger.debug('Validating and enhancing next step', {
        correlationId,
        operation: 'step_validation'
      });
      const validatedStep = this.validateNextStep(nextStep, context);

      logger.debug('Next step planned successfully', {
        correlationId,
        operation: 'next_step_planned',
        metadata: {
          stepNumber: validatedStep.stepNumber,
          agent: validatedStep.agent,
          operation: validatedStep.operation,
          reasoning: validatedStep.reasoning.substring(0, 100)
        }
      });

      return validatedStep;
    } catch (error) {
      logger.error('Failed to plan next step', error as Error, {
        correlationId: `next-step-planning-error-${Date.now()}`,
        operation: 'next_step_planning_error',
        metadata: {
          currentStep: context.currentStep,
          originalRequest: context.originalRequest.substring(0, 100)
        }
      });
      throw error;
    }
  }

  /**
   * Analyze step results to determine completion and next actions
   */
  async analyzeStepResult(stepResult: StepResult, context: WorkflowContext): Promise<{
    shouldContinue: boolean;
    isComplete: boolean;
    needsUserInput: boolean;
    analysis: string;
    updatedContext?: Partial<WorkflowContext>;
  }> {
    if (!this.openaiService) {
      throw new Error('OpenAIService not available');
    }

    try {
      const analysisPrompt = this.createStepAnalysisPrompt(stepResult, context);

      const response = await this.openaiService.generateText(
        analysisPrompt,
        'You are an intelligent step result analyzer. Analyze the step result and determine next actions. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 1500 }
      );

      // Robust JSON parsing with error handling
      let analysis;
      try {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn('Failed to parse step analysis JSON, using fallback', {
          correlationId: `step-analysis-parse-error-${Date.now()}`,
          operation: 'step_analysis_parse_error',
          metadata: {
            responseLength: response.length,
            responsePreview: response.substring(0, 200),
            parseError: parseError instanceof Error ? parseError.message : 'Unknown error'
          }
        });

        // Fallback analysis based on step success
        analysis = {
          shouldContinue: stepResult.success && stepResult.agent === 'calendarAgent' && stepResult.operation === 'check_availability',
          isComplete: stepResult.success && stepResult.agent === 'calendarAgent' && stepResult.operation === 'list',
          needsUserInput: false,
          analysis: stepResult.success
            ? 'Step completed successfully. Proceeding based on operation type.'
            : 'Step failed. Stopping workflow for user review.'
        };
      }

      logger.debug('Step result analyzed', {
        correlationId: `step-analysis-${Date.now()}`,
        operation: 'step_result_analysis',
        metadata: {
          stepNumber: stepResult.stepNumber,
          success: stepResult.success,
          shouldContinue: analysis.shouldContinue,
          isComplete: analysis.isComplete,
          needsUserInput: analysis.needsUserInput
        }
      });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze step result', error as Error, {
        correlationId: `step-analysis-error-${Date.now()}`,
        operation: 'step_analysis_error',
        metadata: {
          stepNumber: stepResult.stepNumber,
          success: stepResult.success
        }
      });
      throw error;
    }
  }

  /**
   * Create prompt for next step planning
   */
  private createNextStepPrompt(context: WorkflowContext): string {
    const availableAgentsJson = JSON.stringify(
      Object.fromEntries(
        Object.entries(this.agentInventory).map(([name, meta]) => [name, {
          capabilities: meta.capabilities,
          limitations: meta.limitations
        }])
      ),
      null,
      2
    );

    const completedStepsContext = context.completedSteps.length > 0
      ? `\nCOMPLETED STEPS:\n${context.completedSteps.map(step =>
          `Step ${step.stepNumber}: ${step.agent}.${step.operation} - ${step.success ? 'SUCCESS' : 'FAILED'} - ${step.result ? JSON.stringify(step.result).substring(0, 100) : 'No result'}`
        ).join('\n')}`
      : '\nNo steps completed yet.';

    const gatheredDataContext = Object.keys(context.gatheredData).length > 0
      ? `\nGATHERED DATA:\n${JSON.stringify(context.gatheredData, null, 2)}`
      : '';

    const currentDate = new Date();
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const currentYear = currentDate.getFullYear();

    const intentAnalysisContext = context.gatheredData.intentAnalysis
      ? `\nINTENT ANALYSIS:\n- Intent Type: ${context.gatheredData.intentType}\n- Confidence: ${context.gatheredData.confidence}\n- Analysis: ${JSON.stringify(context.gatheredData.intentAnalysis, null, 2)}`
      : '';

    return `
You are an advanced AI workflow planner. Plan the next logical step based on the current context.

CURRENT DATE CONTEXT:
- Today's date: ${currentDateStr}
- Current year: ${currentYear}
- Current time: ${currentDate.toISOString()}

ORIGINAL REQUEST: "${context.originalRequest}"
CURRENT STEP: ${context.currentStep}
MAX STEPS: ${context.maxSteps}

${intentAnalysisContext}${completedStepsContext}${gatheredDataContext}

AVAILABLE AGENTS (dynamic JSON):
${availableAgentsJson}

AVAILABLE AGENTS WITH EXACT OPERATION NAMES:
- calendarAgent: create, list, update, delete, check_availability, find_slots
- emailAgent: send, compose, search, read, reply, forward, delete  
- contactAgent: search, create, update, delete, resolve

PLANNING RULES:
1. Use intent analysis to understand the user's goal and context
2. For confirmation_positive: plan to execute the referenced draft
3. For confirmation_negative: plan to cancel/cleanup drafts
4. For draft_modification: plan to update the draft with new values
5. For new_request/new_write_operation: plan steps to fulfill the request (resolve contacts, compose drafts, etc.)
6. For read_operation: plan steps to gather the requested information
7. Always defer destructive actions until explicit user confirmation
8. If essential data is missing, plan a clarification/user-input step
9. Be intelligent about step dependencies and order
10. Always use current year (${currentYear}) when generating dates
11. Use proper ISO 8601 format for dates: YYYY-MM-DDTHH:mm:ssZ
12. Use EXACT operation names (with underscores, not spaces)
13. For calendar operations: use check_availability, create, list, update, delete, find_slots
14. For email operations: use send, compose, search, read, reply, forward, delete
15. For contact operations: use search, create, update, delete, resolve

WRITE OPERATION GUIDELINE:
- For email writes: plan contactAgent.resolve → emailAgent.compose (draft) → await confirmation
- For calendar writes: plan contact resolution for attendees → calendarAgent.create (draft) → await confirmation
- For reads: plan single read operation → synthesize results

RESPONSE FORMAT (JSON only):
{
  "stepNumber": ${context.currentStep},
  "description": "Clear description of what this step will accomplish",
  "agent": "agentName",
  "operation": "exact_operation_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "reasoning": "Detailed reasoning for why this step is needed and how it advances the goal",
  "isComplete": false
}

If the task is complete, respond with:
{
  "isComplete": true,
  "reasoning": "Explanation of why the task is complete"
}

Plan intelligently based on intent and context, not rigid templates!
`;
  }

  /**
   * Create prompt for step result analysis
   */
  private createStepAnalysisPrompt(stepResult: StepResult, context: WorkflowContext): string {
    // Summarize large result objects to prevent token overflow
    const resultSummary = this.summarizeStepResult(stepResult);

    return `
You are an intelligent step result analyzer. Analyze the step execution result and determine next actions.

ORIGINAL REQUEST: "${context.originalRequest}"
CURRENT STEP: ${stepResult.stepNumber}

STEP EXECUTION RESULT:
- Agent: ${stepResult.agent}
- Operation: ${stepResult.operation}
- Parameters: ${JSON.stringify(stepResult.parameters)}
- Success: ${stepResult.success}
- Result Summary: ${resultSummary}
- Error: ${stepResult.error || 'None'}

CONTEXT:
- Completed Steps: ${context.completedSteps.length}
- Gathered Data Keys: ${Object.keys(context.gatheredData).join(', ')}

ANALYSIS REQUIREMENTS:
1. Determine if the step was successful and achieved its goal
2. Check if the overall task is now complete
3. Identify if user input is needed to proceed
4. Assess if the workflow should continue
5. Extract any useful data from the step result
6. Recommend next actions

WORKFLOW CONTINUATION GUIDELINES:
- For calendar check_availability: If successful and slot is available, continue to create the event
- For calendar list operations: If successful, consider task complete (user asked for info)
- For failed steps: Generally continue if the failure is recoverable, stop if critical
- For read operations: Complete after successful retrieval
- For write operations: Continue until confirmation and execution is complete
- Always prioritize user intent from the original request

RESPONSE FORMAT (JSON only):
{
  "shouldContinue": true/false,
  "isComplete": true/false,
  "needsUserInput": true/false,
  "analysis": "Detailed analysis of the step result and what it means",
  "updatedContext": {
    "gatheredData": {
      "newKey": "newValue"
    }
  }
}

Analyze intelligently and provide actionable insights!
`;
  }

  /**
   * Validate and enhance next step planning result
   */
  private validateNextStep(nextStep: any, context: WorkflowContext): NextStepPlan {
    // Validate agent exists
    if (!nextStep.agent || !this.agentInventory[nextStep.agent]) {
      throw new Error(`Invalid agent specified: ${nextStep.agent}`);
    }

    // Remove strict operation validation - let the agent handle it
    // The agent will validate the operation when it receives the tool call

    return {
      stepNumber: nextStep.stepNumber || context.currentStep,
      description: nextStep.description || 'Execute step',
      agent: nextStep.agent,
      operation: nextStep.operation,
      parameters: nextStep.parameters || {},
      reasoning: nextStep.reasoning || 'Step planning reasoning',
      isComplete: nextStep.isComplete || false
    };
  }

  /**
   * Get available agents for planning
   */
  getAvailableAgents(): Record<string, any> {
    return this.agentInventory;
  }

  protected async onDestroy(): Promise<void> {
    logger.debug('NextStepPlanningService destroyed', {
      correlationId: `next-step-planning-destroy-${Date.now()}`,
      operation: 'next_step_planning_destroy',
      metadata: { service: 'nextStepPlanningService' }
    });
  }

  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.isReady() && !!this.openaiService,
      details: {
        service: 'nextStepPlanningService',
        hasOpenAIService: !!this.openaiService,
        availableAgents: Object.keys(this.agentInventory),
        stepByStepPlanning: true
      }
    };
  }

  /**
   * Summarize step results to prevent token overflow in analysis prompts
   */
  private summarizeStepResult(stepResult: StepResult): string {
    if (!stepResult.result || typeof stepResult.result !== 'object') {
      return JSON.stringify(stepResult.result);
    }

    try {
      // Handle calendar results
      if (stepResult.agent === 'calendarAgent') {
        const result = stepResult.result as any;
        if (result.result?.data?.events) {
          const events = result.result.data.events;
          return `Found ${events.length} calendar events: ${events.slice(0, 3).map((e: any) =>
            `"${e.summary}" (${e.start?.dateTime || e.start?.date})`
          ).join(', ')}${events.length > 3 ? ` and ${events.length - 3} more...` : ''}`;
        }
        if (result.result?.data?.isAvailable !== undefined) {
          return `Time slot availability: ${result.result.data.isAvailable ? 'Available' : 'Busy/Conflict'}`;
        }
      }

      // Handle email results
      if (stepResult.agent === 'emailAgent') {
        const result = stepResult.result as any;
        if (result.result?.data?.emails) {
          return `Found ${result.result.data.emails.length} emails`;
        }
        if (result.result?.data?.sent) {
          return `Email sent successfully`;
        }
      }

      // Handle contact results
      if (stepResult.agent === 'contactAgent') {
        const result = stepResult.result as any;
        if (result.result?.data?.contacts) {
          return `Found ${result.result.data.contacts.length} contacts`;
        }
      }

      // Default: stringify with size limit
      const resultStr = JSON.stringify(stepResult.result);
      if (resultStr.length > 500) {
        return resultStr.substring(0, 500) + '... [truncated]';
      }
      return resultStr;

    } catch (error) {
      return `Result data (${typeof stepResult.result}) - could not summarize`;
    }
  }

  /**
   * Refresh agent inventory dynamically from AgentFactory
   */
  private async refreshAgentInventory(): Promise<void> {
    try {
      const { AgentFactory } = await import('../framework/agent-factory');
      const meta = await AgentFactory.getAgentDiscoveryMetadata();
      const inventory: Record<string, any> = {};
      for (const [name, info] of Object.entries(meta || {})) {
        inventory[name] = {
          capabilities: Array.isArray((info as any).capabilities) ? (info as any).capabilities : [],
          limitations: (info as any).limitations,
          schema: (info as any).schema,
          enabled: (info as any).enabled
        };
      }
      this.agentInventory = inventory;
    } catch {
      // Keep previous inventory on failure
    }
  }
}