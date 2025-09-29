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
        
        Output Strategy Execution (from initial risk assessment):
        - Direct: Show results and confirm completion (Low Risk operations)
        - Preview: Present results for user review before execution (Medium Risk)
        - Confirmation: Show detailed plan and ask for approval (High Risk)
        
        High Risk Preview Process:
        1. Generate detailed preview with full context and risk factors
        2. Present to user with clear explanation of what will happen
        3. End current workflow cleanly
        4. User response options start entirely new workflows:
           - "Please execute the proposed plan" (acceptance)
           - "Change X to Y in the proposal" (revision)
           - No response needed for cancellation
           
        User Question Mode (SHORTCUT from Environment Check):
        - Generate specific question with clear context explanation
        - Explain why this information is required
        - Provide examples or options if helpful
        - End workflow cleanly - user answer starts new flow
        
        Context Updates:
        - Mark workflow as complete
        - Include final results and outcomes
        - Note any remaining limitations
        - Prepare for next user interaction
        
        ${this.CONTEXT_FORMAT}
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
