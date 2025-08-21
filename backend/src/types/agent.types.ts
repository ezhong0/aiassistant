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
    const errors: string[] = [];

    if (!parameters) {
      errors.push('Parameters are required');
      return { valid: false, errors };
    }

    if (!parameters.query || typeof parameters.query !== 'string') {
      errors.push('Query parameter is required and must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Default preview generation - can be overridden by subclasses
   */
  async generatePreview?(parameters: any, accessToken?: string): Promise<any> {
    const actionId = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      message: `Preview for ${this.name}: ${parameters.query}`,
      actionId,
      type: this.name,
      parameters,
      awaitingConfirmation: this.requiresConfirmation,
      confirmationPrompt: `I'm about to execute ${this.description.toLowerCase()}. Would you like me to proceed?`
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
   * Helper method for standardized error handling
   */
  protected handleError(error: any, operation: string): StandardAgentResponse {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorCode = this.extractErrorCode(error);
    
    return {
      success: false,
      message: `Failed to ${operation}: ${errorMessage}`,
      error: errorCode,
      metadata: {
        agent: this.name,
        operation,
        timestamp: new Date().toISOString(),
        errorType: error?.constructor?.name || 'UnknownError'
      }
    };
  }

  /**
   * Helper method for standardized success responses
   */
  protected createSuccessResponse(message: string, data?: any): StandardAgentResponse {
    return {
      success: true,
      message,
      data,
      metadata: {
        agent: this.name,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Helper method for standardized error responses
   */
  protected createErrorResponse(message: string, error: string, data?: any): StandardAgentResponse {
    return {
      success: false,
      message,
      error,
      data,
      metadata: {
        agent: this.name,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Extract error code from various error types
   */
  private extractErrorCode(error: any): string {
    if (error?.code) return error.code;
    if (error?.name) return error.name;
    if (error instanceof Error) return error.constructor.name;
    return 'UNKNOWN_ERROR';
  }

  /**
   * Common parameter extraction helper
   */
  protected extractCommonParams(query: string): {
    searchTerm?: string;
    emailAddresses?: string[];
    names?: string[];
  } {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailAddresses = query.match(emailRegex) || [];
    
    // Extract names (simple pattern - words that are capitalized)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const names = query.match(namePattern) || [];
    
    // Extract search term (remove common command words)
    const searchTerm = query
      .replace(/^(find|search|look for|get|lookup)\s+/i, '')
      .replace(/\s+(contact|contacts?|information|info|details?)$/i, '')
      .trim();

    return {
      searchTerm: searchTerm || query,
      emailAddresses,
      names
    };
  }
}

/**
 * Standard response interface for all agents
 */
export interface StandardAgentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  metadata?: {
    agent: string;
    operation?: string;
    timestamp: string;
    errorType?: string;
    [key: string]: any;
  };
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
  
  /** Agent class constructor (optional for new BaseAgent framework) */
  agentClass?: new () => IAgent;
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