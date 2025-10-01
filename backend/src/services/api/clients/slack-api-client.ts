import { WebClient } from '@slack/web-api';
import { BaseAPIClient } from '../base-api-client';
import {
  APIClientConfig,
  APIRequest,
  APIResponse,
  AuthCredentials
} from '../../../types/api/api-client.types';
import { APIClientError } from '../../../errors';
import { SlackErrorTransformer } from '../../../errors/transformers';

/**
 * Slack API Client - Handles all Slack Web API interactions
 * 
 * This client provides a unified interface for Slack APIs including:
 * - Chat operations (postMessage, update, delete)
 * - Conversations (channels, DMs, threads)
 * - Users and team information
 * - File uploads and management
 * - Webhook and slash command responses
 * 
 * It uses the official Slack Web API client library.
 */
export class SlackAPIClient extends BaseAPIClient {
  private webClient: WebClient | null = null;

  constructor(config: APIClientConfig) {
    super('SlackAPIClient', config);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Initialize Slack Web API client
      this.webClient = new WebClient();
      
      this.logInfo('Slack API client initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Slack API client', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.webClient = null as any;
      this.logInfo('Slack API client destroyed');
    } catch (error) {
      this.logError('Error destroying Slack API client', error);
    }
  }

  /**
   * Perform Slack authentication
   */
  protected async performAuthentication(credentials: AuthCredentials): Promise<void> {
    if (credentials.type !== 'bearer' && credentials.type !== 'api_key') {
      throw new Error('Slack API requires bearer token or API key authentication');
    }

    const token = credentials.accessToken || credentials.apiKey;
    if (!token) {
      throw new Error('Token is required for Slack API authentication');
    }

    try {
      // Set token for Web API client
      this.webClient = new WebClient(token);
      
      this.logInfo('Slack authentication successful');
    } catch (error) {
      this.logError('Slack authentication failed', error);
      throw error;
    }
  }

  /**
   * Perform Slack API request
   */
  protected async performRequest<T>(
    request: APIRequest, 
    requestId: string
  ): Promise<APIResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Parse Slack API method from endpoint
      const method = this.getSlackMethodFromEndpoint(request.endpoint);
      
      this.logDebug('Making Slack API request', {
        requestId,
        endpoint: request.endpoint,
        method: request.method
      });

      // Prepare request parameters
      const params = {
        ...request.query,
        ...request.data
      };

      // Execute the request
      const response = await method(params);

      const executionTime = Date.now() - startTime;

      return {
        data: response as T,
        statusCode: 200, // Slack Web API client doesn't expose status code directly
        headers: {}, // Slack Web API client doesn't expose headers directly
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          executionTime
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logError('Slack API request failed', error, {
        requestId,
        endpoint: request.endpoint,
        executionTime
      });

      throw error;
    }
  }

  /**
   * Handle Slack API errors using Slack-specific transformer
   */
  protected handleAPIError(error: unknown, request?: APIRequest): APIClientError {
    return SlackErrorTransformer.transform(error, {
      serviceName: this.name,
      endpoint: request?.endpoint,
      method: request?.method
    });
  }

  /**
   * Get Slack API method from endpoint
   */
  private getSlackMethodFromEndpoint(endpoint: string): any {
    // Remove leading slash and convert to method path
    const methodPath = endpoint.replace(/^\//, '');
    
    // Map endpoint to Slack Web API methods
    if (!this.webClient) {
      throw new Error('Slack WebClient not initialized');
    }

    const methodMap: Record<string, any> = {
      // Chat methods
      'chat.postMessage': this.webClient.chat.postMessage,
      'chat.postEphemeral': this.webClient.chat.postEphemeral,
      'chat.update': this.webClient.chat.update,
      'chat.delete': this.webClient.chat.delete,
      'chat.scheduleMessage': this.webClient.chat.scheduleMessage,
      'chat.deleteScheduledMessage': this.webClient.chat.deleteScheduledMessage,
      
      // Conversations methods
      'conversations.list': this.webClient.conversations.list,
      'conversations.history': this.webClient.conversations.history,
      'conversations.replies': this.webClient.conversations.replies,
      'conversations.info': this.webClient.conversations.info,
      'conversations.create': this.webClient.conversations.create,
      'conversations.rename': this.webClient.conversations.rename,
      'conversations.archive': this.webClient.conversations.archive,
      'conversations.unarchive': this.webClient.conversations.unarchive,
      'conversations.invite': this.webClient.conversations.invite,
      'conversations.kick': this.webClient.conversations.kick,
      'conversations.leave': this.webClient.conversations.leave,
      'conversations.members': this.webClient.conversations.members,
      'conversations.open': this.webClient.conversations.open,
      'conversations.close': this.webClient.conversations.close,
      'conversations.setTopic': this.webClient.conversations.setTopic,
      'conversations.setPurpose': this.webClient.conversations.setPurpose,
      
      // Users methods
      'users.list': this.webClient.users.list,
      'users.info': this.webClient.users.info,
      'users.lookupByEmail': this.webClient.users.lookupByEmail,
      'users.getPresence': this.webClient.users.getPresence,
      'users.setPresence': this.webClient.users.setPresence,
      // 'users.setActive': deprecated method removed
      'users.setPhoto': this.webClient.users.setPhoto,
      'users.deletePhoto': this.webClient.users.deletePhoto,
      // 'users.setRealName': deprecated method removed
      
      // Auth methods
      'auth.test': this.webClient.auth.test,
      'auth.revoke': this.webClient.auth.revoke,
      
      // Team methods
      'team.info': this.webClient.team.info,
      'team.billableInfo': this.webClient.team.billableInfo,
      'team.profile.get': this.webClient.team.profile.get,
      
      // Files methods
      'files.upload': this.webClient.files.upload,
      'files.list': this.webClient.files.list,
      'files.info': this.webClient.files.info,
      'files.delete': this.webClient.files.delete,
      'files.revokePublicURL': this.webClient.files.revokePublicURL,
      'files.sharedPublicURL': this.webClient.files.sharedPublicURL,
      
      // Search methods
      'search.messages': this.webClient.search.messages,
      'search.files': this.webClient.search.files,
      
      // Webhook response (using built-in respond functionality)
      // 'webhook.response': deprecated method removed
    };
    
    const method = methodMap[methodPath];
    if (!method) {
      throw new Error(`Unsupported Slack API endpoint: ${endpoint}`);
    }
    
    return method;
  }

  /**
   * Test Slack API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with auth.test endpoint
      const response = await this.makeRequest({
        method: 'GET',
        endpoint: '/auth.test',
        requiresAuth: true
      });
      
      return !!(response.data as any)?.ok;
    } catch (error) {
      this.logError('Slack API connection test failed', error);
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
        hasWebClient: !!this.webClient,
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
