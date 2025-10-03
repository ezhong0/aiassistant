/**
 * BaseSubAgent - Abstract base class for all SubAgents
 *
 * This class implements the 4-Prompt Architecture for SubAgents:
 * - 2-prompt workflow (Command Interpretation, Tool Reassessment)
 * - working_data for internal state management
 * - Direct tool execution through domain services
 * - Natural language interface
 */

import { GenericAIService } from '../services/generic-ai.service';
import { IDomainService } from '../services/domain/interfaces/base-domain.interface';
import logger from '../utils/logger';
import {
  CommandInterpretationPromptBuilder,
  CommandInterpretationContext,
} from '../services/prompt-builders/sub-agent/command-interpretation-prompt-builder';
import {
  ToolReassessmentPromptBuilder,
  ToolReassessmentContext,
  ToolExecutionResult,
} from '../services/prompt-builders/sub-agent/tool-reassessment-prompt-builder';
import { ToolCall } from './tool-execution';

/**
 * SubAgent Response interface - simplified single string + metadata
 */
export interface SubAgentResponse {
  message: string;              // Single string response for Master Agent
  success: boolean;
  metadata?: {
    tools_used: string[];       // Tools that were executed
    execution_time: number;     // Time taken in seconds
    data?: Record<string, unknown>;                 // Optional structured data
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
 * Abstract BaseSubAgent class
 */
export abstract class BaseSubAgent {
  protected aiService: GenericAIService;
  protected domain: string;
  protected config: AgentConfig;

  // New prompt builders for 2-prompt architecture
  protected commandInterpretationBuilder: CommandInterpretationPromptBuilder;
  protected toolReassessmentBuilder: ToolReassessmentPromptBuilder;

  // Internal state - working_data (never sent to Master Agent)
  private working_data: Record<string, unknown> = {};

  constructor(domain: string, aiService: GenericAIService, config: Partial<AgentConfig> = {}) {
    this.domain = domain;
    this.aiService = aiService;
    this.config = {
      name: `${domain}SubAgent`,
      description: `SubAgent for ${domain} operations`,
      enabled: true,
      timeout: 30000,
      retryCount: 3,
      ...config,
    };

    // Initialize new prompt builders
    this.commandInterpretationBuilder = new CommandInterpretationPromptBuilder(this.aiService, this.domain);
    this.toolReassessmentBuilder = new ToolReassessmentPromptBuilder(this.aiService, this.domain);
  }

  /**
   * Main entry point - 2-prompt architecture with working_data
   */
  async processNaturalLanguageRequest(
    request: string,
    userId: string,
  ): Promise<SubAgentResponse> {
    const startTime = Date.now();
    const correlationId = `${this.domain}-${Date.now()}`;
    const toolsUsed: string[] = [];

    try {
      logger.info(`${this.domain} SubAgent processing request (2-prompt architecture)`, {
        correlationId,
        operation: 'process_natural_language_request',
        domain: this.domain,
        requestLength: request.length,
        userId,
      });

      // Ensure AI service is initialized
      if (!this.aiService.initialized) {
        await this.aiService.initialize();
      }

      // Reset working_data for new request
      this.working_data = {};

      // Phase 1: SubAgent Prompt 1 - Command Interpretation & Tool Call List Creation
      logger.info(`Executing SubAgent Prompt 1: Command Interpretation`, { correlationId, domain: this.domain });

      const interpretContext: CommandInterpretationContext = {
        master_command: request,
        user_context: await this.gatherUserContext(userId), // TODO: implement in subclasses
        cross_account_intent: false // TODO: detect from Master Agent command
      };

      const interpretResult = await this.commandInterpretationBuilder.execute(interpretContext);

      // Check if needs clarification
      if (interpretResult.needs_clarification) {
        return {
          message: interpretResult.clarification_question || 'I need more information to proceed with this request.',
          success: false,
          metadata: {
            tools_used: [],
            execution_time: (Date.now() - startTime) / 1000
          }
        };
      }

      // Store initial working_data and tool_call_list
      this.working_data = interpretResult.working_data;
      let tool_call_list = [...interpretResult.tool_call_list];

      logger.info('Command interpreted, created tool call list', {
        correlationId,
        domain: this.domain,
        toolCount: tool_call_list.length,
        queryType: interpretResult.query_type,
        scope: interpretResult.scope
      });

      // Phase 2: Tool Execution Loop with Prompt 2 after EACH tool
      const MAX_ITERATIONS = 10;
      let iteration = 0;
      let isComplete = false;
      let finalResponse = '';

      while (iteration < MAX_ITERATIONS && !isComplete) {
        iteration++;

        // Get next tool from list
        if (tool_call_list.length === 0) {
          isComplete = true;
          break;
        }

        const nextTool = tool_call_list.shift()!;

        logger.info(`Executing tool ${iteration}`, {
          correlationId,
          domain: this.domain,
          iteration,
          tool: nextTool.tool,
          params: nextTool.params
        });

        // Execute tool
        let toolResult: ToolExecutionResult;
        const toolStartTime = Date.now();

        try {
          const result = await this.executeToolCallWithRetry(
            nextTool.tool,
            { ...nextTool.params, userId }
          );

          toolResult = {
            tool: nextTool.tool,
            success: true,
            result: result,
            executionTime: Date.now() - toolStartTime
          };

          toolsUsed.push(nextTool.tool);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorInfo = this.classifyError(error);

          logger.error(`Tool execution failed: ${nextTool.tool}`, error as Error, {
            correlationId,
            domain: this.domain,
            toolName: nextTool.tool,
            params: nextTool.params,
            errorType: errorInfo.type
          });

          toolResult = {
            tool: nextTool.tool,
            success: false,
            error: errorMessage,
            executionTime: Date.now() - toolStartTime
          };

          toolsUsed.push(nextTool.tool);
        }

        // SubAgent Prompt 2 - Tool Reassessment
        logger.info('Executing SubAgent Prompt 2: Tool Reassessment', { correlationId, domain: this.domain, iteration });

        const reassessContext: ToolReassessmentContext = {
          working_data: this.working_data,
          tool_call_list: tool_call_list,
          latest_tool_result: toolResult,
          is_final_tool: tool_call_list.length === 0
        };

        const reassessResult = await this.toolReassessmentBuilder.execute(reassessContext);

        // Update working_data and tool_call_list from Prompt 2
        this.working_data = reassessResult.working_data;
        tool_call_list = reassessResult.tool_call_list;
        finalResponse = reassessResult.natural_language_response;
        isComplete = reassessResult.is_complete;

        logger.info('Tool reassessment complete', {
          correlationId,
          domain: this.domain,
          iteration,
          isComplete,
          needsConfirmation: reassessResult.needs_confirmation,
          toolsRemaining: tool_call_list.length
        });

        // Check if waiting for user confirmation
        if (reassessResult.needs_confirmation) {
          logger.info('Workflow paused - waiting for user confirmation', { correlationId, domain: this.domain });
          return {
            message: reassessResult.confirmation_prompt || finalResponse,
            success: true,
            metadata: {
              tools_used: toolsUsed,
              execution_time: (Date.now() - startTime) / 1000,
              data: {
                pending_action: reassessResult.pending_action,
                working_data: this.working_data
              }
            }
          };
        }

        // Check if complete
        if (isComplete) {
          logger.info('SubAgent workflow completed', { correlationId, domain: this.domain, iterations: iteration });
          break;
        }

        // Safety check: if tool failed and no new tools added, exit
        if (!toolResult.success && tool_call_list.length === 0) {
          logger.warn('Tool failed and no recovery tools added, exiting', { correlationId, domain: this.domain });
          isComplete = true;
          break;
        }
      }

      if (iteration >= MAX_ITERATIONS) {
        logger.warn('Max iterations reached', { correlationId, domain: this.domain, iterations: iteration });
        finalResponse += '\n\n(Note: Maximum tool execution steps reached.)';
      }

      // Return final natural language response from Prompt 2
      return {
        message: finalResponse || 'Request processed successfully.',
        success: true,
        metadata: {
          tools_used: toolsUsed,
          execution_time: (Date.now() - startTime) / 1000,
          data: {} // working_data is NOT sent to Master Agent
        }
      };

    } catch (error) {
      const executionTime = (Date.now() - startTime) / 1000;
      logger.error(`${this.domain} SubAgent processing failed`, error as Error, {
        correlationId,
        operation: 'process_natural_language_request_error',
        domain: this.domain,
        executionTime,
      });

      return {
        message: `${this.domain} operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        metadata: {
          tools_used: toolsUsed,
          execution_time: executionTime,
          data: undefined,
        },
        error: {
          type: 'tool_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          tool: 'unknown',
          recoverable: false,
        },
      };
    }
  }

  /**
   * Get available tools for this domain
   */
  protected getAvailableTools(): string[] {
    return Object.keys(this.getToolToServiceMap());
  }

  /**
   * Gather user context (to be implemented by subclasses if needed)
   */
  protected async gatherUserContext(userId: string): Promise<{
    email_accounts?: Array<{ id: string; email: string; primary?: boolean }>;
    calendars?: Array<{ id: string; name: string; primary?: boolean }>;
    timezone?: string;
  }> {
    // Default implementation returns empty context
    // SubAgents can override this to fetch actual user context
    return {};
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by domain-specific SubAgents
  // ============================================================================

  /**
   * Execute a tool call by mapping to domain service method
   */
  protected abstract executeToolCall(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;

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
      examples: [],
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
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    return {
      healthy: this.config.enabled,
      details: {
        domain: this.domain,
        enabled: this.config.enabled,
        availableTools: this.getAvailableTools().length,
      },
    };
  }

  /**
   * Classify error types for better handling and retry logic
   */
  protected classifyError(error: unknown): { type: string; retryable: boolean; retryDelay?: number } {
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
  protected async executeToolCallWithRetry(toolName: string, params: Record<string, unknown>, maxRetries = 3): Promise<Record<string, unknown>> {
    let lastError: unknown;

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
          retryDelay: errorInfo.retryDelay,
        });
      }
    }

    throw lastError;
  }

}
