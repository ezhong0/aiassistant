/**
 * BaseSubAgent - Abstract base class for all SubAgents
 * 
 * This class implements the Generic SubAgent design pattern with:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Single textbox context management
 * - Direct tool execution through domain services
 * - Natural language interface
 */

import { GenericAIService } from '../services/generic-ai.service';
import { IDomainService } from '../services/domain/interfaces/base-domain.interface';
import logger from '../utils/logger';
import {
  IntentAssessmentPromptBuilder,
  PlanReviewPromptBuilder,
  ResponseFormattingPromptBuilder
} from '../services/prompt-builders/sub-agent';

/**
 * SubAgent Response interface - simplified single string + metadata
 */
export interface SubAgentResponse {
  message: string;              // Single string response for Master Agent
  success: boolean;
  metadata?: {
    tools_used: string[];       // Tools that were executed
    execution_time: number;     // Time taken in seconds
    data?: any;                 // Optional structured data
  };
  error?: {
    type: 'auth' | 'params' | 'network' | 'rate_limit' | 'permission' | 'tool_error';
    message: string;            // Clear error description for Master Agent
    tool: string;               // Which tool failed
    recoverable: boolean;       // Whether Master Agent can retry
  };
}

/**
 * Agent Capabilities interface for discovery
 */
export interface AgentCapabilities {
  name: string;
  description: string;
  operations: string[];
  requiresAuth: boolean;
  requiresConfirmation: boolean;
  isCritical: boolean;
  examples?: string[];
}

/**
 * Agent Configuration interface
 */
export interface AgentConfig {
  name: string;
  description: string;
  enabled: boolean;
  timeout: number;
  retryCount: number;
}

/**
 * Intent Assessment Response Schema
 */
// const INTENT_ASSESSMENT_SCHEMA: StructuredSchema = {
//   type: 'object',
//   properties: {
//     context: {
//       type: 'string',
//       description: 'Updated context in SimpleContext format'
//     },
//     toolsNeeded: {
//       type: 'array',
//       items: { type: 'string' },
//       description: 'List of tools needed to fulfill the request'
//     },
//     executionPlan: {
//       type: 'string',
//       description: 'Brief plan for tool execution'
//     }
//   },
//   required: ['context', 'toolsNeeded', 'executionPlan'],
//   description: 'Intent assessment and planning response'
// };

/**
 * Tool Execution Response Schema
 */
// const TOOL_EXECUTION_SCHEMA: StructuredSchema = {
//   type: 'object',
//   properties: {
//     context: {
//       type: 'string',
//       description: 'Updated context in SimpleContext format'
//     },
//     toolCalls: {
//       type: 'array',
//       items: {
//         type: 'object',
//         properties: {
//           toolName: { type: 'string' },
//           params: { type: 'object' },
//           result: { type: 'object' }
//         }
//       },
//       description: 'Tool calls made and their results'
//     },
//     needsMoreWork: {
//       type: 'boolean',
//       description: 'Whether more tool execution is needed'
//     },
//     nextSteps: {
//       type: 'string',
//       description: 'What to do next if more work is needed'
//     }
//   },
//   required: ['context', 'toolCalls', 'needsMoreWork'],
//   description: 'Tool execution results and next steps'
// };

/**
 * Response Formatting Schema
 */
// const RESPONSE_FORMATTING_SCHEMA: StructuredSchema = {
//   type: 'object',
//   properties: {
//     context: {
//       type: 'string',
//       description: 'Final context in SimpleContext format'
//     },
//     success: {
//       type: 'boolean',
//       description: 'Whether the operation was successful'
//     },
//     message: {
//       type: 'string',
//       description: 'Human-readable summary of what was accomplished'
//     },
//     metadata: {
//       type: 'object',
//       description: 'Structured metadata with tool execution results'
//     }
//   },
//   required: ['context', 'success', 'message', 'metadata'],
//   description: 'Final formatted response'
// };

/**
 * Abstract BaseSubAgent class
 */
export abstract class BaseSubAgent {
  protected aiService: GenericAIService;
  protected domain: string;
  protected config: AgentConfig;
  protected intentAssessmentBuilder: IntentAssessmentPromptBuilder;
  protected planReviewBuilder: PlanReviewPromptBuilder;
  protected responseFormattingBuilder: ResponseFormattingPromptBuilder;

  constructor(domain: string, config: Partial<AgentConfig> = {}) {
    this.domain = domain;
    // Get AI service from service locator (lazy initialization)
    this.aiService = null as any; // Will be set when needed
    this.config = {
      name: `${domain}SubAgent`,
      description: `SubAgent for ${domain} operations`,
      enabled: true,
      timeout: 30000,
      retryCount: 3,
      ...config
    };
    
    // Initialize prompt builders
    this.intentAssessmentBuilder = new IntentAssessmentPromptBuilder(this.aiService, this.domain);
    this.planReviewBuilder = new PlanReviewPromptBuilder(this.aiService, this.domain);
    this.responseFormattingBuilder = new ResponseFormattingPromptBuilder(this.aiService, this.domain);
  }

  /**
   * Main entry point - simplified interface matching design document
   */
  async processNaturalLanguageRequest(
    request: string, 
    userId: string
  ): Promise<SubAgentResponse> {
    const startTime = Date.now();
    const correlationId = `${this.domain}-${Date.now()}`;
    
    try {
      logger.info(`${this.domain} SubAgent processing request`, {
        correlationId,
        operation: 'process_natural_language_request',
        domain: this.domain,
        requestLength: request.length,
        userId
      });

      // Get AI service if not already set
      if (!this.aiService) {
        const { serviceManager } = await import('../services/service-locator-compat');
        const service = serviceManager.getService<GenericAIService>('genericAIService');
        if (!service) {
          throw new Error('GenericAIService not available');
        }
        this.aiService = service;
      }
      
      // Initialize AI service if needed
      if (!this.aiService.initialized) {
        await this.aiService.initialize();
      }

      // Phase 1: Intent Assessment & Planning
      let context = await this.assessIntent(request, userId);
      
      // Phase 2: Direct Tool Execution (Max 3 iterations)
      context = await this.executeTools(context, userId);
      
      // Phase 3: Response Formatting
      const response = await this.formatResponse(context, request, startTime);

      logger.info(`${this.domain} SubAgent completed successfully`, {
        correlationId,
        operation: 'process_natural_language_request_success',
        domain: this.domain,
        success: response.success,
        executionTime: response.metadata?.execution_time
      });

      return response;

    } catch (error) {
      const executionTime = (Date.now() - startTime) / 1000;
      logger.error(`${this.domain} SubAgent processing failed`, error as Error, {
        correlationId,
        operation: 'process_natural_language_request_error',
        domain: this.domain,
        executionTime
      });

      return {
        message: `${this.domain} operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        metadata: {
          tools_used: [],
          execution_time: executionTime,
          data: null
        },
        error: {
          type: 'tool_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          tool: 'unknown',
          recoverable: false
        }
      };
    }
  }

  /**
   * Phase 1: Intent Assessment & Planning
   */
  protected async assessIntent(request: string, userId: string): Promise<string> {
    const contextInput = `
MASTER AGENT REQUEST: ${request}
USER_ID: ${userId}
AVAILABLE_TOOLS: ${this.getAvailableTools().join(', ')}
    `;

    const response = await this.intentAssessmentBuilder.execute(contextInput);
    return response.parsed.context;
  }

  /**
   * Phase 2: Sequential Tool Execution with Plan Review (Max 3 iterations)
   */
  protected async executeTools(context: string, userId: string): Promise<string> {
    let currentContext = context;
    let iteration = 0;
    const maxIterations = 3;

    // Extract tool calls from the initial intent assessment
    let toolCalls = this.extractToolCallsFromContext(currentContext);

    while (iteration < maxIterations && toolCalls.length > 0) {
      iteration++;

      // Execute tools sequentially with plan review after each tool
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];
        
        if (!toolCall) {
          logger.warn('Skipping undefined tool call', { iteration, index: i });
          continue;
        }
        
        try {
          const result = await this.executeToolCallWithRetry(
            toolCall.tool, 
            { ...toolCall.params, userId }
          );
          
          // Update context with structured tool result
          currentContext = this.updateContextWithToolResult(currentContext, {
            tool: toolCall.tool,
            success: true,
            result: result,
            executionTime: Date.now()
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorInfo = this.classifyError(error);
          
          logger.error(`Tool execution failed: ${toolCall.tool}`, error as Error, {
            toolName: toolCall.tool,
            params: toolCall.params,
            errorType: errorInfo.type,
            errorMessage: errorMessage,
            userId
          });
          
          // Update context with structured error
          currentContext = this.updateContextWithToolResult(currentContext, {
            tool: toolCall.tool,
            success: false,
            error: errorMessage,
            errorType: errorInfo.type,
            executionTime: Date.now()
          });
        }

        // Plan review after each tool execution (except the last tool in the iteration)
        if (i < toolCalls.length - 1) {
          const contextInput = `
CURRENT_CONTEXT:
${currentContext}

USER_ID: ${userId}
AVAILABLE_TOOLS: ${this.getAvailableTools().join(', ')}
ITERATION: ${iteration}/${maxIterations}
TOOL_EXECUTED: ${toolCall.tool}
          `;

          const response = await this.planReviewBuilder.execute(contextInput);
          currentContext = response.parsed.context;
          
          // Extract updated tool calls for remaining tools in this iteration
          const updatedToolCalls = this.extractToolCallsFromContext(currentContext);
          
          // If plan review suggests different tools, update the remaining tools
          if (updatedToolCalls.length > 0) {
            toolCalls = updatedToolCalls;
            // Continue with the updated tool list
            i = -1; // Reset loop counter to start from beginning of updated list
            continue;
          }
        }
      }

      // Final plan review after all tools in this iteration
      const contextInput = `
CURRENT_CONTEXT:
${currentContext}

USER_ID: ${userId}
AVAILABLE_TOOLS: ${this.getAvailableTools().join(', ')}
ITERATION: ${iteration}/${maxIterations}
ITERATION_COMPLETE: true
      `;

      const response = await this.planReviewBuilder.execute(contextInput);
      currentContext = response.parsed.context;
      
      // Extract new tool calls for next iteration
      toolCalls = this.extractToolCallsFromContext(currentContext);
      
      // Break if no more tool calls
      if (toolCalls.length === 0) {
        break;
      }
    }

    return currentContext;
  }

  /**
   * Phase 3: Response Formatting
   */
  protected async formatResponse(context: string, request: string, startTime: number): Promise<SubAgentResponse> {
    const contextInput = `
FINAL_CONTEXT:
${context}

ORIGINAL_REQUEST: ${request}
    `;

    const response = await this.responseFormattingBuilder.execute(contextInput);
    const executionTime = (Date.now() - startTime) / 1000;
    
    return {
      message: response.parsed.response.summary,
      success: response.parsed.response.success,
      metadata: {
        tools_used: this.extractToolsUsedFromContext(context),
        execution_time: executionTime,
        data: response.parsed.response.data
      }
    };
  }

  /**
   * Get available tools for this domain
   */
  protected getAvailableTools(): string[] {
    return Object.keys(this.getToolToServiceMap());
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by domain-specific SubAgents
  // ============================================================================


  /**
   * Execute a tool call by mapping to domain service method
   */
  protected abstract executeToolCall(toolName: string, params: any): Promise<any>;

  /**
   * Get tool-to-service method mapping
   */
  protected abstract getToolToServiceMap(): Record<string, string>;

  /**
   * Get the domain service instance
   */
  protected abstract getService(): IDomainService;

  // ============================================================================
  // AGENT FACTORY INTERFACE METHODS
  // ============================================================================

  /**
   * Check if agent is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get agent capabilities description
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: this.config.name,
      description: this.config.description,
      operations: this.getAvailableTools(),
      requiresAuth: true,
      requiresConfirmation: false,
      isCritical: false,
      examples: []
    };
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get agent timeout
   */
  getTimeout(): number {
    return this.config.timeout;
  }

  /**
   * Get retry count
   */
  getRetries(): number {
    return this.config.retryCount;
  }

  /**
   * Get agent health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.config.enabled,
      details: {
        domain: this.domain,
        enabled: this.config.enabled,
        availableTools: this.getAvailableTools().length
      }
    };
  }

  /**
   * Extract tools used from context string
   */
  protected extractToolsUsedFromContext(context: string): string[] {
    const tools: string[] = [];
    const toolResultMatches = context.match(/TOOL_RESULT_(\w+):/g);
    if (toolResultMatches) {
      for (const match of toolResultMatches) {
        const toolName = match.replace('TOOL_RESULT_', '').replace(':', '');
        tools.push(toolName);
      }
    }
    return tools;
  }

  /**
   * Extract tool calls from structured AI response
   */
  protected extractToolCallsFromContext(context: string): Array<{tool: string, params: any, description: string}> {
    try {
      // Try to parse as JSON first (structured response)
      const jsonMatch = context.match(/\{.*\}/s);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.toolCalls && Array.isArray(parsed.toolCalls)) {
            return parsed.toolCalls;
          }
        } catch {
          // Not valid JSON, continue
        }
      }
      
      // Fallback: Look for TOOL_CALLS pattern
      const toolCallsMatch = context.match(/TOOL_CALLS:\s*(\[.*?\])/s);
      if (toolCallsMatch && toolCallsMatch[1]) {
        const toolCallsJson = toolCallsMatch[1];
        return JSON.parse(toolCallsJson);
      }
      
      return [];
    } catch (error) {
      logger.warn('Failed to extract tool calls from context', { error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  /**
   * Update context with structured tool result
   */
  protected updateContextWithToolResult(context: string, toolResult: {
    tool: string;
    success: boolean;
    result?: any;
    error?: string;
    errorType?: string;
    executionTime: number;
  }): string {
    const resultEntry = `
TOOL_RESULT_${toolResult.tool}:
  Success: ${toolResult.success}
  ${toolResult.success ? `Result: ${JSON.stringify(toolResult.result)}` : `Error: ${toolResult.error} (Type: ${toolResult.errorType || 'Unknown'})`}
  ExecutionTime: ${toolResult.executionTime}`;

    return context + resultEntry;
  }

  /**
   * Classify error types for better handling and retry logic
   */
  protected classifyError(error: any): { type: string; retryable: boolean; retryDelay?: number } {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('authentication') || message.includes('unauthorized')) {
        return { type: 'AUTHENTICATION_ERROR', retryable: false };
      } else if (message.includes('permission') || message.includes('forbidden')) {
        return { type: 'PERMISSION_ERROR', retryable: false };
      } else if (message.includes('rate limit') || message.includes('too many requests')) {
        return { type: 'RATE_LIMIT_ERROR', retryable: true, retryDelay: 2000 };
      } else if (message.includes('timeout') || message.includes('timed out')) {
        return { type: 'TIMEOUT_ERROR', retryable: true, retryDelay: 1000 };
      } else if (message.includes('network') || message.includes('connection')) {
        return { type: 'NETWORK_ERROR', retryable: true, retryDelay: 1500 };
      } else if (message.includes('validation') || message.includes('invalid')) {
        return { type: 'VALIDATION_ERROR', retryable: false };
      } else if (message.includes('not found') || message.includes('404')) {
        return { type: 'NOT_FOUND_ERROR', retryable: false };
      } else if (message.includes('server error') || message.includes('5')) {
        return { type: 'SERVER_ERROR', retryable: true, retryDelay: 3000 };
      } else {
        return { type: 'UNKNOWN_ERROR', retryable: false };
      }
    }
    
    return { type: 'UNKNOWN_ERROR', retryable: false };
  }

  /**
   * Execute tool call with retry logic
   */
  protected async executeToolCallWithRetry(toolName: string, params: any, maxRetries: number = 3): Promise<any> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeToolCall(toolName, params);
      } catch (error) {
        lastError = error;
        const errorInfo = this.classifyError(error);
        
        // Don't retry non-retryable errors
        if (!errorInfo.retryable) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        if (errorInfo.retryDelay) {
          await new Promise(resolve => globalThis.setTimeout(resolve, errorInfo.retryDelay));
        }
        
        logger.warn(`Tool call failed, retrying (attempt ${attempt}/${maxRetries})`, {
          toolName,
          errorType: errorInfo.type,
          retryDelay: errorInfo.retryDelay
        });
      }
    }
    
    throw lastError;
  }

}
