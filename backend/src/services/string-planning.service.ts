import { BaseService } from './base-service';
import logger from '../utils/logger';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';

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
 * String-based planning result
 */
export interface StringStepPlan {
  nextStep: string;
  isComplete: boolean;
  reasoning?: string;
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
      logger.warn('OpenAI service not available - string planning will use fallbacks');
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

      const response = await this.openaiService.generateStructuredData(
        prompt,
        'Plan next step in natural language',
        {
          temperature: 0.3,
          maxTokens: 300,
          response_format: { type: "json_object" }
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
        plan.reasoning || 'String-based planning step',
        {
          correlationId,
          sessionId: context.userContext?.sessionId || 'unknown',
          userId: context.userContext?.userId,
          operation: 'string_step_planned'
        }
      );

      logger.info('String-based step planned successfully', {
        correlationId,
        nextStep: plan.nextStep.substring(0, 100),
        isComplete: plan.isComplete,
        reasoning: plan.reasoning?.substring(0, 100),
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

      // Simple fallback for when AI fails
      if (context.completedSteps.length === 0) {
        return {
          nextStep: `Help with: ${context.originalRequest}`,
          isComplete: false,
          reasoning: 'Fallback planning due to AI service error'
        };
      } else {
        return {
          nextStep: '',
          isComplete: true,
          reasoning: 'Unable to plan further steps due to AI service error'
        };
      }
    }
  }

  /**
   * Create simple, focused prompt for string planning
   */
  private createStringPlanningPrompt(context: StringWorkflowContext): string {
    const currentYear = new Date().getFullYear();

    let prompt = `You are planning the next step to help with this request: "${context.originalRequest}"

Current situation:
- This is step ${context.currentStep} (max ${context.maxSteps} steps)`;

    if (context.completedSteps.length > 0) {
      prompt += `
- Previous steps completed:
${context.completedSteps.map((step, i) => `  ${i + 1}. ${step}`).join('\n')}`;

      if (context.stepResults.length > 0) {
        prompt += `
- Previous results:
${context.stepResults.map((result, i) => `  ${i + 1}. ${result.substring(0, 200)}...`).join('\n')}`;
      }
    } else {
      prompt += `
- No previous steps completed yet`;
    }

    prompt += `

Plan the next single step as a clear, natural language instruction that tells an expert agent what to do.

Examples of good steps:
- "Get calendar events for next Tuesday"
- "Find John Smith's email address from contacts"
- "Compose an email to the team about the meeting"
- "Schedule a 30-minute call with Sarah for tomorrow afternoon"

Guidelines:
- Be specific about what needs to be done
- Include relevant timeframes (use current year ${currentYear})
- Focus on one clear action per step
- Use natural, conversational language
- If the request is complete, mark isComplete as true

Respond with JSON:
{
  "nextStep": "Clear instruction for what to do next",
  "isComplete": false,
  "reasoning": "Brief explanation of why this step is needed"
}`;

    return prompt;
  }

  /**
   * Validate and clean the AI response
   */
  private validatePlanResponse(response: any): StringStepPlan {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid AI response format');
    }

    if (response.isComplete === true) {
      return {
        nextStep: '',
        isComplete: true,
        reasoning: response.reasoning || 'Task completed'
      };
    }

    if (!response.nextStep || typeof response.nextStep !== 'string') {
      throw new Error('AI response missing valid nextStep');
    }

    return {
      nextStep: response.nextStep.trim(),
      isComplete: false,
      reasoning: response.reasoning || 'AI planning step'
    };
  }

  /**
   * Analyze step result to understand what was accomplished
   */
  async analyzeStepResult(
    stepDescription: string,
    stepResult: string,
    context: StringWorkflowContext
  ): Promise<{ summary: string; shouldContinue: boolean }> {
    const correlationId = `string-result-analysis-${Date.now()}`;

    try {
      if (!this.openaiService) {
        return {
          summary: stepResult.substring(0, 200),
          shouldContinue: true
        };
      }

      const prompt = `Analyze what was accomplished in this step:

Step: "${stepDescription}"
Result: "${stepResult.substring(0, 500)}"

Original request: "${context.originalRequest}"

Provide a brief summary of what was accomplished and whether we should continue planning more steps.

Respond with JSON:
{
  "summary": "Brief summary of what was accomplished",
  "shouldContinue": true/false
}`;

      const analysis = await this.openaiService.generateStructuredData(
        prompt,
        'Analyze step results for planning',
        {
          temperature: 0.2,
          maxTokens: 200,
          response_format: { type: "json_object" }
        }
      );

      return {
        summary: (analysis as any).summary || stepResult.substring(0, 200),
        shouldContinue: (analysis as any).shouldContinue !== false
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