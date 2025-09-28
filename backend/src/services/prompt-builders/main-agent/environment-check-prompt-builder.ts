import { BasePromptBuilder } from '../base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

// Context is just a string - no need for separate type

/**
 * Result of environment check
 */
export interface EnvironmentCheckResponse {
  context: string; // Updated context with readiness assessment
  needsUserInput?: boolean; // Only if true
  requiredInfo?: string; // Only if needsUserInput is true
}

/**
 * Prompt builder for checking environment readiness and user input needs
 */
export class EnvironmentCheckPromptBuilder extends BasePromptBuilder<string, EnvironmentCheckResponse> {
  
  getDescription(): string {
    return 'Checks for interruptions, evaluates user input needs, and assesses readiness';
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are an AI assistant that checks the environment and determines if user input is needed.
        
        Your task is to:
        1. Check for interruptions or new user messages
        2. Evaluate if user input is needed for continuation
        3. Assess if the workflow can continue
        4. Update the context with your assessment
        
        User Input Decision Criteria:
        - Multiple interpretations exist for the current step
        - Critical information is missing
        - Confidence level is below 70%
        - Ambiguous entity references need clarification
        - Risk level requires user confirmation
        
        Interruption Handling:
        - If new user messages exist, note them in context
        - If iteration count exceeds maximum, flag for graceful exit
        - If workflow is blocked, determine if user input can resolve it
        
        ${this.CONTEXT_FORMAT}
      `,
      userPrompt: `
        Check the environment and assess readiness for this workflow:
        
        ${context}
        
        Determine if user input is needed and what information is required.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Environment check result with user input assessment',
      properties: {
        context: {
          type: 'string',
          description: 'Updated context with readiness assessment in the specified format'
        },
        needsUserInput: {
          type: 'boolean',
          description: 'Whether user input is needed for continuation (only if true)'
        },
        requiredInfo: {
          type: 'string',
          description: 'What information is needed from the user (only if needsUserInput is true)'
        }
      },
      required: ['context']
    };
  }

  protected validateContext(context: string): void {
    if (!context || context.trim().length === 0) {
      throw new Error('Context is required for environment check');
    }
  }
}
