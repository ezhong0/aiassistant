import OpenAI from 'openai';
import { ToolCall, ToolExecutionContext } from '../types/tools';
import { aiConfigService } from '../config/ai-config';
import { BaseService } from './base-service';
import { z } from 'zod';

/**
 * Configuration interface for OpenAI service initialization
 */
export interface OpenAIConfig {
  /** OpenAI API key for authentication */
  apiKey: string;
  /** Optional model override (defaults to AI config or gpt-4o-mini) */
  model?: string;
}


/**
 * OpenAI Service - Handles all AI-powered operations
 * 
 * This service provides a centralized interface for OpenAI API interactions,
 * including structured data generation and conversation management.
 * 
 * Features:
 * - Rate limiting and concurrent request management
 * - Structured data extraction with Zod validation
 * - Comprehensive error handling and logging
 * - Memory usage monitoring
 * - Model configuration management
 */
export class OpenAIService extends BaseService {
  private client: OpenAI;
  private model: string;
  private apiKey: string;
  private activeRequests: number = 0;
  private readonly maxConcurrentRequests: number = 3;

  /**
   * Initialize OpenAI service with configuration
   * 
   * @param config - OpenAI configuration including API key and optional model
   * 
   * @example
   * ```typescript
   * const openaiService = new OpenAIService({
   *   apiKey: process.env.OPENAI_API_KEY,
   *   model: 'gpt-4o-mini'
   * });
   * ```
   */
  constructor(config: OpenAIConfig) {
    super('OpenAIService');
    
    this.apiKey = config.apiKey;
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    
    // Use AI configuration for default model
    try {
      const aiOpenAIConfig = aiConfigService.getOpenAIConfig('routing');
      this.model = config.model || aiOpenAIConfig.model;
      this.logInfo(`OpenAI service initialized with model: ${this.model} (from AI config)`);
    } catch (error) {
      throw new Error(`Failed to initialize OpenAI service: AI configuration unavailable. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    // OpenAI client is already initialized in constructor
    this.logInfo('OpenAI service initialized successfully');
  }

  /**
   * Override isReady to include API key validation
   */
  public isReady(): boolean {
    const baseReady = super.isReady();
    const hasValidApiKey = this.hasValidApiKey();
    
    if (baseReady && !hasValidApiKey) {
      this.logWarn('OpenAI service base ready but API key is invalid');
    }
    
    return baseReady && hasValidApiKey;
  }

  /**
   * Check if the API key is valid (not dummy or empty)
   */
  private hasValidApiKey(): boolean {
    return !!(this.apiKey && 
             this.apiKey.length > 10 && 
             this.apiKey !== 'dummy-key' &&
             this.apiKey.startsWith('sk-'));
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('OpenAI service destroyed');
  }


  /**
   * Generate a simple text response
   */
  async generateText(
    userInput: string, 
    systemPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    this.assertReady();
    
    // Check concurrent request limit
    if (this.activeRequests >= this.maxConcurrentRequests) {
      throw new Error(`Too many concurrent OpenAI requests (${this.activeRequests}/${this.maxConcurrentRequests}). Please try again in a moment.`);
    }
    
    this.activeRequests++;
    
    try {
      this.logDebug('Generating text response', { 
        userInputLength: userInput.length,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 500
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: Math.min(options.maxTokens || 500, 1500) // Increased limit for better responses
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Memory monitoring
      const responseSize = JSON.stringify(response).length;
      if (responseSize > 50000) { // 50KB warning threshold
        this.logWarn('Large OpenAI text response detected', { 
          responseSizeBytes: responseSize,
          contentLength: content.length
        });
      }

      this.logDebug('Text response generated successfully', { 
        responseLength: content.length,
        responseSizeBytes: responseSize
      });

      return content;
    } catch (error) {
      this.handleError(error, 'generateText');
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Generate structured data using OpenAI function calling with Zod schema validation
   * 
   * This method uses OpenAI's function calling to extract structured data from
   * user input according to a provided schema. It's ideal for parsing user requests
   * into structured formats for further processing.
   * 
   * @param userInput - Natural language input to parse
   * @param systemPrompt - System prompt with parsing instructions
   * @param schema - Zod schema defining the expected data structure
   * @param options - Optional configuration for temperature and token limits
   * @returns Promise resolving to parsed and validated data of type T
   * 
   * @example
   * ```typescript
   * const schema = z.object({
   *   operation: z.string(),
   *   parameters: z.record(z.any())
   * });
   * 
   * const result = await openaiService.generateStructuredData(
   *   "Send email to john@example.com about meeting",
   *   "Parse user requests into structured format",
   *   schema,
   *   { temperature: 0.1 }
   * );
   * 
   * // result.operation contains "send_email"
   * // result.parameters contains { to: "john@example.com", subject: "meeting" }
   * ```
   * 
   * @throws {Error} When service is not ready or API key is invalid
   * @throws {Error} When concurrent request limit is exceeded
   * @throws {Error} When OpenAI API call fails or returns invalid data
   */
  async generateStructuredData<T extends object>(
    userInput: string,
    systemPrompt: string,
    schema: z.ZodSchema<T> | any, // Accept both Zod schemas and plain objects
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<T> {
    this.assertReady();
    
    // Check concurrent request limit
    if (this.activeRequests >= this.maxConcurrentRequests) {
      throw new Error(`Too many concurrent OpenAI requests (${this.activeRequests}/${this.maxConcurrentRequests}). Please try again in a moment.`);
    }
    
    this.activeRequests++;
    
    try {
      this.logDebug('Generating structured data', { 
        userInputLength: userInput.length,
        schemaType: typeof schema,
        temperature: options.temperature || 0.1
      });

      // Convert schema to OpenAI function parameters
      let openAISchema: any;
      if (schema._def) {
        // It's a Zod schema
        openAISchema = this.convertZodToOpenAISchema(schema._def);
      } else if (schema.type === 'object' && schema.properties) {
        // It's already a plain object schema
        openAISchema = schema;
      } else {
        // Fallback for unknown schema format
        this.logWarn('Unknown schema format, treating as plain object', { schema });
        openAISchema = schema;
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_data',
            description: 'Extract structured data from user input',
            parameters: openAISchema
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_data' } },
        temperature: options.temperature || 0.1,
        max_tokens: Math.min(options.maxTokens || 1000, 1500) // Increased limit for better responses
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('No tool call in OpenAI response');
      }

      const extractedData = JSON.parse((toolCall as any).function?.arguments || '{}');
      
      // Validate the extracted data - handle both Zod schemas and plain objects
      let validatedData: T;
      if (schema && typeof schema.parse === 'function') {
        // It's a Zod schema
        validatedData = schema.parse(extractedData);
      } else {
        // It's a plain object schema - just return the extracted data
        validatedData = extractedData as T;
      }
      
      this.logDebug('Structured data generated successfully', { 
        dataKeys: Object.keys(validatedData)
      });

      return validatedData;
    } catch (error) {
      this.handleError(error, 'generateStructuredData');
    } finally {
      this.activeRequests--;
    }
  }


  /**
   * Update the model being used
   */
  updateModel(newModel: string): void {
    this.assertReady();
    
    this.model = newModel;
    this.logInfo('OpenAI model updated', { newModel });
  }

  /**
   * Get current model configuration
   */
  getModelConfig(): { model: string; availableModels: string[] } {
    return {
      model: this.model,
      availableModels: ['gpt-4', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
    };
  }

  /**
   * Create a chat completion (for backward compatibility)
   */
  async createChatCompletion(
    messages: Array<{ role: string; content: string }>,
    maxTokens?: number
  ): Promise<{ content: string }> {
    this.assertReady();
    
    try {
      this.logDebug('Creating chat completion', { 
        messageCount: messages.length,
        maxTokens: maxTokens || 500
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
        temperature: 0.7,
        max_tokens: Math.min(maxTokens || 500, 1500) // Increased limit for better responses
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      this.logDebug('Chat completion created successfully', { 
        responseLength: content.length 
      });

      return { content };
    } catch (error) {
      this.handleError(error, 'createChatCompletion');
    }
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: any, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logError(`OpenAI ${operation} failed`, error, { operation });
    throw new Error(`OpenAI ${operation} failed: ${errorMessage}`);
  }

  /**
   * Get service configuration
   */
  getConfig(): OpenAIConfig {
    return {
      apiKey: '***', // Don't expose API key
      model: this.model
    };
  }

  /**
   * Test OpenAI connection
   */
  async testConnection(): Promise<boolean> {
    this.assertReady();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });
      
      return !!response.choices[0]?.message?.content;
    } catch (error) {
      this.logError('OpenAI connection test failed', error);
      return false;
    }
  }

  /**
   * Convert Zod schema definition to OpenAI function parameters format
   * 
   * This helper method converts Zod schema definitions to the format
   * expected by OpenAI's function calling API.
   * 
   * @param zodDef - Zod schema definition object
   * @returns OpenAI-compatible schema object
   * 
   * @private
   */
  private convertZodToOpenAISchema(zodDef: any): any {
    // Handle both Zod schemas and plain objects
    if (!zodDef) {
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }

    // If it's already a plain object schema, return it
    if (zodDef.type === 'object' && zodDef.properties) {
      return zodDef;
    }

    // If it's a Zod schema, extract the shape
    const shape = zodDef.shape || zodDef._def?.shape;
    if (!shape) {
      this.logWarn('Could not extract shape from Zod schema, using empty schema', { zodDef });
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }

    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Convert Zod object schema to OpenAI schema
    for (const [key, value] of Object.entries(shape)) {
      const fieldDef = value as any;
      
      // Determine field type
      let fieldType = 'string';
      if (fieldDef._def) {
        switch (fieldDef._def.typeName) {
          case 'ZodString':
            fieldType = 'string';
            break;
          case 'ZodNumber':
            fieldType = 'number';
            break;
          case 'ZodBoolean':
            fieldType = 'boolean';
            break;
          case 'ZodArray':
            fieldType = 'array';
            break;
          case 'ZodEnum':
            fieldType = 'string';
            break;
          default:
            fieldType = 'string';
        }
      }

      properties[key] = {
        type: fieldType,
        description: fieldDef.description || `Field: ${key}`
      };

      // Add enum values if it's an enum
      if (fieldDef._def && fieldDef._def.typeName === 'ZodEnum') {
        properties[key].enum = fieldDef._def.values;
      }

      // Check if field is required (Zod schemas are required by default unless marked optional)
      const isOptional = fieldDef._def?.typeName === 'ZodOptional' || 
                        fieldDef._def?.typeName === 'ZodNullable' ||
                        fieldDef.isOptional?.() === true;
      
      if (!isOptional) {
        required.push(key);
      }
    }

    this.logDebug('Converted Zod schema to OpenAI schema', {
      propertiesCount: Object.keys(properties).length,
      requiredCount: required.length,
      properties: Object.keys(properties),
      required
    });

    return {
      type: 'object',
      properties,
      required
    };
  }
}