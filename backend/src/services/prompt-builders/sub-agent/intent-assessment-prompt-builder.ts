import { BaseSubAgentPromptBuilder, SubAgentContext, BaseSubAgentResponse } from '../sub-agent-base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

/**
 * Result of intent assessment phase
 */
export interface IntentAssessmentResponse extends BaseSubAgentResponse {
  context: string; // JSON stringified SubAgentContext with intent analysis
  riskLevel: 'low' | 'medium' | 'high';
  expectedResponseFormat: string; // What format Master Agent expects
  successCriteria: string; // How to determine if request is fulfilled
}

/**
 * Prompt builder for Phase 1: Intent Assessment & Response Planning
 * Understands what Master Agent wants and plans tool execution
 */
export class IntentAssessmentPromptBuilder extends BaseSubAgentPromptBuilder<IntentAssessmentResponse> {
  
  getDescription(): string {
    return 'Assesses Master Agent intent and plans tool execution for sub-agent';
  }

  buildPrompt(context: SubAgentContext): AIPrompt<SubAgentContext> {
    return {
      systemPrompt: `
        You are a ${this.domain} sub-agent that analyzes Master Agent requests to understand intent and plan execution.
        
        Your task is to:
        1. Parse the specific request from Master Agent
        2. Identify the expected response format
        3. Determine success criteria for the operation
        4. Assess risk level for the operation
        5. Plan tool execution sequence
        
        Intent Analysis Guidelines:
        - Extract the core action being requested
        - Identify all required parameters and entities
        - Determine what constitutes successful completion
        - Assess potential risks and constraints
        
        Risk Assessment:
        - Low Risk: Read-only operations, internal data access, simple retrievals
        - Medium Risk: Single recipient communications, personal calendar events, controlled modifications
        - High Risk: External communications, bulk operations, public events, data exports
        
        Tool Planning:
        - Map request to specific domain tools
        - Determine optimal tool call sequence
        - Identify required parameters for each tool
        - Plan error handling approach
        
        ${this.SUB_AGENT_CONTEXT_FORMAT}
        
        Domain-Specific Guidelines:
        ${this.getDomainGuidelines()}
      `,
      userPrompt: `
        Analyze this Master Agent request and plan the execution:
        
        REQUEST: ${context.request}
        CURRENT TOOLS: ${context.tools.join(', ')}
        CURRENT STATUS: ${context.status}
        
        Provide intent assessment and execution plan.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Intent assessment result with execution plan',
      properties: {
        context: {
          type: 'object',
          description: 'Updated context with intent analysis and execution plan',
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
        riskLevel: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Risk assessment of the operation'
        },
        expectedResponseFormat: {
          type: 'string',
          description: 'What response format Master Agent expects (data, confirmation, summary, etc.)'
        },
        successCriteria: {
          type: 'string',
          description: 'How to determine if the request is successfully fulfilled'
        }
      },
      required: ['context', 'riskLevel', 'expectedResponseFormat', 'successCriteria']
    };
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
