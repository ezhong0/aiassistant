import { BaseService } from '../services/base-service';
import { GenericAIService } from '../services/generic-ai.service';
import { serviceManager } from '../services/service-manager';
import logger from '../utils/logger';

/**
 * Domain-specific context structure for sub-agents
 */
export interface DomainContext {
  domain: string;
  operation: string;
  entities: string[];
  parameters: Record<string, any>;
  constraints: string[];
  progress: string[];
  blockers: string[];
  next: string;
  notes: string;
}

/**
 * Sub-agent response format for Master Agent integration
 */
export interface SubAgentResponse {
  success: boolean;
  domain: string;
  operation: string;
  result: {
    data: any;
    summary: string;
    metadata: {
      operationsCompleted: string[];
      entitiesProcessed: string[];
      constraintsHandled: string[];
      errorsEncountered?: string[];
      confidence: number;
    };
  };
  context: DomainContext;
  error?: {
    type: string;
    message: string;
    recoverable: boolean;
    suggestions: string[];
  };
}

/**
 * Domain-specific operation result
 */
export interface DomainOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Domain-specific configuration
 */
export interface DomainConfig {
  name: string;
  domain: string;
  systemPrompt: string;
  operations: string[];
  services: string[];
  optionalServices?: string[];
  auth: {
    type: 'oauth' | 'api-key' | 'none';
    provider?: string;
  };
  maxIterations: number;
  riskLevels: {
    high: string[];
    medium: string[];
    low: string[];
  };
  limitations: string[];
}

/**
 * Abstract base class for all domain-specific sub-agents
 * 
 * Implements the three-phase architecture:
 * 1. Domain Understanding & Planning
 * 2. Domain Execution Loop (Max 5 iterations)
 * 3. Domain Result Formatting
 * 
 * Each sub-agent handles one domain (Email, Calendar, Contacts, Slack)
 * and provides structured output for Master Agent integration.
 */
export abstract class SubAgent extends BaseService {
  protected aiService: GenericAIService | null = null;
  protected services: Map<string, any> = new Map();
  private isInitialized = false;

  // Domain-specific prompt builders
  private domainAnalysisBuilder: DomainAnalysisPromptBuilder | null = null;
  private domainPlanningBuilder: DomainPlanningPromptBuilder | null = null;
  private domainReadinessBuilder: DomainReadinessPromptBuilder | null = null;
  private domainExecutionBuilder: DomainExecutionPromptBuilder | null = null;
  private domainProgressBuilder: DomainProgressPromptBuilder | null = null;
  private domainResultBuilder: DomainResultPromptBuilder | null = null;

  constructor() {
    super('SubAgent');
  }

  /**
   * Get domain-specific configuration
   */
  protected abstract getDomainConfig(): DomainConfig;

  /**
   * Execute a domain-specific operation
   */
  protected abstract executeDomainOperation(
    operation: string,
    parameters: Record<string, any>,
    context: DomainContext
  ): Promise<DomainOperationResult>;

  /**
   * Get domain-specific service
   */
  protected getService<T = any>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not available for ${this.getDomainConfig().domain}`);
    }
    return service as T;
  }

  /**
   * Main entry point for sub-agent processing
   */
  async processDomainRequest(
    request: string,
    context?: {
      sessionId: string;
      userId?: string;
      accessToken?: string;
      correlationId?: string;
    }
  ): Promise<SubAgentResponse> {
    const startTime = Date.now();
    const config = this.getDomainConfig();

    logger.info('Processing domain request', {
      domain: config.domain,
      request: request.substring(0, 100),
      sessionId: context?.sessionId,
      userId: context?.userId,
      operation: 'domain_request_start'
    });

    try {
      await this.ensureInitialized();

      // Phase 1: Domain Understanding & Planning
      const domainContext = await this.analyzeAndPlan(request, context);

      // Phase 2: Domain Execution Loop
      const executionResult = await this.executeDomainWorkflow(domainContext, context);

      // Phase 3: Domain Result Formatting
      const finalResult = await this.formatDomainResult(executionResult, startTime);

      return finalResult;

    } catch (error) {
      logger.error('Domain request processing failed', error as Error, {
        domain: config.domain,
        request: request.substring(0, 100),
        sessionId: context?.sessionId,
        userId: context?.userId,
        operation: 'domain_request_error'
      });

      return this.createErrorResponse(error as Error, startTime);
    }
  }

  /**
   * Phase 1: Domain Understanding & Planning
   */
  private async analyzeAndPlan(
    request: string,
    context?: any
  ): Promise<DomainContext> {
    const config = this.getDomainConfig();
    
    logger.info('Analyzing domain request and creating plan', {
      domain: config.domain,
      operation: 'domain_analysis'
    });

    // Domain Analysis
    const analysisResult = await this.domainAnalysisBuilder!.execute(request);
    let domainContext = analysisResult.parsed.context;

    // Domain Planning
    const planningResult = await this.domainPlanningBuilder!.execute(domainContext);
    domainContext = planningResult.parsed.context;

    return domainContext;
  }

  /**
   * Phase 2: Domain Execution Loop
   */
  private async executeDomainWorkflow(
    domainContext: DomainContext,
    context?: any
  ): Promise<DomainContext> {
    const config = this.getDomainConfig();
    
    logger.info('Executing domain workflow', {
      domain: config.domain,
      operation: 'domain_execution'
    });

    const maxIterations = config.maxIterations;
    let currentContext = domainContext;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Domain Readiness Check
      const readinessResult = await this.domainReadinessBuilder!.execute(currentContext);
      currentContext = readinessResult.parsed.context;

      // Check if domain operation is needed
      if (readinessResult.parsed.operation && readinessResult.parsed.parameters) {
        try {
          const operationResult = await this.executeDomainOperation(
            readinessResult.parsed.operation,
            readinessResult.parsed.parameters,
            currentContext
          );

          // Update context with operation results
          if (operationResult.success) {
            currentContext = `${currentContext}\n\nDomain Operation Result:\nOperation: ${readinessResult.parsed.operation}\nResult: ${JSON.stringify(operationResult.data, null, 2)}`;
          } else {
            currentContext = `${currentContext}\n\nDomain Operation Error:\nOperation: ${readinessResult.parsed.operation}\nError: ${operationResult.error}`;
          }
        } catch (error) {
          logger.error('Domain operation execution failed', error as Error, {
            domain: config.domain,
            operation: readinessResult.parsed.operation
          });

          currentContext = `${currentContext}\n\nDomain Operation Error:\nOperation: ${readinessResult.parsed.operation}\nError: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      // Domain Progress Assessment
      const progressResult = await this.domainProgressBuilder!.execute(currentContext);
      currentContext = progressResult.parsed.context;

      // Check if workflow is complete
      if (progressResult.parsed.complete) {
        logger.info('Domain workflow complete', {
          domain: config.domain,
          iteration,
          operation: 'domain_execution_complete'
        });
        break;
      }
    }

    if (iteration >= maxIterations) {
      logger.warn('Domain execution loop reached maximum iterations', {
        domain: config.domain,
        iteration,
        operation: 'domain_execution_max_iterations'
      });
    }

    return currentContext;
  }

  /**
   * Phase 3: Domain Result Formatting
   */
  private async formatDomainResult(
    domainContext: DomainContext,
    startTime: number
  ): Promise<SubAgentResponse> {
    const config = this.getDomainConfig();
    
    logger.info('Formatting domain result', {
      domain: config.domain,
      operation: 'domain_result_formatting'
    });

    const result = await this.domainResultBuilder!.execute(domainContext);
    const finalContext = result.parsed.context;
    const summary = result.parsed.summary;
    const data = result.parsed.data;
    const metadata = result.parsed.metadata;

    return {
      success: true,
      domain: config.domain,
      operation: finalContext.operation,
      result: {
        data,
        summary,
        metadata: {
          operationsCompleted: metadata.operationsCompleted || [],
          entitiesProcessed: metadata.entitiesProcessed || [],
          constraintsHandled: metadata.constraintsHandled || [],
          errorsEncountered: metadata.errorsEncountered || [],
          confidence: metadata.confidence || 100
        }
      },
      context: finalContext
    };
  }

  /**
   * Initialize sub-agent services and prompt builders
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const config = this.getDomainConfig();

    try {
      // Get AI service
      this.aiService = serviceManager.getService<GenericAIService>('genericAIService') || null;
      
      if (!this.aiService) {
        throw new Error('GenericAIService not available for SubAgent');
      }

      // Initialize domain-specific services
      for (const serviceName of config.services) {
        const service = serviceManager.getService(serviceName);
        if (service) {
          this.services.set(serviceName, service);
        } else {
          throw new Error(`Required service ${serviceName} not available for ${config.domain}`);
        }
      }

      // Initialize optional services
      if (config.optionalServices) {
        for (const serviceName of config.optionalServices) {
          const service = serviceManager.getService(serviceName);
          if (service) {
            this.services.set(serviceName, service);
          }
        }
      }

      // Initialize prompt builders
      this.domainAnalysisBuilder = new DomainAnalysisPromptBuilder(this.aiService, config);
      this.domainPlanningBuilder = new DomainPlanningPromptBuilder(this.aiService, config);
      this.domainReadinessBuilder = new DomainReadinessPromptBuilder(this.aiService, config);
      this.domainExecutionBuilder = new DomainExecutionPromptBuilder(this.aiService, config);
      this.domainProgressBuilder = new DomainProgressPromptBuilder(this.aiService, config);
      this.domainResultBuilder = new DomainResultPromptBuilder(this.aiService, config);

      this.isInitialized = true;

      logger.info('SubAgent initialized successfully', {
        domain: config.domain,
        operation: 'subagent_init'
      });

    } catch (error) {
      logger.error('SubAgent initialization failed', error as Error, {
        domain: config.domain,
        operation: 'subagent_init_error'
      });
      throw error;
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: Error, startTime: number): SubAgentResponse {
    const config = this.getDomainConfig();
    
    return {
      success: false,
      domain: config.domain,
      operation: 'error',
      result: {
        data: null,
        summary: `Domain operation failed: ${error.message}`,
        metadata: {
          operationsCompleted: [],
          entitiesProcessed: [],
          constraintsHandled: [],
          errorsEncountered: [error.message],
          confidence: 0
        }
      },
      context: {
        domain: config.domain,
        operation: 'error',
        entities: [],
        parameters: {},
        constraints: [],
        progress: ['Error occurred'],
        blockers: [error.message],
        next: 'Error recovery needed',
        notes: `Error at ${new Date().toISOString()}: ${error.message}`
      },
      error: {
        type: 'execution_error',
        message: error.message,
        recoverable: false,
        suggestions: ['Check domain service availability', 'Verify authentication', 'Retry operation']
      }
    };
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.isInitialized = false;
    this.services.clear();
    logger.info('SubAgent cleanup completed', {
      domain: this.getDomainConfig().domain,
      operation: 'subagent_cleanup'
    });
  }
}

/**
 * Domain Analysis Prompt Builder
 */
class DomainAnalysisPromptBuilder {
  constructor(
    private aiService: GenericAIService,
    private config: DomainConfig
  ) {}

  async execute(request: string): Promise<any> {
    const prompt = {
      systemPrompt: `
        You are a ${this.config.domain} domain analysis agent.
        
        Your task is to analyze user requests and determine domain-specific intent.
        
        Domain: ${this.config.domain}
        Available Operations: ${this.config.operations.join(', ')}
        
        Analyze the request and identify:
        1. Primary domain operation needed
        2. Domain-specific entities involved
        3. Operation parameters required
        4. Domain constraints and limitations
        5. Risk level assessment
        
        Return structured analysis in the domain context format.
      `,
      userPrompt: `Analyze this ${this.config.domain} request: ${request}`,
      context: request
    };

    const schema = {
      type: 'object',
      description: 'Domain analysis result',
      properties: {
        context: {
          type: 'string',
          description: 'Domain context with analysis results'
        }
      },
      required: ['context']
    };

    return this.aiService.executePrompt(prompt, schema);
  }
}

/**
 * Domain Planning Prompt Builder
 */
class DomainPlanningPromptBuilder {
  constructor(
    private aiService: GenericAIService,
    private config: DomainConfig
  ) {}

  async execute(context: string): Promise<any> {
    const prompt = {
      systemPrompt: `
        You are a ${this.config.domain} domain planning agent.
        
        Your task is to create a specific execution plan for domain operations.
        
        Domain: ${this.config.domain}
        Available Operations: ${this.config.operations.join(', ')}
        
        Create a plan that:
        1. Sequences operations logically
        2. Identifies dependencies
        3. Sets success criteria
        4. Plans for error handling
        
        Return structured plan in the domain context format.
      `,
      userPrompt: `Create execution plan for this ${this.config.domain} context: ${context}`,
      context
    };

    const schema = {
      type: 'object',
      description: 'Domain planning result',
      properties: {
        context: {
          type: 'string',
          description: 'Domain context with execution plan'
        }
      },
      required: ['context']
    };

    return this.aiService.executePrompt(prompt, schema);
  }
}

/**
 * Domain Readiness Prompt Builder
 */
class DomainReadinessPromptBuilder {
  constructor(
    private aiService: GenericAIService,
    private config: DomainConfig
  ) {}

  async execute(context: string): Promise<any> {
    const prompt = {
      systemPrompt: `
        You are a ${this.config.domain} domain readiness agent.
        
        Your task is to check if domain operations are ready to execute.
        
        Domain: ${this.config.domain}
        Available Operations: ${this.config.operations.join(', ')}
        
        Check for:
        1. Service availability
        2. Authentication status
        3. Operation prerequisites
        4. Domain constraints
        
        Return readiness assessment and next operation to execute.
      `,
      userPrompt: `Check readiness for this ${this.config.domain} context: ${context}`,
      context
    };

    const schema = {
      type: 'object',
      description: 'Domain readiness result',
      properties: {
        context: {
          type: 'string',
          description: 'Updated domain context'
        },
        operation: {
          type: 'string',
          description: 'Next operation to execute (if ready)'
        },
        parameters: {
          type: 'object',
          description: 'Parameters for the operation'
        }
      },
      required: ['context']
    };

    return this.aiService.executePrompt(prompt, schema);
  }
}

/**
 * Domain Execution Prompt Builder
 */
class DomainExecutionPromptBuilder {
  constructor(
    private aiService: GenericAIService,
    private config: DomainConfig
  ) {}

  async execute(context: string): Promise<any> {
    const prompt = {
      systemPrompt: `
        You are a ${this.config.domain} domain execution agent.
        
        Your task is to execute domain operations and process results.
        
        Domain: ${this.config.domain}
        Available Operations: ${this.config.operations.join(', ')}
        
        Execute operations and:
        1. Handle domain-specific errors
        2. Process service responses
        3. Update domain context
        4. Track progress
        
        Return execution results and updated context.
      `,
      userPrompt: `Execute operations for this ${this.config.domain} context: ${context}`,
      context
    };

    const schema = {
      type: 'object',
      description: 'Domain execution result',
      properties: {
        context: {
          type: 'string',
          description: 'Updated domain context with execution results'
        }
      },
      required: ['context']
    };

    return this.aiService.executePrompt(prompt, schema);
  }
}

/**
 * Domain Progress Prompt Builder
 */
class DomainProgressPromptBuilder {
  constructor(
    private aiService: GenericAIService,
    private config: DomainConfig
  ) {}

  async execute(context: string): Promise<any> {
    const prompt = {
      systemPrompt: `
        You are a ${this.config.domain} domain progress agent.
        
        Your task is to assess domain operation progress and determine completion.
        
        Domain: ${this.config.domain}
        Available Operations: ${this.config.operations.join(', ')}
        
        Assess:
        1. Operation success
        2. Progress toward goals
        3. Remaining operations
        4. Completion status
        
        Return progress assessment and completion status.
      `,
      userPrompt: `Assess progress for this ${this.config.domain} context: ${context}`,
      context
    };

    const schema = {
      type: 'object',
      description: 'Domain progress result',
      properties: {
        context: {
          type: 'string',
          description: 'Updated domain context with progress assessment'
        },
        complete: {
          type: 'boolean',
          description: 'Whether domain workflow is complete'
        }
      },
      required: ['context', 'complete']
    };

    return this.aiService.executePrompt(prompt, schema);
  }
}

/**
 * Domain Result Prompt Builder
 */
class DomainResultPromptBuilder {
  constructor(
    private aiService: GenericAIService,
    private config: DomainConfig
  ) {}

  async execute(context: string): Promise<any> {
    const prompt = {
      systemPrompt: `
        You are a ${this.config.domain} domain result agent.
        
        Your task is to format domain results for Master Agent integration.
        
        Domain: ${this.config.domain}
        Available Operations: ${this.config.operations.join(', ')}
        
        Format:
        1. Aggregate domain data
        2. Create natural language summary
        3. Include operation metadata
        4. Add domain insights
        
        Return structured result for Master Agent.
      `,
      userPrompt: `Format results for this ${this.config.domain} context: ${context}`,
      context
    };

    const schema = {
      type: 'object',
      description: 'Domain result formatting',
      properties: {
        context: {
          type: 'string',
          description: 'Final domain context'
        },
        summary: {
          type: 'string',
          description: 'Natural language summary of domain operations'
        },
        data: {
          type: 'object',
          description: 'Domain-specific data results'
        },
        metadata: {
          type: 'object',
          description: 'Operation metadata and insights'
        }
      },
      required: ['context', 'summary', 'data', 'metadata']
    };

    return this.aiService.executePrompt(prompt, schema);
  }
}
