import { BasePromptBuilder } from './base-prompt-builder';
import { AIPrompt, StructuredSchema, BaseAIResponse } from '../generic-ai.service';

/**
 * Base response interface for sub-agents
 */
export interface BaseSubAgentResponse extends BaseAIResponse {
  context: string; // Free-form text context
}

/**
 * Base class for sub-agent prompt builders
 * Uses simple string context like Master Agent
 */
export abstract class BaseSubAgentPromptBuilder<TResult extends BaseSubAgentResponse = BaseSubAgentResponse> 
  extends BasePromptBuilder<string, TResult> {
  
  // Structured context format for sub-agents with tool calls
  protected readonly SUB_AGENT_CONTEXT_FORMAT = `
REQUEST: [What master agent asked for]
TOOL_CALLS: [JSON array of tool calls with parameters]
STATUS: [Current execution status]
RESULTS: [Data collected so far]
NOTES: [Brief execution context]`;

  constructor(protected aiService: any, protected domain: string) {
    super(aiService);
  }

  protected validateContext(context: string): void {
    if (!context || context.trim().length === 0) {
      throw new Error('Context is required for sub-agent execution');
    }
  }

  /**
   * Get the updated context from the response
   */
  getContext(response: any): string {
    return response.context;
  }
}
