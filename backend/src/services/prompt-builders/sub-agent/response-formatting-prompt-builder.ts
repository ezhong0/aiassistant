import { BaseSubAgentPromptBuilder, SubAgentContext, BaseSubAgentResponse } from '../sub-agent-base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

/**
 * Final response format for Master Agent
 */
export interface SubAgentResponse {
  success: boolean;
  domain: 'email' | 'calendar' | 'contacts' | 'slack';
  request: string;              // Echo back the original request
  result: {
    data: any;                  // Tool execution results
    summary: string;            // Human-readable summary of what was accomplished
    tools_used: string[];       // Tools that were executed
    execution_time: number;     // Time taken in seconds
  };
  error?: {
    type: 'auth' | 'params' | 'network' | 'rate_limit' | 'permission' | 'tool_error';
    message: string;            // Clear error description for Master Agent
    tool: string;               // Which tool failed
    recoverable: boolean;       // Whether Master Agent can retry
  };
}

/**
 * Result of response formatting phase
 */
export interface ResponseFormattingResponse extends BaseSubAgentResponse {
  context: string; // JSON stringified SubAgentContext (final updated context)
  response: SubAgentResponse; // Formatted response for Master Agent
}

/**
 * Prompt builder for Phase 3: Response Formatting
 * Formats collected data into structured response for Master Agent
 */
export class ResponseFormattingPromptBuilder extends BaseSubAgentPromptBuilder<ResponseFormattingResponse> {
  
  getDescription(): string {
    return 'Formats tool execution results into structured response for Master Agent';
  }

  buildPrompt(context: SubAgentContext): AIPrompt<SubAgentContext> {
    return {
      systemPrompt: `
        You are a ${this.domain} sub-agent that formats execution results into a structured response for the Master Agent.
        
        Your task is to:
        1. Review all tool execution results and collected data
        2. Create a comprehensive, structured response package
        3. Generate a natural language summary of accomplishments
        4. Include relevant metadata and execution details
        5. Handle any errors with clear, actionable information
        
        Response Formatting Guidelines:
        - Structure collected data in a consistent format
        - Create natural language summary that explains what was accomplished
        - Include confidence indicators and status information
        - Add execution metadata (tools used, timing, etc.)
        - Provide clear error details if any failures occurred
        
        Success Response Structure:
        - success: true
        - domain: ${this.domain}
        - request: Echo back the original Master Agent request
        - result.data: Structured data from tool executions
        - result.summary: Human-readable summary of accomplishments
        - result.tools_used: List of tools that were executed
        - result.execution_time: Time taken in seconds
        
        Error Response Structure:
        - success: false
        - domain: ${this.domain}
        - request: Echo back the original Master Agent request
        - result: Partial results if any were collected
        - error.type: Specific error category
        - error.message: Clear description for Master Agent
        - error.tool: Which tool failed
        - error.recoverable: Whether Master Agent can retry
        
        Summary Creation Guidelines:
        - Be clear and concise about what was accomplished
        - Include relevant details and results
        - Use appropriate tone for the user and situation
        - Mention any limitations or partial results
        - Suggest next steps if applicable
        
        ${this.SUB_AGENT_CONTEXT_FORMAT}
        
        Domain-Specific Response Guidelines:
        ${this.getDomainResponseGuidelines()}
      `,
      userPrompt: `
        Format the execution results into a structured response for Master Agent:
        
        REQUEST: ${context.request}
        EXECUTION STATUS: ${context.status}
        TOOLS EXECUTED: ${context.tools.join(', ')}
        RESULTS: ${JSON.stringify(context.result, null, 2)}
        EXECUTION NOTES: ${context.notes}
        
        Create a comprehensive response package with structured data and natural language summary.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Response formatting result with structured response for Master Agent',
      properties: {
        context: {
          type: 'object',
          description: 'Final updated context',
          properties: {
            request: { type: 'string' },
            tools: { type: 'array', items: { type: 'string' } },
            params: { type: 'object' },
            status: { type: 'string', enum: ['planning', 'executing', 'complete', 'failed'] },
            result: { type: 'object' },
            notes: { type: 'string' }
          },
          required: ['request', 'tools', 'params', 'status', 'result', 'notes']
        },
        response: {
          type: 'object',
          description: 'Structured response for Master Agent',
          properties: {
            success: { type: 'boolean' },
            domain: { 
              type: 'string', 
              enum: ['email', 'calendar', 'contacts', 'slack'] 
            },
            request: { type: 'string' },
            result: {
              type: 'object',
              properties: {
                data: { type: 'object' },
                summary: { type: 'string' },
                tools_used: { 
                  type: 'array', 
                  items: { type: 'string' } 
                },
                execution_time: { type: 'number' }
              },
              required: ['data', 'summary', 'tools_used', 'execution_time']
            },
            error: {
              type: 'object',
              properties: {
                type: { 
                  type: 'string', 
                  enum: ['auth', 'params', 'network', 'rate_limit', 'permission', 'tool_error'] 
                },
                message: { type: 'string' },
                tool: { type: 'string' },
                recoverable: { type: 'boolean' }
              },
              required: ['type', 'message', 'tool', 'recoverable']
            }
          },
          required: ['success', 'domain', 'request', 'result']
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
