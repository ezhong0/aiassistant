import { Logger } from 'winston';
import { ToolExecutionContext, ToolResult, AgentConfig } from '../types/tools';
import { ActionPreview, PreviewGenerationResult } from '../types/api.types';
import logger from '../utils/logger';
import { aiConfigService } from '../config/ai-config';
import { AGENT_HELPERS } from '../config/agent-config';
import { setTimeout as sleep } from 'timers/promises';

/**
 * Abstract base class that eliminates boilerplate code for all agents
 * and provides consistent error handling, logging, and execution patterns.
 */
export abstract class BaseAgent<TParams = any, TResult = any> {
  protected logger: Logger;
  protected config: AgentConfig;
  
  constructor(config: AgentConfig) {
    this.config = config;
    this.logger = logger.child({ agent: config.name });
  }

  /**
   * Template method - handles all common concerns
   * This is the main entry point that orchestrates the entire execution flow
   */
  async execute(params: TParams, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Pre-execution hooks
      await this.beforeExecution(params, context);
      this.validateParams(params);
      this.logger.info('Agent execution started', { 
        params: this.sanitizeForLogging(params),
        sessionId: context.sessionId,
        userId: context.userId 
      });
      
      // Core business logic (implemented by subclass)
      const result = await this.processQuery(params, context);
      
      // Post-execution hooks
      await this.afterExecution(result, context);
      
      return this.createSuccessResult(result, Date.now() - startTime);
      
    } catch (error) {
      return this.createErrorResult(error as Error, Date.now() - startTime);
    }
  }

  /**
   * Execute in preview mode - generates action preview for confirmation
   * Returns a special result with awaitingConfirmation: true when confirmation is needed
   */
  async executePreview(params: TParams, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Pre-execution hooks (but not actual execution)
      await this.beforeExecution(params, context);
      this.validateParams(params);
      this.logger.info('Agent preview execution started', { 
        params: this.sanitizeForLogging(params),
        sessionId: context.sessionId,
        userId: context.userId 
      });
      
      // Check if this operation actually needs confirmation
      const operation = this.detectOperation(params);
      const needsConfirmation = this.operationRequiresConfirmation(operation);
      
      this.logger.info('Operation confirmation check', {
        operation,
        needsConfirmation,
        agentName: this.config.name,
        sessionId: context.sessionId
      });
      
      // If operation doesn't need confirmation, execute directly
      if (!needsConfirmation) {
        this.logger.info('Operation does not require confirmation, executing directly', {
          operation,
          reason: this.getOperationConfirmationReason(operation)
        });
        return await this.execute(params, context);
      }
      
      // Generate preview for operations that need confirmation
      if (!this.generatePreview) {
        throw this.createError(
          `Agent ${this.config.name} does not support preview generation`,
          'PREVIEW_NOT_SUPPORTED'
        );
      }

      const previewResult = await this.generatePreview(params, context);
      
      if (!previewResult.success) {
        throw this.createError(
          previewResult.error || 'Failed to generate preview',
          'PREVIEW_GENERATION_FAILED'
        );
      }
      
      const result = {
        awaitingConfirmation: true,
        preview: previewResult.preview,
        message: previewResult.preview?.description || 'Action preview generated',
        actionId: previewResult.preview?.actionId,
        parameters: params,
        originalQuery: previewResult.preview?.originalQuery
      } as TResult;
      
      this.logger.info('Agent preview completed', {
        actionId: previewResult.preview?.actionId,
        actionType: previewResult.preview?.actionType,
        requiresConfirmation: previewResult.preview?.requiresConfirmation,
        riskLevel: previewResult.preview?.riskAssessment?.level
      });
      
      return this.createSuccessResult(result, Date.now() - startTime);
      
    } catch (error) {
      return this.createErrorResult(error as Error, Date.now() - startTime);
    }
  }

  // ABSTRACT METHODS - Must be implemented by subclasses
  
  /**
   * Core business logic - this is where each agent implements its specific functionality
   */
  protected abstract processQuery(params: TParams, context: ToolExecutionContext): Promise<TResult>;
  
  /**
   * Generate a detailed action preview for confirmation purposes
   * Must be implemented by agents that require confirmation (requiresConfirmation: true)
   * Can be left unimplemented for agents that don't need confirmation
   */
  protected generatePreview?(params: TParams, context: ToolExecutionContext): Promise<PreviewGenerationResult>;
  
  // OPTIONAL OVERRIDES - Can be customized by subclasses
  
  /**
   * Validate input parameters before execution
   * Override this method to add agent-specific validation
   */
  protected validateParams(params: TParams): void {
    if (!params) {
      throw new Error('Parameters are required');
    }
  }
  
  /**
   * Pre-execution hook - called before processQuery
   * Use this for setup, authorization checks, etc.
   */
  protected async beforeExecution(params: TParams, context: ToolExecutionContext): Promise<void> {
    // Override for pre-execution logic
    this.logger.debug('Pre-execution hook called', { 
      agent: this.config.name,
      sessionId: context.sessionId 
    });
  }
  
  /**
   * Post-execution hook - called after successful processQuery
   * Use this for cleanup, notifications, caching, etc.
   */
  protected async afterExecution(result: TResult, context: ToolExecutionContext): Promise<void> {
    // Override for post-execution logic
    this.logger.debug('Post-execution hook called', { 
      agent: this.config.name,
      sessionId: context.sessionId 
    });
  }
  
  /**
   * Sanitize parameters for logging - remove sensitive data
   * Override this to customize what gets logged
   */
  protected sanitizeForLogging(params: TParams): any {
    // Default implementation - override to remove sensitive data from logs
    return params;
  }
  
  // STANDARD IMPLEMENTATIONS - Consistent across all agents
  
  /**
   * Create a successful tool result with standardized format
   */
  protected createSuccessResult(result: TResult, executionTime: number): ToolResult {
    this.logger.info('Agent execution completed successfully', { 
      executionTime,
      agent: this.config.name,
      resultType: typeof result
    });
    
    return {
      toolName: this.config.name,
      result,
      success: true,
      executionTime
    };
  }
  
  /**
   * Create an error tool result with standardized format and logging
   */
  protected createErrorResult(error: Error, executionTime: number): ToolResult {
    this.logger.error('Agent execution failed', {
      error: error.message,
      stack: error.stack,
      executionTime,
      agent: this.config.name,
      errorType: error.constructor.name
    });
    
    return {
      toolName: this.config.name,
      result: null,
      success: false,
      error: error.message,
      executionTime
    };
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Check if agent is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled !== false; // Default to enabled if not specified
  }

  /**
   * Get agent timeout in milliseconds
   */
  getTimeout(): number {
    // Try to get timeout from AI configuration first, then fall back to local config
    try {
      const aiAgentConfig = aiConfigService.getAgentConfig(this.config.name);
      return aiAgentConfig.timeout;
    } catch (error) {
      // Fall back to local config or default
      return this.config.timeout || 30000; // Default 30 seconds
    }
  }

  /**
   * Get retry count
   */
  getRetries(): number {
    // Try to get retries from AI configuration first, then fall back to local config
    try {
      const aiAgentConfig = aiConfigService.getAgentConfig(this.config.name);
      return aiAgentConfig.retries;
    } catch (error) {
      // Fall back to local config or default
      return this.config.retryCount || 3; // Default 3 retries
    }
  }

  /**
   * Get agent fallback strategy from AI configuration
   */
  getFallbackStrategy(): 'fail' | 'retry' | 'queue' {
    try {
      const aiAgentConfig = aiConfigService.getAgentConfig(this.config.name);
      return aiAgentConfig.fallback_strategy;
    } catch (error) {
      // Default fallback strategy
      return 'retry';
    }
  }

  /**
   * Check if agent is enabled from AI configuration
   */
  isEnabledFromConfig(): boolean {
    try {
      const aiAgentConfig = aiConfigService.getAgentConfig(this.config.name);
      return aiAgentConfig.enabled;
    } catch (error) {
      // Fall back to local config
      return this.isEnabled();
    }
  }

  /**
   * Helper method to create typed errors with consistent structure
   */
  protected createError(message: string, code?: string, details?: any): Error {
    const error = new Error(message) as any;
    if (code) error.code = code;
    if (details) error.details = details;
    return error;
  }

  /**
   * Helper method for timeout handling
   */
  protected async withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs || this.getTimeout();
    
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(this.createError(
            `Agent execution timed out after ${timeout}ms`,
            'EXECUTION_TIMEOUT'
          ));
        }, timeout);
      })
    ]);
  }

  /**
   * Helper method for retry logic with AI configuration fallback strategy
   */
  protected async withRetries<T>(
    operation: () => Promise<T>, 
    maxRetries?: number,
    delay?: number
  ): Promise<T> {
    const retries = maxRetries || this.getRetries();
    const retryDelay = delay || 1000;
    const fallbackStrategy = this.getFallbackStrategy();
    
    let lastError: Error | null = null;
    
    // Handle different fallback strategies
    if (fallbackStrategy === 'fail') {
      // No retries, fail immediately
      try {
        return await operation();
      } catch (error) {
        this.logger.error(`Operation failed with 'fail' strategy`, {
          agent: this.config.name,
          error: (error as Error).message
        });
        throw error;
      }
    }
    
    // For queue strategy, we'll implement basic retry for now
    // In a full implementation, this would add to a queue for later processing
    if (fallbackStrategy === 'queue') {
      this.logger.info(`Using 'queue' fallback strategy - implementing as retry for now`, {
        agent: this.config.name
      });
    }
    
    // Standard retry logic (for both 'retry' and 'queue' strategies)
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.warn(`Retry attempt ${attempt}/${retries}`, {
            agent: this.config.name,
            lastError: lastError?.message,
            strategy: fallbackStrategy
          });
          
          // Wait before retry
          await sleep(retryDelay * attempt);
        }
        
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retries) {
          this.logger.error(`All retry attempts exhausted`, {
            agent: this.config.name,
            attempts: attempt + 1,
            finalError: lastError.message,
            strategy: fallbackStrategy
          });
          throw lastError;
        }
      }
    }
    
    throw lastError;
  }

  // OPERATION DETECTION METHODS

  /**
   * Detect the operation type from user parameters
   * Override this method in subclasses for agent-specific operation detection
   */
  protected detectOperation(params: TParams): string {
    // Default implementation - try to extract operation from query parameter
    if (params && typeof params === 'object' && 'query' in params) {
      const query = (params as any).query;
      if (typeof query === 'string') {
        const configAgentName = this.getConfigAgentName();
        return AGENT_HELPERS.detectOperation(configAgentName as any, query);
      }
    }
    
    // Fallback to 'unknown' if no query found
    return 'unknown';
  }

  /**
   * Map agent names from BaseAgent to AGENT_CONFIG names
   */
  private getConfigAgentName(): string {
    const agentNameMapping: Record<string, string> = {
      'emailAgent': 'email',
      'contactAgent': 'contact', 
      'calendarAgent': 'calendar',
      'contentCreator': 'content',
      'Tavily': 'search',
      'Think': 'think'
    };
    
    return agentNameMapping[this.config.name] || this.config.name;
  }

  /**
   * Check if the detected operation requires confirmation
   */
  protected operationRequiresConfirmation(operation: string): boolean {
    const configAgentName = this.getConfigAgentName();
    return AGENT_HELPERS.operationRequiresConfirmation(configAgentName as any, operation);
  }

  /**
   * Get the reason why an operation requires or doesn't require confirmation
   */
  protected getOperationConfirmationReason(operation: string): string {
    const configAgentName = this.getConfigAgentName();
    return AGENT_HELPERS.getOperationConfirmationReason(configAgentName as any, operation);
  }

  /**
   * Check if the detected operation is read-only
   */
  protected isReadOnlyOperation(operation: string): boolean {
    const configAgentName = this.getConfigAgentName();
    return AGENT_HELPERS.isReadOnlyOperation(configAgentName as any, operation);
  }
}

/**
 * Utility types for better type safety
 */
export type AgentExecutor<TParams, TResult> = (
  params: TParams, 
  context: ToolExecutionContext
) => Promise<ToolResult>;

/**
 * Factory function for creating agent instances
 */
export const createAgent = <TParams, TResult>(
  AgentClass: new (config: AgentConfig) => BaseAgent<TParams, TResult>,
  config: AgentConfig
): BaseAgent<TParams, TResult> => {
  return new AgentClass(config);
}

