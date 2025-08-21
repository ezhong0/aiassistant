import logger from '../utils/logger';
import { AgentFactory } from '../framework/agent-factory';
import { 
  ToolCall, 
  ToolResult, 
  ToolExecutionContext,
  ToolExecutionError,
  TOOL_NAMES 
} from '../types/tools';
import { TIMEOUTS, EXECUTION_CONFIG } from '../config/app-config';

export interface ToolExecutorConfig {
  timeout?: number;
  retryCount?: number;
}

export interface ExecutionMode {
  preview: boolean; // If true, prepare action but don't execute
}

export class ToolExecutorService {
  private config: ToolExecutorConfig;

  constructor(config: ToolExecutorConfig = {}) {
    this.config = {
      timeout: config.timeout || TIMEOUTS.toolExecution,
      retryCount: config.retryCount || EXECUTION_CONFIG.toolExecution.defaultRetryCount
    };
    logger.info('ToolExecutorService initialized', { config: this.config });
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
    const startTime = Date.now();
    
    try {
      logger.info(`Executing tool: ${toolCall.name}`, { 
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
        logger.info(`Tool ${toolCall.name} requires confirmation, but preview not implemented yet`);
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

      logger.info(`Tool execution completed: ${toolCall.name}`, { 
        success, 
        executionTime,
        hasError: !!error 
      });

      return toolResult;

    } catch (err) {
      const executionTime = Date.now() - startTime;
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      
      logger.error(`Tool execution failed: ${toolCall.name}`, { 
        error, 
        executionTime,
        sessionId: context.sessionId 
      });

      return {
        toolName: toolCall.name,
        result: null,
        success: false,
        error,
        executionTime
      };
    }
  }

  /**
   * Execute multiple tool calls sequentially
   */
  async executeTools(
    toolCalls: ToolCall[], 
    context: ToolExecutionContext,
    accessToken?: string,
    mode: ExecutionMode = { preview: false }
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    logger.info(`Executing ${toolCalls.length} tools`, { 
      sessionId: context.sessionId,
      tools: toolCalls.map(tc => tc.name) 
    });

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall, context, accessToken, mode);
        results.push(result);

        // If a critical tool fails, we might want to stop execution
        if (!result.success && this.isCriticalTool(toolCall.name)) {
          logger.warn(`Critical tool failed, stopping execution: ${toolCall.name}`);
          break;
        }

      } catch (error) {
        logger.error(`Failed to execute tool: ${toolCall.name}`, error);
        results.push({
          toolName: toolCall.name,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: 0
        });
      }
    }

    return results;
  }


  /**
   * Determine if a tool needs user confirmation before execution
   */
  private toolNeedsConfirmation(toolName: string): boolean {
    return AgentFactory.toolNeedsConfirmation(toolName);
  }


  /**
   * Determine if a tool is critical for the workflow
   */
  private isCriticalTool(toolName: string): boolean {
    return AgentFactory.isCriticalTool(toolName);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(results: ToolResult[]): {
    total: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
  } {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = total - successful;
    const totalExecutionTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);
    const averageExecutionTime = total > 0 ? totalExecutionTime / total : 0;

    return {
      total,
      successful,
      failed,
      averageExecutionTime,
      totalExecutionTime
    };
  }
}

// Export singleton instance
export const toolExecutorService = new ToolExecutorService();