/**
 * OpenAI API Mock Responses
 * Uses AI to generate realistic mock responses for OpenAI APIs
 */

import { APIRequest, APIResponse } from '../../../src/types/api/api-client.types';
import { AIMockGenerator } from './ai-mock-generator';

interface MockContext {
  testScenarioId?: string;
  userId?: string;
  userEmail?: string;
  currentTime?: Date;
  [key: string]: any;
}

export class OpenAiApiMocks {
  private aiMockGenerator: AIMockGenerator;

  constructor() {
    this.aiMockGenerator = new AIMockGenerator();
  }

  /**
   * Mock OpenAI chat completion using AI
   */
  async chatCompletion(data: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/chat/completions',
      method: 'POST',
      data: data
    };
    
    return this.aiMockGenerator.generateMockResponse('OpenAI', request, context);
  }

  /**
   * Mock OpenAI embeddings generation using AI
   */
  async generateEmbeddings(data: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/embeddings',
      method: 'POST',
      data: data
    };
    
    return this.aiMockGenerator.generateMockResponse('OpenAI', request, context);
  }

  /**
   * Generic handler for any OpenAI API request
   */
  async handleRequest(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    return this.aiMockGenerator.generateMockResponse('OpenAI', request, context);
  }

  /**
   * Get default response for any OpenAI API request
   */
  async getDefaultResponse(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    const timestamp = new Date().toISOString();
    
    return {
      success: true,
      data: {
        id: `openai-mock-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a mock response from OpenAI API for testing purposes.'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      },
      status: 200,
      statusText: 'OK',
      metadata: {
        requestId: `openai-mock-${Date.now()}`,
        timestamp,
        mockGenerated: true
      }
    };
  }
}

