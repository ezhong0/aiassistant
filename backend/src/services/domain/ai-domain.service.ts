import { BaseService } from '../base-service';
import { getAPIClient } from '../api';
import { OpenAIClient } from '../api/clients/openai-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError, APIClientErrorCode } from '../../errors/api-client.errors';
import { ValidationHelper, AIValidationSchemas } from '../../validation/api-client.validation';
import { IAIDomainService } from './interfaces/domain-service.interfaces';

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
 */
export class AIDomainService extends BaseService implements IAIDomainService {
  private openaiClient: OpenAIClient | null = null;

  constructor() {
    super('AIDomainService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing AI Domain Service');

      // Get OpenAI API client
      this.openaiClient = await getAPIClient<OpenAIClient>('openai');

      // Authenticate with OpenAI API key (skip assertReady check during init)
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      this.logInfo('Authenticating with OpenAI API', {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey.length
      });

      // Authenticate directly without assertReady check during initialization
      if (!this.openaiClient) {
        throw new Error('OpenAI client not available');
      }

      const credentials = {
        type: 'api_key' as const,
        apiKey
      };

      await this.openaiClient.authenticate(credentials);
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
      this.openaiClient = null;
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
    
    if (!this.openaiClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'OpenAI client not available',
        { serviceName: 'AIDomainService' }
      );
    }

    try {
      const credentials: AuthCredentials = {
        type: 'api_key',
        apiKey
      };

      await this.openaiClient.authenticate(credentials);
      this.logInfo('AI service authenticated successfully');
    } catch (error) {
      throw APIClientError.fromError(error, {
        serviceName: 'AIDomainService',
        endpoint: 'authenticate'
      });
    }
  }

  /**
   * Generate chat completion
   */
  async generateChatCompletion(params: {
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
  }): Promise<{
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
      index: number;
      message: {
        role: string;
        content: string;
      };
      finishReason: string;
    }>;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    this.assertReady();
    
    if (!this.openaiClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'OpenAI client not available',
        { serviceName: 'AIDomainService' }
      );
    }

    try {
      // Validate input parameters
      const validatedParams = ValidationHelper.validate(AIValidationSchemas.generateChatCompletion, params);

      this.logInfo('Generating chat completion', {
        messageCount: validatedParams.messages.length,
        model: validatedParams.model || 'gpt-4',
        temperature: validatedParams.temperature || 0.7
      });

      const response = await this.openaiClient.makeRequest({
        method: 'POST',
        endpoint: '/chat/completions',
        data: {
          model: validatedParams.model || 'gpt-4',
          messages: validatedParams.messages,
          temperature: validatedParams.temperature || 0.7,
          max_tokens: validatedParams.maxTokens,
          top_p: validatedParams.topP,
          frequency_penalty: validatedParams.frequencyPenalty,
          presence_penalty: validatedParams.presencePenalty,
          stop: validatedParams.stop
        }
      });

      const result = {
        id: response.data.id,
        object: response.data.object,
        created: response.data.created,
        model: response.data.model,
        choices: response.data.choices,
        usage: response.data.usage
      };

      this.logInfo('Chat completion generated successfully', {
        model: result.model,
        choiceCount: result.choices.length,
        totalTokens: result.usage.totalTokens
      });

      return result;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }
      throw APIClientError.fromError(error, {
        serviceName: 'AIDomainService',
        endpoint: 'generateChatCompletion',
        method: 'POST'
      });
    }
  }

  /**
   * Generate text completion
   */
  async generateTextCompletion(params: {
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
  }): Promise<{
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
      text: string;
      index: number;
      finishReason: string;
    }>;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    this.assertReady();
    
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    try {
      this.logInfo('Generating text completion', {
        promptLength: params.prompt.length,
        model: params.model || 'text-davinci-003',
        temperature: params.temperature || 0.7
      });

      const response = await this.openaiClient.makeRequest({
        method: 'POST',
        endpoint: '/completions',
        data: {
          model: params.model || 'text-davinci-003',
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
        id: response.data.id,
        object: response.data.object,
        created: response.data.created,
        model: response.data.model,
        choices: response.data.choices,
        usage: response.data.usage
      };

      this.logInfo('Text completion generated successfully', {
        model: result.model,
        choiceCount: result.choices.length,
        totalTokens: result.usage.totalTokens
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
  }): Promise<{
    object: string;
    data: Array<{
      object: string;
      index: number;
      embedding: number[];
    }>;
    model: string;
    usage: {
      promptTokens: number;
      totalTokens: number;
    };
  }> {
    this.assertReady();
    
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    try {
      this.logInfo('Generating embeddings', {
        inputType: Array.isArray(params.input) ? 'array' : 'string',
        inputLength: Array.isArray(params.input) ? params.input.length : 1,
        model: params.model || 'text-embedding-ada-002'
      });

      const response = await this.openaiClient.makeRequest({
        method: 'POST',
        endpoint: '/embeddings',
        data: {
          model: params.model || 'text-embedding-ada-002',
          input: params.input
        }
      });

      const result = {
        object: response.data.object,
        data: response.data.data,
        model: response.data.model,
        usage: response.data.usage
      };

      this.logInfo('Embeddings generated successfully', {
        model: result.model,
        embeddingCount: result.data.length,
        totalTokens: result.usage.totalTokens
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
    
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    try {
      this.logInfo('Generating images', {
        prompt: params.prompt.substring(0, 100),
        n: params.n || 1,
        size: params.size || '1024x1024'
      });

      const response = await this.openaiClient.makeRequest({
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
    
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    try {
      this.logInfo('Transcribing audio', {
        fileSize: params.file.length,
        model: params.model || 'whisper-1',
        language: params.language
      });

      const response = await this.openaiClient.makeRequest({
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
    
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    try {
      this.logInfo('Translating audio', {
        fileSize: params.file.length,
        model: params.model || 'whisper-1'
      });

      const response = await this.openaiClient.makeRequest({
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
  async listModels(): Promise<{
    object: string;
    data: Array<{
      id: string;
      object: string;
      created: number;
      ownedBy: string;
      permission: Array<{
        id: string;
        object: string;
        created: number;
        allowCreateEngine: boolean;
        allowSampling: boolean;
        allowLogprobs: boolean;
        allowSearchIndices: boolean;
        allowView: boolean;
        allowFineTuning: boolean;
        organization: string;
        group?: string;
        isBlocking: boolean;
      }>;
      root: string;
      parent?: string;
    }>;
  }> {
    this.assertReady();
    
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    try {
      this.logInfo('Listing available models');

      const response = await this.openaiClient.makeRequest({
        method: 'GET',
        endpoint: '/models'
      });

      const result = {
        object: response.data.object,
        data: response.data.data
      };

      this.logInfo('Models listed successfully', {
        modelCount: result.data.length
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
  async generateStructuredData(
    userPrompt: string,
    systemPrompt: string,
    schema: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
      description?: string;
    },
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<any> {
    this.assertReady();
    
    if (!this.openaiClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'OpenAI client not available',
        { serviceName: 'AIDomainService' }
      );
    }

    try {
      this.logInfo('Generating structured data', {
        schemaType: schema.type,
        propertiesCount: Object.keys(schema.properties).length,
        temperature: options?.temperature || 0.1
      });

      const response = await this.openaiClient.makeRequest({
        method: 'POST',
        endpoint: '/chat/completions',
        data: {
          model: options?.model || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: options?.temperature || 0.1,
          max_tokens: options?.maxTokens || 1000,
          functions: [{
            name: 'structured_response',
            description: schema.description || 'Generate structured response',
            parameters: schema
          }],
          function_call: { name: 'structured_response' }
        }
      });

      const functionCall = response.data.choices[0]?.message?.function_call;
      if (!functionCall || !functionCall.arguments) {
        throw new Error('No structured response received');
      }

      const result = JSON.parse(functionCall.arguments);

      this.logInfo('Structured data generated successfully', {
        model: options?.model || 'gpt-4',
        hasResult: !!result
      });

      return result;
    } catch (error) {
      throw APIClientError.fromError(error, {
        serviceName: 'AIDomainService',
        endpoint: 'generateStructuredData',
        method: 'POST'
      });
    }
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.openaiClient;
      const details = {
        initialized: this.initialized,
        hasOpenAIClient: !!this.openaiClient,
        authenticated: this.openaiClient?.isAuthenticated() || false
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
