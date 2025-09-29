/**
 * AI Mock Generator
 * Uses OpenAI to generate realistic mock responses for external APIs
 */

import { APIRequest, APIResponse } from '../../../src/types/api/api-client.types';
import { GenericAIService } from '../../../src/services/generic-ai.service';
import { serviceManager } from '../../../src/services/service-manager';
import logger from '../../../src/utils/logger';

interface MockContext {
  testScenarioId?: string;
  userId?: string;
  userEmail?: string;
  currentTime?: Date;
  [key: string]: any;
}

export class AIMockGenerator {
  private aiService: GenericAIService;

  constructor() {
    this.aiService = serviceManager.getService<GenericAIService>('genericAIService')!;
  }

  /**
   * Generate a realistic mock response for any external API using AI
   */
  async generateMockResponse<T = any>(
    serviceName: string,
    request: APIRequest,
    context: MockContext
  ): Promise<APIResponse<T>> {
    try {
      const prompt = this.buildMockGenerationPrompt(serviceName, request, context);
      
      const response = await this.aiService.executePrompt({
        systemPrompt: `You are an expert at generating realistic API responses. Generate a JSON response that matches the expected format for the ${serviceName} API.`,
        userPrompt: prompt,
        schema: {
          type: 'object',
          description: `Realistic ${serviceName} API response`,
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            status: { type: 'number' },
            statusText: { type: 'string' },
            metadata: { type: 'object' }
          },
          required: ['success', 'data', 'status', 'statusText']
        }
      });

      if (response.success && response.data) {
        return response.data as APIResponse<T>;
      } else {
        throw new Error('Failed to generate AI mock response');
      }
    } catch (error) {
      logger.error('Failed to generate AI mock response', error as Error, {
        serviceName,
        endpoint: request.endpoint,
        method: request.method
      });
      
      // Fallback to basic mock response
      return this.generateFallbackResponse<T>(serviceName, request);
    }
  }

  /**
   * Build a prompt for AI to generate realistic mock responses
   */
  private buildMockGenerationPrompt(
    serviceName: string,
    request: APIRequest,
    context: MockContext
  ): string {
    const testScenario = context.testScenarioId || 'unknown';
    const userEmail = context.userEmail || 'user@example.com';
    const currentTime = context.currentTime || new Date();

    return `
Generate a realistic ${serviceName} API response for the following request:

**Request Details:**
- Endpoint: ${request.endpoint}
- Method: ${request.method}
- Test Scenario: ${testScenario}
- User Email: ${userEmail}
- Current Time: ${currentTime.toISOString()}

**Request Data:**
${JSON.stringify(request.data || {}, null, 2)}

**Context:**
${JSON.stringify(context, null, 2)}

**Requirements:**
1. Generate a realistic response that would be returned by the actual ${serviceName} API
2. Include appropriate success/error status
3. Provide realistic data that matches the request
4. Include proper HTTP status codes
5. Add realistic metadata (timestamps, IDs, etc.)
6. Make the response contextually appropriate for the test scenario

**Response Format:**
Return a JSON object with:
- success: boolean
- data: object (the actual API response data)
- status: number (HTTP status code)
- statusText: string (HTTP status text)
- metadata: object (additional response metadata)

Generate a response that would be realistic for this specific request and context.
`;
  }

  /**
   * Generate a fallback response when AI generation fails
   */
  private generateFallbackResponse<T = any>(
    serviceName: string,
    request: APIRequest
  ): APIResponse<T> {
    const timestamp = new Date().toISOString();
    
    return {
      success: true,
      data: {
        id: `mock-${Date.now()}`,
        timestamp,
        service: serviceName,
        endpoint: request.endpoint,
        method: request.method,
        mockData: true
      } as T,
      status: 200,
      statusText: 'OK',
      metadata: {
        requestId: `mock-${Date.now()}`,
        timestamp,
        mockGenerated: true,
        fallback: true
      }
    };
  }

  /**
   * Generate specific mock responses for common API patterns
   */
  async generateEmailMock(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    const prompt = `
Generate a realistic Gmail API response for:
- Endpoint: ${request.endpoint}
- Method: ${request.method}
- Test Scenario: ${context.testScenarioId}

For email search requests, return a list of mock emails.
For email send requests, return a success response with message ID.
For email get requests, return a single email object.

Make the response realistic and contextually appropriate.
`;

    return this.generateMockResponse('Gmail', request, context);
  }

  async generateCalendarMock(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    const prompt = `
Generate a realistic Google Calendar API response for:
- Endpoint: ${request.endpoint}
- Method: ${request.method}
- Test Scenario: ${context.testScenarioId}

For event creation, return a success response with event ID.
For event search, return a list of mock events.
For event updates, return the updated event.

Make the response realistic and contextually appropriate.
`;

    return this.generateMockResponse('Google Calendar', request, context);
  }

  async generateSlackMock(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    const prompt = `
Generate a realistic Slack API response for:
- Endpoint: ${request.endpoint}
- Method: ${request.method}
- Test Scenario: ${context.testScenarioId}

For message sending, return a success response with message timestamp.
For channel info, return channel details.
For user info, return user details.

Make the response realistic and contextually appropriate.
`;

    return this.generateMockResponse('Slack', request, context);
  }
}
