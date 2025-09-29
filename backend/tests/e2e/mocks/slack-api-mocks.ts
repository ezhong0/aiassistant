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
  async sendMessage(messageData: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/chat.postMessage',
      method: 'POST',
      data: messageData
    };
    
    return this.aiMockGenerator.generateSlackMock(request, context);
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
   * Mock Slack user info using AI
   */
  async getUserInfo(userId: string, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/users.info',
      method: 'GET',
      data: { user: userId }
    };
    
    return this.aiMockGenerator.generateSlackMock(request, context);
  }

  /**
   * Mock Slack conversation history using AI
   */
  async getConversationHistory(channelId: string, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/conversations.history',
      method: 'GET',
      data: { channel: channelId }
    };
    
    return this.aiMockGenerator.generateSlackMock(request, context);
  }

  /**
   * Generic handler for any Slack API request
   */
  async handleRequest(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    return this.aiMockGenerator.generateSlackMock(request, context);
  }
}