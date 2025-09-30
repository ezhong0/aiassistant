import { BaseSubAgentPromptBuilder, BaseSubAgentResponse } from '../sub-agent-base-prompt-builder';
import { AIPrompt, StructuredSchema } from '../../generic-ai.service';

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

/**
 * Result of plan review phase
 */
export interface PlanReviewResponse extends BaseSubAgentResponse {
  context: string; // Free-form text context with updated plan
  steps: string[]; // Updated list of execution steps
}

/**
 * Prompt builder for Phase 2: Plan Review & Revision
 * Reviews tool execution results and revises the plan as needed
 */
export class PlanReviewPromptBuilder extends BaseSubAgentPromptBuilder<PlanReviewResponse> {
  
  getDescription(): string {
    return 'Reviews tool execution results and revises execution plan for sub-agent';
  }

  getName(): string {
    return `PlanReviewPromptBuilder[${this.domain}]`;
  }

  buildPrompt(context: string): AIPrompt<string> {
    return {
      systemPrompt: `
        You are a ${this.domain} sub-agent that reviews tool execution results and revises the execution plan.
        
        Your task is to:
        1. Analyze the results of the most recent tool execution
        2. Assess whether the original request is being fulfilled
        3. Determine if the plan needs revision
        4. Update the execution steps based on new information
        5. Decide whether to continue, exit early, or modify the approach
        
        Plan Review Guidelines:
        - Evaluate if the tool execution was successful
        - Check if new information changes the approach
        - Determine if the request is fully or partially fulfilled
        - Identify any blockers or issues that emerged
        - Assess if the remaining steps are still appropriate
        
        Decision Making:
        - Revise Plan: If new information requires a different approach
        - Add Steps: If additional tools are needed based on results
        - Remove Steps: If some planned tools are no longer necessary
        - Update Steps: Modify existing steps based on new information
        
        Context Updates:
        - Update RESULT with new information from tool execution
        - Update STATUS based on progress assessment
        - Update Notes with execution details and plan changes
        - Update TOOLS if the plan changes
        
        ${this.SUB_AGENT_CONTEXT_FORMAT}
        
        Domain-Specific Review Guidelines:
        ${this.getDomainReviewGuidelines()}
      `,
      userPrompt: `
        Review the tool execution results and revise the plan:
        
        ${context}
        
        Analyze the results and determine if the plan needs revision.
      `,
      context
    };
  }

  getSchema(): StructuredSchema {
    return {
      type: 'object',
      description: 'Plan review result with updated execution plan',
      properties: {
        context: {
          type: 'string',
          description: 'Free-form text context with updated plan and results'
        },
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated list of execution steps (may be modified based on tool results)'
        }
      },
      required: ['context', 'steps']
    };
  }

  private getDomainReviewGuidelines(): string {
    switch (this.domain) {
      case 'email':
        return `
          Email Review Guidelines:
          - Check if emails were sent successfully and delivered
          - Verify recipient validation and delivery status
          - Assess if follow-up actions are needed
          - Consider email formatting and content quality
        `;
      case 'calendar':
        return `
          Calendar Review Guidelines:
          - Check if events were created successfully
          - Verify attendee availability and conflicts
          - Assess if scheduling conflicts were resolved
          - Consider timezone and recurrence settings
        `;
      case 'contacts':
        return `
          Contact Review Guidelines:
          - Check if contact searches returned results
          - Verify contact information accuracy
          - Assess if additional searches are needed
          - Consider contact validation and duplicates
        `;
      case 'slack':
        return `
          Slack Review Guidelines:
          - Check if messages were retrieved successfully
          - Verify channel access and permissions
          - Assess if conversation analysis is complete
          - Consider message threading and context
        `;
      default:
        return 'Review tool results according to domain-specific best practices and requirements.';
    }
  }
}
