import { BaseService } from './base-service';
import logger from '../utils/logger';
import { OpenAIService } from './openai.service';
import { getService } from "./service-manager";
import { StringWorkflowContext } from './string-planning.service';

/**
 * Plan reevaluation result
 */
export interface PlanReevaluationResult {
  shouldContinue: boolean;
  modifiedPlan?: string[];
  earlyTermination?: boolean;
  reasoning: string;
  confidence: number;
}

/**
 * PlanReevaluationService - Analyzes step results and modifies plans
 *
 * This service evaluates the results of each step and determines:
 * 1. Whether to continue with the current plan
 * 2. Whether to modify the plan based on new information
 * 3. Whether to terminate early if the goal is achieved
 * 4. Whether to terminate early if stuck in a loop
 */
export class PlanReevaluationService extends BaseService {
  private openaiService: OpenAIService | null = null;

  constructor() {
    super('PlanReevaluationService');
  }

  protected async onInitialize(): Promise<void> {
    this.openaiService = getService('openaiService') as OpenAIService;
    if (!this.openaiService) {
      throw new Error('OpenAI service unavailable. Plan reevaluation requires AI service.');
    }
  }

  protected async onDestroy(): Promise<void> {
    this.openaiService = null;
  }

  /**
   * Reevaluate the plan based on step results
   */
  async reevaluatePlan(
    context: StringWorkflowContext,
    stepResult: string
  ): Promise<PlanReevaluationResult> {
    const correlationId = `plan-reevaluation-${Date.now()}`;

    try {
      logger.warn('Reevaluating plan', {
        correlationId,
        currentStep: context.currentPlanStep,
        totalSteps: context.comprehensivePlan?.length,
        stepResultLength: stepResult.length,
        operation: 'plan_reevaluation'
      });

      if (!this.openaiService) {
        throw new Error('AI service required for plan reevaluation');
      }

      const prompt = this.createReevaluationPrompt(context, stepResult);

      logger.debug('🔍 PLAN REEVALUATION - SENDING TO AI', {
        correlationId,
        promptLength: prompt.length,
        prompt: prompt.substring(0, 500) + '...',
        operation: 'plan_reevaluation_ai_request'
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
                stepAnalysis: { type: 'string' },
                goalProgress: { type: 'string' },
                loopDetection: { type: 'string' },
                planAssessment: { type: 'string' }
              },
              required: ['stepAnalysis', 'goalProgress', 'loopDetection', 'planAssessment']
            },
            decision: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['continue', 'modify', 'terminate'] },
                reason: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
              },
              required: ['action', 'reason', 'confidence']
            },
            modifiedPlan: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 10
            },
            globalContextAddition: { type: 'string' }
          },
          required: ['reasoning', 'decision']
        },
        {
          temperature: 0.2,
          maxTokens: 600
        }
      );

      const result = this.validateReevaluationResponse(response);
      
      // Add useful information to global context if provided
      if (result.globalContextAddition) {
        await this.addToGlobalContext(context, result.globalContextAddition);
      }

      // Add reevaluation reasoning to global context
      await this.addToGlobalContext(context, `Plan reevaluation: ${result.reasoning.goalProgress}`);

      logger.warn('Plan reevaluation completed', {
        correlationId,
        action: result.decision.action,
        confidence: result.decision.confidence,
        reason: result.decision.reason,
        operation: 'plan_reevaluation_completed'
      });

      return {
        shouldContinue: result.decision.action === 'continue',
        modifiedPlan: result.decision.action === 'modify' ? result.modifiedPlan : undefined,
        earlyTermination: result.decision.action === 'terminate',
        reasoning: result.decision.reason,
        confidence: result.decision.confidence
      };

    } catch (error) {
      logger.error('Plan reevaluation failed', error as Error, {
        correlationId,
        operation: 'plan_reevaluation_error',
        metadata: {
          currentStep: context.currentPlanStep,
          originalRequest: context.originalRequest.substring(0, 100)
        }
      });

      // Default to continue on error
      return {
        shouldContinue: true,
        reasoning: 'Reevaluation failed, continuing with current plan',
        confidence: 0.5
      };
    }
  }

  /**
   * Add information to the global context "textbox"
   */
  private async addToGlobalContext(context: StringWorkflowContext, info: string): Promise<void> {
    const timestamp = new Date().toISOString();
    context.globalContext.push(`${timestamp}: ${info}`);
    
    logger.debug('Added to global context from PlanReevaluationService', {
      info: info.substring(0, 100),
      totalContextEntries: context.globalContext.length
    });
  }

  /**
   * Create prompt for plan reevaluation
   */
  private createReevaluationPrompt(context: StringWorkflowContext, stepResult: string): string {
    const temporalContext = `Current date/time: ${new Date().toLocaleString('en-US')}`;
    const requestDescription = context.intentDescription || context.originalRequest;

    return `${temporalContext}

PLAN REEVALUATION ANALYSIS:

Original Request: "${context.originalRequest}"
User Intent: "${requestDescription}"

CURRENT PLAN:
${context.comprehensivePlan?.map((step, i) => `${i + 1}. ${step}`).join('\n') || 'No plan available'}

COMPLETED STEPS & RESULTS:
${context.completedSteps.map((step, i) => 
  `${i + 1}. ${step}\n   → Result: ${context.stepResults[i]?.substring(0, 200) || 'N/A'}`
).join('\n')}

LATEST STEP RESULT: "${stepResult}"

GLOBAL CONTEXT (any service can add useful information here):
${context.globalContext.length > 0 ? context.globalContext.join('\n') : 'No global context yet'}

ANALYSIS INSTRUCTIONS:
1. Analyze the latest step result - was it successful?
2. Assess progress toward the original goal
3. Check for loops (repeated similar attempts)
4. Evaluate if the current plan is still appropriate
5. Determine the best next action
6. Identify useful information from the step result that should be added to global context

Return JSON:
{
  "reasoning": {
    "stepAnalysis": "Was the latest step successful? What did it accomplish?",
    "goalProgress": "How much progress have we made toward the original goal?",
    "loopDetection": "Are we repeating similar attempts? Any signs of being stuck?",
    "planAssessment": "Is the current plan still appropriate given the results?"
  },
  "decision": {
    "action": "continue" | "modify" | "terminate",
    "reason": "Why this action is best",
    "confidence": 0.95
  },
  "modifiedPlan": ["New step 1", "New step 2", ...], // Only if action is "modify"
  "globalContextAddition": "Useful information from this step result for future steps" // Optional
}

Guidelines:
- "continue": Current plan is working well, proceed to next step
- "modify": Plan needs adjustment based on new information
- "terminate": Goal achieved OR stuck in loop OR plan is no longer viable
- Consider the global context when making decisions
- Be conservative with modifications - only change if necessary
- Add useful information to global context that could help future steps
- Only include globalContextAddition if the step result contains valuable information`;
  }

  /**
   * Validate reevaluation response
   */
  private validateReevaluationResponse(response: any): { reasoning: any; decision: any; modifiedPlan?: string[]; globalContextAddition?: string } {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid AI response format for plan reevaluation');
    }

    if (!response.reasoning || typeof response.reasoning !== 'object') {
      throw new Error('AI response missing reasoning for plan reevaluation');
    }

    if (!response.decision || typeof response.decision !== 'object') {
      throw new Error('AI response missing decision for plan reevaluation');
    }

    const validActions = ['continue', 'modify', 'terminate'];
    if (!validActions.includes(response.decision.action)) {
      throw new Error(`Invalid decision action: ${response.decision.action}`);
    }

    return {
      reasoning: {
        stepAnalysis: response.reasoning.stepAnalysis || 'No step analysis provided',
        goalProgress: response.reasoning.goalProgress || 'No goal progress assessment',
        loopDetection: response.reasoning.loopDetection || 'No loop detection analysis',
        planAssessment: response.reasoning.planAssessment || 'No plan assessment'
      },
      decision: {
        action: response.decision.action,
        reason: response.decision.reason || 'No reason provided',
        confidence: Math.max(0, Math.min(1, response.decision.confidence || 0.5))
      },
      modifiedPlan: response.decision.action === 'modify' && Array.isArray(response.modifiedPlan)
        ? response.modifiedPlan.map((step: any) => String(step).trim()).filter((step: string) => step.length > 0)
        : undefined,
      globalContextAddition: response.globalContextAddition || undefined
    };
  }
}
