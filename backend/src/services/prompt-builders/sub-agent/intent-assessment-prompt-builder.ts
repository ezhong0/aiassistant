import { BaseSubAgentPromptBuilder, BaseSubAgentResponse } from '../sub-agent-base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';
import { ToolRegistry } from '../../../framework/tool-registry';
import { ToolCall } from '../../../framework/tool-execution';

// ToolCall interface moved to tool-execution.ts

/**
 * Result of intent assessment phase
 */
export interface IntentAssessmentResponse extends BaseSubAgentResponse {
  context: string; // Free-form text context with intent analysis
  toolCalls: ToolCall[]; // List of concrete tool calls to execute
}

/**
 * Prompt builder for Phase 1: Intent Assessment & Response Planning
 * Understands what Master Agent wants and plans tool execution
 */
export class IntentAssessmentPromptBuilder extends BaseSubAgentPromptBuilder<IntentAssessmentResponse> {
  
  getDescription(): string {
    return 'Assesses Master Agent intent and plans tool execution for sub-agent';
  }

  getName(): string {
    return `IntentAssessmentPromptBuilder[${this.domain}]`;
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are a ${this.domain} sub-agent that analyzes Master Agent requests to understand intent and plan execution.
        
        AVAILABLE_TOOLS:
        ${this.getToolDefinitions()}
        
        Your task is to:
        1. Parse the specific request from Master Agent
        2. Create concrete tool calls with specific parameters
        3. Plan tool execution sequence
        4. Update context with intent analysis
        
        Intent Analysis Guidelines:
        - Extract the core action being requested
        - Identify all required parameters and entities
        - Map the request to specific domain tools
        - Create concrete tool calls with all necessary parameters
        
        Tool Call Creation Guidelines:
        - Each tool call should be specific and actionable
        - Include all required parameters for each tool
        - Tool calls should be in logical order (gather info before acting)
        - Provide clear descriptions for each tool call
        - Consider validation and error handling tools
        
        ${this.SUB_AGENT_CONTEXT_FORMAT}
        
        Domain-Specific Guidelines:
        ${this.getDomainGuidelines()}
      `,
      userPrompt: `
        Analyze this Master Agent request and create concrete tool calls:
        
        ${context}
        
        Create specific tool calls with parameters to fulfill this request.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Intent assessment result with concrete tool calls',
      properties: {
        context: {
          type: 'string',
          description: 'Updated context in structured format'
        },
        toolCalls: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', description: 'Name of the tool to call' },
              params: { type: 'object', description: 'Parameters for the tool call' },
              description: { type: 'string', description: 'Description of what this tool call does' }
            },
            required: ['tool', 'params', 'description']
          },
          description: 'List of concrete tool calls with parameters to execute'
        },
        executionPlan: {
          type: 'string',
          description: 'Brief plan for tool execution'
        }
      },
      required: ['context', 'toolCalls', 'executionPlan']
    };
  }

  private getToolDefinitions(): string {
    return ToolRegistry.generateToolDefinitionsForDomain(this.domain);
  }

  private getDomainGuidelines(): string {
    switch (this.domain) {
      case 'email':
        return `
          Email Guidelines:
          - Always validate recipient addresses before sending
          - Check delivery status for external recipients
          - Use appropriate subject lines and email formatting
          - Consider email templates for common communications
        `;
      case 'calendar':
        return `
          Calendar Guidelines:
          - Check for scheduling conflicts before creating events
          - Validate attendee availability and timezones
          - Use proper event titles and descriptions
          - Consider recurring event patterns
        `;
      case 'contacts':
        return `
          Contact Guidelines:
          - Validate contact information before creating/updating
          - Check for duplicate contacts
          - Use consistent formatting for names and addresses
          - Respect privacy and data protection requirements
        `;
      case 'slack':
        return `
          Slack Guidelines:
          - Respect channel permissions and access controls
          - Use appropriate message formatting and mentions
          - Consider thread organization for complex discussions
          - Follow workspace communication guidelines
        `;
      default:
        return 'Follow domain-specific best practices and security guidelines.';
    }
  }
}
