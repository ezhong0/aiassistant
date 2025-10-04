import { google } from 'googleapis';
import { BaseAPIClient } from '../base-api-client';
import {
  APIClientConfig,
  APIRequest,
  APIResponse,
  AuthCredentials
} from '../../../types/api/api-client.types';
import { APIClientError } from '../../../errors';
import { GoogleErrorTransformer } from '../../../errors/transformers';

/**
 * Google API Client - Handles all Google services (Gmail, Calendar, Contacts)
 *
 * This client provides a unified interface for all Google APIs including:
 * - Gmail API
 * - Google Calendar API
 * - Google Contacts API
 * - Google Drive API (if needed)
 *
 * It uses the Google APIs client library with OAuth2 authentication.
 *
 * E2E Testing Support:
 * - Set mockManager to enable request interception during tests
 */
export class GoogleAPIClient extends BaseAPIClient {
  private auth: any;
  private gmail: any;
  private calendar: any;
  private people: any;
  private mockManager: any = null; // UnifiedMockManager for E2E testing

  constructor(config: APIClientConfig) {
    super('GoogleAPIClient', config);
  }

  /**
   * Set mock manager for E2E testing
   */
  setMockManager(mockManager: any): void {
    this.mockManager = mockManager;
    this.logInfo('Mock manager enabled for E2E testing');
  }

  /**
   * Clear mock manager
   */
  clearMockManager(): void {
    this.mockManager = null;
    this.logInfo('Mock manager disabled');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Initialize Google APIs client
      this.auth = new google.auth.OAuth2();
      
      // Initialize service clients
      this.gmail = google.gmail('v1');
      this.calendar = google.calendar('v3');
      this.people = google.people('v1');
      
      this.logInfo('Google API client initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Google API client', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.auth = null;
      this.gmail = null;
      this.calendar = null;
      this.people = null;
      this.logInfo('Google API client destroyed');
    } catch (error) {
      this.logError('Error destroying Google API client', error);
    }
  }

  /**
   * Perform Google OAuth2 authentication
   */
  protected async performAuthentication(credentials: AuthCredentials): Promise<void> {
    if (credentials.type !== 'oauth2') {
      throw GoogleErrorTransformer.transform(
        new Error('Google API requires OAuth2 authentication'),
        { serviceName: this.name }
      );
    }

    if (!credentials.accessToken) {
      throw GoogleErrorTransformer.transform(
        new Error('Access token is required for Google API authentication'),
        { serviceName: this.name }
      );
    }

    try {
      // Set credentials for OAuth2 client
      this.auth.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken
      });

      this.logInfo('Google OAuth2 authentication successful');
    } catch (error) {
      this.logError('Google OAuth2 authentication failed', error);
      throw GoogleErrorTransformer.transform(error, { serviceName: this.name });
    }
  }

  /**
   * Perform Google API request
   */
  protected async performRequest<T>(
    request: APIRequest,
    requestId: string
  ): Promise<APIResponse<T>> {
    const startTime = Date.now();

    try {
      // Use mock manager if set (E2E testing mode)
      if (this.mockManager) {
        this.logDebug('Using mock manager for request', {
          requestId,
          endpoint: request.endpoint,
          method: request.method
        });

        const mockResponse = await this.mockManager.interceptRequest('GoogleAPIClient', {
          endpoint: request.endpoint,
          method: request.method,
          data: request.data,
          query: request.query,
          headers: request.headers
        });

        const executionTime = Date.now() - startTime;

        return {
          data: mockResponse.data as T,
          statusCode: mockResponse.status,
          headers: mockResponse.headers || {},
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            executionTime,
            ...(mockResponse.metadata && { mockSource: mockResponse.metadata.mockSource })
          }
        };
      }

      // Normal mode: use real Google APIs
      const service = this.getServiceFromEndpoint(request.endpoint);
      const method = this.getMethodFromRequest(request, service);

      this.logDebug('Making Google API request', {
        requestId,
        service,
        endpoint: request.endpoint,
        method: request.method
      });

      // Execute the request
      const response = await method({
        auth: this.auth,
        ...request.query,
        ...(request.data && { requestBody: request.data })
      });

      const executionTime = Date.now() - startTime;

      return {
        data: response.data as T,
        statusCode: 200, // Google APIs client doesn't expose status code directly
        headers: {}, // Google APIs client doesn't expose headers directly
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          executionTime
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logError('Google API request failed', error, {
        requestId,
        endpoint: request.endpoint,
        executionTime
      });

      throw error;
    }
  }

  /**
   * Handle Google API errors using Google-specific transformer
   */
  protected handleAPIError(error: unknown, request?: APIRequest): APIClientError {
    return GoogleErrorTransformer.transform(error, {
      serviceName: this.name,
      endpoint: request?.endpoint,
      method: request?.method
    });
  }

  /**
   * Determine which Google service to use based on endpoint
   */
  private getServiceFromEndpoint(endpoint: string): string {
    if (endpoint.includes('/gmail/')) return 'gmail';
    if (endpoint.includes('/calendar/')) return 'calendar';
    if (endpoint.includes('/people/')) return 'people';
    if (endpoint.includes('/drive/')) return 'drive';
    
    // Default to gmail for backward compatibility
    return 'gmail';
  }

  /**
   * Get the appropriate method from the service based on request
   */
  private getMethodFromRequest(request: APIRequest, service: string): any {
    const endpoint = request.endpoint;
    
    // Gmail API methods
    if (service === 'gmail') {
      if (endpoint.includes('/messages/send')) {
        return this.gmail.users.messages.send;
      } else if (endpoint.includes('/messages/list')) {
        return this.gmail.users.messages.list;
      } else if (endpoint.includes('/messages/get')) {
        return this.gmail.users.messages.get;
      } else if (endpoint.includes('/threads/get')) {
        return this.gmail.users.threads.get;
      } else if (endpoint.includes('/messages/attachments')) {
        return this.gmail.users.messages.attachments.get;
      }
    }
    
    // Calendar API methods
    if (service === 'calendar') {
      if (endpoint.includes('/events/insert')) {
        return this.calendar.events.insert;
      } else if (endpoint.includes('/events/list')) {
        return this.calendar.events.list;
      } else if (endpoint.includes('/events/get')) {
        return this.calendar.events.get;
      } else if (endpoint.includes('/events/patch')) {
        return this.calendar.events.patch;
      } else if (endpoint.includes('/events/delete')) {
        return this.calendar.events.delete;
      } else if (endpoint.includes('/freebusy/query')) {
        return this.calendar.freebusy.query;
      } else if (endpoint.includes('/calendarList/list')) {
        return this.calendar.calendarList.list;
      }
    }
    
    // People API methods
    if (service === 'people') {
      if (endpoint.includes('/people/me/connections')) {
        return this.people.people.connections.list;
      } else if (endpoint.includes('/people/createContact')) {
        return this.people.people.createContact;
      } else if (endpoint.includes('/people/updateContact')) {
        return this.people.people.updateContact;
      } else if (endpoint.includes('/people/deleteContact')) {
        return this.people.people.deleteContact;
      }
    }
    
    throw new Error(`Unsupported Google API endpoint: ${endpoint}`);
  }

  /**
   * Test Google API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple Gmail API call
      const response = await this.makeRequest({
        method: 'GET',
        endpoint: '/gmail/v1/users/me/profile',
        requiresAuth: true
      });
      
      return !!response.data;
    } catch (error) {
      this.logError('Google API connection test failed', error);
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
        hasAuth: !!this.auth,
        hasGmail: !!this.gmail,
        hasCalendar: !!this.calendar,
        hasPeople: !!this.people,
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
