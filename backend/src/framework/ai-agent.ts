import { Logger } from 'winston';
import { ToolExecutionContext, ToolResult, AgentConfig } from '../types/tools';
import { ActionPreview, PreviewGenerationResult, ActionRiskAssessment } from '../types/api/api.types';
import { OpenAIService } from '../services/openai.service';
import { getService } from '../services/service-manager';
import logger from '../utils/logger';
import { aiConfigService } from '../config/ai-config';
import { AGENT_HELPERS } from '../config/agent-config';
import { setTimeout as sleep } from 'timers/promises';
import {
  ToolParameters,
  ToolExecutionResult,
  AgentExecutionSummary,
  ThinkParameters,
  validateToolParameters
} from '../types/agents/agent-parameters';

/**
 * AI Planning Configuration
 */
export interface AIPlanningConfig {
  /** Whether to use AI planning for this agent */
  enableAIPlanning?: boolean;
  /** Maximum number of planning steps */
  maxPlanningSteps?: number;
  /** Planning timeout in milliseconds */
  planningTimeout?: number;
  /** Whether to cache AI plans */
  cachePlans?: boolean;
  /** Temperature for AI planning (0-2) */
  planningTemperature?: number;
  /** Max tokens for AI planning */
  planningMaxTokens?: number;
}

/**
 * AI Plan Step
 */
export interface AIPlanStep {
  id: string;
  tool: string;
  description: string;
  parameters: ToolParameters;
  dependencies?: string[];
  estimatedTime?: number;
  requiresConfirmation?: boolean;
}

/**
 * AI Plan
 */
export interface AIPlan {
  id: string;
  query: string;
  steps: AIPlanStep[];
  totalEstimatedTime: number;
  requiresConfirmation: boolean;
  confidence: number;
  reasoning?: string;
  fallbackStrategy?: 'manual' | 'simplified' | 'abort';
}

/**
 * Tool Registry for AI Planning
 */
export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  examples?: string[];
  estimatedExecutionTime?: number;
  requiresConfirmation?: boolean;
  capabilities?: string[];
  limitations?: string[];
}

/**
 * AI Planning Result
 */
export interface AIPlanningResult {
  success: boolean;
  plan?: AIPlan;
  error?: string;
  fallbackToManual?: boolean;
  executionTime?: number;
}

/**
 * Enhanced AIAgent that replaces BaseAgent as the single base class for all agents
 * 
 * This abstract class provides intelligent, AI-driven execution that can understand 
 * user queries, plan multi-step operations, and orchestrate multiple tools automatically
 * while maintaining all BaseAgent patterns and providing manual fallbacks.
 * 
 * Key Features:
 * - AI-powered planning and tool selection
 * - Intelligent multi-step operation orchestration
 * - Comprehensive caching system for performance
 * - Automatic tool registration and discovery
 * - Error handling with graceful fallbacks
 * - Memory usage monitoring and optimization
 * - Integration with OpenAI service for intelligent decision making
 * 
 * The AIAgent implements a sophisticated AI-first architecture where agents
 * can understand complex user requests, break them down into executable steps,
 * and coordinate multiple tools to achieve the desired outcome.
 * 
 * @abstract
 * @template TParams - Type of parameters accepted by the agent
 * @template TResult - Type of result returned by the agent
 * 
 * @example
 * ```typescript
 * export class MyAgent extends AIAgent<MyParams, MyResult> {
 *   constructor() {
 *     super({
 *       name: 'myAgent',
 *       description: 'Handles specific operations',
 *       capabilities: ['operation1', 'operation2'],
 *       limitations: ['cannot handle X'],
 *       aiPlanning: {
 *         enableAIPlanning: true,
 *         maxPlanningSteps: 5
 *       }
 *     });
 *   }
 * 
 *   protected async processQuery(params: MyParams, context: ToolExecutionContext): Promise<MyResult> {
 *     // Agent-specific logic here
 *     return await this.executeAIPlanning(params, context);
 *   }
 * }
 * ```
 */
export abstract class AIAgent<TParams = any, TResult = any> {
  protected logger: Logger;
  protected config: AgentConfig;
  protected aiConfig: AIPlanningConfig;
  protected openaiService: OpenAIService | undefined;
  protected toolRegistry: Map<string, AITool> = new Map();
  protected planCache: Map<string, { plan: AIPlan; timestamp: number; accessCount: number }> = new Map();
  protected readonly maxCacheSize: number = 50; // Reduced from 100
  protected readonly cacheExpiryMs: number = 10 * 60 * 1000; // Reduced to 10 minutes
  private cacheCleanupInterval?: NodeJS.Timeout;
  
  /**
   * Create a new AIAgent instance with AI planning capabilities
   * 
   * Initializes the agent with comprehensive AI planning support, tool registry,
   * caching system, and OpenAI integration. The agent is configured with
   * intelligent planning capabilities and automatic tool discovery.
   * 
   * @param config - Agent configuration including name, capabilities, and AI settings
   * @param config.name - Unique name for the agent
   * @param config.description - Human-readable description of agent capabilities
   * @param config.capabilities - Array of capabilities this agent provides
   * @param config.limitations - Array of limitations or constraints
   * @param config.aiPlanning - AI planning configuration options
   * 
   * @example
   * ```typescript
   * constructor() {
   *   super({
   *     name: 'emailAgent',
   *     description: 'Handles email operations',
   *     capabilities: ['send', 'search', 'reply'],
   *     limitations: ['requires authentication'],
   *     aiPlanning: {
   *       enableAIPlanning: true,
   *       maxPlanningSteps: 10
   *     }
   *   });
   * }
   * ```
   */
  constructor(config: AgentConfig & { aiPlanning?: AIPlanningConfig }) {
    this.config = config;
    this.logger = logger.child({ agent: config.name });
    
    this.aiConfig = {
      enableAIPlanning: true,
      maxPlanningSteps: 10,
      planningTimeout: 30000,
      cachePlans: true,
      planningTemperature: 0.1,
      planningMaxTokens: 2000,
      ...config.aiPlanning
    };

    // Initialize OpenAI service for planning
    this.initializeAIServices();
    
    // Register default tools
    this.registerDefaultTools();
    
    // Start periodic cache cleanup
    this.startCacheCleanup();
  }

  // ============================================================================
  // ERROR HANDLING AND LOGGING SYSTEM
  // ============================================================================

  /**
   * Log AI planning errors with detailed context
   */
  protected logAIPlanningError(
    error: Error,
    errorType: 'service_unavailable' | 'planning_failed' | 'timeout' | 'invalid_request',
    context: ToolExecutionContext
  ): void {
    const timestamp = new Date().toISOString();
    
    this.logger.error('AI Planning Error', {
      agent: this.config.name,
      errorType,
      error: error.message,
      sessionId: context.sessionId,
      userId: context.userId,
      timestamp,
      aiConfig: {
        enableAIPlanning: this.aiConfig.enableAIPlanning,
        maxPlanningSteps: this.aiConfig.maxPlanningSteps,
        planningTimeout: this.aiConfig.planningTimeout
      }
    });
  }

  /**
   * Log service availability issues
   */
  protected logServiceError(
    serviceName: string,
    operation: string,
    reason: 'unavailable' | 'timeout' | 'error'
  ): void {
    this.logger.error(`Service Error: ${serviceName} ${operation} failed (${reason})`, {
      serviceName,
      operation,
      reason,
      agent: this.config.name
    });
  }

  /**
   * Log timeout issues
   */
  protected logTimeoutError(
    operation: string,
    timeoutMs: number,
    context?: any
  ): void {
    this.logger.error('Timeout Error', {
      operation,
      timeoutMs,
      agent: this.config.name,
      context
    });
  }

  /**
   * Log AI planning fallback with detailed context
   */
  protected logAIPlanningFallback(
    error: Error,
    fallbackReason: 'service_unavailable' | 'planning_failed' | 'timeout' | 'unsuitable_query',
    context: ToolExecutionContext
  ): void {
    const fallbackType = 'AI Planning → Manual Execution';
    const timestamp = new Date().toISOString();
    
    this.logger.warn('AI Planning Fallback', {
      agent: this.config.name,
      fallbackType,
      fallbackReason,
      error: error.message,
      sessionId: context.sessionId,
      userId: context.userId,
      timestamp,
      aiConfig: {
        enableAIPlanning: this.aiConfig.enableAIPlanning,
        maxPlanningSteps: this.aiConfig.maxPlanningSteps,
        planningTimeout: this.aiConfig.planningTimeout
      }
    });
  }

  /**
   * Initialize AI services for planning
   */
  private initializeAIServices(): void {
    try {
      this.openaiService = getService<OpenAIService>('openaiService');
      if (!this.openaiService) {
        this.logger.debug('OpenAI service not available during agent initialization - will retry when needed');
      }
    } catch (error) {
      this.logger.debug('Failed to initialize OpenAI service during agent creation - will retry when needed', error);
    }
  }

  /**
   * Register default tools available for AI planning
   * Override this method to customize available tools
   */
  protected registerDefaultTools(): void {
    // Base tools that most agents can use
    this.registerTool({
      name: 'think',
      description: 'Analyze and reason about the current situation',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to think about' },
          context: { type: 'string', description: 'Additional context' }
        },
        required: ['query']
      },
      examples: ['think about the best approach', 'analyze the current situation'],
      estimatedExecutionTime: 2000,
      requiresConfirmation: false,
      capabilities: ['analysis', 'reasoning', 'verification'],
      limitations: ['cannot execute external actions', 'read-only analysis']
    });
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
      const operation = await this.detectOperation(params);
      const needsConfirmation = await this.operationRequiresConfirmation(operation);
      
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
          reason: await this.getOperationConfirmationReason(operation)
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

  /**
   * Register a tool for AI planning
   */
  protected registerTool(tool: AITool): void {
    this.toolRegistry.set(tool.name, tool);
    this.logger.debug(`Tool registered for AI planning: ${tool.name}`, {
      agent: this.config.name,
      capabilities: tool.capabilities
    });
  }

  /**
   * Single-path AI planning execution with proper error handling
   * This method implements the core AI-first execution logic for all agents
   */
  protected async processQuery(params: TParams, context: ToolExecutionContext): Promise<TResult> {
    try {
        this.logger.debug('Executing with AI planning', {
            agent: this.config.name,
            sessionId: context.sessionId,
          aiPlanningEnabled: this.aiConfig.enableAIPlanning
          });
      
      return await this.executeWithAIPlanning(params, context);
      
    } catch (error) {
      // Enhanced error handling with user-friendly messages
      this.logger.error('AI planning execution failed', {
        agent: this.config.name,
        error: error instanceof Error ? error.message : error,
        sessionId: context.sessionId,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      });
      
      // Create user-friendly error message
      const userMessage = this.createUserFriendlyErrorMessage(error as Error, params);
      
      throw this.createError(
        userMessage,
        'AI_PLANNING_FAILED',
        { 
          originalError: error instanceof Error ? error.message : 'Unknown error',
          agent: this.config.name,
          sessionId: context.sessionId
        }
      );
    }
  }

  /**
   * AI-driven execution with planning and tool orchestration
   * Enhanced with proper error handling and graceful degradation
   */
  protected async executeWithAIPlanning(params: TParams, context: ToolExecutionContext): Promise<TResult> {
    const startTime = Date.now();

    // Check AI service availability first
    const openaiService = this.getOpenAIService();
    if (!openaiService || !openaiService.isReady()) {
      throw this.createError(
        'AI service is not available. Please check your configuration and try again.',
        'SERVICE_UNAVAILABLE'
      );
    }

    // Step 1: Generate execution plan with enhanced error handling
    const planningResult = await this.generateExecutionPlan(params, context);
    
    if (!planningResult.success || !planningResult.plan) {
      const errorMessage = planningResult.error || 'Failed to generate execution plan';
      
      // Provide more specific error messages based on the failure type
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        throw this.createError(
          'Your request is taking longer than expected. Please try with a simpler request.',
          'TIMEOUT'
        );
      } else if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) {
        throw this.createError(
          'Authentication failed. Please check your credentials and try again.',
          'AUTHENTICATION_FAILED'
        );
      } else {
        throw this.createError(
          'I encountered an issue understanding your request. Please try rephrasing it.',
          'AI_PLANNING_FAILED'
        );
      }
    }

    const plan = planningResult.plan;
    
      this.logger.debug('AI execution plan generated', {
          agent: this.config.name,
          planId: plan.id,
        stepCount: plan.steps.length
        });

    // Step 2: Execute plan steps with enhanced error handling
    const executionResults = await this.executePlan(plan, params, context);

    // Step 3: Synthesize results
    return this.synthesizeResults(plan, executionResults, params, context, startTime);
  }

  /**
   * Generate an AI execution plan for the given parameters
   */
  protected async generateExecutionPlan(params: TParams, context: ToolExecutionContext): Promise<AIPlanningResult> {
    const startTime = Date.now();
    
    // Get OpenAI service dynamically to ensure we have the latest state
    const openaiService = this.getOpenAIService();
    if (!openaiService || !openaiService.isReady()) {
      const reason = !openaiService ? 'OpenAI service not available' : 'OpenAI service not ready (likely invalid API key)';
      this.logger.debug('AI planning unavailable', { reason, hasService: !!openaiService });
      return {
        success: false,
        error: reason,
        fallbackToManual: true
      };
    }

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(params);
      if (this.aiConfig.cachePlans && this.planCache.has(cacheKey)) {
        const cacheEntry = this.planCache.get(cacheKey)!;
        
        // Check if cache entry is still valid
        if (Date.now() - cacheEntry.timestamp < this.cacheExpiryMs) {
          // Update access info for LRU
          cacheEntry.accessCount++;
          this.planCache.set(cacheKey, { ...cacheEntry, timestamp: Date.now() });
          
          this.logger.debug('Using cached AI plan', {
              agent: this.config.name,
              planId: cacheEntry.plan.id,
            sessionId: context.sessionId
            });
          return { success: true, plan: cacheEntry.plan, executionTime: Date.now() - startTime };
        } else {
          // Remove expired entry
          this.planCache.delete(cacheKey);
        }
      }

      // Generate new plan
      const systemPrompt = this.buildPlanningSystemPrompt();
      const userQuery = this.buildPlanningUserQuery(params, context);

      const response = await this.withTimeout(
        openaiService.generateStructuredData<AIPlan>(
          userQuery,
          systemPrompt,
          this.getPlanningSchema(),
          {
            temperature: this.aiConfig.planningTemperature || undefined,
            maxTokens: this.aiConfig.planningMaxTokens || undefined
          }
        ),
        this.aiConfig.planningTimeout
      );

      // Validate and enhance the plan
      const validatedPlan = this.validateAndEnhancePlan(response, params, context);

      // Cache the plan if enabled and cache is not under memory pressure
      if (this.aiConfig.cachePlans && this.planCache.size < this.maxCacheSize * 0.9) {
        this.evictExpiredCacheEntries();
        this.ensureCacheSize();
        
        this.planCache.set(cacheKey, {
          plan: validatedPlan,
          timestamp: Date.now(),
          accessCount: 1
        });
      } else if (this.aiConfig.cachePlans) {
        this.logger.debug('Skipping cache due to memory pressure', {
          agent: this.config.name,
          currentCacheSize: this.planCache.size,
          maxSize: this.maxCacheSize
        });
      }

      return {
        success: true,
        plan: validatedPlan,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Failed to generate AI execution plan', {
        agent: this.config.name,
        error: error instanceof Error ? error.message : error,
        sessionId: context.sessionId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Plan generation failed',
        fallbackToManual: true,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a generated AI plan
   */
  protected async executePlan(plan: AIPlan, params: TParams, context: ToolExecutionContext): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const executedSteps = new Set<string>();

      this.logger.debug('Starting AI plan execution', {
          agent: this.config.name,
        planId: plan.id
        });

    // Execute steps respecting dependencies
    const remainingSteps = [...plan.steps];
    let iterationCount = 0;
    const maxIterations = plan.steps.length * 2; // Prevent infinite loops

    while (remainingSteps.length > 0 && iterationCount < maxIterations) {
      iterationCount++;
      const initialLength = remainingSteps.length;

      for (let i = remainingSteps.length - 1; i >= 0; i--) {
        const step = remainingSteps[i];
        if (!step) continue;

        // Check if dependencies are satisfied
        const canExecute = !step.dependencies || 
          step.dependencies.every(dep => executedSteps.has(dep));

        if (canExecute) {
          try {
              this.logger.debug(`Executing plan step: ${step.id}`, {
                  agent: this.config.name,
                  tool: step.tool,
                  sessionId: context.sessionId
                });

            const stepResult = await this.executeToolStep(step, results, params, context);
            results.set(step.id, stepResult);
            executedSteps.add(step.id);
            remainingSteps.splice(i, 1);

              this.logger.debug(`Plan step completed: ${step.id}`, {
                  agent: this.config.name,
                  success: stepResult?.success !== false,
                  sessionId: context.sessionId
                });

          } catch (error) {
            this.logger.error(`Plan step failed: ${step.id}`, {
              agent: this.config.name,
              error: error instanceof Error ? error.message : error,
              sessionId: context.sessionId
            });

            // Decide whether to continue or abort based on step criticality
            if (this.isStepCritical(step)) {
              throw this.createError(
                `Critical plan step failed: ${step.id} - ${error instanceof Error ? error.message : error}`,
                'CRITICAL_STEP_FAILED'
              );
            }

            // Mark as failed but continue
            results.set(step.id, { success: false, error: error instanceof Error ? error.message : error });
            executedSteps.add(step.id);
            remainingSteps.splice(i, 1);
          }
        }
      }

      // If no progress was made, we have a dependency issue
      if (remainingSteps.length === initialLength) {
        const remainingIds = remainingSteps.map(s => s.id).join(', ');
        throw this.createError(
          `Dependency cycle or missing dependencies in plan steps: ${remainingIds}`,
          'PLAN_DEPENDENCY_ERROR'
        );
      }
    }

    if (remainingSteps.length > 0) {
      throw this.createError(
        `Plan execution exceeded maximum iterations with ${remainingSteps.length} steps remaining`,
        'PLAN_EXECUTION_TIMEOUT'
      );
    }

      this.logger.debug('AI plan execution completed', {
          agent: this.config.name,
          planId: plan.id,
          executedSteps: executedSteps.size,
        sessionId: context.sessionId
        });

    return results;
  }

  /**
   * Execute a single tool step from the plan
   */
  protected async executeToolStep(
    step: AIPlanStep, 
    previousResults: Map<string, any>,
    params: TParams,
    context: ToolExecutionContext
  ): Promise<any> {
    // Resolve parameters with context from previous steps
    const resolvedParameters = this.resolveStepParameters(step, previousResults, params);

    // Execute the tool
    switch (step.tool) {
      case 'think':
        return this.executeThinkStep(resolvedParameters, context);
      
      default:
        // For custom tools, delegate to the manual implementation or external services
        return this.executeCustomTool(step.tool, resolvedParameters, context);
    }
  }

  /**
   * Execute a think step (analysis/reasoning)
   */
  protected async executeThinkStep(parameters: ThinkParameters, _context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const openaiService = this.getOpenAIService();
    if (!openaiService || !openaiService.isReady()) {
      return { 
        success: false, 
        error: 'OpenAI service not available for thinking step' 
      };
    }

    try {
      const response = await openaiService.generateText(
        parameters.query || 'Analyze the current situation',
        'Think through this carefully and provide helpful insights.',
        { temperature: 0.3, maxTokens: 500 }
      );

      return {
        success: true,
        result: response,
        metadata: {
          analysis: response,
          reasoning: response,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Think step failed'
      };
    }
  }

  /**
   * Synthesize results from plan execution into final result
   */
  protected async synthesizeResults(
    plan: AIPlan,
    executionResults: Map<string, any>,
    params: TParams,
    context: ToolExecutionContext,
    startTime?: number
  ): Promise<TResult> {
    // Default synthesis - combine all successful results
    const successfulResults = Array.from(executionResults.values())
      .filter(result => result?.success !== false);

    const failedResults = Array.from(executionResults.values())
      .filter(result => result?.success === false);

    // Build result summary
    const summary: AgentExecutionSummary = {
      totalSteps: plan.steps.length,
      successfulSteps: successfulResults.length,
      failedSteps: failedResults.length,
      totalExecutionTime: startTime ? Date.now() - startTime : 0,
      errors: failedResults.map(r => r.error || 'Unknown error'),
      warnings: []
    };

      this.logger.debug('AI plan results synthesized', {
          agent: this.config.name,
          planId: plan.id,
          successRate: `${successfulResults.length}/${plan.steps.length}`,
        sessionId: context.sessionId
        });

    // Override this method in subclasses for custom result synthesis
    return this.buildFinalResult(summary, successfulResults, failedResults, params, context);
  }

  // ABSTRACT METHODS - Must be implemented by subclasses
  
  /**
   * Generate a detailed action preview for confirmation purposes
   * Must be implemented by agents that require confirmation (requiresConfirmation: true)
   * Can be left unimplemented for agents that don't need confirmation
   */
  protected generatePreview?(params: TParams, context: ToolExecutionContext): Promise<PreviewGenerationResult>;

  /**
   * Create user-friendly error messages for AI planning failures
   * Override this method to customize error messages for specific agents
   */
  protected createUserFriendlyErrorMessage(error: Error, params: TParams): string {
    // Throw error instead of creating hardcoded user-friendly messages
    throw error;
  }

  /**
   * Create progressive error message with three levels of disclosure
   */
  private createProgressiveErrorMessage(simple: string, guidance: string, technical: string): string {
    return `${simple} ${guidance}

💡 Need more details? Ask me to "explain the error" for technical information.

[Hidden Technical Details: ${technical}]`;
  }

  /**
   * Build the final result from synthesized execution results
   * Override this method to customize how results are formatted
   */
  protected abstract buildFinalResult(
    summary: AgentExecutionSummary,
    successfulResults: ToolExecutionResult[],
    failedResults: ToolExecutionResult[],
    params: TParams,
    context: ToolExecutionContext
  ): TResult;

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
  protected createError(message: string, code?: string, details?: Record<string, unknown>): Error {
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
    let timeoutHandle: NodeJS.Timeout | undefined;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        this.logTimeoutError('agent execution', timeout);
        reject(this.createError(
          `Agent execution timed out after ${timeout}ms`,
          'TIMEOUT'
        ));
      }, timeout);
    });
    
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      return result;
    } catch (error) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      throw error;
    }
  }

  /**
   * Helper method for retry logic with proper error handling
   */
  protected async withRetries<T>(
    operation: () => Promise<T>, 
    maxRetries?: number,
    delay?: number
  ): Promise<T> {
    const retries = maxRetries || this.getRetries();
    const retryDelay = delay || 1000;
    
    let lastError: Error | null = null;
    
    // Standard retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.warn(`Retry attempt ${attempt}/${retries}`, {
            agent: this.config.name,
            lastError: lastError?.message
          });
          
          // Wait before retry
          await sleep(retryDelay * attempt);
        }
        
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retries) {
          this.logger.error('Operation failed after all retries', {
            agent: this.config.name,
            attempts: attempt + 1,
            maxRetries: retries,
            finalError: lastError.message
          });
          throw lastError;
        }
      }
    }
    
    throw lastError;
  }

  // OPERATION DETECTION METHODS

  /**
   * Detect the operation type from user parameters using AI classification
   * Override this method in subclasses for agent-specific operation detection
   */
  protected async detectOperation(params: TParams): Promise<string> {
    // Default implementation - try to extract operation from query parameter
    if (params && typeof params === 'object' && 'query' in params) {
      const query = (params as any).query;
      if (typeof query === 'string') {
        const configAgentName = this.getConfigAgentName();
        return await AGENT_HELPERS.detectOperation(configAgentName as any, query);
      }
    }
    
    // Fallback to 'unknown' if no query found
    return 'unknown';
  }

  /**
   * Map agent names from AIAgent to AGENT_CONFIG names
   */
  private getConfigAgentName(): string {
    const agentNameMapping: Record<string, string> = {
      'emailAgent': 'email',
      'contactAgent': 'contact',
      'calendarAgent': 'calendar',
      'contentCreator': 'content',
      'Think': 'think'
    };
    
    return agentNameMapping[this.config.name] || this.config.name;
  }

  /**
   * Check if the detected operation requires confirmation using AI
   */
  protected async operationRequiresConfirmation(operation: string): Promise<boolean> {
    const configAgentName = this.getConfigAgentName();
    return await AGENT_HELPERS.operationRequiresConfirmation(configAgentName as any, operation);
  }

  /**
   * Get the reason why an operation requires or doesn't require confirmation
   */
  protected async getOperationConfirmationReason(operation: string): Promise<string> {
    const configAgentName = this.getConfigAgentName();
    return await AGENT_HELPERS.getOperationConfirmationReason(configAgentName as any, operation);
  }

  /**
   * Check if the detected operation is read-only
   */
  protected isReadOnlyOperation(operation: string): boolean {
    const configAgentName = this.getConfigAgentName();
    return AGENT_HELPERS.isReadOnlyOperation(configAgentName as any, operation);
  }

  // UTILITY METHODS - Can be overridden for customization

  /**
   * Check if AI planning can be used for the given parameters
   */
  protected canUseAIPlanning(_params: TParams): boolean {
    // Override this method to add custom logic for when to use AI planning
    return (this.aiConfig.enableAIPlanning ?? false) && !!this.openaiService;
  }

  /**
   * Check if AI planning is enabled for this agent
   * This method is now used for configuration validation only
   */
  protected isAIPlanningEnabled(): boolean {
    return this.aiConfig.enableAIPlanning ?? true;
  }

  /**
   * Get OpenAI service dynamically
   */
  protected getOpenAIService(): OpenAIService | null {
    try {
      return getService<OpenAIService>('openaiService') || null;
    } catch (error) {
      this.logger.debug('Failed to get OpenAI service', { error });
      return null;
    }
  }

  /**
   * Execute custom tools not handled by the base implementation
   */
  protected async executeCustomTool(toolName: string, _parameters: ToolParameters, _context: ToolExecutionContext): Promise<ToolExecutionResult> {
    // Override this method to handle custom tools specific to your agent
    this.logger.warn(`Unknown tool in AI plan: ${toolName}`, {
      agent: this.config.name,
      availableTools: Array.from(this.toolRegistry.keys())
    });

    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    };
  }

  /**
   * Check if a step is critical for plan success
   */
  protected isStepCritical(step: AIPlanStep): boolean {
    const tool = this.toolRegistry.get(step.tool);
    return tool?.requiresConfirmation || step.requiresConfirmation || false;
  }

  /**
   * Resolve step parameters using context from previous steps
   */
  protected resolveStepParameters(step: AIPlanStep, previousResults: Map<string, any>, originalParams: TParams): any {
    // Start with original parameters (including accessToken, sessionId, etc.)
    let resolvedParams = { 
      ...originalParams,  // Include original context like accessToken
      ...step.parameters  // Override with step-specific parameters
    };

    // Simple parameter resolution - replace {{stepId.field}} patterns
    const paramString = JSON.stringify(resolvedParams);
    const resolvedString = paramString.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, stepId, field) => {
      const stepResult = previousResults.get(stepId);
      if (stepResult && stepResult[field] !== undefined) {
        return JSON.stringify(stepResult[field]);
      }
      return match;
    });

    try {
      resolvedParams = JSON.parse(resolvedString);
    } catch (error) {
      this.logger.warn('Failed to resolve step parameters', {
        agent: this.config.name,
        stepId: step.id,
        error: error instanceof Error ? error.message : error
      });
    }

    this.logger.debug('Step parameters resolved', {
      agent: this.config.name,
      stepId: step.id,
      hasAccessToken: !!(resolvedParams as any).accessToken,
      parameterKeys: Object.keys(resolvedParams)
    });

    return resolvedParams;
  }

  /**
   * Build system prompt for AI planning
   */
  protected buildPlanningSystemPrompt(): string {
    const tools = Array.from(this.toolRegistry.values());
    const toolDescriptions = tools.map(tool => 
      `- ${tool.name}: ${tool.description}${tool.capabilities ? ' (Capabilities: ' + tool.capabilities.join(', ') + ')' : ''}`
    ).join('\n');

    const toolNames = tools.map(tool => tool.name).join(', ');

    return `You're helping plan how to handle a user request for the ${this.config.name} agent.

Available tools: ${toolNames}

${toolDescriptions}

Create a smart execution plan using only these tools. Think about what a good assistant would do, then return a JSON plan with the steps needed.`;
  }

  /**
   * Build user query for AI planning
   */
  protected buildPlanningUserQuery(params: TParams, context: ToolExecutionContext): string {
    const query = (params as any).query || JSON.stringify(params);
    
    return `Create an execution plan for this request: "${query}"

Context:
- Agent: ${this.config.name}
- Session: ${context.sessionId}
- User: ${context.userId}

Please provide a detailed execution plan that accomplishes this request efficiently and safely.`;
  }

  /**
   * Get JSON schema for AI planning
   */
  protected getPlanningSchema(): any {
    return {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique plan identifier' },
        query: { type: 'string', description: 'Original user query' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Step identifier' },
              tool: { type: 'string', description: 'Tool name' },
              description: { type: 'string', description: 'Step description' },
              parameters: { type: 'object', description: 'Tool parameters' },
              dependencies: { 
                type: 'array', 
                items: { type: 'string' }, 
                description: 'Dependency step IDs' 
              },
              estimatedTime: { type: 'number', description: 'Estimated execution time (ms)' },
              requiresConfirmation: { type: 'boolean', description: 'Needs user confirmation' }
            },
            required: ['id', 'tool', 'description', 'parameters']
          }
        },
        totalEstimatedTime: { type: 'number', description: 'Total estimated time (ms)' },
        requiresConfirmation: { type: 'boolean', description: 'Plan needs confirmation' },
        confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence level' },
        reasoning: { type: 'string', description: 'Planning reasoning' },
        fallbackStrategy: { 
          type: 'string', 
          enum: ['manual', 'simplified', 'abort'],
          description: 'What to do if plan fails'
        }
      },
      required: ['id', 'query', 'steps', 'totalEstimatedTime', 'requiresConfirmation', 'confidence']
    };
  }

  /**
   * Validate and enhance an AI-generated plan
   */
  protected validateAndEnhancePlan(plan: AIPlan, _params: TParams, _context: ToolExecutionContext): AIPlan {
    // Basic validation
    if (!plan.id || !plan.steps || plan.steps.length === 0) {
      throw this.createError('Invalid plan structure', 'INVALID_PLAN');
    }

    // Enhance with defaults and validation
    const enhancedPlan: AIPlan = {
      ...plan,
      id: plan.id || `plan-${Date.now()}`,
      confidence: Math.max(0, Math.min(1, plan.confidence || 0.5)),
      totalEstimatedTime: plan.totalEstimatedTime || this.estimatePlanTime(plan.steps),
      requiresConfirmation: plan.requiresConfirmation ?? this.planRequiresConfirmation(plan.steps)
    };

    // Validate tools exist
    for (const step of enhancedPlan.steps) {
      if (!this.toolRegistry.has(step.tool) && !this.isBuiltinTool(step.tool)) {
        this.logger.warn(`Plan references unknown tool: ${step.tool}`, {
          agent: this.config.name,
          availableTools: Array.from(this.toolRegistry.keys())
        });
      }
    }

    return enhancedPlan;
  }

  /**
   * Check if a tool is built into the AI agent framework
   */
  protected isBuiltinTool(toolName: string): boolean {
    return ['think'].includes(toolName);
  }

  /**
   * Estimate total execution time for plan steps
   */
  protected estimatePlanTime(steps: AIPlanStep[]): number {
    return steps.reduce((total, step) => {
      const tool = this.toolRegistry.get(step.tool);
      const stepTime = step.estimatedTime || tool?.estimatedExecutionTime || 5000;
      return total + stepTime;
    }, 0);
  }

  /**
   * Check if any step in the plan requires confirmation
   */
  protected planRequiresConfirmation(steps: AIPlanStep[]): boolean {
    return steps.some(step => {
      const tool = this.toolRegistry.get(step.tool);
      return step.requiresConfirmation || tool?.requiresConfirmation || false;
    });
  }

  /**
   * Generate cache key for plan caching
   */
  protected generateCacheKey(params: TParams): string {
    const query = (params as any).query || JSON.stringify(params);
    const hash = this.simpleHash(query + this.config.name);
    return `plan-${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  protected simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get AI planning configuration
   */
  getAIConfig(): AIPlanningConfig {
    return { ...this.aiConfig };
  }

  /**
   * Update AI planning configuration
   */
  updateAIConfig(updates: Partial<AIPlanningConfig>): void {
    this.aiConfig = { ...this.aiConfig, ...updates };
    this.logger.debug('AI planning configuration updated', {
      agent: this.config.name,
      updates
    });
  }

  /**
   * Get registered tools for debugging
   */
  getRegisteredTools(): AITool[] {
    return Array.from(this.toolRegistry.values());
  }

  /**
   * Clear plan cache
   */
  clearPlanCache(): void {
    this.planCache.clear();
    this.logger.debug('AI plan cache cleared', {
      agent: this.config.name
    });
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    // Clean cache every 2 minutes for better memory management
    this.cacheCleanupInterval = setInterval(() => {
      try {
        const sizeBefore = this.planCache.size;
        this.evictExpiredCacheEntries();
        this.ensureCacheSize(); // Also enforce size limits during cleanup
        const sizeAfter = this.planCache.size;
        
        if (sizeBefore > sizeAfter) {
          this.logger.debug('Periodic cache cleanup completed', {
            agent: this.config.name,
            removedEntries: sizeBefore - sizeAfter,
            currentSize: sizeAfter
          });
        }
      } catch (error) {
        this.logger.error('Cache cleanup failed', {
          agent: this.config.name,
          error: error instanceof Error ? error.message : error
        });
      }
    }, 2 * 60 * 1000); // Reduced to 2 minutes
  }

  /**
   * Stop periodic cache cleanup
   */
  private stopCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = undefined as any;
    }
  }

  /**
   * Cleanup resources on agent destruction
   */
  destroy(): void {
    this.stopCacheCleanup();
    this.clearPlanCache();
  }

  /**
   * Get plan cache statistics
   */
  getPlanCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.planCache.size,
      keys: Array.from(this.planCache.keys())
    };
  }

  /**
   * Evict expired cache entries
   */
  private evictExpiredCacheEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.planCache.entries()) {
      if (now - entry.timestamp > this.cacheExpiryMs) {
        this.planCache.delete(key);
      }
    }
  }

  /**
   * Ensure cache doesn't exceed maximum size using LRU eviction
   */
  private ensureCacheSize(): void {
    if (this.planCache.size >= this.maxCacheSize) {
      // Find least recently used entries
      const entries = Array.from(this.planCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest entries until we're under the limit
      const toRemove = entries.slice(0, this.planCache.size - this.maxCacheSize + 1);
      for (const [key] of toRemove) {
        this.planCache.delete(key);
      }

      this.logger.debug('Cache size limit enforced', {
        agent: this.config.name,
        removedEntries: toRemove.length,
        newSize: this.planCache.size
      });
    }
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
  AgentClass: new (config: AgentConfig & { aiPlanning?: AIPlanningConfig }) => AIAgent<TParams, TResult>,
  config: AgentConfig & { aiPlanning?: AIPlanningConfig }
): AIAgent<TParams, TResult> => {
  return new AgentClass(config);
}

/**
 * Enhanced preview generation using AI planning
 */
export abstract class AIAgentWithPreview<TParams = any, TResult = any> extends AIAgent<TParams, TResult> {
  
  /**
   * Generate preview using AI planning
   */
  protected async generatePreview(params: TParams, context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    try {
      // Generate plan for preview
      const planningResult = await this.generateExecutionPlan(params, context);
      
      if (!planningResult.success || !planningResult.plan) {
        return {
          success: false,
          error: 'Failed to generate preview plan'
        };
      }

      const plan = planningResult.plan;
      
      // Create action preview from plan
      const preview: ActionPreview = {
        actionId: `preview-${plan.id}`,
        actionType: this.getActionType(params) as any,
        title: `AI Plan: ${plan.query}`,
        description: this.buildPreviewDescription(plan, params),
        riskAssessment: this.assessRisk(plan, params),
        estimatedExecutionTime: `${Math.round(plan.totalEstimatedTime / 1000)}s`,
        reversible: false,
        requiresConfirmation: plan.requiresConfirmation,
        awaitingConfirmation: true,
        previewData: {
          steps: plan.steps.map(step => ({
            description: step.description,
            tool: step.tool,
            estimatedTime: step.estimatedTime || 5000
          })),
          confidence: plan.confidence,
          reasoning: plan.reasoning
        },
        originalQuery: (params as any).query || JSON.stringify(params),
        parameters: params as Record<string, unknown>
      };

      return {
        success: true,
        preview
      };

    } catch (error) {
      this.logger.error('Failed to generate AI-powered preview', {
        agent: this.config.name,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Preview generation failed'
      };
    }
  }

  /**
   * Get action type for preview - override in subclasses
   */
  protected abstract getActionType(params: TParams): string;

  /**
   * Build preview description from AI plan
   */
  protected buildPreviewDescription(plan: AIPlan, params: TParams): string {
    const stepDescriptions = plan.steps
      .map((step, index) => `${index + 1}. ${step.description}`)
      .join('\n');

    return `I will execute the following ${plan.steps.length} steps:\n\n${stepDescriptions}\n\nEstimated total time: ${Math.round(plan.totalEstimatedTime / 1000)}s`;
  }

  /**
   * Assess risk level for the plan
   */
  protected assessRisk(plan: AIPlan, _params: TParams): ActionRiskAssessment {
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for confirmation requirements
    if (plan.requiresConfirmation) {
      reasons.push('Contains actions that require confirmation');
      riskLevel = 'medium';
    }

    // Check for multiple steps
    if (plan.steps.length > 3) {
      reasons.push('Complex multi-step operation');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Check for external service dependencies
    const hasExternalDeps = plan.steps.some(step => 
      !this.isBuiltinTool(step.tool)
    );
    
    if (hasExternalDeps) {
      reasons.push('Involves external services');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Low confidence plans are higher risk
    if (plan.confidence < 0.7) {
      reasons.push('AI confidence below 70%');
      riskLevel = 'high';
    }

    return { level: riskLevel, factors: reasons };
  }
}