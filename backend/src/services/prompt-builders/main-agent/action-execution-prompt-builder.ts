import { BasePromptBuilder } from '../base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

// Context is just a string - no need for separate type

/**
 * Result of action execution planning
 */
export interface ActionExecutionResponse {
  context: string; // Updated context with execution plan
  agent: 'email' | 'calendar' | 'contact' | 'slack'; // Agent to send request to
  request: string; // Specific request string to send to the agent
}

/**
 * Prompt builder for determining which agent to use and what request to send
 */
export class ActionExecutionPromptBuilder extends BasePromptBuilder<string, ActionExecutionResponse> {
  
  getDescription(): string {
    return 'Determines which agent to use and what request to send for a specific step';
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are an AI assistant that translates workflow steps into specific agent requests.
        
        Your task is to:
        1. Analyze the current step and context
        2. Determine which domain agent should handle this step
        3. Create a specific, actionable request for that agent
        4. Update the context with your execution plan
        
        Agent Selection Guidelines:
        - Email Agent: Email operations (send, search, read, reply, forward, draft)
        - Calendar Agent: Calendar operations (schedule, check availability, reschedule, cancel)
        - Contact Agent: Contact operations (search, create, update, delete, find)
        - Slack Agent: Slack operations (channel messages, search, summarize, user info)
        
        CRITICAL: Use SINGLE MESSAGE INTERFACE - Send one complete natural language request
        to the sub-agent. The sub-agent must extract ALL needed context from that single message. Do not include follow-up questions; the sub-agent will not ask back.
        
        Request Creation Guidelines:
        - Be specific and actionable
        - Include all necessary parameters
        - Use natural language that the agent can understand
        - Consider the current context and entities
        - Include any constraints or requirements (time windows, risk constraints, approvals)
        - Make the request self-contained and executable as-is
        
        Example Requests:
        - "Find available 2-hour slots next month for 8 board members"
        - "Send calendar invites to all board members for the meeting on [date]"
        - "Search for contact information for David Smith"
        - "Draft a follow-up email to John about the meeting"
        
        ${this.CONTEXT_FORMAT}
      `,
      userPrompt: `
        Translate this workflow step into a specific agent request:
        
        ${context}
        
        Determine which agent should handle this step and create a specific request.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Action execution result with agent selection and request',
      properties: {
        context: {
          type: 'string',
          description: 'Updated context with execution plan in the specified format'
        },
        agent: {
          type: 'string',
          enum: ['email', 'calendar', 'contact', 'slack'],
          description: 'Agent to send request to'
        },
        request: {
          type: 'string',
          description: 'Specific request string to send to the agent'
        }
      },
      required: ['context', 'agent', 'request']
    };
  }

  protected validateContext(context: string): void {
    if (!context || context.trim().length === 0) {
      throw new Error('Context is required for action execution');
    }
  }
}
