import { ErrorFactory, ERROR_CATEGORIES } from '../../errors';
import { BaseService } from '../base-service';
import { OpenAIClient } from '../api/clients/openai-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError } from '../../errors';
import { ValidationHelper, AIValidationSchemas } from '../../validation/api-client.validation';
import { IAIDomainService, StructuredDataParams } from './interfaces/ai-domain.interface';

/**
 * AI Prompt interface for structured AI requests (from GenericAIService)
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
 * AI Response interface with metadata (from GenericAIService)
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
 * AI Domain Service - High-level AI operations using standardized API client
 *
 * This service provides domain-specific AI operations that wrap the OpenAI API.
 * It handles text generation, completions, embeddings, and image generation
 * with a clean interface that's easy to use from agents and other services.
 *
 * Features:
 * - Chat completions with GPT models
 * - Text completions and generation
 * - Embeddings for semantic search
 * - Image generation with DALL-E
 * - Audio transcription and translation
 * - API key authentication
 *
 * Dependencies are now injected via constructor for better testability and explicit dependency management.
 */
export class AIDomainService extends BaseService implements Partial<IAIDomainService> {
  /**
   * Constructor with OpenAI client injection
   */
  constructor(private readonly openAIClient: OpenAIClient) {
    super('AIDomainService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing AI Domain Service');

      // Authenticate with OpenAI API key
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw ErrorFactory.domain.serviceError('AIDomainService', 'OPENAI_API_KEY environment variable is required for AI operations');
      }

      this.logInfo('Authenticating with OpenAI API', {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey.length
      });

      // Authenticate directly without assertReady check during initialization
      if (!this.openAIClient) {
        throw ErrorFactory.domain.serviceUnavailable('openai-client', {
        service: 'AIDomainService',
        operation: 'ai-operation'
      });
      }

      const credentials = {
        type: 'api_key' as const,
        apiKey
      };

      await this.openAIClient.authenticate(credentials);
      this.logInfo('AI service authenticated successfully');

      this.logInfo('AI Domain Service initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize AI Domain Service', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('AI Domain Service destroyed');
    } catch (error) {
      this.logError('Error destroying AI Domain Service', error);
    }
  }

  /**
   * Authenticate with OpenAI API
   */
  async authenticate(apiKey: string): Promise<void> {
    this.assertReady();
    
    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceError('AIDomainService', 'OpenAI client not available');
    }

    try {
      const credentials: AuthCredentials = {
        type: 'api_key',
        apiKey
      };

      await this.openAIClient.authenticate(credentials);
      this.logInfo('AI service authenticated successfully');
    } catch (error) {
      throw ErrorFactory.util.wrapError(error instanceof Error ? error : new Error(String(error)), ERROR_CATEGORIES.SERVICE, {
        service: 'AIDomainService',
        metadata: { endpoint: 'authenticate' }
      });
    }
  }

  /**
   * Generate chat completion
   */
  async generateChatCompletion(params: {
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'function';
      content: string;
      name?: string;
      functionCall?: {
        name: string;
        arguments: string;
      };
    }>;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    model?: string;
    functions?: Array<{
      name: string;
      description: string;
      parameters: any;
    }>;
    functionCall?: 'none' | 'auto' | { name: string };
    stream?: boolean;
  }): Promise<{
    message: {
      role: 'system' | 'user' | 'assistant' | 'function';
      content: string;
      name?: string;
      functionCall?: {
        name: string;
        arguments: string;
      };
    };
    metadata: {
      model: string;
      tokensUsed?: {
        prompt: number;
        completion: number;
        total: number;
      };
      executionTime: number;
      finishReason?: 'stop' | 'length' | 'function_call' | 'content_filter';
      requestId?: string;
      cached?: boolean;
    };
  }> {
    this.assertReady();

    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceError('AIDomainService', 'OpenAI client not available');
    }

    try {
      const startTime = Date.now();

      // Validate input parameters - use a more flexible validation
      const validatedParams = {
        ...params,
        model: params.model || 'gpt-5-nano',
        temperature: params.temperature || 0.7,
        maxTokens: params.maxTokens,
        topP: params.topP,
        frequencyPenalty: params.frequencyPenalty,
        presencePenalty: params.presencePenalty,
        stop: params.stop,
        functions: params.functions,
        functionCall: params.functionCall,
        stream: params.stream
      };

      this.logInfo('Generating chat completion', {
        messageCount: validatedParams.messages.length,
        model: validatedParams.model || 'gpt-5-mini',
        temperature: validatedParams.temperature || 0.7
      });

      const response = await this.openAIClient.makeRequest({
        method: 'POST',
        endpoint: '/chat/completions',
        data: {
          model: validatedParams.model || 'gpt-5-nano',
          messages: validatedParams.messages,
          temperature: validatedParams.temperature || 0.7,
          max_tokens: validatedParams.maxTokens,
          top_p: validatedParams.topP,
          frequency_penalty: validatedParams.frequencyPenalty,
          presence_penalty: validatedParams.presencePenalty,
          stop: validatedParams.stop,
          functions: validatedParams.functions,
          function_call: validatedParams.functionCall,
          stream: validatedParams.stream
        }
      });

      const result = {
        message: {
          role: response.data.choices[0]?.message?.role || 'assistant',
          content: response.data.choices[0]?.message?.content || '',
          name: response.data.choices[0]?.message?.name,
          functionCall: response.data.choices[0]?.message?.function_call
        },
        metadata: {
          model: response.data.model,
          tokensUsed: {
            prompt: response.data.usage?.prompt_tokens || 0,
            completion: response.data.usage?.completion_tokens || 0,
            total: response.data.usage?.total_tokens || 0
          },
          executionTime: Date.now() - startTime,
          finishReason: response.data.choices[0]?.finish_reason,
          requestId: response.data.id,
          cached: false
        }
      };

      this.logInfo('Chat completion generated successfully', {
        model: result.metadata.model,
        totalTokens: result.metadata.tokensUsed?.total || 0
      });

      return result;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }
      throw ErrorFactory.util.wrapError(error instanceof Error ? error : new Error(String(error)), ERROR_CATEGORIES.SERVICE, {
        service: 'AIDomainService',
        metadata: { endpoint: 'generateChatCompletion', method: 'POST' }
      });
    }
  }

  /**
   * Generate text completion
   */
  async generateTextCompletion(params: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    model?: string;
    stream?: boolean;
  }): Promise<{
    text: string;
    metadata: {
      model: string;
      tokensUsed?: {
        prompt: number;
        completion: number;
        total: number;
      };
      executionTime: number;
      finishReason?: 'stop' | 'length' | 'function_call' | 'content_filter';
      requestId?: string;
      cached?: boolean;
    };
  }> {
    this.assertReady();
    
    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceUnavailable('openai-client', {
        service: 'AIDomainService',
        operation: 'ai-operation'
      });
    }

    try {
      const startTime = Date.now();

      this.logInfo('Generating text completion', {
        promptLength: params.prompt.length,
        model: params.model || 'gpt-5-nano',
        temperature: params.temperature || 0.7
      });

      const response = await this.openAIClient.makeRequest({
        method: 'POST',
        endpoint: '/completions',
        data: {
          model: params.model || 'gpt-5-nano',
          prompt: params.prompt,
          temperature: params.temperature || 0.7,
          max_tokens: params.maxTokens,
          top_p: params.topP,
          frequency_penalty: params.frequencyPenalty,
          presence_penalty: params.presencePenalty,
          stop: params.stop
        }
      });

      const result = {
        text: response.data.choices[0]?.text || '',
        metadata: {
          model: response.data.model,
          tokensUsed: {
            prompt: response.data.usage?.prompt_tokens || 0,
            completion: response.data.usage?.completion_tokens || 0,
            total: response.data.usage?.total_tokens || 0
          },
          executionTime: Date.now() - startTime,
          finishReason: response.data.choices[0]?.finish_reason,
          requestId: response.data.id,
          cached: false
        }
      };

      this.logInfo('Text completion generated successfully', {
        model: result.metadata.model,
        totalTokens: result.metadata.tokensUsed?.total || 0
      });

      return result;
    } catch (error) {
      this.logError('Failed to generate text completion', error);
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(params: {
    input: string | string[];
    model?: string;
    dimensions?: number;
    encodingFormat?: 'float' | 'base64';
  }): Promise<{
    embeddings: number[][];
    metadata: {
      model: string;
      dimensions: number;
      tokensUsed: number;
      executionTime: number;
    };
  }> {
    this.assertReady();
    
    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceUnavailable('openai-client', {
        service: 'AIDomainService',
        operation: 'ai-operation'
      });
    }

    try {
      const startTime = Date.now();

      this.logInfo('Generating embeddings', {
        inputType: Array.isArray(params.input) ? 'array' : 'string',
        inputLength: Array.isArray(params.input) ? params.input.length : 1,
        model: params.model || 'text-embedding-ada-002'
      });

      const response = await this.openAIClient.makeRequest({
        method: 'POST',
        endpoint: '/embeddings',
        data: {
          model: params.model || 'text-embedding-ada-002',
          input: params.input
        }
      });

      const result = {
        embeddings: response.data.data.map((item: any) => item.embedding),
        metadata: {
          model: response.data.model,
          dimensions: response.data.data[0]?.embedding?.length || 0,
          tokensUsed: response.data.usage?.total_tokens || 0,
          executionTime: Date.now() - startTime
        }
      };

      this.logInfo('Embeddings generated successfully', {
        model: result.metadata.model,
        embeddingCount: result.embeddings.length,
        totalTokens: result.metadata.tokensUsed
      });

      return result;
    } catch (error) {
      this.logError('Failed to generate embeddings', error);
      throw error;
    }
  }

  /**
   * Generate images
   */
  async generateImages(params: {
    prompt: string;
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024';
    responseFormat?: 'url' | 'b64_json';
    user?: string;
  }): Promise<{
    created: number;
    data: Array<{
      url?: string;
      b64Json?: string;
    }>;
  }> {
    this.assertReady();
    
    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceUnavailable('openai-client', {
        service: 'AIDomainService',
        operation: 'ai-operation'
      });
    }

    try {
      this.logInfo('Generating images', {
        prompt: params.prompt.substring(0, 100),
        n: params.n || 1,
        size: params.size || '1024x1024'
      });

      const response = await this.openAIClient.makeRequest({
        method: 'POST',
        endpoint: '/images/generations',
        data: {
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || '1024x1024',
          response_format: params.responseFormat || 'url',
          user: params.user
        }
      });

      const result = {
        created: response.data.created,
        data: response.data.data
      };

      this.logInfo('Images generated successfully', {
        imageCount: result.data.length,
        created: result.created
      });

      return result;
    } catch (error) {
      this.logError('Failed to generate images', error);
      throw error;
    }
  }

  /**
   * Transcribe audio
   */
  async transcribeAudio(params: {
    file: Buffer;
    model?: string;
    language?: string;
    prompt?: string;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    temperature?: number;
  }): Promise<{
    text: string;
  }> {
    this.assertReady();
    
    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceUnavailable('openai-client', {
        service: 'AIDomainService',
        operation: 'ai-operation'
      });
    }

    try {
      this.logInfo('Transcribing audio', {
        fileSize: params.file.length,
        model: params.model || 'whisper-1',
        language: params.language
      });

      const response = await this.openAIClient.makeRequest({
        method: 'POST',
        endpoint: '/audio/transcriptions',
        data: {
          file: params.file,
          model: params.model || 'whisper-1',
          language: params.language,
          prompt: params.prompt,
          response_format: params.responseFormat || 'json',
          temperature: params.temperature
        }
      });

      const result = {
        text: response.data.text
      };

      this.logInfo('Audio transcribed successfully', {
        textLength: result.text.length
      });

      return result;
    } catch (error) {
      this.logError('Failed to transcribe audio', error);
      throw error;
    }
  }

  /**
   * Translate audio
   */
  async translateAudio(params: {
    file: Buffer;
    model?: string;
    prompt?: string;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    temperature?: number;
  }): Promise<{
    text: string;
  }> {
    this.assertReady();
    
    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceUnavailable('openai-client', {
        service: 'AIDomainService',
        operation: 'ai-operation'
      });
    }

    try {
      this.logInfo('Translating audio', {
        fileSize: params.file.length,
        model: params.model || 'whisper-1'
      });

      const response = await this.openAIClient.makeRequest({
        method: 'POST',
        endpoint: '/audio/translations',
        data: {
          file: params.file,
          model: params.model || 'whisper-1',
          prompt: params.prompt,
          response_format: params.responseFormat || 'json',
          temperature: params.temperature
        }
      });

      const result = {
        text: response.data.text
      };

      this.logInfo('Audio translated successfully', {
        textLength: result.text.length
      });

      return result;
    } catch (error) {
      this.logError('Failed to translate audio', error);
      throw error;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    contextLength?: number;
    capabilities: string[];
    pricing?: {
      inputTokens: number;
      outputTokens: number;
    };
  }>> {
    this.assertReady();
    
    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceUnavailable('openai-client', {
        service: 'AIDomainService',
        operation: 'ai-operation'
      });
    }

    try {
      this.logInfo('Listing available models');

      const response = await this.openAIClient.makeRequest({
        method: 'GET',
        endpoint: '/models'
      });

      const result = response.data.data.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.id,
        contextLength: undefined as number | undefined,
        capabilities: ['text-generation'],
        pricing: undefined as Record<string, unknown> | undefined
      }));

      this.logInfo('Models listed successfully', {
        modelCount: result.length
      });

      return result;
    } catch (error) {
      this.logError('Failed to list models', error);
      throw error;
    }
  }

  /**
   * Generate structured data using function calling
   */
  async generateStructuredData<T = any>(params: StructuredDataParams): Promise<T> {
    this.assertReady();

    if (!this.openAIClient) {
      throw ErrorFactory.domain.serviceError('AIDomainService', 'OpenAI client not available');
    }

    try {
      this.logInfo('Generating structured data', {
        schemaType: params.schema.type,
        propertiesCount: Object.keys(params.schema.properties || {}).length,
        temperature: params.temperature || 0.1,
        promptBuilder: params.metadata?.promptBuilder || 'unknown'
      });

      const response = await this.openAIClient.makeRequest({
        method: 'POST',
        endpoint: '/chat/completions',
        data: {
          model: params.model || 'gpt-5-nano',
          messages: [
            { role: 'system', content: params.systemPrompt || 'Generate structured response' },
            { role: 'user', content: params.prompt }
          ],
          temperature: params.temperature || 0.1,
          max_tokens: params.maxTokens || 1000,
          functions: [{
            name: 'structured_response',
            description: params.schema.description || 'Generate structured response',
            parameters: params.schema
          }],
          function_call: { name: 'structured_response' }
        },
        options: {
          metadata: {
            promptBuilder: params.metadata?.promptBuilder || 'unknown'
          }
        }
      });

      const functionCall = response.data.choices[0]?.message?.function_call;
      if (!functionCall || !functionCall.arguments) {
        throw ErrorFactory.domain.serviceError('AIDomainService', 'No structured response received from OpenAI', {
          operation: 'generateStructuredData',
          hasFunctionCall: !!functionCall
        });
      }

      const result = JSON.parse(functionCall.arguments);

      this.logInfo('Structured data generated successfully', {
        model: params.model || 'gpt-5-nano',
        hasResult: !!result
      });

      return result;
    } catch (error) {
      throw ErrorFactory.util.wrapError(error instanceof Error ? error : new Error(String(error)), ERROR_CATEGORIES.SERVICE, {
        service: 'AIDomainService',
        metadata: { endpoint: 'generateStructuredData', method: 'POST' }
      });
    }
  }

  /**
   * Execute a prompt with structured output and automatic JSON parsing
   * This is a convenience method that wraps generateStructuredData with a cleaner interface
   *
   * @param prompt - The AI prompt with system and user instructions
   * @param schema - Required structured schema for function calling
   * @param promptBuilderName - Optional name for logging
   * @returns Promise resolving to AI response with parsed JSON
   */
  async executePrompt<T = any>(
    prompt: AIPrompt,
    schema: StructuredSchema,
    promptBuilderName?: string,
  ): Promise<AIResponse<T>> {
    const startTime = Date.now();
    const requestId = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logInfo('Executing AI prompt', {
      requestId,
      schemaType: schema.type,
      temperature: prompt.options?.temperature ?? 0.1,
      promptBuilder: promptBuilderName || 'unknown',
    });

    try {
      this.assertReady();

      this.logDebug('Executing structured AI prompt', {
        requestId,
        schemaType: schema.type,
        propertiesCount: Object.keys(schema.properties).length,
        temperature: prompt.options?.temperature ?? 0.1,
      });

      // Use generateStructuredData for the actual AI call
      const structuredResponse = await this.generateStructuredData<T>({
        prompt: prompt.userPrompt,
        schema: schema,
        systemPrompt: prompt.systemPrompt,
        temperature: prompt.options?.temperature ?? 0.1,
        maxTokens: prompt.options?.maxTokens ?? 1000,
        model: prompt.options?.model ?? 'gpt-5-nano',
        metadata: { promptBuilder: promptBuilderName || 'unknown' },
      });

      // Parse and format response
      const response = JSON.stringify(structuredResponse);
      const parsed = structuredResponse as T;

      const result: AIResponse<T> = {
        content: response,
        parsed,
        context: (parsed as any).context || '', // Extract context from parsed response
        metadata: {
          model: prompt.options?.model ?? 'gpt-5-nano',
          tokens: 0, // Would extract from OpenAI response if available
          processingTime: Date.now() - startTime,
          success: true,
        },
      };

      this.logInfo('AI prompt completed successfully', {
        requestId,
        processingTime: Date.now() - startTime,
        model: result.metadata.model,
      });

      return result;

    } catch (error) {
      this.logError('AI prompt execution failed', error, {
        correlationId: requestId,
        operation: 'ai_prompt_execution_error',
        errorStack: error instanceof Error ? error.stack : undefined,
        prompt: {
          systemPromptLength: prompt.systemPrompt?.length || 0,
          userPromptLength: prompt.userPrompt?.length || 0,
          model: prompt.options?.model,
          temperature: prompt.options?.temperature,
        },
        metadata: {
          processingTime: Date.now() - startTime,
          success: false,
        },
        schema: schema.description || 'custom schema',
      });

      return {
        content: '',
        parsed: {} as T,
        context: '', // Empty context on error
        metadata: {
          model: prompt.options?.model ?? 'gpt-5-nano',
          tokens: 0,
          processingTime: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Chat completion - convenience method
   */
  async chat(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  }): Promise<{ content: string; role: string }> {
    const result = await this.generateChatCompletion({
      messages: params.messages,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      model: params.model
    });

    return {
      content: result.message.content,
      role: result.message.role
    };
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.openAIClient;
      const details = {
        initialized: this.initialized,
        hasOpenAIClient: !!this.openAIClient,
        authenticated: this.openAIClient?.isAuthenticated() || false
      };

      return { healthy, details };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
