import { BaseService } from './base-service';
import logger from '../utils/logger';
import { OpenAIService } from './openai.service';
import { getService } from './service-manager';
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
            nextStep: { type: 'string' },
            isComplete: { type: 'boolean' },
            reasoning: { type: 'string' }
          },
          required: ['nextStep', 'isComplete']
        },
        {
          temperature: 0.3,
          maxTokens: 300
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

      // No fallback - let AI failures be explicit
      throw error;
    }
  }

  /**
   * Create simple, focused prompt for string planning
   */
  private createStringPlanningPrompt(context: StringWorkflowContext): string {
    // Use PromptUtils for consistent temporal context
    const temporalContext = context.agentContext
      ? PromptUtils.getTemporalContext(context.agentContext)
      : `Current date/time: ${new Date().toLocaleString('en-US')}`;

    let prompt = `${temporalContext}

You are planning the next step to help with this request: "${context.originalRequest}"

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

    // Check for repeated failures or similar steps
    const recentSteps = context.completedSteps.slice(-3); // Last 3 steps
    const recentResults = context.stepResults.slice(-3); // Last 3 results

    let failureAnalysis = '';
    if (recentSteps.length >= 2) {
      const hasRepeatedFailures = recentResults.every(result =>
        result.toLowerCase().includes('wasn\'t able to') ||
        result.toLowerCase().includes('unfortunately') ||
        result.toLowerCase().includes('failed') ||
        result.toLowerCase().includes('error') ||
        result.toLowerCase().includes('couldn\'t')
      );

      const hasSimilarSteps = recentSteps.every(step =>
        step.toLowerCase().includes('access') && step.toLowerCase().includes('calendar')
      );

      if (hasRepeatedFailures && hasSimilarSteps) {
        failureAnalysis = `
IMPORTANT: The last ${recentSteps.length} steps have all failed with similar calendar access issues.
Consider marking this workflow as COMPLETE rather than retrying the same approach.`;
      }
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
- Include relevant timeframes (use current date/time provided above)
- Focus on one clear action per step
- Use natural, conversational language
- If the request is complete OR if repeated attempts have failed, mark isComplete as true
- Avoid suggesting the same action that has already failed multiple times${failureAnalysis}

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