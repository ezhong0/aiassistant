import { BasePromptBuilder } from '../base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

// Context is just a string - no need for separate type

/**
 * Result of progress assessment
 */
export interface ProgressAssessmentResponse {
  context: string; // Updated context with progress assessment
  newSteps?: string[]; // Only if workflow steps need to be updated
}

/**
 * Prompt builder for assessing progress and updating workflow steps if needed
 */
export class ProgressAssessmentPromptBuilder extends BasePromptBuilder<string, ProgressAssessmentResponse> {
  
  getDescription(): string {
    return 'Assesses progress and updates workflow steps if needed';
  }

  getName(): string {
    return 'ProgressAssessmentPromptBuilder';
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are an AI assistant that assesses workflow progress and adapts the plan as needed.
        
        Your task is to:
        1. Analyze the results from the last agent execution
        2. Assess the overall progress toward the goal
        3. Determine if the workflow steps need to be updated
        4. Update the context with your assessment
        
        Progress Assessment Guidelines:
        - Evaluate if the current step was successful
        - Check if new information changes the approach
        - Identify any blockers or issues that emerged
        - Determine if the remaining steps are still appropriate
        - Classify any errors as temporary/permanent and adapt plan accordingly
        
        Step Update Criteria:
        - Agent execution revealed new requirements
        - Error occurred that requires a different approach
        - New information changes the optimal path
        - User input or context changes the plan
        - Risk assessment indicates different steps needed
        - Circuit-breaker conditions or rate limits suggest backoff or alternate route
        
        Context Updates (use structured format):
        - Update PROGRESS with completed actions and decisions made
        - Update DATA with new information gathered from agents
        - Update BLOCKERS with any issues or limitations found
        - Update NEXT with the immediate next action step
        - Update ENTITIES if new people/companies discovered
        - Update CONSTRAINTS if new limitations found
        
        Confidence Calculation Guidelines:
        - Data completeness (0-40%): How much required information is gathered
        - Entity resolution (0-20%): How clearly entities are identified
        - API reliability (0-20%): Whether tools are working properly
        - User clarity (0-20%): How well user intent is understood
        
        Adaptation Decisions:
        - CONTINUE: Proceed with next step
        - REVISE PLAN: Replace NEXT with a revised action list
        - EXIT: Stop and defer to Final Output (e.g., for high-risk preview or blocking errors)
        
        Completion Status:
        - COMPLETE (90%+): Ready for final output
        - PARTIAL (50-89%): Continue with limitations or ask for guidance
        - BLOCKED (<50%): Need adaptation or user input
        
        ${this.CONTEXT_FORMAT}
      `,
      userPrompt: `
        Assess the progress and determine if workflow steps need updating:
        
        ${context}
        
        Evaluate the progress and update the context. If the workflow steps need to be changed, provide new steps.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Progress assessment result with optional step updates',
      properties: {
        context: {
          type: 'string',
          description: 'Updated context with progress assessment in the specified format'
        },
        newSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated workflow steps (only if steps need to be updated)'
        }
      },
      required: ['context']
    };
  }

  protected validateContext(context: string): void {
    if (!context || context.trim().length === 0) {
      throw new Error('Context is required for progress assessment');
    }
  }
}
