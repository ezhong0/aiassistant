/**
 * BaseSubAgent - Abstract base class for all SubAgents
 * 
 * This class implements the Generic SubAgent design pattern with:
 * - 3-phase workflow (Intent Assessment, Tool Execution, Response Formatting)
 * - Single textbox context management
 * - Direct tool execution through domain services
 * - Natural language interface
 */

import { GenericAIService, AIPrompt, StructuredSchema } from '../services/generic-ai.service';
import { DomainServiceResolver } from '../services/domain/dependency-injection/domain-service-container';
import { IDomainService } from '../services/domain/interfaces/domain-service.interfaces';
import logger from '../utils/logger';

/**
 * SubAgent Response interface - matches MasterAgent response format
 */
export interface SubAgentResponse {
  success: boolean;
  message: string;        // Human-readable summary
  metadata: any;          // Tool execution results (not "data")
}

/**
 * Agent Execution Context for SubAgents
 */
export interface AgentExecutionContext {
  sessionId: string;
  userId?: string;
  accessToken?: string;
  slackContext?: any;
  correlationId?: string;
  timestamp: Date;
}

/**
 * Agent Capabilities interface for discovery
 */
export interface AgentCapabilities {
  name: string;
  description: string;
  operations: string[];
  requiresAuth: boolean;
  requiresConfirmation: boolean;
  isCritical: boolean;
  examples?: string[];
}

/**
 * Agent Configuration interface
 */
export interface AgentConfig {
  name: string;
  description: string;
  enabled: boolean;
  timeout: number;
  retryCount: number;
}

/**
 * Simple Context Format (like MasterAgent)
 * Single textbox with structured fields
 */
export interface SimpleContext {
  request: string;    // What master agent asked for
  tools: string;      // Tools needed to fulfill request
  params: string;     // Parameters for tool calls
  status: 'Planning' | 'Executing' | 'Complete' | 'Failed';
  result: string;     // Data collected from tool calls
  notes: string;      // Brief execution context
}

/**
 * Intent Assessment Response Schema
 */
const INTENT_ASSESSMENT_SCHEMA: StructuredSchema = {
  type: 'object',
  properties: {
    context: {
      type: 'string',
      description: 'Updated context in SimpleContext format'
    },
    toolsNeeded: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of tools needed to fulfill the request'
    },
    executionPlan: {
      type: 'string',
      description: 'Brief plan for tool execution'
    }
  },
  required: ['context', 'toolsNeeded', 'executionPlan'],
  description: 'Intent assessment and planning response'
};

/**
 * Tool Execution Response Schema
 */
const TOOL_EXECUTION_SCHEMA: StructuredSchema = {
  type: 'object',
  properties: {
    context: {
      type: 'string',
      description: 'Updated context in SimpleContext format'
    },
    toolCalls: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          toolName: { type: 'string' },
          params: { type: 'object' },
          result: { type: 'object' }
        }
      },
      description: 'Tool calls made and their results'
    },
    needsMoreWork: {
      type: 'boolean',
      description: 'Whether more tool execution is needed'
    },
    nextSteps: {
      type: 'string',
      description: 'What to do next if more work is needed'
    }
  },
  required: ['context', 'toolCalls', 'needsMoreWork'],
  description: 'Tool execution results and next steps'
};

/**
 * Response Formatting Schema
 */
const RESPONSE_FORMATTING_SCHEMA: StructuredSchema = {
  type: 'object',
  properties: {
    context: {
      type: 'string',
      description: 'Final context in SimpleContext format'
    },
    success: {
      type: 'boolean',
      description: 'Whether the operation was successful'
    },
    message: {
      type: 'string',
      description: 'Human-readable summary of what was accomplished'
    },
    metadata: {
      type: 'object',
      description: 'Structured metadata with tool execution results'
    }
  },
  required: ['context', 'success', 'message', 'metadata'],
  description: 'Final formatted response'
};

/**
 * Abstract BaseSubAgent class
 */
export abstract class BaseSubAgent {
  protected aiService: GenericAIService;
  protected domain: string;
  protected config: AgentConfig;

  constructor(domain: string, config: Partial<AgentConfig> = {}) {
    this.domain = domain;
    this.aiService = new GenericAIService();
    this.config = {
      name: `${domain}SubAgent`,
      description: `SubAgent for ${domain} operations`,
      enabled: true,
      timeout: 30000,
      retryCount: 3,
      ...config
    };
  }

  /**
   * Main entry point - mirrors MasterAgent.processUserInput
   */
  async processNaturalLanguageRequest(
    request: string, 
    context: AgentExecutionContext
  ): Promise<SubAgentResponse> {
    const correlationId = context.correlationId || `${this.domain}-${Date.now()}`;
    
    try {
      logger.info(`${this.domain} SubAgent processing request`, {
        correlationId,
        operation: 'process_natural_language_request',
        domain: this.domain,
        requestLength: request.length
      });

      // Initialize AI service if needed
      if (!this.aiService.initialized) {
        await this.aiService.initialize();
      }

      // Phase 1: Intent Assessment & Planning
      let workflowContext = await this.assessIntent(request, context);
      
      // Phase 2: Direct Tool Execution (Max 3 iterations)
      workflowContext = await this.executeTools(workflowContext, context);
      
      // Phase 3: Response Formatting
      const response = await this.formatResponse(workflowContext, context);

      logger.info(`${this.domain} SubAgent completed successfully`, {
        correlationId,
        operation: 'process_natural_language_request_success',
        domain: this.domain,
        success: response.success
      });

      return response;

    } catch (error) {
      logger.error(`${this.domain} SubAgent processing failed`, error as Error, {
        correlationId,
        operation: 'process_natural_language_request_error',
        domain: this.domain
      });

      return {
        success: false,
        message: `${this.domain} operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          domain: this.domain,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Phase 1: Intent Assessment & Planning
   */
  protected async assessIntent(request: string, context: AgentExecutionContext): Promise<string> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = `
Analyze this request and create an execution plan:

REQUEST: ${request}
USER_ID: ${context.userId || 'unknown'}

Create a SimpleContext with:
- REQUEST: The original request
- TOOLS: List of tools needed (comma-separated)
- PARAMS: Basic parameters needed
- STATUS: Planning
- RESULT: (empty for now)
- NOTES: Brief context about what needs to be done

Available tools: ${this.getAvailableTools().join(', ')}
    `;

    const prompt: AIPrompt = {
      systemPrompt,
      userPrompt,
      options: { temperature: 0.1, maxTokens: 500 }
    };

    const response = await this.aiService.executePrompt(prompt, INTENT_ASSESSMENT_SCHEMA);
    return response.parsed.context;
  }

  /**
   * Phase 2: Direct Tool Execution (Max 3 iterations)
   */
  protected async executeTools(workflowContext: string, context: AgentExecutionContext): Promise<string> {
    let currentContext = workflowContext;
    let iteration = 0;
    const maxIterations = 3;

    while (iteration < maxIterations) {
      iteration++;

      const systemPrompt = this.getSystemPrompt();
      const userPrompt = `
Execute tools based on the current context:

CURRENT_CONTEXT:
${currentContext}

USER_ID: ${context.userId || 'unknown'}

Execute the needed tools and update the context. Set needsMoreWork to true if you need another iteration.
Available tools: ${this.getAvailableTools().join(', ')}

Tool execution iteration: ${iteration}/${maxIterations}
      `;

      const prompt: AIPrompt = {
        systemPrompt,
        userPrompt,
        options: { temperature: 0.1, maxTokens: 1000 }
      };

      const response = await this.aiService.executePrompt(prompt, TOOL_EXECUTION_SCHEMA);
      
      // Execute the actual tool calls
      for (const toolCall of response.parsed.toolCalls) {
        try {
          const result = await this.executeToolCall(
            toolCall.toolName, 
            { ...toolCall.params, userId: context.userId }
          );
          toolCall.result = result;
        } catch (error) {
          toolCall.result = {
            error: error instanceof Error ? error.message : 'Tool execution failed'
          };
        }
      }

      currentContext = response.parsed.context;

      // Check if we need more iterations
      if (!response.parsed.needsMoreWork) {
        break;
      }
    }

    return currentContext;
  }

  /**
   * Phase 3: Response Formatting
   */
  protected async formatResponse(workflowContext: string, context: AgentExecutionContext): Promise<SubAgentResponse> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = `
Format the final response based on the completed workflow:

FINAL_CONTEXT:
${workflowContext}

Create a natural language summary and structured metadata.
Focus on what was accomplished and any important results.
    `;

    const prompt: AIPrompt = {
      systemPrompt,
      userPrompt,
      options: { temperature: 0.1, maxTokens: 500 }
    };

    const response = await this.aiService.executePrompt(prompt, RESPONSE_FORMATTING_SCHEMA);
    
    return {
      success: response.parsed.success,
      message: response.parsed.message,
      metadata: response.parsed.metadata
    };
  }

  /**
   * Get available tools for this domain
   */
  protected getAvailableTools(): string[] {
    return Object.keys(this.getToolToServiceMap());
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by domain-specific SubAgents
  // ============================================================================

  /**
   * Get domain-specific system prompt
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Execute a tool call by mapping to domain service method
   */
  protected abstract executeToolCall(toolName: string, params: any): Promise<any>;

  /**
   * Get tool-to-service method mapping
   */
  protected abstract getToolToServiceMap(): Record<string, string>;

  /**
   * Get the domain service instance
   */
  protected abstract getService(): IDomainService;

  // ============================================================================
  // AGENT FACTORY INTERFACE METHODS
  // ============================================================================

  /**
   * Check if agent is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get agent capabilities description
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: this.config.name,
      description: this.config.description,
      operations: this.getAvailableTools(),
      requiresAuth: true,
      requiresConfirmation: false,
      isCritical: false,
      examples: []
    };
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get agent timeout
   */
  getTimeout(): number {
    return this.config.timeout;
  }

  /**
   * Get retry count
   */
  getRetries(): number {
    return this.config.retryCount;
  }

  /**
   * Get agent health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    return {
      healthy: this.config.enabled,
      details: {
        domain: this.domain,
        enabled: this.config.enabled,
        availableTools: this.getAvailableTools().length
      }
    };
  }

  /**
   * Helper method to format SimpleContext
   */
  protected formatSimpleContext(context: Partial<SimpleContext>): string {
    const ctx: SimpleContext = {
      request: context.request || '',
      tools: context.tools || '',
      params: context.params || '',
      status: context.status || 'Planning',
      result: context.result || '',
      notes: context.notes || ''
    };

    return `REQUEST: ${ctx.request}
TOOLS: ${ctx.tools}
PARAMS: ${ctx.params}
STATUS: ${ctx.status}
RESULT: ${ctx.result}
NOTES: ${ctx.notes}`;
  }

  /**
   * Helper method to parse SimpleContext
   */
  protected parseSimpleContext(contextString: string): SimpleContext {
    const lines = contextString.split('\n');
    const context: Partial<SimpleContext> = {};

    for (const line of lines) {
      const [key, ...valueParts] = line.split(': ');
      const value = valueParts.join(': ').trim();
      
      if (!key) continue;
      
      switch (key.trim()) {
        case 'REQUEST':
          context.request = value;
          break;
        case 'TOOLS':
          context.tools = value;
          break;
        case 'PARAMS':
          context.params = value;
          break;
        case 'STATUS':
          context.status = value as SimpleContext['status'];
          break;
        case 'RESULT':
          context.result = value;
          break;
        case 'NOTES':
          context.notes = value;
          break;
      }
    }

    return {
      request: context.request || '',
      tools: context.tools || '',
      params: context.params || '',
      status: context.status || 'Planning',
      result: context.result || '',
      notes: context.notes || ''
    };
  }
}
