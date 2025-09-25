import { BaseService } from './base-service';
import logger from '../utils/logger';
import { OpenAIService } from './openai.service';
import { getService } from "./service-manager";
import { AgentExecutionContext } from '../types/agents/natural-language.types';
import { PromptUtils } from '../utils/prompt-utils';

/**
 * Simple workflow context for string-based planning
 */
export interface StringWorkflowContext {
  originalRequest: string;
  currentStep: number;
  maxSteps: number;
  completedSteps: string[];
  stepResults: string[];
  userContext?: any;
  agentContext?: AgentExecutionContext; // For timezone/locale/preferences
}

/**
 * Simple step result from execution
 */
export interface StringStepResult {
  stepNumber: number;
  stepDescription: string;
  result: string;
  success: boolean;
  executedAt: Date;
}

/**
 * Chain-of-Thought reasoning for step planning
 */
export interface StepPlanningReasoning {
  currentState: string;
  gaps: string[];
  progressCheck: string;
  nextAction: string;
}

/**
 * String-based planning result
 */
export interface StringStepPlan {
  reasoning: StepPlanningReasoning;
  nextStep: string;
  isComplete: boolean;
}

/**
 * StringPlanningService - Simple, natural language workflow planning
 *
 * Replaces complex structured planning with simple string-based steps.
 * Each step is a natural language description of what needs to be done.
 */
export class StringPlanningService extends BaseService {
  private openaiService: OpenAIService | null = null;

  constructor() {
    super('StringPlanningService');
  }

  protected async onInitialize(): Promise<void> {
    this.openaiService = getService('openaiService') as OpenAIService;
    if (!this.openaiService) {
      throw new Error('OpenAI service unavailable. String planning requires AI service.');
    }
  }

  protected async onDestroy(): Promise<void> {
    this.openaiService = null;
  }

  /**
   * Plan the next step in simple string format
   */
  async planNextStep(context: StringWorkflowContext): Promise<StringStepPlan> {
    const correlationId = `string-planning-${Date.now()}`;

    try {
      logger.info('Planning next string-based step', {
        correlationId,
        currentStep: context.currentStep,
        originalRequest: context.originalRequest.substring(0, 100),
        completedSteps: context.completedSteps.length,
        operation: 'string_step_planning'
      });

      if (!this.openaiService) {
        throw new Error('AI service required for string planning');
      }

      // Simple, focused prompt for natural language planning
      const prompt = this.createStringPlanningPrompt(context);

      logger.debug('🔍 STRING PLANNING - SENDING TO AI', {
        correlationId,
        promptLength: prompt.length,
        prompt: prompt.substring(0, 500) + '...',
        operation: 'string_planning_ai_request'
      });

      const response = await this.openaiService.generateStructuredData(
        context.originalRequest,
        prompt,
        {
          type: 'object',
          properties: {
            reasoning: {
              type: 'object',
              properties: {
                currentState: { type: 'string' },
                gaps: { type: 'array', items: { type: 'string' } },
                progressCheck: { type: 'string' },
                nextAction: { type: 'string' }
              },
              required: ['currentState', 'gaps', 'progressCheck', 'nextAction']
            },
            nextStep: { type: 'string' },
            isComplete: { type: 'boolean' }
          },
          required: ['reasoning', 'nextStep', 'isComplete']
        },
        {
          temperature: 0.3,
          maxTokens: 500
        }
      );

      logger.debug('AI planning response received', {
        correlationId,
        response: JSON.stringify(response),
        responseType: typeof response,
        hasNextStep: !!(response as any)?.nextStep,
        operation: 'ai_planning_response'
      });

      const plan = this.validatePlanResponse(response);

      // Log the planned step using natural language logger
      const { naturalLanguageLogger } = await import('../utils/natural-language-logger');
      naturalLanguageLogger.logStringPlanCreation(
        context.currentStep,
        plan.nextStep,
        plan.isComplete,
        plan.reasoning.nextAction,
        {
          correlationId,
          sessionId: context.userContext?.sessionId || 'unknown',
          userId: context.userContext?.userId,
          operation: 'string_step_planned'
        }
      );

      logger.info('String-based step planned with CoT reasoning', {
        correlationId,
        nextStep: plan.nextStep.substring(0, 100),
        isComplete: plan.isComplete,
        currentState: plan.reasoning.currentState,
        progressCheck: plan.reasoning.progressCheck,
        gaps: plan.reasoning.gaps,
        operation: 'string_step_planned'
      });

      return plan;

    } catch (error) {
      logger.error('String planning failed', error as Error, {
        correlationId,
        operation: 'string_planning_error',
        metadata: {
          currentStep: context.currentStep,
          originalRequest: context.originalRequest.substring(0, 100)
        }
      });

      // No fallback - let AI failures be explicit
      throw error;
    }
  }

  /**
   * Create Chain-of-Thought prompt for step planning
   */
  private createStringPlanningPrompt(context: StringWorkflowContext): string {
    // Use PromptUtils for consistent temporal context
    const temporalContext = context.agentContext
      ? PromptUtils.getTemporalContext(context.agentContext)
      : `Current date/time: ${new Date().toLocaleString('en-US')}`;

    let prompt = `${temporalContext}

Original Request: "${context.originalRequest}"
Current Step: ${context.currentStep}/${context.maxSteps}
`;

    if (context.completedSteps.length > 0) {
      prompt += `
Previous Steps & Results:
${context.completedSteps.map((step, i) =>
  `${i + 1}. ${step}\n   → ${context.stepResults[i]?.substring(0, 150) || 'N/A'}`
).join('\n')}`;
    } else {
      prompt += `\nPrevious Steps: None (this is the first step)`;
    }

    prompt += `

PLAN NEXT STEP (Chain-of-Thought):

Step 1 - Assess Current State:
[What has been accomplished so far? What information/results do we have?]

Step 2 - Identify Gaps:
[What information or actions are still needed to fulfill the request?]
[What's missing from what we have vs what was requested?]

Step 3 - Evaluate Progress:
[Are we making progress toward the goal?]
[Are we stuck in a loop? (Check if recent steps are semantically similar)]
[If we've tried the same approach 3+ times with failures, we're stuck]

Step 4 - Plan Next Action:
[What's the logical next step to make progress?]
[OR should we stop if the request is fulfilled or we're stuck?]

THEN return JSON:
{
  "reasoning": {
    "currentState": "We have X, accomplished Y",
    "gaps": ["Still need Z", "Missing W"],
    "progressCheck": "Making progress" | "Stuck - same approach tried 3 times" | "Request fulfilled",
    "nextAction": "Best to do X because Y" | "Stop because request is complete"
  },
  "nextStep": "Clear, specific instruction for agent" | "",
  "isComplete": false | true
}

Guidelines:
- Be specific and include timeframes from temporal context above
- If progressCheck shows we're stuck or request is fulfilled, set isComplete=true
- Use natural, conversational language for nextStep`;

    return prompt;
  }

  /**
   * Validate and clean the AI response
   */
  private validatePlanResponse(response: any): StringStepPlan {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid AI response format');
    }

    if (!response.reasoning || typeof response.reasoning !== 'object') {
      throw new Error('AI response missing CoT reasoning');
    }

    const reasoning: StepPlanningReasoning = {
      currentState: response.reasoning.currentState || 'Unknown state',
      gaps: Array.isArray(response.reasoning.gaps) ? response.reasoning.gaps : [],
      progressCheck: response.reasoning.progressCheck || 'Unknown progress',
      nextAction: response.reasoning.nextAction || 'No action specified'
    };

    if (response.isComplete === true) {
      return {
        reasoning,
        nextStep: '',
        isComplete: true
      };
    }

    if (!response.nextStep || typeof response.nextStep !== 'string') {
      throw new Error('AI response missing valid nextStep');
    }

    return {
      reasoning,
      nextStep: response.nextStep.trim(),
      isComplete: false
    };
  }

  /**
   * Analyze step result to understand what was accomplished
   */
  async analyzeStepResult(
    stepDescription: string,
    stepResult: string,
    context: StringWorkflowContext
  ): Promise<{ summary: string; shouldContinue: boolean; loopDetected?: boolean; fulfillmentScore?: number }> {
    const correlationId = `string-result-analysis-${Date.now()}`;

    try {
      if (!this.openaiService) {
        return {
          summary: stepResult.substring(0, 200),
          shouldContinue: true
        };
      }

      const prompt = `Analyze this workflow step:

Step: "${stepDescription}"
Result: "${stepResult.substring(0, 500)}"

Original Request: "${context.originalRequest}"

Previous ${context.completedSteps.length} steps:
${context.completedSteps.map((s, i) =>
  `${i+1}. ${s} → ${context.stepResults[i]?.substring(0, 150) || 'N/A'}`
).join('\n')}

Critical Analysis:
1. Was this step successful?
2. Does this FULLY answer the original request?
3. Are we repeating similar attempts? (Look for semantic similarity, not exact wording)
   - Example: "Check calendar", "List calendar events", "Get calendar" = SIMILAR
4. Is continuing likely to help, or are we stuck?

Return JSON:
{
  "summary": "Brief summary of accomplishment",
  "shouldContinue": boolean,
  "loopDetected": boolean,
  "fulfillmentScore": 0.0-1.0
}`;

      const analysis = await this.openaiService.generateStructuredData(
        prompt,
        'Analyze step results for planning with loop detection',
        {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            shouldContinue: { type: 'boolean' },
            loopDetected: { type: 'boolean' },
            fulfillmentScore: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['summary', 'shouldContinue']
        },
        {
          temperature: 0.2,
          maxTokens: 200
        }
      );

      const result = analysis as any;

      // Log loop detection
      if (result.loopDetected) {
        logger.warn('Loop detected in workflow', {
          correlationId,
          step: stepDescription,
          fulfillmentScore: result.fulfillmentScore
        });
      }

      return {
        summary: result.summary || stepResult.substring(0, 200),
        shouldContinue: result.shouldContinue !== false && !result.loopDetected,
        loopDetected: result.loopDetected,
        fulfillmentScore: result.fulfillmentScore
      };

    } catch (error) {
      logger.error('Step result analysis failed', error as Error, {
        correlationId,
        operation: 'string_result_analysis_error'
      });

      return {
        summary: stepResult.substring(0, 200),
        shouldContinue: context.currentStep < context.maxSteps
      };
    }
  }
}