/**
 * Google API Mock Responses
 * Realistic mock responses for Gmail, Calendar, and Contacts APIs
 */

import { APIRequest, APIResponse } from '../../../src/types/api/api-client.types';

interface MockContext {
  testScenarioId?: string;
  userId?: string;
  userEmail?: string;
  currentTime?: Date;
  [key: string]: any;
}

export class GoogleApiMocks {

  /**
   * Mock Gmail search results
   */
  async searchEmails(query: string, context: MockContext): Promise<APIResponse<any>> {
    const mockEmails = this.generateMockEmails(query, context);

    return {
      success: true,
      data: {
        messages: mockEmails,
        nextPageToken: mockEmails.length > 10 ? 'mock_next_page_token' : undefined,
        resultSizeEstimate: mockEmails.length
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: `/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
      metadata: {
        requestId: `gmail-search-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 250,
        cached: false
      }
    };
  }

  /**
   * Mock email sending
   */
  async sendEmail(emailData: any, context: MockContext): Promise<APIResponse<any>> {
    const messageId = `mock_message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      data: {
        id: messageId,
        threadId: `mock_thread_${Date.now()}`,
        labelIds: ['SENT']
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/gmail/v1/users/me/messages/send',
      metadata: {
        requestId: `gmail-send-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 180,
        cached: false
      }
    };
  }

  /**
   * Mock calendar event listing
   */
  async listCalendarEvents(query: any, context: MockContext): Promise<APIResponse<any>> {
    const mockEvents = this.generateMockCalendarEvents(query, context);

    return {
      success: true,
      data: {
        kind: 'calendar#events',
        etag: 'mock_etag',
        summary: 'Primary Calendar',
        items: mockEvents,
        nextPageToken: mockEvents.length > 10 ? 'mock_calendar_next_page' : undefined
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/calendar/v3/calendars/primary/events',
      metadata: {
        requestId: `calendar-list-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 200,
        cached: false
      }
    };
  }

  /**
   * Mock calendar event creation
   */
  async createCalendarEvent(eventData: any, context: MockContext): Promise<APIResponse<any>> {
    const eventId = `mock_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      data: {
        kind: 'calendar#event',
        id: eventId,
        status: 'confirmed',
        htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
        summary: eventData.summary || 'Mock Event',
        description: eventData.description,
        start: eventData.start || {
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York'
        },
        end: eventData.end || {
          dateTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: eventData.attendees || [],
        organizer: {
          email: context.userEmail || 'user@example.com',
          displayName: 'Test User'
        },
        creator: {
          email: context.userEmail || 'user@example.com',
          displayName: 'Test User'
        }
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/calendar/v3/calendars/primary/events',
      metadata: {
        requestId: `calendar-create-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 220,
        cached: false
      }
    };
  }

  /**
   * Mock contacts search
   */
  async searchContacts(query: string, context: MockContext): Promise<APIResponse<any>> {
    const mockContacts = this.generateMockContacts(query, context);

    return {
      success: true,
      data: {
        results: mockContacts,
        nextPageToken: mockContacts.length > 10 ? 'mock_contacts_next_page' : undefined
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: '/people/v1/people:searchContacts',
      metadata: {
        requestId: `contacts-search-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 150,
        cached: false
      }
    };
  }

  /**
   * Generate realistic mock emails based on query
   */
  private generateMockEmails(query: string, context: MockContext): any[] {
    const baseEmails = [
      {
        id: 'mock_email_1',
        threadId: 'mock_thread_1',
        snippet: 'Meeting tomorrow at 2pm - looking forward to discussing the project proposal',
        payload: {
          headers: [
            { name: 'From', value: 'john.doe@company.com' },
            { name: 'Subject', value: 'Project Meeting Tomorrow' },
            { name: 'Date', value: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
          ]
        }
      },
      {
        id: 'mock_email_2',
        threadId: 'mock_thread_2',
        snippet: 'Weekly report attached - please review the latest metrics and KPIs',
        payload: {
          headers: [
            { name: 'From', value: 'sarah.johnson@company.com' },
            { name: 'Subject', value: 'Weekly Report - Q4 Metrics' },
            { name: 'Date', value: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
          ]
        }
      },
      {
        id: 'mock_email_3',
        threadId: 'mock_thread_3',
        snippet: 'Client feedback on the proposal - they loved the innovative approach',
        payload: {
          headers: [
            { name: 'From', value: 'client@example.com' },
            { name: 'Subject', value: 'Re: Proposal Feedback' },
            { name: 'Date', value: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
          ]
        }
      }
    ];

    // Filter based on query if provided
    if (query && query !== '*') {
      return baseEmails.filter(email =>
        email.snippet.toLowerCase().includes(query.toLowerCase()) ||
        email.payload.headers.some(header =>
          header.value.toLowerCase().includes(query.toLowerCase())
        )
      );
    }

    return baseEmails;
  }

  /**
   * Generate realistic mock calendar events
   */
  private generateMockCalendarEvents(query: any, context: MockContext): any[] {
    const currentTime = context.currentTime || new Date();
    const tomorrow = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000);

    return [
      {
        kind: 'calendar#event',
        id: 'mock_event_1',
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event?eid=mock_event_1',
        summary: 'Team Standup',
        description: 'Daily standup meeting',
        start: {
          dateTime: new Date(tomorrow.setHours(9, 0, 0, 0)).toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: new Date(tomorrow.setHours(9, 30, 0, 0)).toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: [
          { email: 'team@company.com', responseStatus: 'accepted' }
        ]
      },
      {
        kind: 'calendar#event',
        id: 'mock_event_2',
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event?eid=mock_event_2',
        summary: 'Client Presentation',
        description: 'Q4 results presentation to client',
        start: {
          dateTime: new Date(nextWeek.setHours(14, 0, 0, 0)).toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: new Date(nextWeek.setHours(15, 0, 0, 0)).toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: [
          { email: 'client@example.com', responseStatus: 'needsAction' },
          { email: context.userEmail || 'user@example.com', responseStatus: 'accepted' }
        ]
      }
    ];
  }

  /**
   * Generate realistic mock contacts
   */
  private generateMockContacts(query: string, context: MockContext): any[] {
    const baseContacts = [
      {
        resourceName: 'people/mock_contact_1',
        names: [{ displayName: 'John Doe', givenName: 'John', familyName: 'Doe' }],
        emailAddresses: [{ value: 'john.doe@company.com', type: 'work' }],
        phoneNumbers: [{ value: '+1-555-123-4567', type: 'work' }],
        organizations: [{ name: 'Tech Company Inc', title: 'Senior Developer' }]
      },
      {
        resourceName: 'people/mock_contact_2',
        names: [{ displayName: 'Sarah Johnson', givenName: 'Sarah', familyName: 'Johnson' }],
        emailAddresses: [{ value: 'sarah.johnson@company.com', type: 'work' }],
        phoneNumbers: [{ value: '+1-555-987-6543', type: 'work' }],
        organizations: [{ name: 'Tech Company Inc', title: 'Product Manager' }]
      }
    ];

    // Filter based on query if provided
    if (query) {
      return baseContacts.filter(contact =>
        contact.names[0].displayName.toLowerCase().includes(query.toLowerCase()) ||
        contact.emailAddresses[0].value.toLowerCase().includes(query.toLowerCase())
      );
    }

    return baseContacts;
  }

  /**
   * Default response for unhandled endpoints
   */
  async getDefaultResponse(request: APIRequest, context: MockContext): Promise<APIResponse<any>> {
    return {
      success: true,
      data: {
        message: 'Mock response for Google API',
        endpoint: request.endpoint,
        method: request.method,
        timestamp: new Date().toISOString()
      },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      url: request.endpoint,
      metadata: {
        requestId: `google-default-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 100,
        cached: false
      }
    };
  }
}