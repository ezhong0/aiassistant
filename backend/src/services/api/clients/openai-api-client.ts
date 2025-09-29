import OpenAI from 'openai';
import { BaseAPIClient } from '../base-api-client';
import { 
  APIClientConfig, 
  APIRequest, 
  APIResponse, 
  APIError, 
  AuthCredentials 
} from '../../../types/api/api-client.types';

/**
 * OpenAI API Client - Handles all OpenAI API interactions
 * 
 * This client provides a unified interface for OpenAI APIs including:
 * - Chat completions (GPT models)
 * - Text completions
 * - Embeddings
 * - Fine-tuning
 * - Image generation (DALL-E)
 * - Audio transcription and translation
 * 
 * It uses the official OpenAI Node.js client library.
 */
export class OpenAIClient extends BaseAPIClient {
  private openai: OpenAI | null = null;

  constructor(config: APIClientConfig) {
    super('OpenAIClient', config, true); // Enable circuit breaker for AI operations
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      // OpenAI client will be initialized in authentication
      this.logInfo('OpenAI API client initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize OpenAI API client', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.openai = null as any;
      this.logInfo('OpenAI API client destroyed');
    } catch (error) {
      this.logError('Error destroying OpenAI API client', error);
    }
  }

  /**
   * Perform OpenAI authentication
   */
  protected async performAuthentication(credentials: AuthCredentials): Promise<void> {
    if (credentials.type !== 'api_key') {
      throw new Error('OpenAI API requires API key authentication');
    }

    if (!credentials.apiKey) {
      throw new Error('API key is required for OpenAI API authentication');
    }

    try {
      // Initialize OpenAI client with API key
      this.openai = new OpenAI({
        apiKey: credentials.apiKey,
        timeout: this.config.timeout || 30000
      });
      
      this.logInfo('OpenAI authentication successful');
    } catch (error) {
      this.logError('OpenAI authentication failed', error);
      throw error;
    }
  }

  /**
   * Perform OpenAI API request
   */
  protected async performRequest<T>(
    request: APIRequest, 
    requestId: string
  ): Promise<APIResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Parse OpenAI API method from endpoint
      const method = this.getOpenAIMethodFromEndpoint(request.endpoint);
      
      this.logDebug('Making OpenAI API request', {
        requestId,
        endpoint: request.endpoint,
        method: request.method
      });

      // Execute the request
      const response = await method(request.data || {});

      const executionTime = Date.now() - startTime;

      return {
        data: response as T,
        statusCode: 200, // OpenAI client doesn't expose status code directly
        headers: {}, // OpenAI client doesn't expose headers directly
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          executionTime
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logError('OpenAI API request failed', error, {
        requestId,
        endpoint: request.endpoint,
        executionTime
      });

      throw error;
    }
  }

  /**
   * Handle OpenAI API errors
   */
  protected handleAPIError(error: unknown, request?: APIRequest): APIError {
    const apiError = this.createAPIError('OPENAI_API_ERROR', 'OpenAI API request failed', error);
    
    if (error && typeof error === 'object' && 'status' in error) {
      const openaiError = error as any;
      const status = openaiError.status;
      const code = openaiError.code;
      const type = openaiError.type;
      
      // Map OpenAI API error codes
      if (status === 401) {
        apiError.code = 'OPENAI_AUTH_FAILED';
        apiError.message = 'OpenAI API key is invalid or expired';
        apiError.category = 'authentication';
      } else if (status === 403) {
        apiError.code = 'OPENAI_PERMISSION_DENIED';
        apiError.message = 'OpenAI API access forbidden - check your API key permissions';
        apiError.category = 'authentication';
      } else if (status === 404) {
        apiError.code = 'OPENAI_NOT_FOUND';
        apiError.message = 'OpenAI API endpoint not found';
        apiError.category = 'client_error';
      } else if (status === 429) {
        apiError.code = 'OPENAI_RATE_LIMIT';
        apiError.message = 'OpenAI API rate limit exceeded - please try again later';
        apiError.category = 'rate_limit';
      } else if (status === 500) {
        apiError.code = 'OPENAI_SERVER_ERROR';
        apiError.message = 'OpenAI API server error - please try again later';
        apiError.category = 'server_error';
      } else if (code === 'insufficient_quota') {
        apiError.code = 'OPENAI_QUOTA_EXCEEDED';
        apiError.message = 'OpenAI API quota exceeded - please check your billing';
        apiError.category = 'rate_limit';
      } else if (code === 'invalid_request_error') {
        apiError.code = 'OPENAI_INVALID_REQUEST';
        apiError.message = 'OpenAI API request is invalid';
        apiError.category = 'client_error';
      } else if (type === 'invalid_request_error') {
        apiError.code = 'OPENAI_INVALID_REQUEST';
        apiError.message = 'OpenAI API request parameters are invalid';
        apiError.category = 'client_error';
      }
      
      apiError.statusCode = status;
      apiError.context = {
        endpoint: request?.endpoint,
        method: request?.method,
        openaiCode: code,
        openaiType: type,
        openaiMessage: openaiError.message
      };
    }
    
    return apiError;
  }

  /**
   * Get OpenAI API method from endpoint
   */
  private getOpenAIMethodFromEndpoint(endpoint: string): (params: any) => Promise<any> {
    // Remove leading slash and convert to method path
    const methodPath = endpoint.replace(/^\//, '');

    // Map endpoint to OpenAI API methods
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Return bound methods to preserve context
    const methodMap: Record<string, (params: any) => Promise<any>> = {
      // Chat completions
      'chat/completions': (params) => this.openai!.chat.completions.create(params),

      // Text completions
      'completions': (params) => this.openai!.completions.create(params),

      // Embeddings
      'embeddings': (params) => this.openai!.embeddings.create(params),

      // Images
      'images/generations': (params) => this.openai!.images.generate(params),
      'images/edits': (params) => this.openai!.images.edit(params),
      'images/variations': (params) => this.openai!.images.createVariation(params),

      // Audio
      'audio/transcriptions': (params) => this.openai!.audio.transcriptions.create(params),
      'audio/translations': (params) => this.openai!.audio.translations.create(params),

      // Fine-tuning (updated APIs)
      'fine-tuning/jobs': (params) => this.openai!.fineTuning.jobs.create(params),
      'fine-tuning/jobs/list': (params) => this.openai!.fineTuning.jobs.list(params),
      'fine-tuning/jobs/retrieve': (params) => this.openai!.fineTuning.jobs.retrieve(params),
      'fine-tuning/jobs/cancel': (params) => this.openai!.fineTuning.jobs.cancel(params),

      // Models
      'models': (params) => this.openai!.models.list(params),
      'models/retrieve': (params) => this.openai!.models.retrieve(params),
      'models/delete': (params) => this.openai!.models.delete(params),

      // Files
      'files': (params) => this.openai!.files.create(params),
      'files/list': (params) => this.openai!.files.list(params),
      'files/retrieve': (params) => this.openai!.files.retrieve(params),
      'files/delete': (params) => this.openai!.files.delete(params),
      'files/content': (params) => this.openai!.files.content(params),

      // Moderations
      'moderations': (params) => this.openai!.moderations.create(params),

      // Assistants (if available) - Note: some methods require specific IDs as first parameter
      'assistants': (params) => this.openai!.beta.assistants.create(params),
      'assistants/list': (params) => this.openai!.beta.assistants.list(params),
      'assistants/retrieve': (params) => this.openai!.beta.assistants.retrieve(params.assistantId, params.options),
      'assistants/update': (params) => this.openai!.beta.assistants.update(params.assistantId, params.body, params.options),
      'assistants/delete': (params) => this.openai!.beta.assistants.delete(params.assistantId, params.options),

      // Threads (if available) - Note: some methods require specific IDs as first parameter
      'threads': (params) => this.openai!.beta.threads.create(params),
      'threads/retrieve': (params) => this.openai!.beta.threads.retrieve(params.threadId, params.options),
      'threads/update': (params) => this.openai!.beta.threads.update(params.threadId, params.body, params.options),
      'threads/delete': (params) => this.openai!.beta.threads.delete(params.threadId, params.options),

      // Messages (if available) - Note: some methods require specific IDs as first parameter
      'threads/messages': (params) => this.openai!.beta.threads.messages.create(params.threadId, params.body, params.options),
      'threads/messages/list': (params) => this.openai!.beta.threads.messages.list(params.threadId, params.query, params.options),
      'threads/messages/retrieve': (params) => this.openai!.beta.threads.messages.retrieve(params.threadId, params.messageId, params.options),
      'threads/messages/update': (params) => this.openai!.beta.threads.messages.update(params.threadId, params.messageId, params.body),

      // Runs (if available) - Note: some methods require specific IDs as first parameter
      'threads/runs': (params) => this.openai!.beta.threads.runs.create(params.threadId, params.body, params.options),
      'threads/runs/list': (params) => this.openai!.beta.threads.runs.list(params.threadId, params.query, params.options),
      'threads/runs/retrieve': (params) => this.openai!.beta.threads.runs.retrieve(params.threadId, params.runId, params.options),
      'threads/runs/update': (params) => this.openai!.beta.threads.runs.update(params.threadId, params.runId, params.body),
      'threads/runs/submit-tool-outputs': (params) => this.openai!.beta.threads.runs.submitToolOutputs(params.threadId, params.runId, params.body),
      'threads/runs/cancel': (params) => this.openai!.beta.threads.runs.cancel(params.threadId, params.runId)
    };

    const method = methodMap[methodPath];
    if (!method) {
      throw new Error(`Unsupported OpenAI API endpoint: ${endpoint}`);
    }

    return method;
  }

  /**
   * Test OpenAI API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple models list request
      const response = await this.makeRequest({
        method: 'GET',
        endpoint: '/models',
        requiresAuth: true
      });
      
      return !!(response.data as any)?.data;
    } catch (error) {
      this.logError('OpenAI API connection test failed', error);
      return false;
    }
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.authenticated;
      const details = {
        initialized: this.initialized,
        authenticated: this.authenticated,
        hasOpenAI: !!this.openai,
        serviceName: this.name
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
