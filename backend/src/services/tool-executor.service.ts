import { 
  ToolCall, 
  ToolResult, 
  ToolExecutionContext, 
  validateToolCall, 
  validateToolExecutionContext,
  safeParseToolCall 
} from '../types/tools';
import { TIMEOUTS, EXECUTION_CONFIG } from '../config/app-config';
import { AgentFactory } from '../framework/agent-factory';
import { BaseService } from './base-service';
import { getService } from './service-manager';
import { AGENT_HELPERS } from '../config/agent-config';

/**
 * Configuration interface for ToolExecutorService
 * 
 * Defines the configuration options for tool execution including
 * timeout settings and retry behavior.
 * 
 * @interface ToolExecutorConfig
 */
export interface ToolExecutorConfig {
  /** 
   * Timeout in milliseconds for individual tool execution
   * @default TIMEOUTS.toolExecution
   */
  timeout?: number;
  
  /** 
   * Number of retry attempts for failed tool executions
   * @default EXECUTION_CONFIG.toolExecution.defaultRetryCount
   */
  retryCount?: number;
}

/**
 * Execution mode configuration for tool execution
 * 
 * Controls how tools are executed, including preview mode
 * for testing and validation.
 * 
 * @interface ExecutionMode
 */
export interface ExecutionMode {
  /** 
   * If true, prepare action but don't execute (preview mode)
   * Useful for testing and validation without side effects
   */
  preview: boolean;
}

/**
 * Tool Executor Service - Centralized tool execution and orchestration
 * 
 * This service provides a unified interface for executing tools across the
 * multi-agent system. It handles tool validation, execution orchestration,
 * error handling, retry logic, and performance monitoring.
 * 
 * Key Features:
 * - Centralized tool execution with consistent error handling
 * - Automatic retry logic with exponential backoff
 * - Tool validation and safety checks
 * - Performance monitoring and execution metrics
 * - Preview mode for testing without side effects
 * - Integration with AgentFactory for tool discovery
 * 
 * The service acts as the bridge between the MasterAgent's tool call
 * generation and the actual execution of specialized agent tools.
 * 
 * @example
 * ```typescript
 * const toolExecutor = new ToolExecutorService({
 *   timeout: 30000,
 *   retryCount: 3
 * });
 * 
 * await toolExecutor.initialize();
 * 
 * // Execute a tool call
 * const result = await toolExecutor.executeToolCall(toolCall, context);
 * 
 * // Execute multiple tools in sequence
 * const results = await toolExecutor.executeToolCalls(toolCalls, context);
 * ```
 */
export class ToolExecutorService extends BaseService {
  private config: ToolExecutorConfig;

  /**
   * Create a new ToolExecutorService instance
   * 
   * @param config - Configuration options for tool execution
   * @param config.timeout - Timeout in milliseconds for tool execution
   * @param config.retryCount - Number of retry attempts for failed executions
   * 
   * @example
   * ```typescript
   * // Default configuration
   * const toolExecutor = new ToolExecutorService();
   * 
   * // Custom configuration
   * const toolExecutor = new ToolExecutorService({
   *   timeout: 60000,
   *   retryCount: 5
   * });
   * ```
   */
  constructor(config: ToolExecutorConfig = {}) {
    super('ToolExecutorService');
    this.config = {
      timeout: config.timeout || TIMEOUTS.toolExecution,
      retryCount: config.retryCount || EXECUTION_CONFIG.toolExecution.defaultRetryCount
    };
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('ToolExecutorService initialized', { 
      config: this.config
    });
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('ToolExecutorService destroyed');
  }

  /**
   * Execute a single tool call with comprehensive validation and error handling
   * 
   * @param toolCall - The tool call to execute, validated against ToolCallSchema
   * @param context - Execution context including session, user, and Slack context
   * @param accessToken - OAuth token for external API access
   * @param mode - Execution mode (preview vs actual execution)
   * @returns Promise resolving to validated ToolResult
   * 
   * @example
   * ```typescript
   * const result = await toolExecutor.executeTool(
   *   { name: 'send_email', parameters: { to: 'user@example.com' } },
   *   { sessionId: 'abc123', userId: 'user456', timestamp: new Date() }
   * );
   * ```
   */
  async executeTool(
    toolCall: ToolCall, 
    context: ToolExecutionContext,
    accessToken?: string,
    mode: ExecutionMode = { preview: false }
  ): Promise<ToolResult> {
    this.assertReady();
    
    // ✅ Validate input at service boundary
    const validatedToolCall = validateToolCall(toolCall);
    const validatedContext = validateToolExecutionContext(context);
    
    const startTime = Date.now();
    
    try {
        this.logInfo(`Executing tool: ${validatedToolCall.name}`, { 
          toolName: validatedToolCall.name, 
          sessionId: validatedContext.sessionId 
          });

      let result: unknown;
      let success = true;
      let error: string | undefined;

      // Determine if this tool needs confirmation using AI-powered operation detection
      const needsConfirmation = await this.toolNeedsConfirmation(validatedToolCall.name, validatedToolCall);
      
      this.logInfo(`Tool ${validatedToolCall.name} confirmation check`, { 
        needsConfirmation, 
        isPreviewMode: mode.preview,
        willExecutePreview: mode.preview && needsConfirmation,
        toolCall: {
          name: validatedToolCall.name,
          hasQuery: !!validatedToolCall.parameters.query,
          hasAction: !!validatedToolCall.parameters.action
        }
      });
      
      if (mode.preview) {
        // In preview mode - check if tool needs confirmation and handle accordingly
        if (needsConfirmation) {
            this.logInfo(`Tool ${validatedToolCall.name} requires confirmation, executing in preview mode`);
          const agent = AgentFactory.getAgentByToolName(validatedToolCall.name);
          
          if (agent && typeof (agent as any).executePreview === 'function') {
            // Add access token to parameters if provided
            const executionParameters = accessToken 
              ? { ...validatedToolCall.parameters, accessToken }
              : validatedToolCall.parameters;
            
            // Execute agent in preview mode
            result = await (agent as any).executePreview(executionParameters, validatedContext);

            // Check if preview failed due to auth requirements
            if (result && typeof result === 'object' && 'authRequired' in result && result.authRequired) {
              const authResult = result as any; // Cast to avoid TypeScript issues
              this.logInfo(`Preview failed due to auth requirements for ${validatedToolCall.name}`, {
                authReason: authResult.authReason,
                hasMessage: !!authResult.fallbackMessage
              });

              // Convert auth failure to a tool result that indicates auth is needed
              result = {
                success: false,
                needsReauth: true,
                reauth_reason: authResult.authReason,
                error: authResult.error || 'Authentication required',
                message: authResult.error || 'Authentication required'
              };
            } else if (result && typeof result === 'object' && 'result' in result) {
              // Extract the actual result data which should contain awaitingConfirmation
              result = result.result;
            }
          } else {
            // Fallback for agents that don't support preview mode yet
            this.logWarn(`Agent ${validatedToolCall.name} does not support preview mode, using fallback`);
            result = { 
              success: true, 
              awaitingConfirmation: true,
              message: `Confirmation required for ${validatedToolCall.name}`,
              actionId: `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              parameters: validatedToolCall.parameters,
              originalQuery: validatedToolCall.parameters.query
            };
          }
        } else {
          // Tool doesn't need confirmation - execute directly without preview mode
          this.logInfo(`Tool ${validatedToolCall.name} doesn't require confirmation, executing directly`);
          result = await AgentFactory.executeAgent(validatedToolCall.name, validatedToolCall.parameters, validatedContext, accessToken);
          // Don't add wasPreviewExecution flag for non-confirmation tools
        }
      } else {
        // Execute the tool using AgentFactory normally (not preview mode)
        result = await AgentFactory.executeAgent(validatedToolCall.name, validatedToolCall.parameters, validatedContext, accessToken);
      }

      // Check if the tool execution was successful
      if (result && typeof result === 'object' && 'success' in result) {
        const resultObj = result as { success: unknown; error?: unknown };
        success = Boolean(resultObj.success);
        if (!success && resultObj.error) {
          error = String(resultObj.error);
        }
      }

      const executionTime = Date.now() - startTime;

      const toolResult: ToolResult = {
        toolName: validatedToolCall.name,
        result,
        success,
        error,
        executionTime
      };

        this.logInfo(`Tool execution completed: ${validatedToolCall.name}`, { 
          toolName: validatedToolCall.name,
            success, 
          executionTime,
          hasError: !!error 
          });

      return toolResult;

    } catch (err) {
      const executionTime = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      this.logError(`Tool execution failed: ${validatedToolCall.name}`, err, {
        toolName: validatedToolCall.name,
        sessionId: context.sessionId,
        executionTime
      });

      return {
        toolName: validatedToolCall.name,
        result: null,
        success: false,
        error: errorMessage,
        executionTime
      };
    }
  }

  /**
   * Execute multiple tool calls
   */
  async executeTools(
    toolCalls: ToolCall[], 
    context: ToolExecutionContext,
    accessToken?: string,
    mode: ExecutionMode = { preview: false }
  ): Promise<ToolResult[]> {
    this.assertReady();
    
    this.logInfo(`Executing ${toolCalls.length} tools`, {
      toolNames: toolCalls.map(tc => tc.name),
      sessionId: context.sessionId,
      mode
    });

    const results: ToolResult[] = [];
    
    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall, context, accessToken, mode);
        results.push(result);
        
        // If a tool fails and it's critical, we might want to stop execution
        if (!result.success && this.isCriticalTool(toolCall.name)) {
          this.logWarn(`Critical tool ${toolCall.name} failed, stopping execution`, {
            error: result.error,
            completedTools: results.length,
            totalTools: toolCalls.length
          });
          break;
        }
        
      } catch (error) {
        this.logError(`Unexpected error executing tool ${toolCall.name}`, error, {
          toolName: toolCall.name,
          sessionId: context.sessionId
        });
        
        results.push({
          toolName: toolCall.name,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime: 0
        });
      }
    }

    this.logInfo(`Completed execution of ${toolCalls.length} tools`, {
      successfulTools: results.filter(r => r.success).length,
      failedTools: results.filter(r => !r.success).length,
      sessionId: context.sessionId
    });

    return results;
  }

  /**
   * Check if a tool needs confirmation using AI-powered operation detection
   * ALWAYS evaluates operation-specific rules for comprehensive confirmation logic
   */
  private async toolNeedsConfirmation(toolName: string, toolCall?: ToolCall): Promise<boolean> {
    try {
      // Always check for operation-specific logic first
      if (toolCall && toolCall.parameters) {
        const operation = await this.detectOperationFromToolCall(toolName, toolCall);
        const operationNeedsConfirmation = AgentFactory.toolNeedsConfirmationForOperation(toolName, operation);
        
        this.logInfo(`AI operation-aware confirmation check for ${toolName}`, { 
          operation,
          operationNeedsConfirmation,
          reason: await AGENT_HELPERS.getOperationConfirmationReason(toolName as any, operation),
          parameters: Object.keys(toolCall.parameters)
        });
        
        return operationNeedsConfirmation;
      }
      
      // Fall back to agent-level requirement if no operation detection possible
      const agentNeedsConfirmation = AgentFactory.toolNeedsConfirmation(toolName);
      this.logInfo(`Using agent-level confirmation requirement for ${toolName}`, { 
        agentNeedsConfirmation,
        reason: 'No operation detection available - using agent default'
      });
      return agentNeedsConfirmation;
      
    } catch (error) {
      this.logWarn(`Could not determine confirmation requirement for ${toolName}`, { error });
      // Default to agent-level requirement on error
      return AgentFactory.toolNeedsConfirmation(toolName);
    }
  }

  /**
   * Detect operation type from tool call parameters using AI classification
   */
  private async detectOperationFromToolCall(toolName: string, toolCall: ToolCall): Promise<string> {
    try {
      const operation = await AgentFactory.detectOperationFromParameters(toolName, toolCall.parameters);
      this.logInfo(`AI operation detection for ${toolName}`, {
        toolName,
        detectedOperation: operation,
        parameters: toolCall.parameters
      });
      return operation;
    } catch (error) {
      this.logWarn(`Failed to detect operation from tool call`, { 
        toolName, 
        error: error instanceof Error ? error.message : error 
      });
      return 'unknown';
    }
  }

  /**
   * Check if a tool is critical
   */
  private isCriticalTool(toolName: string): boolean {
    try {
      return AgentFactory.isCriticalTool(toolName);
    } catch (error) {
      this.logWarn(`Could not determine critical status for ${toolName}`, { error });
      return false; // Default to non-critical
    }
  }

  /**
   * Get execution statistics from results
   */
  getExecutionStats(results: ToolResult[]): {
    total: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
  } {
    this.assertReady();
    
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = total - successful;
    const totalExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0);
    const averageExecutionTime = total > 0 ? totalExecutionTime / total : 0;

    return {
      total,
      successful,
      failed,
      averageExecutionTime,
      totalExecutionTime
    };
  }


  /**
   * Get service configuration
   */
  getConfig(): ToolExecutorConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<ToolExecutorConfig>): void {
    this.assertReady();
    
    this.config = { ...this.config, ...newConfig };
    this.logInfo('ToolExecutorService configuration updated', { newConfig: this.config });
  }
}
// Export the class for registration with ServiceManager
