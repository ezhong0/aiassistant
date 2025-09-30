/**
 * API Mock Manager
 * Intercepts and mocks external API calls during E2E testing
 *
 * NOTE: OpenAI API calls are NOT mocked - they go through to the real OpenAI API.
 * Only external service APIs (Google, Slack, etc.) are mocked.
 */

import { APIRequest, APIResponse } from '../../../src/types/api/api-client.types';
import logger from '../../../src/utils/logger';
import { GoogleApiMocks } from '../mocks/google-api-mocks';
import { SlackApiMocks } from '../mocks/slack-api-mocks';

interface ApiCallRecord {
  timestamp: Date;
  clientName: string;
  request: APIRequest;
  response: APIResponse;
  duration: number;
}

interface MockContext {
  testScenarioId?: string;
  userId?: string;
  userEmail?: string;
  currentTime?: Date;
  [key: string]: any;
}

/**
 * Central API Mock Manager for E2E Testing
 *
 * Handles interception and mocking of external APIs (Google, Slack, etc.)
 * OpenAI calls are NOT mocked - they flow through to the real OpenAI API for authentic AI responses.
 */
export class ApiMockManager {
  private static instance: ApiMockManager;
  private callRecords: ApiCallRecord[] = [];
  private mockContext: MockContext = {};
  private mockResponders: Map<string, any> = new Map();

  constructor() {
    // Initialize mock responders for external APIs (OpenAI is NOT mocked - it uses real API)
    this.mockResponders.set('GoogleAPIClient', new GoogleApiMocks());
    this.mockResponders.set('SlackAPIClient', new SlackApiMocks());
  }

  static getInstance(): ApiMockManager {
    if (!ApiMockManager.instance) {
      ApiMockManager.instance = new ApiMockManager();
    }
    return ApiMockManager.instance;
  }

  /**
   * Set context for mock responses (e.g., test scenario, user info)
   */
  setMockContext(context: MockContext): void {
    this.mockContext = { ...this.mockContext, ...context };

    logger.info('Mock context updated', {
      operation: 'e2e_mock_context_set',
      context: this.mockContext
    });
  }

  /**
   * Intercept API request and return mock response
   */
  static async interceptRequest<T = any>(
    clientName: string,
    request: APIRequest
  ): Promise<APIResponse<T>> {
    const instance = ApiMockManager.getInstance();
    return instance.handleRequest<T>(clientName, request);
  }

  /**
   * Record API call for OpenAI (real calls that should be tracked)
   */
  static recordOpenAICall<T = any>(
    request: APIRequest,
    response: APIResponse<T>,
    duration: number
  ): void {
    const instance = ApiMockManager.getInstance();
    const callRecord: ApiCallRecord = {
      timestamp: new Date(),
      clientName: 'OpenAIClient',
      request: { ...request },
      response,
      duration
    };
    instance.callRecords.push(callRecord);
    
    logger.info('OpenAI API call recorded for E2E testing', {
      operation: 'e2e_openai_call_recorded',
      endpoint: request.endpoint,
      duration,
      statusCode: response.statusCode
    });
  }

  /**
   * Handle individual API request with appropriate mock
   */
  private async handleRequest<T = any>(
    clientName: string,
    request: APIRequest
  ): Promise<APIResponse<T>> {
    const startTime = Date.now();

    logger.info('Intercepting API request for E2E testing', {
      operation: 'e2e_api_intercept',
      client: clientName,
      endpoint: request.endpoint,
      method: request.method,
      testScenario: this.mockContext.testScenarioId
    });

    try {
      // Get appropriate mock responder
      const mockResponder = this.mockResponders.get(clientName);
      if (!mockResponder) {
        throw new Error(`No mock responder found for client: ${clientName}`);
      }

      // Generate mock response
      const mockResponse = await this.generateMockResponse<T>(
        clientName,
        request,
        mockResponder
      );

      // Add realistic delay
      await this.addRealisticDelay(clientName, request.endpoint);

      // Record the API call
      const callRecord: ApiCallRecord = {
        timestamp: new Date(),
        clientName,
        request: { ...request },
        response: mockResponse,
        duration: Date.now() - startTime
      };

      this.callRecords.push(callRecord);

      logger.info('Mock API response generated', {
        operation: 'e2e_mock_response',
        client: clientName,
        endpoint: request.endpoint,
        duration: callRecord.duration,
        statusCode: mockResponse.statusCode
      });

      return mockResponse;

    } catch (error) {
      logger.error('Failed to generate mock response', error as Error, {
        operation: 'e2e_mock_error',
        client: clientName,
        endpoint: request.endpoint
      });

      // Return error response
      return {
        data: null as T,
        statusCode: 500,
        headers: {},
        metadata: {
          requestId: `mock-error-${Date.now()}`,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          executionTime: Date.now() - startTime,
          cached: false
        }
      };
    }
  }

  /**
   * Generate mock response using appropriate responder
   */
  private async generateMockResponse<T = any>(
    clientName: string,
    request: APIRequest,
    mockResponder: any
  ): Promise<APIResponse<T>> {
    // Route to appropriate mock method based on endpoint and client
    // Note: OpenAI is NOT included here - it uses the real API
    switch (clientName) {
      case 'GoogleAPIClient':
        return this.handleGoogleApiRequest<T>(request, mockResponder);

      case 'SlackAPIClient':
        return this.handleSlackApiRequest<T>(request, mockResponder);

      default:
        throw new Error(`Unsupported client for mocking: ${clientName}`);
    }
  }

  /**
   * Handle Google API requests
   */
  private async handleGoogleApiRequest<T = any>(
    request: APIRequest,
    mockResponder: GoogleApiMocks
  ): Promise<APIResponse<T>> {
    const { endpoint, method, data, query } = request;

    // Gmail API
    if (endpoint.includes('/gmail/v1/users/me/messages')) {
      if (method === 'GET' && query?.q) {
        return mockResponder.searchEmails(query.q as string, this.mockContext);
      }
      if (method === 'POST') {
        return mockResponder.sendEmail(data, this.mockContext);
      }
    }

    // Calendar API
    if (endpoint.includes('/calendar/v3/calendars')) {
      if (method === 'GET' && endpoint.includes('/events')) {
        return mockResponder.listCalendarEvents(query, this.mockContext);
      }
      if (method === 'POST' && endpoint.includes('/events')) {
        return mockResponder.createCalendarEvent(data, this.mockContext);
      }
    }

    // Contacts API
    if (endpoint.includes('/people/v1/people:searchContacts')) {
      return mockResponder.searchContacts(query?.query as string, this.mockContext);
    }

    // Default response
    return mockResponder.getDefaultResponse(request, this.mockContext);
  }

  /**
   * Handle Slack API requests
   */
  private async handleSlackApiRequest<T = any>(
    request: APIRequest,
    mockResponder: SlackApiMocks
  ): Promise<APIResponse<T>> {
    const { endpoint, method, data } = request;

    if (endpoint === '/chat.postMessage') {
      return mockResponder.postMessage(data, this.mockContext);
    }

    if (endpoint === '/conversations.history') {
      return mockResponder.getConversationHistory(data, this.mockContext);
    }

    if (endpoint === '/users.info') {
      return mockResponder.getUserInfo(data, this.mockContext);
    }

    return mockResponder.getDefaultResponse(request, this.mockContext);
  }

  /**
   * Add realistic delay based on API type and endpoint
   */
  private async addRealisticDelay(clientName: string, endpoint: string): Promise<void> {
    let delayMs = 100; // Default delay

    // Simulate realistic API response times
    switch (clientName) {
      case 'GoogleAPIClient':
        delayMs = endpoint.includes('/gmail/') ? 300 :
                 endpoint.includes('/calendar/') ? 200 :
                 endpoint.includes('/people/') ? 150 : 200;
        break;

      case 'SlackAPIClient':
        delayMs = 150;
        break;
    }

    // Add some randomness
    delayMs += Math.random() * 100;

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Get all recorded API calls for analysis
   */
  getApiCallRecords(): ApiCallRecord[] {
    return [...this.callRecords];
  }

  /**
   * Clear call records (between tests)
   */
  clearCallRecords(): void {
    this.callRecords = [];
    logger.info('API call records cleared', {
      operation: 'e2e_records_cleared'
    });
  }

  /**
   * Get API call statistics
   */
  getCallStatistics() {
    const records = this.callRecords;
    const clientStats = new Map<string, number>();
    const endpointStats = new Map<string, number>();
    let totalDuration = 0;

    records.forEach(record => {
      clientStats.set(record.clientName, (clientStats.get(record.clientName) || 0) + 1);
      endpointStats.set(record.request.endpoint, (endpointStats.get(record.request.endpoint) || 0) + 1);
      totalDuration += record.duration;
    });

    return {
      totalCalls: records.length,
      averageDuration: records.length > 0 ? totalDuration / records.length : 0,
      clientBreakdown: Object.fromEntries(clientStats),
      endpointBreakdown: Object.fromEntries(endpointStats),
      totalDuration
    };
  }
}

// Export singleton instance as default
export default ApiMockManager.getInstance();