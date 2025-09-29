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
  private getOpenAIMethodFromEndpoint(endpoint: string): any {
    // Remove leading slash and convert to method path
    const methodPath = endpoint.replace(/^\//, '');
    
    // Map endpoint to OpenAI API methods
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const methodMap: Record<string, any> = {
      // Chat completions
      'chat/completions': this.openai.chat.completions.create,
      
      // Text completions
      'completions': this.openai.completions.create,
      
      // Embeddings
      'embeddings': this.openai.embeddings.create,
      
      // Images
      'images/generations': this.openai.images.generate,
      'images/edits': this.openai.images.edit,
      'images/variations': this.openai.images.createVariation,
      
      // Audio
      'audio/transcriptions': this.openai.audio.transcriptions.create,
      'audio/translations': this.openai.audio.translations.create,
      
      // Fine-tuning (updated APIs)
      'fine-tuning/jobs': this.openai.fineTuning.jobs.create,
      'fine-tuning/jobs/list': this.openai.fineTuning.jobs.list,
      'fine-tuning/jobs/retrieve': this.openai.fineTuning.jobs.retrieve,
      'fine-tuning/jobs/cancel': this.openai.fineTuning.jobs.cancel,
      
      // Models
      'models': this.openai.models.list,
      'models/retrieve': this.openai.models.retrieve,
      'models/delete': this.openai.models.delete,
      
      // Files
      'files': this.openai.files.create,
      'files/list': this.openai.files.list,
      'files/retrieve': this.openai.files.retrieve,
      'files/delete': this.openai.files.delete,
      'files/content': this.openai.files.content,
      
      // Moderations
      'moderations': this.openai.moderations.create,
      
      // Assistants (if available)
      'assistants': this.openai.beta.assistants.create,
      'assistants/list': this.openai.beta.assistants.list,
      'assistants/retrieve': this.openai.beta.assistants.retrieve,
      'assistants/update': this.openai.beta.assistants.update,
      'assistants/delete': this.openai.beta.assistants.delete,
      
      // Threads (if available)
      'threads': this.openai.beta.threads.create,
      'threads/retrieve': this.openai.beta.threads.retrieve,
      'threads/update': this.openai.beta.threads.update,
      'threads/delete': this.openai.beta.threads.delete,
      
      // Messages (if available)
      'threads/messages': this.openai.beta.threads.messages.create,
      'threads/messages/list': this.openai.beta.threads.messages.list,
      'threads/messages/retrieve': this.openai.beta.threads.messages.retrieve,
      'threads/messages/update': this.openai.beta.threads.messages.update,
      
      // Runs (if available)
      'threads/runs': this.openai.beta.threads.runs.create,
      'threads/runs/list': this.openai.beta.threads.runs.list,
      'threads/runs/retrieve': this.openai.beta.threads.runs.retrieve,
      'threads/runs/update': this.openai.beta.threads.runs.update,
      'threads/runs/submit-tool-outputs': this.openai.beta.threads.runs.submitToolOutputs,
      'threads/runs/cancel': this.openai.beta.threads.runs.cancel
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
