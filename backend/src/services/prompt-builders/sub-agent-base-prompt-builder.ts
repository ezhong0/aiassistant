import { BasePromptBuilder } from './base-prompt-builder';
import { AIPrompt, StructuredSchema, BaseAIResponse } from '../../generic-ai.service';

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
  
  // Simple context format for sub-agents - just a text box
  protected readonly SUB_AGENT_CONTEXT_FORMAT = `
Context: [Free-form text describing the current state, progress, and any relevant information]`;

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
