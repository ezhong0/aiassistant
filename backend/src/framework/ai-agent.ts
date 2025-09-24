import { Logger } from 'winston';
import { ToolExecutionContext, ToolResult, AgentConfig } from '../types/tools';
import { ActionPreview, PreviewGenerationResult, ActionRiskAssessment } from '../types/api/api.types';
import { OpenAIService } from '../services/openai.service';
import { getService } from '../services/service-manager';
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
import {
  AgentExecutionContext,
  AgentIntent,
  NaturalLanguageResponse,
  AgentCapabilities,
  INaturalLanguageAgent
} from '../types/agents/natural-language.types';
import { DraftManager, Draft, WriteOperation } from '../services/draft-manager.service';

/**
 * @deprecated AIAgent is deprecated. Use NaturalLanguageAgent instead.
 *
 * This class is kept for backwards compatibility only.
 * All new agents should extend NaturalLanguageAgent from './natural-language-agent'
 *
 * Migration guide:
 * 1. Extend NaturalLanguageAgent instead of AIAgent
 * 2. Implement getAgentConfig() - return agent metadata
 * 3. Implement executeOperation() - execute operations
 * 4. Remove all other methods - base class handles them
 *
 * See CalendarAgentV3, SlackAgentV2, EmailAgentV2 for examples.
 */

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
export abstract class AIAgent<TParams = any, TResult = any> implements INaturalLanguageAgent {
  protected config: AgentConfig;
  protected aiConfig: AIPlanningConfig;
  protected openaiService: OpenAIService | undefined;
  protected draftManager: DraftManager | null = null;
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
    
  }

  /**
   * Log service availability issues
   */
  protected logServiceError(
    serviceName: string,
    operation: string,
    reason: 'unavailable' | 'timeout' | 'error'
  ): void {
  }

  /**
   * Log timeout issues
   */
  protected logTimeoutError(
    operation: string,
    timeoutMs: number,
    context?: any
  ): void {
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
    
  }

  /**
   * Initialize AI services for planning
   */
  private initializeAIServices(): void {
    try {
      this.openaiService = getService<OpenAIService>('openaiService');
      this.draftManager = getService<DraftManager>('draftManager') || null;

      if (!this.openaiService) {
        const error = new Error(`OpenAI service not available for ${this.config.name}`);
        this.logServiceError('openaiService', 'initialization', 'unavailable');
      }

      if (!this.draftManager) {
        const error = new Error(`Draft manager not available for ${this.config.name}`);
        this.logServiceError('draftManager', 'initialization', 'unavailable');
      }
    } catch (error) {
      this.logServiceError('aiServices', 'initialization', 'error');
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
   * Register a tool for AI planning
   */
  protected registerTool(tool: AITool): void {
    this.toolRegistry.set(tool.name, tool);
  }

  /**
   * Single-path AI planning execution with proper error handling
   * This method implements the core AI-first execution logic for all agents
   */
  protected async processQuery(params: TParams, context: ToolExecutionContext): Promise<TResult> {
    try {
      
      return await this.executeWithAIPlanning(params, context);
      
    } catch (error) {
      // Enhanced error handling with user-friendly messages
      
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
      }

      return {
        success: true,
        plan: validatedPlan,
        executionTime: Date.now() - startTime
      };

    } catch (error) {

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

            const stepResult = await this.executeToolStep(step, results, params, context);
            results.set(step.id, stepResult);
            executedSteps.add(step.id);
            remainingSteps.splice(i, 1);


          } catch (error) {

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


    // Override this method in subclasses for custom result synthesis
    return this.buildFinalResult(summary, successfulResults, failedResults, params, context);
  }

  // ABSTRACT METHODS - Must be implemented by subclasses
  
  // Preview generation removed; drafts handle confirmation UX

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
  }
  
  /**
   * Post-execution hook - called after successful processQuery
   * Use this for cleanup, notifications, caching, etc.
   */
  protected async afterExecution(result: TResult, context: ToolExecutionContext): Promise<void> {
    // Override for post-execution logic
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
          
          // Wait before retry
          await sleep(retryDelay * attempt);
        }
        
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retries) {
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
      
      return null;
    }
  }

  /**
   * Execute custom tools not handled by the base implementation
   */
  protected async executeCustomTool(toolName: string, _parameters: ToolParameters, _context: ToolExecutionContext): Promise<ToolExecutionResult> {
    // Override this method to handle custom tools specific to your agent

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
    }


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

  // ============================================================================
  // NATURAL LANGUAGE INTERFACE IMPLEMENTATION
  // ============================================================================

  /**
   * Primary natural language interface for agent communication
   *
   * This is the main entry point for natural language communication between
   * MasterAgent and domain expert agents. Each agent analyzes the request,
   * determines the appropriate tools, and returns a natural language response.
   */
  async processNaturalLanguageRequest(
    request: string,
    context: AgentExecutionContext
  ): Promise<NaturalLanguageResponse> {
    const startTime = Date.now();

    try {
      // Use natural language logger for structured logging
      const { naturalLanguageLogger } = await import('../utils/natural-language-logger');
      
      // Check if this is a draft execution request
      const isDraftExecution = await this.isDraftExecutionRequest(request, context);
      if (isDraftExecution.isDraftExecution) {
        naturalLanguageLogger.logDraftWorkflow('executed', isDraftExecution.draftId!, 'unknown', {
          correlationId: context.correlationId,
          sessionId: context.sessionId,
          userId: context.userId,
          operation: 'draft_execution'
        });
        return await this.executeDraftFromRequest(isDraftExecution.draftId!, request, context);
      }

      // 1. AI-powered intent analysis (domain-specific)
      const intent = await this.analyzeIntent(request, context);

      // Log intent analysis for natural language flow tracking
      naturalLanguageLogger.logIntentAnalysis({
        intentType: 'new_request', // Will be mapped from agent intent
        confidence: intent.confidence,
        reasoning: intent.reasoning,
        newOperation: {
          operation: intent.operation,
          parameters: intent.parameters
        }
      } as any, request, {
        correlationId: context.correlationId,
        sessionId: context.sessionId,
        userId: context.userId,
        operation: 'agent_intent_analysis'
      });

      // 2. Determine if this operation requires a draft
      const requiresDraft = await this.shouldCreateDraft(intent, context);

      if (requiresDraft.shouldCreateDraft) {
        const draftResponse = await this.createDraftFromIntent(intent, request, context, requiresDraft);
        
        // Log draft creation
        if (draftResponse.draft) {
          naturalLanguageLogger.logDraftWorkflow('created', draftResponse.draft.draftId, draftResponse.draft.type, {
            correlationId: context.correlationId,
            sessionId: context.sessionId,
            userId: context.userId,
            operation: 'draft_creation'
          }, draftResponse.draft.previewData);
        }
        
        return draftResponse;
      }

      // 3. Execute the selected tool(s) directly
      const toolResult = await this.executeSelectedTool(intent, context);

      // 4. Generate natural language response
      const responseText = await this.generateResponse(request, toolResult, intent, context);

      // Create proper NaturalLanguageResponse object
      const response: NaturalLanguageResponse = {
        response: responseText,
        reasoning: intent.reasoning,
        metadata: {
          operation: intent.operation,
          confidence: intent.confidence,
          toolsUsed: intent.toolsUsed,
          executionTime: Date.now() - startTime,
          success: toolResult.success,
          ...intent.parameters
        }
      };

      // Log agent communication
      naturalLanguageLogger.logAgentCommunication(
        this.config.name,
        request,
        response,
        {
          correlationId: context.correlationId,
          sessionId: context.sessionId,
          userId: context.userId,
          operation: 'agent_communication'
        }
      );

      return response;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Log error using natural language logger
      const { naturalLanguageLogger } = await import('../utils/natural-language-logger');
      naturalLanguageLogger.logError(error as Error, {
        correlationId: context.correlationId,
        sessionId: context.sessionId,
        userId: context.userId,
        operation: 'agent_error'
      }, {
        agent: this.config.name,
        request: request.substring(0, 100),
        executionTime
      });

      throw this.createError(
        `Natural language processing failed: ${error instanceof Error ? error.message : error}`,
        'NATURAL_LANGUAGE_PROCESSING_FAILED'
      );
    }
  }

  /**
   * Check if the agent can handle a specific type of request
   */
  async canHandle(request: string): Promise<boolean> {
    try {
      // Simple capability check - can be overridden by specific agents
      const capabilities = this.getCapabilityDescription();
      const lowerRequest = request.toLowerCase();

      return capabilities.capabilities.some(capability =>
        lowerRequest.includes(capability.toLowerCase())
      ) || capabilities.examples.some(example =>
        this.calculateSimilarity(lowerRequest, example.toLowerCase()) > 0.5
      );
    } catch (error) {
      this.logServiceError('canHandle', 'request_analysis', 'error');
      return false;
    }
  }

  /**
   * Calculate similarity between two strings (simple implementation)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  // ============================================================================
  // ABSTRACT METHODS FOR DOMAIN-SPECIFIC IMPLEMENTATION
  // ============================================================================

  /**
   * Analyze natural language intent for this domain
   *
   * Each agent must implement domain-specific intent analysis using AI
   * to determine what operation to perform and extract parameters.
   */
  protected abstract analyzeIntent(request: string, context: AgentExecutionContext): Promise<AgentIntent>;

  /**
   * Execute the tool selected by intent analysis
   *
   * This method should execute the appropriate domain-specific tool
   * based on the analyzed intent and return the structured result.
   */
  protected abstract executeSelectedTool(intent: AgentIntent, context: AgentExecutionContext): Promise<ToolResult>;

  /**
   * Generate natural language response from tool execution result
   *
   * Convert the structured tool result into a natural language response
   * that can be understood by users and the MasterAgent.
   */
  protected abstract generateResponse(
    request: string,
    result: ToolResult,
    intent: AgentIntent,
    context: AgentExecutionContext
  ): Promise<string>;

  /**
   * Get agent capability description for MasterAgent
   *
   * This describes what the agent can do, its limitations, and provides
   * examples to help MasterAgent decide when to use this agent.
   */
  abstract getCapabilityDescription(): AgentCapabilities;

  // ============================================================================
  // DRAFT MANAGEMENT METHODS
  // ============================================================================

  /**
   * Check if the request is asking to execute an existing draft
   */
  protected async isDraftExecutionRequest(
    request: string,
    context: AgentExecutionContext
  ): Promise<{ isDraftExecution: boolean; draftId?: string }> {
    if (!this.openaiService) {
      return { isDraftExecution: false };
    }

    try {
      // Get pending drafts for this session
      const drafts = this.draftManager ? await this.draftManager.getSessionDrafts(context.sessionId) : [];

      if (drafts.length === 0) {
        return { isDraftExecution: false };
      }

      const prompt = `Analyze if this user request is asking to execute an existing draft:

Request: "${request}"

Available drafts:
${drafts.map(d => `- ${d.id}: ${d.previewData.description}`).join('\n')}

Common execution phrases: "yes", "confirm", "send it", "execute", "go ahead", "do it", "proceed"

Return JSON: {"isDraftExecution": boolean, "draftId": string|null}`;

      const response = await this.openaiService.generateText(
        prompt,
        'You analyze if requests are asking to execute drafts. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 100 }
      );

      const parsed = JSON.parse(response) as { isDraftExecution: boolean; draftId: string | null };
      return {
        isDraftExecution: parsed.isDraftExecution,
        draftId: parsed.draftId || undefined
      };
    } catch (error) {
      this.logServiceError('draftAnalysis', 'execution_request', 'error');
      return { isDraftExecution: false };
    }
  }

  /**
   * Determine if an operation should create a draft instead of executing immediately
   */
  protected async shouldCreateDraft(
    intent: AgentIntent,
    context: AgentExecutionContext
  ): Promise<{ shouldCreateDraft: boolean; riskLevel?: 'low' | 'medium' | 'high'; reason?: string }> {
    if (!this.openaiService) {
      return { shouldCreateDraft: false };
    }

    try {
      const prompt = `Analyze if this operation should create a draft for user confirmation:

Agent: ${this.config.name}
Operation: ${intent.operation}
Parameters: ${JSON.stringify(intent.parameters, null, 2)}
Confidence: ${intent.confidence}

Operations that typically need drafts:
- Sending emails or messages
- Creating calendar events with attendees
- Making permanent changes to data
- High-risk or irreversible operations
- Operations involving external parties

Operations that don't need drafts:
- Reading/searching data
- Getting information
- Checking availability
- Simple lookups

Return JSON: {"shouldCreateDraft": boolean, "riskLevel": "low"|"medium"|"high", "reason": string}`;

      const response = await this.openaiService.generateText(
        prompt,
        'You analyze if operations need user confirmation drafts. Return only valid JSON.',
        { temperature: 0.1, maxTokens: 200 }
      );

      const parsed = JSON.parse(response) as { shouldCreateDraft: boolean; riskLevel: 'low' | 'medium' | 'high'; reason: string };
      return parsed;
    } catch (error) {
      this.logServiceError('draftRequirements', 'analysis', 'error');
      // Default to creating drafts for safety on write operations
      const writeOperations = ['create', 'send', 'update', 'delete', 'schedule', 'add'];
      const shouldCreateDraft = writeOperations.some(op => intent.operation.toLowerCase().includes(op));
      return {
        shouldCreateDraft,
        riskLevel: shouldCreateDraft ? 'medium' : 'low',
        reason: shouldCreateDraft ? 'Write operation detected - creating draft for safety' : 'Read-only operation'
      };
    }
  }

  /**
   * Create a draft from the analyzed intent
   */
  protected async createDraftFromIntent(
    intent: AgentIntent,
    originalRequest: string,
    context: AgentExecutionContext,
    draftInfo: { riskLevel?: 'low' | 'medium' | 'high'; reason?: string }
  ): Promise<NaturalLanguageResponse> {
    if (!this.draftManager) {
      throw new Error('Draft manager not available for creating drafts');
    }

    try {
      // Generate preview data for the draft
      const previewData = await this.generateDraftPreview(intent, originalRequest, context);

      const writeOperation: WriteOperation = {
        type: this.getDraftTypeFromAgent(),
        operation: intent.operation,
        parameters: intent.parameters,
        toolCall: {
          name: this.config.name,
          parameters: intent.parameters
        },
        confirmationReason: draftInfo.reason || 'Operation requires confirmation',
        riskLevel: draftInfo.riskLevel || 'medium',
        previewDescription: previewData.description
      };

      const draft = await this.draftManager.createDraft(context.sessionId, writeOperation);

      // Generate natural language response with draft info
      const response = await this.generateDraftResponse(draft, originalRequest, context);

      // Draft creation logged via structured logging in draft manager

      return {
        response,
        reasoning: `Created draft for ${intent.operation} operation`,
        metadata: {
          operation: 'draft_created',
          confidence: intent.confidence,
          toolsUsed: ['draftManager'],
          draftOperation: intent.operation
        },
        draft: {
          draftId: draft.id,
          type: draft.type,
          description: draft.previewData.description,
          previewData: draft.previewData.details,
          requiresConfirmation: true,
          riskLevel: draft.riskLevel
        }
      };
    } catch (error) {
      this.logServiceError('draftManager', 'create_draft', 'error');
      throw new Error(`Failed to create draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a draft from a draft execution request
   */
  protected async executeDraftFromRequest(
    draftId: string,
    request: string,
    context: AgentExecutionContext
  ): Promise<NaturalLanguageResponse> {
    if (!this.draftManager) {
      throw new Error('Draft manager not available for executing drafts');
    }

    try {
      // Execute the draft
      const result = await this.draftManager.executeDraft(draftId);

      // Generate response for the execution
      const response = await this.generateDraftExecutionResponse(result, request, context);

      // Draft execution logged via structured logging in draft manager

      return {
        response,
        reasoning: `Executed draft ${draftId}`,
        metadata: {
          operation: 'draft_executed',
          success: result.success,
          toolsUsed: ['draftManager']
        },
        executedDraft: {
          draftId,
          success: result.success,
          result: result.result,
          error: result.error
        }
      };
    } catch (error) {
      this.logServiceError('draftManager', 'execute_draft', 'error');
      throw new Error(`Failed to execute draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate preview data for a draft
   */
  protected async generateDraftPreview(
    intent: AgentIntent,
    originalRequest: string,
    context: AgentExecutionContext
  ): Promise<{ description: string; details: Record<string, any> }> {
    // Default implementation - agents can override for specific preview generation
    return {
      description: `${intent.operation} operation for ${this.config.name}`,
      details: {
        operation: intent.operation,
        parameters: intent.parameters,
        originalRequest,
        agent: this.config.name
      }
    };
  }

  /**
   * Generate natural language response for draft creation
   */
  protected async generateDraftResponse(
    draft: Draft,
    originalRequest: string,
    context: AgentExecutionContext
  ): Promise<string> {
    if (!this.openaiService) {
      return `I've prepared a ${draft.operation} operation. Would you like me to proceed?`;
    }

    try {
      const prompt = `Generate a natural language response showing the user what draft was created:

Original request: "${originalRequest}"
Draft operation: ${draft.operation}
Draft details: ${JSON.stringify(draft.previewData, null, 2)}
Risk level: ${draft.riskLevel}

Create a friendly response that:
1. Shows exactly what will be done
2. Asks for confirmation
3. Includes relevant details from the draft
4. Is conversational and clear

Example: "I've prepared to send an email to john@example.com with the subject 'Meeting Update'. Would you like me to send it?"`;

      const response = await this.openaiService.generateText(
        prompt,
        'You create friendly confirmation messages for draft operations.',
        { temperature: 0.3, maxTokens: 200 }
      );

      return response.trim();
    } catch (error) {
      this.logServiceError('responseGeneration', 'draft_response', 'error');
      return `I've prepared a ${draft.operation} operation. Would you like me to proceed?`;
    }
  }

  /**
   * Generate natural language response for draft execution
   */
  protected async generateDraftExecutionResponse(
    result: ToolResult,
    request: string,
    context: AgentExecutionContext
  ): Promise<string> {
    if (!this.openaiService) {
      return result.success ? 'Operation completed successfully!' : `Operation failed: ${result.error}`;
    }

    try {
      const prompt = `Generate a natural language response for a completed operation:

User confirmation: "${request}"
Operation result: ${JSON.stringify(result, null, 2)}
Success: ${result.success}

Create a friendly response that:
1. Confirms what was done
2. Includes relevant details from the result
3. Handles both success and failure cases
4. Is conversational and informative

Example success: "✅ Email sent successfully to john@example.com!"
Example failure: "❌ Failed to send email: Invalid recipient address"`;

      const response = await this.openaiService.generateText(
        prompt,
        'You create friendly completion messages for executed operations.',
        { temperature: 0.3, maxTokens: 200 }
      );

      return response.trim();
    } catch (error) {
      this.logServiceError('responseGeneration', 'execution_response', 'error');
      return result.success ? 'Operation completed successfully!' : `Operation failed: ${result.error}`;
    }
  }

  /**
   * Get the draft type based on the agent name
   */
  protected getDraftTypeFromAgent(): 'email' | 'calendar' | 'contact' | 'slack' | 'other' {
    // Use AgentFactory to get agent metadata instead of string matching
    const { AgentFactory } = require('./agent-factory');
    const agentMetadata = AgentFactory.getAgentDiscoveryMetadata();
    
    // Check if agent has draft type configured
    const agentName = this.config.name;
    if (agentMetadata[agentName]?.draftType) {
      return agentMetadata[agentName].draftType;
    }
    
    // If no metadata available, throw error instead of guessing
    throw new Error(`Draft type not configured for agent: ${agentName}. Please configure draft type in agent metadata.`);
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
        }
      } catch (error) {
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
