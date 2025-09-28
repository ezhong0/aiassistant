import { BasePromptBuilder } from '../base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

// Context is just a string - no need for separate type

/**
 * Result of workflow planning
 */
export interface WorkflowPlanningResponse {
  context: string; // Updated context with workflow plan
  steps: string[]; // Specific steps to execute in order
}

/**
 * Prompt builder for creating specific execution steps
 */
export class WorkflowPlanningPromptBuilder extends BasePromptBuilder<string, WorkflowPlanningResponse> {
  
  getDescription(): string {
    return 'Creates specific execution steps that will be looped over in the workflow';
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are an AI assistant that creates specific, actionable steps for executing user requests.
        
        Your task is to:
        1. Analyze the current context and user intent
        2. Break down the request into specific, executable steps
        3. Order the steps logically based on dependencies
        4. Update the context with your workflow plan
        
        Step Creation Guidelines:
        - Each step should be a single, specific action
        - Steps should be in logical order (gather info before acting)
        - Include both data gathering and action steps
        - Consider error handling and user input needs
        - Steps should be clear enough for domain agents to execute
        
        Example Steps:
        - "Check calendar availability for all board members"
        - "Send calendar invites with agenda"
        - "Follow up on RSVPs"
        - "Generate preview for user approval"
        
        ${this.CONTEXT_FORMAT}
      `,
      userPrompt: `
        Create a specific workflow plan for this request:
        
        ${context}
        
        Provide a list of specific steps to execute in order.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Workflow planning result with specific execution steps',
      properties: {
        context: {
          type: 'string',
          description: 'Updated context with workflow plan in the specified format'
        },
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific steps to execute in order'
        }
      },
      required: ['context', 'steps']
    };
  }

  protected validateContext(context: string): void {
    if (!context || context.trim().length === 0) {
      throw new Error('Context is required for workflow planning');
    }
  }
}
