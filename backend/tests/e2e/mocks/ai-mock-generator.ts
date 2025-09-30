/**
 * AI Mock Generator
 * Uses OpenAI to generate realistic mock responses for external APIs
 */

import { APIRequest, APIResponse } from '../../../src/types/api/api-client.types';
import { GenericAIService } from '../../../src/services/generic-ai.service';
import logger from '../../../src/utils/logger';

interface MockContext {
  testScenarioId?: string;
  userId?: string;
  userEmail?: string;
  currentTime?: Date;
  [key: string]: any;
}

export class AIMockGenerator {
  private aiService: GenericAIService | null = null;

  constructor(aiService?: GenericAIService) {
    if (aiService) {
      this.aiService = aiService;
    } else {
      logger.warn('AI service not provided for mock generation, using fallback responses', {
        operation: 'ai_mock_generator_init'
      });
      this.aiService = null;
    }
  }

  /**
   * Generate a realistic mock response for any external API using fallback responses
   * Note: In E2E testing, we use fallback responses to avoid circular dependencies
   */
  async generateMockResponse<T = any>(
    serviceName: string,
    request: APIRequest,
    context: MockContext
  ): Promise<APIResponse<T>> {
    logger.info('Generating fallback mock response for E2E testing', {
      serviceName,
      endpoint: request.endpoint,
      method: request.method,
      testScenario: context.testScenarioId
    });
    
    // Always use fallback responses in E2E testing to avoid circular dependencies
    return this.generateFallbackResponse<T>(serviceName, request);
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
    
    // Generate service-specific mock responses
    if (serviceName === 'OpenAI' && request.endpoint === '/chat/completions') {
      // Check if this is a function call request (structured data generation)
      const requestData = request.data as any;
      const hasFunctionCall = requestData?.function_call || requestData?.functions;
      
      if (hasFunctionCall) {
        // Return function call response for structured data
        return {
          data: {
            id: `chatcmpl-mock-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: null,
                  function_call: {
                    name: 'structured_response',
                    arguments: JSON.stringify({
                      context: `GOAL: Process the user request and provide appropriate response
ENTITIES: user, request
CONSTRAINTS: E2E testing environment
DATA: {}
PROGRESS: Request received, Analysis completed
BLOCKERS: []
NEXT: Execute appropriate action
CURRENT_TIME: ${new Date().toISOString()}
RISK_LEVEL: low
OUTPUT_STRATEGY: direct
CONFIDENCE: 0.9
NOTES: Mock response for E2E testing`
                    })
                  }
                },
                finish_reason: 'function_call'
              }
            ],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 25,
              total_tokens: 75
            }
          } as T,
          statusCode: 200,
          headers: {},
          metadata: {
            requestId: `openai-mock-${Date.now()}`,
            timestamp,
            executionTime: 0,
            mockGenerated: true,
            fallback: true
          }
        };
      } else {
        // Return regular chat completion response
        return {
          data: {
            id: `chatcmpl-mock-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'This is a mock response from OpenAI API for E2E testing purposes. The request has been successfully processed.'
                },
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 25,
              total_tokens: 75
            }
          } as T,
          statusCode: 200,
          headers: {},
          metadata: {
            requestId: `openai-mock-${Date.now()}`,
            timestamp,
            executionTime: 0,
            mockGenerated: true,
            fallback: true
          }
        };
      }
    }
    
    // Default fallback response for other services
    return {
      data: {
        id: `mock-${Date.now()}`,
        timestamp,
        service: serviceName,
        endpoint: request.endpoint,
        method: request.method,
        mockData: true
      } as T,
      statusCode: 200,
      headers: {},
      metadata: {
        requestId: `mock-${Date.now()}`,
        timestamp,
        executionTime: 0,
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
