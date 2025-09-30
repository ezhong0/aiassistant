/**
 * Slack API Mock Responses
 * Uses AI to generate realistic mock responses for Slack APIs
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

export class SlackApiMocks {
  private aiMockGenerator: AIMockGenerator;

  constructor() {
    this.aiMockGenerator = new AIMockGenerator();
  }

  /**
   * Mock Slack message sending using AI
   */
  async postMessage(messageData: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/chat.postMessage',
      method: 'POST',
      data: messageData
    };
    
    return this.aiMockGenerator.generateSlackMock(request, context);
  }

  /**
   * Mock Slack message sending using AI (alias)
   */
  async sendMessage(messageData: any, context: MockContext): Promise<APIResponse<any>> {
    return this.postMessage(messageData, context);
  }

  /**
   * Mock Slack channel info using AI
   */
  async getChannelInfo(channelId: string, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/conversations.info',
      method: 'GET',
      data: { channel: channelId }
    };
    
    return this.aiMockGenerator.generateSlackMock(request, context);
  }

  /**
   * Mock Slack conversation history using AI
   */
  async getConversationHistory(data: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/conversations.history',
      method: 'GET',
      data: data
    };
    
    return this.aiMockGenerator.generateSlackMock(request, context);
  }

  /**
   * Mock Slack user info using AI
   */
  async getUserInfo(data: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/users.info',
      method: 'GET',
      data: data
    };
    
    return this.aiMockGenerator.generateSlackMock(request, context);
  }

  /**
   * Generic handler for any Slack API request
   */
  async handleRequest(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    return this.aiMockGenerator.generateSlackMock(request, context);
  }

  /**
   * Get default response for any Slack API request
   */
  async getDefaultResponse(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    const timestamp = new Date().toISOString();
    
    return {
      data: {
        ok: true,
        id: `slack-mock-${Date.now()}`,
        timestamp,
        service: 'Slack API',
        endpoint: request.endpoint,
        method: request.method,
        mockData: true
      },
      statusCode: 200,
      headers: {},
      metadata: {
        requestId: `slack-mock-${Date.now()}`,
        timestamp,
        executionTime: 0,
        mockGenerated: true
      }
    };
  }
}