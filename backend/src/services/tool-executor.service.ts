import { ToolCall, ToolResult, ToolExecutionContext } from '../types/tools';
import { TIMEOUTS, EXECUTION_CONFIG } from '../config/app-config';
import { AgentFactory } from '../framework/agent-factory';
import { BaseService } from './base-service';
import { getService } from './service-manager';
import { ConfirmationService } from './confirmation.service';
import { 
  ConfirmationRequest, 
  ConfirmationFlow, 
  ConfirmationStatus,
  ConfirmationFlowResult 
} from '../types/confirmation.types';
import { AGENT_HELPERS } from '../config/agent-config';
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
  private confirmationService: ConfirmationService | null = null;

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
    // Get ConfirmationService from service registry (optional dependency)
    this.confirmationService = getService<ConfirmationService>('confirmationService') || null;
    
    this.logInfo('ToolExecutorService initialized', { 
      config: this.config,
      hasConfirmationService: !!this.confirmationService
    });
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

      // Determine if this tool needs confirmation using operation-aware logic
      const needsConfirmation = this.toolNeedsConfirmation(toolCall.name, toolCall);
      
      this.logInfo(`Tool ${toolCall.name} confirmation check`, { 
        needsConfirmation, 
        isPreviewMode: mode.preview,
        willExecutePreview: mode.preview && needsConfirmation,
        toolCall: {
          name: toolCall.name,
          hasQuery: !!toolCall.parameters.query,
          hasAction: !!toolCall.parameters.action
        }
      });
      
      if (mode.preview && needsConfirmation) {
        // In preview mode for confirmation-required tools, execute agent in preview mode
        this.logInfo(`Tool ${toolCall.name} requires confirmation, executing in preview mode`);
        const agent = AgentFactory.getAgent(toolCall.name);
        
        if (agent && typeof (agent as any).executePreview === 'function') {
          // Add access token to parameters if provided
          const executionParameters = accessToken 
            ? { ...toolCall.parameters, accessToken }
            : toolCall.parameters;
          
          // Execute agent in preview mode
          result = await (agent as any).executePreview(executionParameters, context);
          
          // Ensure the result has the expected structure for preview mode
          if (result && typeof result === 'object' && 'result' in result) {
            // Extract the actual result data which should contain awaitingConfirmation
            result = result.result;
          }
        } else {
          // Fallback for agents that don't support preview mode yet
          this.logWarn(`Agent ${toolCall.name} does not support preview mode, using fallback`);
          result = { 
            success: true, 
            awaitingConfirmation: true,
            message: `Confirmation required for ${toolCall.name}`,
            actionId: `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            parameters: toolCall.parameters,
            originalQuery: toolCall.parameters.query
          };
        }
      } else {
        // Execute the tool using AgentFactory normally
        result = await AgentFactory.executeAgent(toolCall.name, toolCall.parameters, context, accessToken);
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
   * Check if a tool needs confirmation using operation-aware logic
   * ALWAYS evaluates operation-specific rules for comprehensive confirmation logic
   */
  private toolNeedsConfirmation(toolName: string, toolCall?: ToolCall): boolean {
    try {
      // Always check for operation-specific logic first
      if (toolCall && toolCall.parameters) {
        const operation = this.detectOperationFromToolCall(toolName, toolCall);
        const operationNeedsConfirmation = AgentFactory.toolNeedsConfirmationForOperation(toolName, operation);
        
        this.logInfo(`Operation-aware confirmation check for ${toolName}`, { 
          operation,
          operationNeedsConfirmation,
          reason: AGENT_HELPERS.getOperationConfirmationReason(toolName as any, operation),
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
   * Detect operation type from tool call parameters using centralized logic
   */
  private detectOperationFromToolCall(toolName: string, toolCall: ToolCall): string {
    try {
      return AgentFactory.detectOperationFromParameters(toolName, toolCall.parameters);
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
   * Execute a tool with confirmation flow support
   * This method determines if confirmation is needed and handles the flow appropriately
   */
  async executeWithConfirmation(
    toolCall: ToolCall,
    context: ToolExecutionContext,
    accessToken?: string
  ): Promise<ToolResult | ConfirmationFlowResult> {
    this.assertReady();
    
    try {
      const startTime = Date.now();
      
      // Check if tool needs confirmation using operation-aware logic
      const needsConfirmation = this.toolNeedsConfirmation(toolCall.name, toolCall);
      
      this.logInfo(`Executing tool with confirmation support: ${toolCall.name}`, {
        toolName: toolCall.name,
        needsConfirmation,
        sessionId: context.sessionId,
        hasConfirmationService: !!this.confirmationService,
        operation: this.detectOperationFromToolCall(toolCall.name, toolCall),
        reason: AGENT_HELPERS.getOperationConfirmationReason(toolCall.name as any, this.detectOperationFromToolCall(toolCall.name, toolCall))
      });

      if (needsConfirmation && this.confirmationService) {
        // Create confirmation flow
        const confirmationRequest: ConfirmationRequest = {
          sessionId: context.sessionId,
          userId: context.userId,
          toolCall,
          context: {
            slackContext: context.slackContext,
            conversationHistory: [], // Could be populated from session
            userPreferences: {} // Could be populated from user settings
          }
        };

        const confirmationFlow = await this.confirmationService.createConfirmation(confirmationRequest);
        
        const executionTime = Date.now() - startTime;
        
        this.logInfo(`Confirmation flow created for ${toolCall.name}`, {
          confirmationId: confirmationFlow.confirmationId,
          sessionId: context.sessionId,
          executionTime
        });

        return {
          success: true,
          confirmationFlow,
          requiresManualFormat: false
        } as ConfirmationFlowResult;
      } else {
        // Execute normally without confirmation
        return await this.executeTool(toolCall, context, accessToken, { preview: false });
      }
    } catch (error) {
      const executionTime = Date.now() - Date.now(); // Will be near 0 for errors
      this.logError(`Tool execution with confirmation failed: ${toolCall.name}`, error, {
        toolName: toolCall.name,
        sessionId: context.sessionId,
        executionTime
      });

      // Return as ConfirmationFlowResult with error
      return {
        success: false,
        error: error as any,
        requiresManualFormat: true
      } as ConfirmationFlowResult;
    }
  }

  /**
   * Execute a confirmed action by confirmation ID
   */
  async executeConfirmedAction(confirmationId: string): Promise<ToolResult> {
    this.assertReady();
    
    if (!this.confirmationService) {
      throw new Error('ConfirmationService is required to execute confirmed actions');
    }

    try {
      this.logInfo(`Executing confirmed action: ${confirmationId}`);
      
      const result = await this.confirmationService.executeConfirmedAction(confirmationId);
      
      this.logInfo(`Confirmed action executed: ${confirmationId}`, {
        success: result.success,
        toolName: result.toolName,
        executionTime: result.executionTime
      });
      
      return result;
    } catch (error) {
      this.logError(`Failed to execute confirmed action: ${confirmationId}`, error);
      
      return {
        toolName: 'unknown',
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0
      };
    }
  }

  /**
   * Get pending confirmations for a session
   */
  async getPendingConfirmations(sessionId: string): Promise<ConfirmationFlow[]> {
    this.assertReady();
    
    if (!this.confirmationService) {
      this.logWarn('ConfirmationService not available, returning empty confirmations');
      return [];
    }

    try {
      return await this.confirmationService.getPendingConfirmations(sessionId);
    } catch (error) {
      this.logError('Failed to get pending confirmations', error, { sessionId });
      return [];
    }
  }

  /**
   * Check if a confirmation exists and is still valid
   */
  async isValidConfirmation(confirmationId: string): Promise<boolean> {
    this.assertReady();
    
    if (!this.confirmationService) {
      return false;
    }

    try {
      const confirmation = await this.confirmationService.getConfirmation(confirmationId);
      return confirmation !== null && confirmation.status === ConfirmationStatus.PENDING;
    } catch (error) {
      this.logError('Error checking confirmation validity', error, { confirmationId });
      return false;
    }
  }

  /**
   * Respond to a confirmation (used by Slack integration)
   */
  async respondToConfirmation(
    confirmationId: string,
    confirmed: boolean,
    userContext?: {
      slackUserId?: string;
      responseChannel?: string;
      responseThreadTs?: string;
    }
  ): Promise<ConfirmationFlow | null> {
    this.assertReady();
    
    if (!this.confirmationService) {
      throw new Error('ConfirmationService is required to respond to confirmations');
    }

    try {
      const response = {
        confirmationId,
        confirmed,
        respondedAt: new Date(),
        userContext
      };

      return await this.confirmationService.respondToConfirmation(confirmationId, response);
    } catch (error) {
      this.logError('Failed to respond to confirmation', error, { confirmationId, confirmed });
      return null;
    }
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