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
        
        Step Update Criteria:
        - Agent execution revealed new requirements
        - Error occurred that requires a different approach
        - New information changes the optimal path
        - User input or context changes the plan
        - Risk assessment indicates different steps needed
        
        Context Updates:
        - Update PROGRESS with completed actions
        - Update DATA with new information gathered
        - Update BLOCKERS with any issues found
        - Update NEXT with the immediate next action
        
        Context Format:
        GOAL: [Primary user intent and desired outcome]
        ENTITIES: [People, companies, meetings, emails referenced]
        CONSTRAINTS: [Time limits, approval requirements, risk factors]
        DATA: [Information gathered from domain agents]
        PROGRESS: [Actions completed, decisions made]
        BLOCKERS: [Current issues preventing progress]
        NEXT: [Immediate next action in workflow]
        
        Free-form Notes: [Additional context, reasoning, edge cases]
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
