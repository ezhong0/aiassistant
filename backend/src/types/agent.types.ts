import { ToolCall, ToolResult, ToolExecutionContext } from './tools';

/**
 * Base interface that all agents must implement
 */
export interface IAgent {
  /** Unique identifier for the agent */
  readonly name: string;
  
  /** Human-readable description of what the agent does */
  readonly description: string;
  
  /** System prompt used for this agent */
  readonly systemPrompt: string;
  
  /** Keywords that can trigger this agent */
  readonly keywords: string[];
  
  /** Whether this agent requires confirmation before execution */
  readonly requiresConfirmation: boolean;
  
  /** Whether this agent is critical for workflow continuity */
  readonly isCritical: boolean;
  
  /** Execute the agent with the given parameters */
  execute(parameters: any, context: ToolExecutionContext, accessToken?: string): Promise<any>;
  
  /** Validate parameters before execution */
  validateParameters(parameters: any): { valid: boolean; errors: string[] };
  
  /** Generate preview for confirmation if needed */
  generatePreview?(parameters: any, accessToken?: string): Promise<any>;
}

/**
 * Base abstract class for agents to extend
 */
export abstract class BaseAgent implements IAgent {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly systemPrompt: string;
  abstract readonly keywords: string[];
  abstract readonly requiresConfirmation: boolean;
  abstract readonly isCritical: boolean;

  abstract execute(parameters: any, context: ToolExecutionContext, accessToken?: string): Promise<any>;

  /**
   * Default parameter validation - can be overridden by subclasses
   */
  validateParameters(parameters: any): { valid: boolean; errors: string[] } {
    if (!parameters) {
      return { valid: false, errors: ['Parameters are required'] };
    }

    if (!parameters.query || typeof parameters.query !== 'string') {
      return { valid: false, errors: ['Query parameter is required and must be a string'] };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Default preview generation - can be overridden by subclasses
   */
  async generatePreview?(parameters: any, accessToken?: string): Promise<any> {
    return {
      success: true,
      message: `Preview for ${this.name}: ${parameters.query}`,
      actionId: `preview-${Date.now()}`,
      type: this.name,
      parameters,
      awaitingConfirmation: true,
      confirmationPrompt: `I'm about to execute ${this.name}. Would you like me to proceed?`
    };
  }

  /**
   * Helper method to match keywords against input
   */
  protected matchesKeywords(input: string): boolean {
    const lowerInput = input.toLowerCase();
    return this.keywords.some(keyword => lowerInput.includes(keyword.toLowerCase()));
  }

  /**
   * Helper method for error handling
   */
  protected handleError(error: any, operation: string): any {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      message: `Failed to ${operation}: ${errorMessage}`,
      error: errorMessage
    };
  }
}

/**
 * Tool metadata for registry
 */
export interface ToolMetadata {
  /** Tool name (matches agent name) */
  name: string;
  
  /** Description for OpenAI function definitions */
  description: string;
  
  /** OpenAI function parameters schema */
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  
  /** Keywords for rule-based routing */
  keywords: string[];
  
  /** Whether this tool needs confirmation */
  requiresConfirmation: boolean;
  
  /** Whether this tool is critical */
  isCritical: boolean;
  
  /** Agent class constructor */
  agentClass: new () => IAgent;
}

/**
 * Configuration for tool registry
 */
export interface ToolRegistryConfig {
  /** Whether to enable OpenAI function calling */
  enableOpenAI: boolean;
  
  /** Whether to enable rule-based fallback routing */
  enableFallback: boolean;
  
  /** Maximum number of tools to suggest for a query */
  maxSuggestions?: number;
}