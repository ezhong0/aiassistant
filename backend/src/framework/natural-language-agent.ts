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
// Removed DraftManager dependency
import {
  AgentExecutionContext,
  AgentIntent,
  NaturalLanguageResponse,
  AgentCapabilities,
  INaturalLanguageAgent,
} from '../types/agents/natural-language.types';
import logger from '../utils/logger';
import { PromptUtils } from '../utils/prompt-utils';

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
 * Chain-of-Thought reasoning for intent analysis
 */
export interface IntentReasoning {
  /** What the user wants to accomplish */
  userGoal: string;

  /** Which operation achieves this goal */
  operationMapping: string;

  /** How parameters were extracted */
  parameterExtraction: string;

  /** Confidence assessment rationale */
  confidenceAnalysis?: string;
}

/**
 * Analyzed intent from natural language input
 */
export interface AnalyzedIntent {
  /** Chain-of-Thought reasoning process */
  reasoning: IntentReasoning;

  /** The operation to execute */
  operation: string;

  /** Parameters for the operation */
  parameters: Record<string, any>;

  /** Confidence level (0-1) */
  confidence: number;
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
  // Removed draftManager - no longer needed
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

      // Removed draft execution check - no longer needed

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

      // Removed draft creation logic - no longer needed

      // 2. Authenticate (get token from context or fetch)
      const authToken = await this.authenticate(context, config);

      // 3. Execute operation (agent-specific implementation)
      const result = await this.executeOperation(intent.operation, intent.parameters, authToken);

      // 4. Format response using LLM
      const responseText = await this.formatResponse(request, result, intent, config, context);

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
      const errorType = await this.categorizeError(error as Error);
      return {
        response: errorResponse,
        reasoning: 'Error occurred during execution',
        metadata: {
          operation: 'error',
          error: (error as Error).message,
          errorType: errorType.type,
          isAuthError: errorType.type === 'authentication',
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
   * Check if agent is enabled
   */
  isEnabled(): boolean {
    return true;
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
   * Get few-shot examples for intent analysis
   */
  private getIntentExamples(config: AgentConfig): string {
    // Default examples based on agent type
    const agentName = config.name.toLowerCase();

    if (agentName.includes('calendar')) {
      return PromptUtils.addFewShotExamples([
        {
          input: 'what\'s on my cal tomorrow',
          output: '{"operation": "list", "parameters": {"timeframe": "tomorrow"}, "confidence": 0.9, "reasoning": "User wants to see tomorrow\'s events"}'
        },
        {
          input: 'schedule meeting with john at 2pm',
          output: '{"operation": "create", "parameters": {"summary": "Meeting with John", "startTime": "2pm"}, "confidence": 0.85, "reasoning": "User wants to create an event"}'
        }
      ]);
    }

    if (agentName.includes('email')) {
      return PromptUtils.addFewShotExamples([
        {
          input: 'send email to john about meeting',
          output: '{"operation": "send", "parameters": {"to": "john", "subject": "meeting"}, "confidence": 0.9, "reasoning": "User wants to compose and send email"}'
        },
        {
          input: 'find emails from sarah',
          output: '{"operation": "search", "parameters": {"from": "sarah"}, "confidence": 0.95, "reasoning": "User wants to search for emails"}'
        }
      ]);
    }

    return ''; // No examples for other agents
  }

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

    const contextBlock = PromptUtils.buildContextBlock(context);

    // Add few-shot examples for better edge case handling
    const examples = this.getIntentExamples(config);

    const prompt = `${contextBlock}

You are a ${config.name} that understands user requests.

System Context: ${config.systemPrompt}

Available Operations: ${config.operations.join(', ')}
${examples}${PromptUtils.getConversationContext(context)}
User Query: "${query}"

ANALYZE INTENT STEP-BY-STEP (Chain-of-Thought):

Step 1 - User Goal:
[What does the user want to accomplish? State in simple terms]

Step 2 - Operation Mapping:
[Which operation achieves this goal? Why this operation?]

Step 3 - Parameter Extraction:
[What parameters are needed? Extract from query and context]
[Consider timezone for dates/times: ${context.timezone || 'not specified'}]

Step 4 - Confidence Assessment:
[How certain is this interpretation? Any ambiguities?]

THEN return JSON:
{
  "reasoning": {
    "userGoal": "User wants to...",
    "operationMapping": "Goal X maps to operation Y because...",
    "parameterExtraction": "Found param1=value1 from...",
    "confidenceAnalysis": "High confidence because..."
  },
  "operation": "operation_name",
  "parameters": { "param1": "value1", ... },
  "confidence": 0.95
}`;

    const response = await this.openaiService.generateText(
      prompt,
      'You analyze user requests and extract structured intent. Return only valid JSON.',
      { temperature: 0.2, maxTokens: 600 } // Increased for CoT reasoning
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

  // Removed draft creation logic - no longer needed

  // Removed draft creation method - no longer needed

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
      reasoning: {
        userGoal: 'Execute confirmed draft',
        operationMapping: 'Draft execution maps to stored operation',
        parameterExtraction: 'Parameters retrieved from confirmed draft'
      }
    }, config, context);

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

  // Removed draft execution request check - no longer needed

  /**
   * Authenticate and get token
   */
  private async authenticate(
    context: AgentExecutionContext,
    config: AgentConfig
  ): Promise<any> {
    // Return accessToken from context based on auth type
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
    config: AgentConfig,
    context?: AgentExecutionContext
  ): Promise<string> {
    if (!this.openaiService) {
      // Fallback: simple formatting
      return `Operation ${intent.operation} completed: ${JSON.stringify(result)}`;
    }

    const contextBlock = context ? PromptUtils.buildContextBlock(context, {
      includeTemporal: true,
      includeConversation: false,
      includePreferences: true
    }) : '';

    const prompt = `${contextBlock}

You are a ${config.name} responding to a user query.

System Context: ${config.systemPrompt}

User Query: "${query}"

Operation Executed: ${intent.operation}
Result: ${JSON.stringify(result, null, 2)}

Generate a natural, helpful response for the user. Be concise and conversational.
${context?.userPreferences ? 'Adapt your response style to match user preferences above.' : ''}
Do NOT return JSON - return plain text response.`;

    const response = await this.openaiService.generateText(
      prompt,
      'You convert structured operation results into natural language responses for users.',
      { temperature: 0.7, maxTokens: 1200 }
    );

    // Log truncation detection
    if (response.length >= 1100) { // Close to token limit
      logger.warn('Response may be truncated due to token limit', {
        responseLength: response.length,
        maxTokens: 1200,
        agent: config.name,
        operation: intent.operation,
        correlationId: context?.correlationId
      });
    }

    return response;
  }

  /**
   * Format error response - generates natural language explanation from LLM
   */
  private async formatErrorResponse(error: Error, query: string, context?: AgentExecutionContext): Promise<string> {
    const config = this.getAgentConfig();

    if (!this.openaiService) {
      return `I encountered an error: ${error.message}`;
    }

    const errorContext = await this.categorizeError(error);

    const authGuidance = errorContext.type === 'authentication'
      ? '\n\nIMPORTANT: For authentication errors, recommend using the /auth command to manage connections. Example: "You can use the /auth command to reconnect your account."'
      : '';

    const prompt = `You are a ${config.name} that encountered an error.

User tried: "${query}"
Error type: ${errorContext.type}
Error message: ${error.message}

Generate a helpful error message that:
1. Explains WHAT went wrong (in simple terms)
2. Explains WHY it happened (if possible)
3. Suggests WHAT TO DO next (specific actionable steps)
4. Offers alternative approaches if applicable${authGuidance}

Be empathetic, clear, and actionable. Avoid technical jargon.

Examples:
- Auth error: "It looks like I don't have permission to access your Gmail. You can use the /auth command to reconnect your Google account."
- Not found: "I couldn't find that event. Try searching with different keywords or check the date range."
- Network error: "I'm having trouble connecting right now. Please try again in a moment."`;

    try {
      return await this.openaiService.generateText(
        prompt,
        'You explain errors to users in a helpful, actionable way.',
        { temperature: 0.5, maxTokens: 250 }
      );
    } catch {
      return `I'm sorry, I encountered an error: ${error.message}`;
    }
  }

  /**
   * Categorize error using AI for better messaging
   */
  private async categorizeError(error: Error): Promise<{ type: string; severity: string }> {
    if (!this.openaiService) {
      return { type: 'unknown', severity: 'medium' };
    }

    try {
      const prompt = `Categorize this error:

Error message: "${error.message}"
Error type: ${error.name}
Stack trace hint: ${error.stack?.split('\n')[0] || 'N/A'}

Return JSON:
{
  "type": "authentication" | "not_found" | "network" | "validation" | "rate_limit" | "unknown",
  "severity": "low" | "medium" | "high"
}

Type guidelines:
- authentication: auth, permission, unauthorized, token issues
- not_found: 404, resource not found, missing data
- network: connection, timeout, offline issues
- validation: invalid input, bad format
- rate_limit: quota exceeded, too many requests
- unknown: anything else`;

      const response = await this.openaiService.generateText(
        prompt,
        'Categorize error for user-friendly messaging',
        { temperature: 0.1, maxTokens: 50 }
      );

      const categorization = JSON.parse(response);
      return {
        type: categorization.type || 'unknown',
        severity: categorization.severity || 'medium'
      };
    } catch {
      return { type: 'unknown', severity: 'medium' };
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

    // Removed draft manager initialization

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