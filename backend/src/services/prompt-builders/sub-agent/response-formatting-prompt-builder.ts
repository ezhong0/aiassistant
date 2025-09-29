import { BaseSubAgentPromptBuilder, BaseSubAgentResponse } from '../sub-agent-base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

/**
 * Final response format for Master Agent
 */
export interface SubAgentResponse {
  success: boolean;
  summary: string;              // Human-readable summary of what was accomplished
  data?: any;                   // Optional structured data from tool executions
}

/**
 * Result of response formatting phase
 */
export interface ResponseFormattingResponse extends BaseSubAgentResponse {
  context: string; // Free-form text context (final updated context)
  response: SubAgentResponse; // The actual response to return to Master Agent
}

/**
 * Prompt builder for Phase 3: Response Formatting
 * Formats collected data into structured response for Master Agent
 */
export class ResponseFormattingPromptBuilder extends BaseSubAgentPromptBuilder<ResponseFormattingResponse> {
  
  getDescription(): string {
    return 'Formats tool execution results into structured response for Master Agent';
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are a ${this.domain} sub-agent that formats execution results into a structured response for the Master Agent.
        
        Your task is to:
        1. Review all tool execution results and collected data
        2. Determine if the request was successfully fulfilled
        3. Create a clear, concise summary of what was accomplished
        4. Include relevant data if needed
        
        Response Formatting Guidelines:
        - Create a natural language summary that explains what was accomplished
        - Be clear and concise about the outcome
        - Use appropriate tone for the user and situation
        - Mention any limitations or partial results
        - Include structured data only if it adds value
        
        Response Structure:
        - success: true/false based on whether the request was fulfilled
        - summary: Clear, human-readable description of what was accomplished
        - data: Optional structured data from tool executions (only if relevant)
        
        Summary Creation Guidelines:
        - Focus on what was actually accomplished
        - Be specific about results and outcomes
        - Mention any important details or limitations
        - Keep it concise but informative
        
        ${this.SUB_AGENT_CONTEXT_FORMAT}
        
        Domain-Specific Response Guidelines:
        ${this.getDomainResponseGuidelines()}
      `,
      userPrompt: `
        Format the execution results into a simple response for Master Agent:
        
        ${context}
        
        Create a clear summary of what was accomplished and whether the request was successful.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Response formatting result with simple response for Master Agent',
      properties: {
        context: {
          type: 'string',
          description: 'Free-form text context (final updated context)'
        },
        response: {
          type: 'object',
          description: 'The actual response to return to Master Agent',
          properties: {
            success: { 
              type: 'boolean',
              description: 'Whether the request was successfully fulfilled'
            },
            summary: { 
              type: 'string',
              description: 'Clear, human-readable description of what was accomplished'
            },
            data: { 
              type: 'object',
              description: 'Optional structured data from tool executions (only if relevant)'
            }
          },
          required: ['success', 'summary']
        }
      },
      required: ['context', 'response']
    };
  }

  private getDomainResponseGuidelines(): string {
    switch (this.domain) {
      case 'email':
        return `
          Email Response Guidelines:
          - Include message IDs, recipient status, and delivery confirmations
          - Summarize email content and recipients in natural language
          - Mention any delivery issues or external recipient validations
          - Include relevant email metadata (timestamps, subject, etc.)
        `;
      case 'calendar':
        return `
          Calendar Response Guidelines:
          - Include event details, attendees, and scheduling information
          - Mention any conflicts found or resolved
          - Summarize meeting details and attendee responses
          - Include relevant calendar metadata (timezone, recurrence, etc.)
        `;
      case 'contacts':
        return `
          Contact Response Guidelines:
          - Include contact details found or created
          - Summarize search results and contact information
          - Mention any validation or duplicate checking performed
          - Include relevant contact metadata (organization, tags, etc.)
        `;
      case 'slack':
        return `
          Slack Response Guidelines:
          - Include message summaries, channel information, and user details
          - Summarize conversation analysis and key discussion points
          - Mention any permission or access considerations
          - Include relevant Slack metadata (timestamps, thread info, etc.)
        `;
      default:
        return 'Format results clearly with relevant domain-specific details and metadata.';
    }
  }
}
