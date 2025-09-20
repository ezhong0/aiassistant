import { BaseService } from './base-service';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';
import { EnhancedLogger } from '../utils/enhanced-logger';

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

  // Available agents and their capabilities for dynamic selection
  private readonly AVAILABLE_AGENTS = {
    emailAgent: {
      capabilities: ['search', 'send', 'read', 'compose', 'reply', 'forward', 'delete'],
      description: 'Gmail operations including search, composition, and management',
      parameters: ['query', 'recipient', 'subject', 'body', 'timeRange', 'maxResults', 'operation']
    },
    calendarAgent: {
      capabilities: ['search', 'create', 'update', 'delete', 'check_availability', 'suggest_times', 'retrieve_events', 'list_events'],
      description: 'Google Calendar operations for event management and scheduling',
      parameters: ['title', 'startTime', 'endTime', 'attendees', 'duration', 'query', 'operation']
    },
    contactAgent: {
      capabilities: ['search', 'create', 'update', 'delete', 'resolve'],
      description: 'Contact management and resolution operations',
      parameters: ['name', 'email', 'phone', 'query', 'operation']
    },
    slackAgent: {
      capabilities: ['send_message', 'gather_context', 'search', 'analyze'],
      description: 'Slack operations for messaging and context gathering',
      parameters: ['channel', 'message', 'user', 'query', 'operation']
    },
    thinkAgent: {
      capabilities: ['analyze', 'reason', 'summarize', 'compare', 'recommend'],
      description: 'AI reasoning and analysis for complex decision making',
      parameters: ['query', 'context', 'data', 'operation']
    }
  };

  constructor() {
    super('nextStepPlanningService');
  }

  protected async onInitialize(): Promise<void> {
    this.openaiService = getService<OpenAIService>('openaiService') || null;

    if (!this.openaiService) {
      throw new Error('OpenAIService is required for NextStepPlanningService');
    }

    EnhancedLogger.debug('NextStepPlanningService initialized', {
      correlationId: `next-step-planning-init-${Date.now()}`,
      operation: 'next_step_planning_init',
      metadata: {
        service: 'nextStepPlanningService',
        hasOpenAIService: !!this.openaiService,
        availableAgents: Object.keys(this.AVAILABLE_AGENTS)
      }
    });
  }

  /**
   * Plan the next step in the workflow based on current context
   */
  async planNextStep(context: WorkflowContext): Promise<NextStepPlan | null> {
    console.log('📋 PLANNING: Starting next step planning...');
    console.log('📊 Planning Context:', JSON.stringify(context, null, 2));
    
    if (!this.openaiService) {
      throw new Error('OpenAIService not available');
    }

    try {
      console.log('🔍 PLANNING: Creating planning prompt...');
      const planningPrompt = this.createNextStepPrompt(context);

      console.log('🤖 PLANNING: Calling OpenAI for step planning...');
      const response = await this.openaiService.generateText(
        planningPrompt,
        'You are an intelligent workflow planner. Plan the next logical step based on context. Return only valid JSON.',
        { temperature: 0.2, maxTokens: 2000 }
      );

      console.log('📋 PLANNING: Raw OpenAI response:', response);
      let nextStep;
      try {
        nextStep = JSON.parse(response);
        console.log('✅ PLANNING: Parsed next step:', JSON.stringify(nextStep, null, 2));
      } catch (parseError) {
        throw new Error(`LLM returned invalid JSON for step planning: ${response.substring(0, 200)}... Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // If the task is marked as complete, return null
      if (nextStep.isComplete) {
        console.log('✅ PLANNING: Task marked as complete, returning null');
        EnhancedLogger.debug('Workflow marked as complete', {
          correlationId: `next-step-complete-${Date.now()}`,
          operation: 'next_step_complete',
          metadata: {
            originalRequest: context.originalRequest.substring(0, 100),
            completedSteps: context.completedSteps.length,
            currentStep: context.currentStep
          }
        });
        return null;
      }

      // Validate and enhance the next step
      console.log('🔧 PLANNING: Validating and enhancing next step...');
      const validatedStep = this.validateNextStep(nextStep, context);
      console.log('🎉 PLANNING: Final validated step:', JSON.stringify(validatedStep, null, 2));

      EnhancedLogger.debug('Next step planned', {
        correlationId: `next-step-planned-${Date.now()}`,
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
      EnhancedLogger.error('Failed to plan next step', error as Error, {
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

      const analysis = JSON.parse(response);

      EnhancedLogger.debug('Step result analyzed', {
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
      EnhancedLogger.error('Failed to analyze step result', error as Error, {
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
    const agentCapabilities = Object.entries(this.AVAILABLE_AGENTS)
      .map(([name, agent]) => `${name}: ${agent.description} (${agent.capabilities.join(', ')})`)
      .join('\n');

    const completedStepsContext = context.completedSteps.length > 0
      ? `\nCOMPLETED STEPS:\n${context.completedSteps.map(step =>
          `Step ${step.stepNumber}: ${step.agent}.${step.operation} - ${step.success ? 'SUCCESS' : 'FAILED'} - ${step.result ? JSON.stringify(step.result).substring(0, 100) : 'No result'}`
        ).join('\n')}`
      : '\nNo steps completed yet.';

    const gatheredDataContext = Object.keys(context.gatheredData).length > 0
      ? `\nGATHERED DATA:\n${JSON.stringify(context.gatheredData, null, 2)}`
      : '';

    return `
You are an advanced AI workflow planner. Plan the next logical step based on the current context.

ORIGINAL REQUEST: "${context.originalRequest}"
CURRENT STEP: ${context.currentStep}
MAX STEPS: ${context.maxSteps}

${completedStepsContext}${gatheredDataContext}

AVAILABLE AGENTS:
${agentCapabilities}

PLANNING RULES:
1. Analyze what has been accomplished so far
2. Determine the next logical step to complete the original request
3. Choose the most appropriate agent for the task
4. Generate specific parameters based on context and previous results
5. If the task is complete, set isComplete to true
6. If maximum steps reached without completion, set isComplete to true
7. Consider error recovery if previous steps failed
8. Be intelligent about step dependencies and order

RESPONSE FORMAT (JSON only):
{
  "stepNumber": ${context.currentStep},
  "description": "Clear description of what this step will accomplish",
  "agent": "agentName",
  "operation": "specific_operation",
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

Plan intelligently based on context, not rigid templates!
`;
  }

  /**
   * Create prompt for step result analysis
   */
  private createStepAnalysisPrompt(stepResult: StepResult, context: WorkflowContext): string {
    return `
You are an intelligent step result analyzer. Analyze the step execution result and determine next actions.

ORIGINAL REQUEST: "${context.originalRequest}"
CURRENT STEP: ${stepResult.stepNumber}

STEP EXECUTION RESULT:
- Agent: ${stepResult.agent}
- Operation: ${stepResult.operation}
- Parameters: ${JSON.stringify(stepResult.parameters)}
- Success: ${stepResult.success}
- Result: ${JSON.stringify(stepResult.result)}
- Error: ${stepResult.error || 'None'}

CONTEXT:
- Completed Steps: ${context.completedSteps.length}
- Gathered Data: ${JSON.stringify(context.gatheredData)}

ANALYSIS REQUIREMENTS:
1. Determine if the step was successful and achieved its goal
2. Check if the overall task is now complete
3. Identify if user input is needed to proceed
4. Assess if the workflow should continue
5. Extract any useful data from the step result
6. Recommend next actions

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
    if (!nextStep.agent || !this.AVAILABLE_AGENTS[nextStep.agent as keyof typeof this.AVAILABLE_AGENTS]) {
      throw new Error(`Invalid agent specified: ${nextStep.agent}`);
    }

    // Validate operation is supported by agent
    const agent = this.AVAILABLE_AGENTS[nextStep.agent as keyof typeof this.AVAILABLE_AGENTS];
    if (!nextStep.operation || !agent.capabilities.includes(nextStep.operation)) {
      throw new Error(`Operation '${nextStep.operation}' not supported by agent '${nextStep.agent}'`);
    }

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
    return this.AVAILABLE_AGENTS;
  }

  protected async onDestroy(): Promise<void> {
    EnhancedLogger.debug('NextStepPlanningService destroyed', {
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
        availableAgents: Object.keys(this.AVAILABLE_AGENTS),
        stepByStepPlanning: true
      }
    };
  }
}