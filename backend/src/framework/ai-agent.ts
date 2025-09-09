import { BaseAgent } from './base-agent';
import { ToolExecutionContext, AgentConfig } from '../types/tools';
import { PreviewGenerationResult, ActionPreview, ActionRiskAssessment } from '../types/api.types';
import { OpenAIService } from '../services/openai.service';
import { getService } from '../services/service-manager';

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
  parameters: any;
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
  parameters: any;
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
 * Enhanced BaseAgent with AI-driven planning and tool orchestration
 * 
 * This abstract class extends BaseAgent to provide intelligent, AI-driven execution
 * that can understand user queries, plan multi-step operations, and orchestrate
 * multiple tools automatically while maintaining all BaseAgent patterns.
 */
export abstract class AIAgent<TParams = any, TResult = any> extends BaseAgent<TParams, TResult> {
  protected aiConfig: AIPlanningConfig;
  protected openaiService: OpenAIService | undefined;
  protected toolRegistry: Map<string, AITool> = new Map();
  protected planCache: Map<string, AIPlan> = new Map();

  constructor(config: AgentConfig & { aiPlanning?: AIPlanningConfig }) {
    super(config);
    
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
  }

  /**
   * Initialize AI services for planning
   */
  private initializeAIServices(): void {
    try {
      this.openaiService = getService<OpenAIService>('openaiService');
      if (!this.openaiService) {
        this.logger.warn('OpenAI service not available - AI planning disabled', {
          agent: this.config.name
        });
        this.aiConfig.enableAIPlanning = false;
      }
    } catch (error) {
      this.logger.warn('Failed to initialize AI services for planning', {
        agent: this.config.name,
        error: error instanceof Error ? error.message : error
      });
      this.aiConfig.enableAIPlanning = false;
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
   * Enhanced processQuery that uses AI planning as primary execution path
   * Falls back to manual implementation when AI planning fails or is disabled
   */
  protected async processQuery(params: TParams, context: ToolExecutionContext): Promise<TResult> {
    const startTime = Date.now();
    
    // Try AI planning first if enabled
    if (this.aiConfig.enableAIPlanning && this.canUseAIPlanning(params)) {
      try {
        this.logger.info('Attempting AI-driven execution', {
          agent: this.config.name,
          sessionId: context.sessionId
        });

        const aiResult = await this.executeWithAIPlanning(params, context);
        
        this.logger.info('AI-driven execution completed', {
          agent: this.config.name,
          executionTime: Date.now() - startTime,
          sessionId: context.sessionId
        });
        
        return aiResult;

      } catch (error) {
        this.logger.warn('AI planning failed, falling back to manual execution', {
          agent: this.config.name,
          error: error instanceof Error ? error.message : error,
          sessionId: context.sessionId
        });

        // Fall back to manual implementation
        return this.executeManually(params, context);
      }
    }

    // Use manual implementation
    this.logger.debug('Using manual execution', {
      agent: this.config.name,
      reason: this.aiConfig.enableAIPlanning ? 'AI planning not suitable for this query' : 'AI planning disabled',
      sessionId: context.sessionId
    });

    return this.executeManually(params, context);
  }

  /**
   * AI-driven execution with planning and tool orchestration
   */
  protected async executeWithAIPlanning(params: TParams, context: ToolExecutionContext): Promise<TResult> {
    // Step 1: Generate execution plan
    const planningResult = await this.generateExecutionPlan(params, context);
    
    if (!planningResult.success || !planningResult.plan) {
      throw this.createError(
        planningResult.error || 'Failed to generate execution plan',
        'AI_PLANNING_FAILED'
      );
    }

    const plan = planningResult.plan;
    
    this.logger.info('AI execution plan generated', {
      agent: this.config.name,
      planId: plan.id,
      stepCount: plan.steps.length,
      confidence: plan.confidence,
      requiresConfirmation: plan.requiresConfirmation,
      sessionId: context.sessionId
    });

    // Step 2: Execute plan steps
    const executionResults = await this.executePlan(plan, params, context);

    // Step 3: Synthesize results
    return this.synthesizeResults(plan, executionResults, params, context);
  }

  /**
   * Generate an AI execution plan for the given parameters
   */
  protected async generateExecutionPlan(params: TParams, context: ToolExecutionContext): Promise<AIPlanningResult> {
    const startTime = Date.now();
    
    if (!this.openaiService) {
      return {
        success: false,
        error: 'OpenAI service not available',
        fallbackToManual: true
      };
    }

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(params);
      if (this.aiConfig.cachePlans && this.planCache.has(cacheKey)) {
        const cachedPlan = this.planCache.get(cacheKey)!;
        this.logger.debug('Using cached AI plan', {
          agent: this.config.name,
          planId: cachedPlan.id,
          sessionId: context.sessionId
        });
        return { success: true, plan: cachedPlan, executionTime: Date.now() - startTime };
      }

      // Generate new plan
      const systemPrompt = this.buildPlanningSystemPrompt();
      const userQuery = this.buildPlanningUserQuery(params, context);

      const response = await this.withTimeout(
        this.openaiService.generateStructuredData<AIPlan>(
          userQuery,
          systemPrompt,
          this.getPlanningSchema(),
          {
            temperature: this.aiConfig.planningTemperature,
            maxTokens: this.aiConfig.planningMaxTokens
          }
        ),
        this.aiConfig.planningTimeout
      );

      // Validate and enhance the plan
      const validatedPlan = this.validateAndEnhancePlan(response, params, context);

      // Cache the plan if enabled
      if (this.aiConfig.cachePlans) {
        this.planCache.set(cacheKey, validatedPlan);
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

    this.logger.info('Starting AI plan execution', {
      agent: this.config.name,
      planId: plan.id,
      stepCount: plan.steps.length,
      sessionId: context.sessionId
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

    this.logger.info('AI plan execution completed', {
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
  protected async executeThinkStep(parameters: any, _context: ToolExecutionContext): Promise<any> {
    if (!this.openaiService) {
      return { 
        success: false, 
        error: 'OpenAI service not available for thinking step' 
      };
    }

    try {
      const response = await this.openaiService.generateText(
        parameters.query || 'Analyze the current situation',
        'You are an analytical AI assistant. Provide thoughtful analysis and insights based on the given context.',
        { temperature: 0.3, maxTokens: 500 }
      );

      return {
        success: true,
        analysis: response,
        reasoning: response,
        timestamp: new Date().toISOString()
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
    context: ToolExecutionContext
  ): Promise<TResult> {
    // Default synthesis - combine all successful results
    const successfulResults = Array.from(executionResults.values())
      .filter(result => result?.success !== false);

    const failedResults = Array.from(executionResults.values())
      .filter(result => result?.success === false);

    // Build result summary
    const summary = {
      planId: plan.id,
      totalSteps: plan.steps.length,
      successfulSteps: successfulResults.length,
      failedSteps: failedResults.length,
      executionTime: Date.now(),
      results: Object.fromEntries(executionResults)
    };

    this.logger.info('AI plan results synthesized', {
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
   * Manual execution fallback when AI planning fails or is disabled
   * This is where the traditional agent logic goes
   */
  protected abstract executeManually(params: TParams, context: ToolExecutionContext): Promise<TResult>;

  /**
   * Build the final result from synthesized execution results
   * Override this method to customize how results are formatted
   */
  protected abstract buildFinalResult(
    summary: any,
    successfulResults: any[],
    failedResults: any[],
    params: TParams,
    context: ToolExecutionContext
  ): TResult;

  // UTILITY METHODS - Can be overridden for customization

  /**
   * Check if AI planning can be used for the given parameters
   */
  protected canUseAIPlanning(_params: TParams): boolean {
    // Override this method to add custom logic for when to use AI planning
    return (this.aiConfig.enableAIPlanning ?? false) && !!this.openaiService;
  }

  /**
   * Execute custom tools not handled by the base implementation
   */
  protected async executeCustomTool(toolName: string, _parameters: any, _context: ToolExecutionContext): Promise<any> {
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
  protected resolveStepParameters(step: AIPlanStep, previousResults: Map<string, any>, _originalParams: TParams): any {
    let resolvedParams = { ...step.parameters };

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

    return `You are an AI planning assistant for the ${this.config.name} agent.

Available Tools:
${toolDescriptions}

Your task is to create an execution plan that breaks down complex user requests into individual tool steps.
Each step should specify:
- id: unique identifier
- tool: which tool to use
- description: what this step accomplishes
- parameters: tool parameters
- dependencies: which steps must complete first (optional)
- estimatedTime: execution time in milliseconds (optional)
- requiresConfirmation: whether user confirmation is needed

Guidelines:
- Prefer simpler plans when possible
- Consider dependencies between steps
- Include confirmation for destructive actions
- Provide clear reasoning for your approach
- Set realistic confidence levels (0.0 to 1.0)

Return a JSON object matching the AIPlan schema.`;
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
    this.logger.info('AI planning configuration updated', {
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
    this.logger.info('AI plan cache cleared', {
      agent: this.config.name
    });
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