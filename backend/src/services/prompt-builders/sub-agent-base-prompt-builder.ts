import { BasePromptBuilder } from './base-prompt-builder';
import { AIPrompt, StructuredSchema, BaseAIResponse } from '../../generic-ai.service';

/**
 * Simple context structure for sub-agents (6 fields)
 */
export interface SubAgentContext {
  request: string;          // Original Master Agent request
  tools: string[];          // Tools needed for execution
  params: any;              // Parameters for tool calls
  status: 'planning' | 'executing' | 'complete' | 'failed';
  result: any;              // Collected tool results
  notes: string;            // Brief execution notes
}

/**
 * Base response interface for sub-agents
 */
export interface BaseSubAgentResponse extends BaseAIResponse {
  context: string; // JSON stringified SubAgentContext
}

/**
 * Base class for sub-agent prompt builders
 * Uses simplified 6-field context structure instead of complex Master Agent context
 */
export abstract class BaseSubAgentPromptBuilder<TResult extends BaseSubAgentResponse = BaseSubAgentResponse> 
  extends BasePromptBuilder<SubAgentContext, TResult> {
  
  // Simplified context format for sub-agents
  protected readonly SUB_AGENT_CONTEXT_FORMAT = `
Sub-Agent Context Format:
REQUEST: [What Master Agent wants]
TOOLS: [Tools needed for execution]
PARAMS: [Parameters for tool calls]
STATUS: [planning/executing/complete/failed]
RESULT: [Data collected from tools]
Notes: [Execution context and details]`;

  constructor(protected aiService: any, protected domain: string) {
    super(aiService);
  }

  protected validateContext(context: SubAgentContext): void {
    if (!context.request || context.request.trim().length === 0) {
      throw new Error('Request is required for sub-agent execution');
    }
    if (!context.tools || context.tools.length === 0) {
      throw new Error('Tools array is required for sub-agent execution');
    }
  }

  /**
   * Get the updated context from the response
   */
  getContext(response: any): string {
    return JSON.stringify(response.context);
  }
}
