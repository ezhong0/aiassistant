import { BaseSubAgentPromptBuilder, SubAgentContext, BaseSubAgentResponse } from '../sub-agent-base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

/**
 * Result of tool execution phase
 */
export interface ToolExecutionResponse extends BaseSubAgentResponse {
  context: string; // JSON stringified SubAgentContext with tool execution results
  toolsExecuted: string[]; // Tools that were successfully executed
  executionErrors?: ToolExecutionError[]; // Any errors encountered
  isComplete: boolean; // Whether the request is fully fulfilled
}

/**
 * Tool execution error details
 */
export interface ToolExecutionError {
  tool: string;
  errorType: 'auth' | 'params' | 'network' | 'rate_limit' | 'permission' | 'tool_error';
  message: string;
  recoverable: boolean;
  retryAfter?: number; // Seconds to wait before retry
}

/**
 * Prompt builder for Phase 2: Direct Tool Execution
 * Executes domain-specific tools and handles errors
 */
export class ToolExecutionPromptBuilder extends BaseSubAgentPromptBuilder<ToolExecutionResponse> {
  
  getDescription(): string {
    return 'Executes domain tools and handles errors for sub-agent';
  }

  buildPrompt(context: SubAgentContext): AIPrompt<SubAgentContext> {
    return {
      systemPrompt: `
        You are a ${this.domain} sub-agent that executes domain-specific tools to fulfill Master Agent requests.
        
        Your task is to:
        1. Execute the planned tools in the correct sequence
        2. Process tool responses and collect results
        3. Handle tool errors gracefully with appropriate retry logic
        4. Update execution status and result data
        5. Determine if the request is fully fulfilled
        
        Pre-execution Checks:
        - Verify authentication and permissions
        - Validate tool parameters
        - Check rate limits and constraints
        - Assess risk level before execution
        
        Tool Execution Guidelines:
        - Execute tools in logical sequence (gather info before acting)
        - Process each tool response immediately
        - Collect and structure results as you go
        - Update context after each tool execution
        
        Error Handling:
        - Authentication Error: Request token refresh, retry once
        - Parameter Error: Log error, return structured failure response
        - Rate Limit: Apply backoff, retry up to 2 times
        - Network Error: Retry with exponential backoff
        - Permission Error: Return clear error message to Master Agent
        
        Progress Assessment:
        - After each tool execution, assess if request is fulfilled
        - Determine if additional tools are needed
        - Update result data with new information
        - Mark completion when success criteria are met
        
        ${this.SUB_AGENT_CONTEXT_FORMAT}
        
        Domain-Specific Tool Guidelines:
        ${this.getDomainToolGuidelines()}
      `,
      userPrompt: `
        Execute the planned tools for this request:
        
        REQUEST: ${context.request}
        PLANNED TOOLS: ${context.tools.join(', ')}
        PARAMETERS: ${JSON.stringify(context.params, null, 2)}
        CURRENT STATUS: ${context.status}
        CURRENT RESULTS: ${JSON.stringify(context.result, null, 2)}
        
        Execute the tools and update the context with results.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Tool execution result with updated context and status',
      properties: {
        context: {
          type: 'object',
          description: 'Updated context with tool execution results',
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
        toolsExecuted: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools that were successfully executed'
        },
        executionErrors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string' },
              errorType: { 
                type: 'string', 
                enum: ['auth', 'params', 'network', 'rate_limit', 'permission', 'tool_error'] 
              },
              message: { type: 'string' },
              recoverable: { type: 'boolean' },
              retryAfter: { type: 'number' }
            },
            required: ['tool', 'errorType', 'message', 'recoverable']
          },
          description: 'Any errors encountered during tool execution'
        },
        isComplete: {
          type: 'boolean',
          description: 'Whether the request is fully fulfilled and no more tools are needed'
        }
      },
      required: ['context', 'toolsExecuted', 'isComplete']
    };
  }

  private getDomainToolGuidelines(): string {
    switch (this.domain) {
      case 'email':
        return `
          Email Tool Guidelines:
          - gmail_send_email: Validate recipients, check subject/body, confirm delivery
          - gmail_search_messages: Use specific search terms, limit results appropriately
          - gmail_get_message: Retrieve full message content and metadata
          - gmail_create_draft: Save draft with proper formatting
          - gmail_reply_to_message: Include original message context
          - gmail_get_delivery_status: Check delivery status for external recipients
        `;
      case 'calendar':
        return `
          Calendar Tool Guidelines:
          - calendar_create_event: Check conflicts, validate attendees, set proper timezone
          - calendar_check_availability: Query multiple attendees, consider time zones
          - calendar_list_events: Use appropriate date ranges and filters
          - calendar_update_event: Preserve important details, notify attendees
          - calendar_delete_event: Confirm deletion, notify affected attendees
        `;
      case 'contacts':
        return `
          Contact Tool Guidelines:
          - contacts_search: Use specific search criteria, handle multiple results
          - contacts_get_by_id: Retrieve complete contact information
          - contacts_list_organizations: Group contacts by organization
          - contacts_validate_email: Check email format and deliverability
        `;
      case 'slack':
        return `
          Slack Tool Guidelines:
          - slack_get_channel_messages: Respect rate limits, use appropriate time ranges
          - slack_search_messages: Use specific search terms across channels
          - slack_get_thread_replies: Maintain thread context and relationships
          - slack_analyze_conversation: Summarize key points and decisions
          - slack_get_user_info: Retrieve user details and permissions
        `;
      default:
        return 'Execute tools according to their specific documentation and best practices.';
    }
  }
}
