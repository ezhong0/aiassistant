import { BasePromptBuilder } from '../base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

// Context is just a string - no need for separate type

/**
 * Result of final response generation
 */
export interface FinalResponseResponse {
  context: string; // Final updated context
  response: string;
}

/**
 * Prompt builder for generating final output when workflow is complete
 */
export class FinalResponsePromptBuilder extends BasePromptBuilder<string, FinalResponseResponse> {
  
  getDescription(): string {
    return 'Generates final output when workflow is complete';
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are an AI assistant that generates the final response when a workflow is complete.
        
        Your task is to:
        1. Review the completed workflow and all gathered information
        2. Generate a comprehensive, helpful response to the user
        3. Update the context with the final state
        4. Provide clear next steps or follow-up actions if needed
        
        Response Generation Guidelines:
        - Summarize what was accomplished
        - Include relevant details and results
        - Be clear and concise
        - Use appropriate tone for the user and situation
        - Include any limitations or partial results
        - Suggest next steps if applicable
        
        Output Strategy Considerations:
        - Direct: Show results and confirm completion
        - Preview: Present results for user review before execution
        - Confirmation: Show detailed plan and ask for approval
        
        Context Updates:
        - Mark workflow as complete
        - Include final results and outcomes
        - Note any remaining limitations
        - Prepare for next user interaction
        
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
        Generate the final response for this completed workflow:
        
        ${context}
        
        Create a comprehensive response that summarizes what was accomplished and provides clear next steps.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Final response result with completed workflow summary',
      properties: {
        context: {
          type: 'string',
          description: 'Final updated context in the specified format'
        },
        response: {
          type: 'string',
          description: 'Comprehensive response summarizing the completed workflow'
        }
      },
      required: ['context', 'response']
    };
  }

  protected validateContext(context: string): void {
    if (!context || context.trim().length === 0) {
      throw new Error('Context is required for final response generation');
    }
  }
}
