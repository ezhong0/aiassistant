import { ToolCall, ToolResult, ToolExecutionContext } from '../types/tools';
import { TIMEOUTS, EXECUTION_CONFIG } from '../config/app-config';
import { AgentFactory } from '../framework/agent-factory';
import { BaseService } from './base-service';
import logger from '../utils/logger';

export interface ToolExecutorConfig {
  timeout?: number;
  retryCount?: number;
}

export interface ExecutionMode {
  preview: boolean; // If true, prepare action but don't execute
}

export class ToolExecutorService extends BaseService {
  private config: ToolExecutorConfig;

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
    this.logInfo('ToolExecutorService initialized', { config: this.config });
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('ToolExecutorService destroyed');
  }

  /**
   * Execute a single tool call
   */
  async executeTool(
    toolCall: ToolCall, 
    context: ToolExecutionContext,
    accessToken?: string,
    mode: ExecutionMode = { preview: false }
  ): Promise<ToolResult> {
    this.assertReady();
    
    const startTime = Date.now();
    
    try {
      this.logInfo(`Executing tool: ${toolCall.name}`, { 
        toolName: toolCall.name, 
        sessionId: context.sessionId 
      });

      let result: unknown;
      let success = true;
      let error: string | undefined;

      // Determine if this tool needs confirmation
      const needsConfirmation = this.toolNeedsConfirmation(toolCall.name);
      
      if (mode.preview && needsConfirmation) {
        // In preview mode for confirmation-required tools, return action preview
        // TODO: Implement preview functionality in AgentFactory if needed
        this.logInfo(`Tool ${toolCall.name} requires confirmation, but preview not implemented yet`);
        result = { success: true, message: `Preview for ${toolCall.name}: ${toolCall.parameters.query || 'action'}` };
      } else {
        // Execute the tool using AgentFactory
        result = await AgentFactory.executeAgent(toolCall.name, toolCall.parameters, context);
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
        toolName: toolCall.name,
        result,
        success,
        error,
        executionTime
      };

      this.logInfo(`Tool execution completed: ${toolCall.name}`, { 
        success, 
        executionTime,
        hasError: !!error 
      });

      return toolResult;

    } catch (err) {
      const executionTime = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      this.logError(`Tool execution failed: ${toolCall.name}`, err, {
        toolName: toolCall.name,
        sessionId: context.sessionId,
        executionTime
      });

      return {
        toolName: toolCall.name,
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
   * Check if a tool needs confirmation
   */
  private toolNeedsConfirmation(toolName: string): boolean {
    try {
      return AgentFactory.toolNeedsConfirmation(toolName);
    } catch (error) {
      this.logWarn(`Could not determine confirmation requirement for ${toolName}`, { error });
      return false; // Default to no confirmation required
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
export { ToolExecutorService };