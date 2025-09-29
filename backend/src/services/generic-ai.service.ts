import { BaseService } from './base-service';
import { DomainServiceResolver } from './domain';
import { IAIDomainService } from './domain/interfaces/ai-domain.interface';
import logger from '../utils/logger';

/**
 * AI Prompt interface for structured AI requests
 */
export interface AIPrompt<TContext = any> {
  systemPrompt: string;
  userPrompt: string;
  context?: TContext;
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

/**
 * Base response interface that all AI responses must extend
 */
export interface BaseAIResponse {
  context: string; // Always present - updated context as formatted text
}

/**
 * AI Response interface with metadata
 */
export interface AIResponse<T = any> extends BaseAIResponse {
  content: string;
  parsed: T;
  metadata: {
    model: string;
    tokens: number;
    processingTime: number;
    success: boolean;
    error?: string;
  };
}

/**
 * Structured schema for OpenAI function calling
 */
export interface StructuredSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  description?: string;
}

/**
 * Default configuration constants
 */
const DEFAULT_CONFIG = {
  TEMPERATURE: 0.1,
  MAX_TOKENS: 1000,
  MODEL: 'gpt-4'
} as const;

/**
 * Generic AI Service - Centralized AI operations with structured output
 * 
 * This service provides a unified interface for all AI operations across the system:
 * - Structured output generation with schemas
 * - Automatic JSON parsing of all responses
 * - Error handling and retry logic
 * - Flow control support for dynamic workflows
 */
export class GenericAIService extends BaseService {
  private aiDomainService: IAIDomainService | null = null;
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    super('GenericAIService');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.aiDomainService = DomainServiceResolver.getAIService();
      await this.aiDomainService.initialize();
      
      this.logInfo('GenericAIService initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize GenericAIService', error);
      throw new Error('AIDomainService not available for GenericAIService');
    }
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('GenericAIService destroyed');
  }

  /**
   * Execute a prompt with structured output and automatic JSON parsing
   * 
   * @param prompt - The AI prompt with system and user instructions
   * @param schema - Required structured schema for function calling
   * @returns Promise resolving to AI response with parsed JSON
   */
  async executePrompt<T = any>(
    prompt: AIPrompt,
    schema: StructuredSchema
  ): Promise<AIResponse<T>> {
    const startTime = Date.now();
    const requestId = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logInfo('Executing AI prompt', {
      requestId,
      schemaType: schema.type,
      temperature: prompt.options?.temperature ?? this.config.TEMPERATURE
    });

    try {
      if (!this.aiDomainService) {
        throw new Error('AI domain service not available');
      }

      this.logDebug('Executing structured AI prompt', {
        requestId,
        schemaType: schema.type,
        propertiesCount: Object.keys(schema.properties).length,
        temperature: prompt.options?.temperature ?? this.config.TEMPERATURE
      });


      // Always use structured output with function calling
      const structuredResponse = await this.aiDomainService.generateStructuredData({
        prompt: prompt.userPrompt,
        schema: schema,
        systemPrompt: prompt.systemPrompt,
        temperature: prompt.options?.temperature ?? this.config.TEMPERATURE,
        maxTokens: prompt.options?.maxTokens ?? this.config.MAX_TOKENS,
        model: prompt.options?.model ?? this.config.MODEL
      });


      // Always parse as JSON
      const response = JSON.stringify(structuredResponse);
      let parsed: T;
      
      try {
        parsed = structuredResponse as T;
      } catch (parseError) {
        this.logError('Failed to parse structured response', { 
          requestId,
          error: parseError, 
          response: response.substring(0, 200) 
        });
        throw new Error('Failed to parse structured response');
      }

      const result: AIResponse<T> = {
        content: response,
        parsed,
        context: (parsed as any).context || '', // Extract context from parsed response
        metadata: {
          model: prompt.options?.model ?? this.config.MODEL,
          tokens: 0, // Would extract from OpenAI response if available
          processingTime: Date.now() - startTime,
          success: true
        }
      };

      this.logInfo('AI prompt completed successfully', {
        requestId,
        processingTime: Date.now() - startTime,
        model: result.metadata.model
      });

      return result;

    } catch (error) {
      // CENTRALIZED AI PROMPT LOGGING - Output on Error
      this.logError('AI prompt execution failed', error, {
        correlationId: requestId,
        operation: 'ai_prompt_execution_error',
        errorStack: error instanceof Error ? error.stack : undefined,
        hasAIService: !!this.aiDomainService,
        prompt: {
          systemPromptLength: prompt.systemPrompt?.length || 0,
          userPromptLength: prompt.userPrompt?.length || 0,
          model: prompt.options?.model,
          temperature: prompt.options?.temperature
        },
        metadata: {
          processingTime: Date.now() - startTime,
          success: false
        },
        schema: schema.description || 'custom schema'
      });

      this.logError('AI prompt execution failed', { 
        requestId,
        error, 
        userPrompt: prompt.userPrompt.substring(0, 100),
        schema: schema.description || 'custom schema'
      });

      return {
        content: '',
        parsed: {} as T,
        context: '', // Empty context on error
        metadata: {
          model: prompt.options?.model ?? this.config.MODEL,
          tokens: 0,
          processingTime: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }


}
