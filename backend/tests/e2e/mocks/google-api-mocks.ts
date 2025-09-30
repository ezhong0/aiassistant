/**
 * Google API Mock Responses
 * Uses AI to generate realistic mock responses for Gmail, Calendar, and Contacts APIs
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

export class GoogleApiMocks {
  private aiMockGenerator: AIMockGenerator;

  constructor() {
    this.aiMockGenerator = new AIMockGenerator();
  }

  /**
   * Mock Gmail search results using AI
   */
  async searchEmails(query: string, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/gmail/v1/users/me/messages',
      method: 'GET',
      data: { q: query }
    };
    
    return this.aiMockGenerator.generateEmailMock(request, context);
  }

  /**
   * Mock email sending using AI
   */
  async sendEmail(emailData: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/gmail/v1/users/me/messages/send',
      method: 'POST',
      data: emailData
    };
    
    return this.aiMockGenerator.generateEmailMock(request, context);
  }

  /**
   * Mock calendar event listing using AI
   */
  async listCalendarEvents(query: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/calendar/v3/calendars/primary/events',
      method: 'GET',
      data: query
    };
    
    return this.aiMockGenerator.generateCalendarMock(request, context);
  }

  /**
   * Mock calendar event creation using AI
   */
  async createCalendarEvent(eventData: any, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/calendar/v3/calendars/primary/events',
      method: 'POST',
      data: eventData
    };
    
    return this.aiMockGenerator.generateCalendarMock(request, context);
  }

  /**
   * Mock contacts search using AI
   */
  async searchContacts(query: string, context: MockContext): Promise<APIResponse<any>> {
    const request: APIRequest = {
      endpoint: '/people/v1/people:searchContacts',
      method: 'GET',
      data: { query }
    };
    
    return this.aiMockGenerator.generateMockResponse('Google Contacts', request, context);
  }

  /**
   * Generic handler for any Google API request
   */
  async handleRequest(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    return this.aiMockGenerator.generateMockResponse('Google API', request, context);
  }

  /**
   * Get default response for any Google API request
   */
  async getDefaultResponse(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    const timestamp = new Date().toISOString();
    
    return {
      data: {
        id: `google-mock-${Date.now()}`,
        timestamp,
        service: 'Google API',
        endpoint: request.endpoint,
        method: request.method,
        mockData: true
      },
      statusCode: 200,
      headers: {},
      metadata: {
        requestId: `google-mock-${Date.now()}`,
        timestamp,
        executionTime: 0,
        mockGenerated: true
      }
    };
  }
}