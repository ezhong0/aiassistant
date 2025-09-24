/**
 * Natural Language Agent - Microservice API Pattern
 *
 * Base class for all natural language agents using a clean microservice-style API.
 *
 * Every agent is a microservice with a single endpoint:
 *   Input: Natural language query + context
 *   Output: Natural language response
 *
 * Agents only implement 2 methods:
 *   1. getAgentConfig() - System prompts, operations, services, auth
 *   2. executeOperation() - Internal logic (API calls)
 *
 * Everything else (LLM analysis, drafts, auth, response formatting) is handled internally.
 *
 * @example
 * ```typescript
 * class WeatherAgent extends NaturalLanguageAgent {
 *   protected getAgentConfig() {
 *     return {
 *       name: 'weatherAgent',
 *       systemPrompt: "You are a weather agent...",
 *       operations: ['get_forecast', 'get_current'],
 *       services: ['weatherService'],
 *       auth: { type: 'api-key' }
 *     };
 *   }
 *
 *   protected async executeOperation(operation, params, auth) {
 *     const service = this.getService('weatherService');
 *     switch(operation) {
 *       case 'get_forecast':
 *         return await service.getForecast(params.location, auth);
 *     }
 *   }
 * }
 *
 * // Usage (like calling a microservice)
 * const agent = new WeatherAgent();
 * const response = await agent.execute(
 *   "What's the weather in SF tomorrow?",
 *   { userId, sessionId, apiKey }
 * );
 * ```
 */

import { OpenAIService } from '../services/openai.service';
import { serviceManager } from '../services/service-manager';
import { DraftManager, WriteOperation, Draft } from '../services/draft-manager.service';
import {
  AgentExecutionContext,
  AgentIntent,
  NaturalLanguageResponse,
  AgentCapabilities,
  INaturalLanguageAgent,
} from '../types/agents/natural-language.types';
import logger from '../utils/logger';

/**
 * Agent configuration - single source of truth for agent metadata
 */
export interface AgentConfig {
  /** Agent name (used for registration and discovery) */
  name: string;

  /** System prompt for LLM intent analysis and response generation */
  systemPrompt: string;

  /** Operations this agent can perform */
  operations: string[];

  /** Required services this agent depends on */
  services: string[];

  /** Optional services (agent works without them but with reduced functionality) */
  optionalServices?: string[];

  /** Authentication configuration */
  auth: {
    type: 'oauth' | 'api-key' | 'none';
    provider?: 'google' | 'slack' | 'sendgrid' | string;
  };

  /** Draft/confirmation rules */
  draftRules?: {
    /** Operations that always require drafts */
    operations?: string[];
    /** Default risk level for this agent's operations */
    defaultRiskLevel?: 'low' | 'medium' | 'high';
  };

  /** Agent description for MasterAgent */
  description?: string;

  /** Agent capabilities (for MasterAgent discovery) */
  capabilities?: string[];

  /** Agent limitations (for MasterAgent discovery) */
  limitations?: string[];
}

/**
 * Analyzed intent from natural language input
 */
export interface AnalyzedIntent {
  /** The operation to execute */
  operation: string;

  /** Parameters for the operation */
  parameters: Record<string, any>;

  /** Confidence level (0-1) */
  confidence: number;

  /** Reasoning for the intent */
  reasoning: string;
}

/**
 * Abstract base class for all natural language agents
 *
 * Implements the template pattern with a single public API:
 *   execute(query, context) → response
 *
 * All internal plumbing (LLM analysis, drafts, auth) is handled automatically.
 */
export abstract class NaturalLanguageAgent implements INaturalLanguageAgent {
  protected openaiService: OpenAIService | null = null;
  protected draftManager: DraftManager | null = null;
  protected services: Map<string, any> = new Map();
  private isInitialized = false;

  // ============================================================================
  // PUBLIC API - Single Endpoint (Final, never override)
  // ============================================================================

  /**
   * Process natural language request - implements INaturalLanguageAgent
   *
   * This is the ONLY public method. All internal logic is handled automatically:
   * 1. Analyzes intent using LLM
   * 2. Handles authentication
   * 3. Determines if draft is needed
   * 4. Executes operation (calls agent's executeOperation)
   * 5. Formats response using LLM
   *
   * @param request - Natural language input
   * @param context - Execution context (userId, sessionId, accessToken, etc.)
   * @returns Natural language response with metadata
   */
  async processNaturalLanguageRequest(request: string, context: AgentExecutionContext): Promise<NaturalLanguageResponse> {
    const startTime = Date.now();

    try {
      // Initialize services if needed
      await this.ensureServices();

      // Get agent configuration
      const config = this.getAgentConfig();

      // Natural language logging
      const { naturalLanguageLogger } = await import('../utils/natural-language-logger');

      // Check if this is a draft execution request
      const isDraftExecution = await this.isDraftExecutionRequest(request, context);
      if (isDraftExecution.isDraftExecution && isDraftExecution.draftId) {
        naturalLanguageLogger.logDraftWorkflow('executed', isDraftExecution.draftId, 'unknown', {
          correlationId: context.correlationId,
          sessionId: context.sessionId,
          userId: context.userId,
          operation: 'draft_execution'
        });
        return await this.executeDraft(isDraftExecution.draftId, request, context);
      }

      // 1. Analyze intent using LLM
      const intent = await this.analyzeIntent(request, context, config);

      naturalLanguageLogger.logIntentAnalysis({
        intentType: 'new_request',
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

      // 2. Determine if draft is needed
      const shouldDraft = await this.shouldCreateDraft(intent, context, config);

      if (shouldDraft.shouldCreateDraft) {
        const draftResponse = await this.createDraft(intent, request, context, config, shouldDraft);

        if (draftResponse.draft) {
          naturalLanguageLogger.logDraftWorkflow('created', draftResponse.draft.draftId, draftResponse.draft.type, {
            correlationId: context.correlationId,
            sessionId: context.sessionId,
            userId: context.userId,
            operation: 'draft_creation'
          }, draftResponse.draft.previewData);
        }

        return {
          response: draftResponse.response,
          reasoning: intent.reasoning,
          metadata: {
            operation: 'draft_created',
            confidence: intent.confidence,
            executionTime: Date.now() - startTime,
            draft: draftResponse.draft
          }
        };
      }

      // 3. Authenticate (get token from context or fetch)
      const authToken = await this.authenticate(context, config);

      // 4. Execute operation (agent-specific implementation)
      const result = await this.executeOperation(intent.operation, intent.parameters, authToken);

      // 5. Format response using LLM
      const responseText = await this.formatResponse(request, result, intent, config);

      // Log agent communication
      const nlResponse: NaturalLanguageResponse = {
        response: responseText,
        reasoning: intent.reasoning,
        metadata: {
          operation: intent.operation,
          confidence: intent.confidence,
          executionTime: Date.now() - startTime,
          ...intent.parameters,
          result
        }
      };

      naturalLanguageLogger.logAgentCommunication(
        config.name,
        request,
        nlResponse,
        {
          correlationId: context.correlationId,
          sessionId: context.sessionId,
          userId: context.userId,
          operation: 'agent_communication'
        }
      );

      return nlResponse;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const { naturalLanguageLogger } = await import('../utils/natural-language-logger');

      logger.error('Natural language agent error', error as Error, {
        correlationId: context.correlationId,
        sessionId: context.sessionId,
        userId: context.userId,
        operation: 'agent_error',
        metadata: { request, executionTime }
      });

      const errorResponse = await this.formatErrorResponse(error as Error, request);
      return {
        response: errorResponse,
        reasoning: 'Error occurred during execution',
        metadata: {
          operation: 'error',
          error: (error as Error).message,
          executionTime
        }
      };
    }
  }

  // ============================================================================
  // PUBLIC INTERFACE METHODS
  // ============================================================================

  /**
   * Get capability description for MasterAgent - implements INaturalLanguageAgent
   */
  getCapabilityDescription(): AgentCapabilities {
    const config = this.getAgentConfig();
    return {
      name: config.name,
      description: config.description || config.systemPrompt,
      capabilities: config.capabilities || config.operations,
      limitations: config.limitations || [],
      examples: [],
      domains: []
    };
  }

  /**
   * Check if agent can handle request - implements INaturalLanguageAgent
   */
  async canHandle(request: string): Promise<boolean> {
    // Default implementation: always return true
    // Subclasses can override with custom logic
    return true;
  }

  // ============================================================================
  // ABSTRACT METHODS - Agents Implement These (2 methods)
  // ============================================================================

  /**
   * Get agent configuration
   *
   * This is the single source of truth for agent metadata.
   * Everything else (schemas, capabilities, discovery) is auto-generated from this.
   */
  protected abstract getAgentConfig(): AgentConfig;

  /**
   * Execute an operation with given parameters
   *
   * This is the agent's internal logic - the "black box" that calls APIs,
   * processes data, and returns results.
   *
   * @param operation - The operation to execute (from config.operations)
   * @param parameters - Parameters for the operation
   * @param authToken - Authentication token (from context or fetched)
   * @returns Operation result (any structure)
   */
  protected abstract executeOperation(
    operation: string,
    parameters: Record<string, any>,
    authToken: any
  ): Promise<any>;

  // ============================================================================
  // INTERNAL METHODS - Template Implementation (Don't Override)
  // ============================================================================

  /**
   * Analyze intent from natural language using LLM
   */
  private async analyzeIntent(
    query: string,
    context: AgentExecutionContext,
    config: AgentConfig
  ): Promise<AnalyzedIntent> {
    if (!this.openaiService) {
      throw new Error('OpenAI service not available for intent analysis');
    }

    const prompt = `You are a ${config.name} that understands user requests.

System Context: ${config.systemPrompt}

Available Operations: ${config.operations.join(', ')}

User Query: "${query}"

Analyze this request and determine:
1. Which operation to execute
2. What parameters are needed
3. Your confidence level
4. Your reasoning

Return JSON: {
  "operation": "operation_name",
  "parameters": { "param1": "value1", ... },
  "confidence": 0.95,
  "reasoning": "User wants to..."
}`;

    const response = await this.openaiService.generateText(
      prompt,
      'You analyze user requests and extract structured intent. Return only valid JSON.',
      { temperature: 0.2, maxTokens: 500 }
    );

    try {
      const intent = JSON.parse(response) as AnalyzedIntent;

      // Validate operation is in config
      if (!config.operations.includes(intent.operation)) {
        throw new Error(`Invalid operation: ${intent.operation}`);
      }

      return intent;
    } catch (error) {
      throw new Error(`Failed to parse intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine if operation should create a draft
   */
  private async shouldCreateDraft(
    intent: AnalyzedIntent,
    context: AgentExecutionContext,
    config: AgentConfig
  ): Promise<{ shouldCreateDraft: boolean; riskLevel?: 'low' | 'medium' | 'high'; reason?: string }> {
    // Check explicit draft rules first
    if (config.draftRules?.operations?.includes(intent.operation)) {
      return {
        shouldCreateDraft: true,
        riskLevel: config.draftRules.defaultRiskLevel || 'medium',
        reason: 'Operation configured to require draft'
      };
    }

    if (!this.openaiService) {
      // Fallback: create draft for write operations
      const writeOperations = ['create', 'send', 'update', 'delete', 'schedule', 'add'];
      const shouldCreateDraft = writeOperations.some(op => intent.operation.toLowerCase().includes(op));
      return {
        shouldCreateDraft,
        riskLevel: shouldCreateDraft ? 'medium' : 'low',
        reason: shouldCreateDraft ? 'Write operation detected' : 'Read-only operation'
      };
    }

    const prompt = `Analyze if this operation should create a draft for user confirmation:

Agent: ${config.name}
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

    return JSON.parse(response);
  }

  /**
   * Create draft from intent
   */
  private async createDraft(
    intent: AnalyzedIntent,
    originalQuery: string,
    context: AgentExecutionContext,
    config: AgentConfig,
    draftInfo: { riskLevel?: 'low' | 'medium' | 'high'; reason?: string }
  ): Promise<{ response: string; draft?: any }> {
    if (!this.draftManager) {
      throw new Error('Draft manager not available');
    }

    const writeOperation: WriteOperation = {
      type: 'other', // Generic type for NaturalLanguageAgent
      operation: intent.operation,
      parameters: intent.parameters,
      toolCall: {
        name: config.name,
        parameters: intent.parameters
      },
      confirmationReason: draftInfo.reason || 'Operation requires confirmation',
      riskLevel: draftInfo.riskLevel || 'medium',
      previewDescription: `${intent.operation}: ${JSON.stringify(intent.parameters)}`
    };

    const draft = await this.draftManager.createDraft(context.sessionId, writeOperation);

    const response = `I've prepared a draft for this operation. ${draftInfo.reason || ''}

Draft ID: ${draft.id}
Operation: ${intent.operation}
Risk Level: ${draftInfo.riskLevel}

Would you like me to execute this draft?`;

    return {
      response,
      draft: {
        draftId: draft.id,
        type: config.name,
        previewData: draft.previewData
      }
    };
  }

  /**
   * Execute a draft
   */
  private async executeDraft(
    draftId: string,
    originalQuery: string,
    context: AgentExecutionContext
  ): Promise<NaturalLanguageResponse> {
    if (!this.draftManager) {
      throw new Error('Draft manager not available');
    }

    const draft = await this.draftManager.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    // Execute the operation from the draft
    const config = this.getAgentConfig();
    const authToken = await this.authenticate(context, config);

    // Parse operation from draft
    const operation = typeof draft.operation === 'string'
      ? JSON.parse(draft.operation)
      : draft.operation;

    const result = await this.executeOperation(
      operation.operation as string,
      operation.parameters,
      authToken
    );

    // Mark draft as executed
    await this.draftManager.executeDraft(draftId);

    // Format response
    const responseText = await this.formatResponse(originalQuery, result, {
      operation: operation.operation as string,
      parameters: operation.parameters,
      confidence: 1.0,
      reasoning: 'Executed confirmed draft'
    }, config);

    return {
      response: responseText,
      reasoning: 'Executed confirmed draft',
      metadata: {
        operation: operation.operation,
        draftId,
        result
      }
    };
  }

  /**
   * Check if request is asking to execute a draft
   */
  private async isDraftExecutionRequest(
    query: string,
    context: AgentExecutionContext
  ): Promise<{ isDraftExecution: boolean; draftId?: string }> {
    if (!this.openaiService || !this.draftManager) {
      return { isDraftExecution: false };
    }

    const drafts = await this.draftManager.getSessionDrafts(context.sessionId);
    if (drafts.length === 0) {
      return { isDraftExecution: false };
    }

    const prompt = `Analyze if this user request is asking to execute an existing draft:

Request: "${query}"

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
  }

  /**
   * Authenticate and get token
   */
  private async authenticate(
    context: AgentExecutionContext,
    config: AgentConfig
  ): Promise<any> {
    // For now, just return accessToken from context
    // TODO: Implement proper auth handling based on config.auth
    if (config.auth.type === 'oauth') {
      return context.accessToken;
    }
    if (config.auth.type === 'api-key') {
      return context.accessToken || null;
    }
    return null;
  }

  /**
   * Format response using LLM
   */
  private async formatResponse(
    query: string,
    result: any,
    intent: AnalyzedIntent,
    config: AgentConfig
  ): Promise<string> {
    if (!this.openaiService) {
      // Fallback: simple formatting
      return `Operation ${intent.operation} completed: ${JSON.stringify(result)}`;
    }

    const prompt = `You are a ${config.name} responding to a user query.

System Context: ${config.systemPrompt}

User Query: "${query}"

Operation Executed: ${intent.operation}
Result: ${JSON.stringify(result, null, 2)}

Generate a natural, helpful response for the user. Be concise and conversational.
Do NOT return JSON - return plain text response.`;

    return await this.openaiService.generateText(
      prompt,
      'You convert structured operation results into natural language responses for users.',
      { temperature: 0.7, maxTokens: 300 }
    );
  }

  /**
   * Format error response
   */
  private async formatErrorResponse(error: Error, query: string): Promise<string> {
    const config = this.getAgentConfig();

    if (!this.openaiService) {
      return `I encountered an error: ${error.message}`;
    }

    const prompt = `You are a ${config.name} that encountered an error.

User Query: "${query}"
Error: ${error.message}

Generate a helpful, apologetic response explaining what went wrong and suggesting what the user can try.
Be concise and user-friendly.`;

    try {
      return await this.openaiService.generateText(
        prompt,
        'You explain errors to users in a helpful way.',
        { temperature: 0.5, maxTokens: 200 }
      );
    } catch {
      return `I'm sorry, I encountered an error: ${error.message}`;
    }
  }

  /**
   * Initialize services
   */
  private async ensureServices(): Promise<void> {
    if (this.isInitialized) return;

    const config = this.getAgentConfig();

    // Initialize OpenAI service (required for all agents)
    this.openaiService = (serviceManager.getService('openaiService') as OpenAIService) || null;

    // Initialize draft manager (required for all agents)
    this.draftManager = (serviceManager.getService('draftManager') as DraftManager) || null;

    // Initialize agent-specific services
    for (const serviceName of config.services) {
      const service = serviceManager.getService(serviceName);
      if (service) {
        this.services.set(serviceName, service);
      } else {
        throw new Error(`Required service ${serviceName} not available for ${config.name}`);
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

    this.isInitialized = true;
  }

  /**
   * Get a service (for use in executeOperation)
   */
  protected getService<T = any>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not available`);
    }
    return service as T;
  }

  // ============================================================================
  // STATIC METHODS - Auto-generated for MasterAgent Discovery
  // ============================================================================

  /**
   * Get OpenAI function schema (auto-generated from config)
   */
  static getOpenAIFunctionSchema(): any {
    // This will be overridden by each agent class
    // We need to instantiate to get config, but that's OK for static discovery
    const instance = new (this as any)();
    const config = instance.getAgentConfig();

    return {
      name: config.name,
      description: config.description || config.systemPrompt.split('\n')[0],
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: `Natural language request for ${config.name}. Operations: ${config.operations.join(', ')}`
          }
        },
        required: ['query']
      }
    };
  }

  /**
   * Get capabilities (auto-generated from config)
   */
  static getCapabilities(): string[] {
    const instance = new (this as any)();
    const config = instance.getAgentConfig();
    return config.capabilities || config.operations;
  }

  /**
   * Get limitations (auto-generated from config)
   */
  static getLimitations(): string[] {
    const instance = new (this as any)();
    const config = instance.getAgentConfig();
    return config.limitations || [];
  }

  /**
   * Get capability description for MasterAgent
   */
  static getCapabilityDescription(): AgentCapabilities {
    const instance = new (this as any)();
    const config = instance.getAgentConfig();

    return {
      name: config.name,
      description: config.description || config.systemPrompt,
      capabilities: config.capabilities || config.operations,
      limitations: config.limitations || [],
      examples: [], // Can be added to config if needed
      domains: []   // Can be added to config if needed
    };
  }
}