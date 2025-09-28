import { BaseService } from './base-service';
import { serviceManager } from './service-manager';
import { OpenAIService } from './openai.service';
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
  private openaiService: OpenAIService | null = null;
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    super('GenericAIService');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.openaiService = serviceManager.getService<OpenAIService>('openaiService') || null;
    
    if (!this.openaiService) {
      throw new Error('OpenAIService not available for GenericAIService');
    }

    this.logInfo('GenericAIService initialized successfully');
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

    try {
      if (!this.openaiService) {
        throw new Error('OpenAI service not available');
      }

      this.logDebug('Executing structured AI prompt', {
        schemaType: schema.type,
        propertiesCount: Object.keys(schema.properties).length,
        temperature: prompt.options?.temperature ?? this.config.TEMPERATURE
      });

      // Always use structured output with function calling
      const structuredResponse = await this.openaiService.generateStructuredData(
        prompt.userPrompt,
        prompt.systemPrompt,
        schema,
        {
          temperature: prompt.options?.temperature ?? this.config.TEMPERATURE,
          maxTokens: prompt.options?.maxTokens ?? this.config.MAX_TOKENS
        }
      );

      // Always parse as JSON
      const response = JSON.stringify(structuredResponse);
      let parsed: T;
      
      try {
        parsed = structuredResponse as T;
      } catch (parseError) {
        this.logError('Failed to parse structured response', { 
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

      this.logInfo('AI prompt executed successfully', {
        processingTime: result.metadata.processingTime,
        success: result.metadata.success,
        schema: schema.description || 'custom schema'
      });

      return result;

    } catch (error) {
      this.logError('AI prompt execution failed', { 
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
