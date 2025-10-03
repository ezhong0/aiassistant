/**
 * Unified Mock Manager for E2E Testing
 * 
 * Manages API mocking based on whole inbox data for comprehensive testing.
 * Provides realistic API responses that match the generated inbox data.
 */

import { BaseService } from '../../services/base-service';
import { InboxData, Email, CalendarEvent } from './whole-inbox-generator';

export interface MockContext {
  inboxData: InboxData;
  userProfile: any;
  currentTime?: Date;
  [key: string]: any;
}

export interface APIRequest {
  endpoint: string;
  method: string;
  data?: any;
  query?: any;
  headers?: any;
}

export interface APIResponse<T = any> {
  data: T;
  status: number;
  headers?: any;
  metadata?: {
    requestId: string;
    timestamp: string;
    mockSource: string;
  };
}

export interface ApiCallRecord {
  id: string;
  timestamp: Date;
  clientName: string;
  request: APIRequest;
  response: APIResponse;
  duration: number;
}

/**
 * Central API Mock Manager for E2E Testing
 */
export class UnifiedMockManager extends BaseService {
  private static instance: UnifiedMockManager;
  private callRecords: ApiCallRecord[] = [];
  private mockContext: MockContext = {};
  private inboxData: InboxData | null = null;

  constructor() {
    super('UnifiedMockManager');
  }

  static getInstance(): UnifiedMockManager {
    if (!UnifiedMockManager.instance) {
      UnifiedMockManager.instance = new UnifiedMockManager();
    }
    return UnifiedMockManager.instance;
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('UnifiedMockManager initialized');
  }

  /**
   * Setup mock context with inbox data
   */
  async setupMockContext(inboxData: InboxData, userProfile: any): Promise<void> {
    this.inboxData = inboxData;
    this.mockContext = {
      inboxData,
      userProfile,
      currentTime: new Date()
    };
    
    this.logInfo(`Mock context setup with ${inboxData.emails.length} emails and ${inboxData.calendar.length} calendar events`);
  }

  /**
   * Intercept API request and return mock response
   */
  async interceptRequest(clientName: string, request: APIRequest): Promise<APIResponse> {
    const startTime = Date.now();
    
    try {
      let response: APIResponse;
      
      switch (clientName) {
        case 'GoogleAPIClient':
          response = await this.handleGoogleApiRequest(request);
          break;
        case 'SlackAPIClient':
          response = await this.handleSlackApiRequest(request);
          break;
        default:
          response = this.getDefaultResponse(request);
      }
      
      const duration = Date.now() - startTime;
      
      // Record the API call
      this.recordApiCall(clientName, request, response, duration);
      
      return response;
      
    } catch (error) {
      this.logError(`Failed to handle ${clientName} request`, { error: error.message, request });
      return this.getErrorResponse(request, error);
    }
  }

  /**
   * Handle Google API requests
   */
  private async handleGoogleApiRequest(request: APIRequest): Promise<APIResponse> {
    const { endpoint, method, data, query } = request;

    // Gmail API
    if (endpoint.includes('/gmail/v1/users/me/messages')) {
      if (method === 'GET' && query?.q) {
        return this.mockGmailSearch(
          query.q as string,
          query.maxResults ? parseInt(query.maxResults as string) : 100,
          query.pageToken as string
        );
      }
      if (method === 'GET' && endpoint.includes('/messages/')) {
        return this.mockGmailGetMessage(endpoint);
      }
      if (method === 'POST' && endpoint.includes('/send')) {
        return this.mockGmailSendMessage(data);
      }
    }

    // Gmail Threads API
    if (endpoint.includes('/gmail/v1/users/me/threads')) {
      if (method === 'GET' && endpoint.includes('/threads/')) {
        return this.mockGmailGetThread(endpoint);
      }
      if (method === 'GET' && query?.q) {
        return this.mockGmailSearchThreads(
          query.q as string,
          query.maxResults ? parseInt(query.maxResults as string) : 100,
          query.pageToken as string
        );
      }
    }

    // Calendar API
    if (endpoint.includes('/calendar/v3/calendars')) {
      if (method === 'GET' && endpoint.includes('/events')) {
        return this.mockCalendarListEvents(query);
      }
      if (method === 'POST' && endpoint.includes('/events')) {
        return this.mockCalendarCreateEvent(data);
      }
    }

    // Contacts API
    if (endpoint.includes('/people/v1/people:searchContacts')) {
      return this.mockContactsSearch(query?.query as string);
    }

    // Default response
    return this.getDefaultResponse(request);
  }

  /**
   * Handle Slack API requests
   */
  private async handleSlackApiRequest(request: APIRequest): Promise<APIResponse> {
    const { endpoint, method, data, query } = request;

    // Slack Web API
    if (endpoint.includes('/api/')) {
      if (method === 'POST' && endpoint.includes('/chat.postMessage')) {
        return this.mockSlackPostMessage(data);
      }
      if (method === 'GET' && endpoint.includes('/conversations.list')) {
        return this.mockSlackListChannels(query);
      }
    }

    return this.getDefaultResponse(request);
  }

  /**
   * Mock Gmail search with pagination support
   */
  private mockGmailSearch(query: string, maxResults: number = 100, pageToken?: string): APIResponse {
    if (!this.inboxData) {
      return this.getDefaultResponse({ endpoint: '/gmail/v1/users/me/messages', method: 'GET' });
    }

    const matchingEmails = this.inboxData.emails.filter(email => 
      this.emailMatchesQuery(email, query)
    );

    // Handle pagination
    const startIndex = pageToken ? parseInt(pageToken) : 0;
    const endIndex = Math.min(startIndex + maxResults, matchingEmails.length);
    const paginatedEmails = matchingEmails.slice(startIndex, endIndex);

    const messages = paginatedEmails.map(email => ({
      id: email.id,
      threadId: email.threadId,
      snippet: email.snippet,
      labelIds: email.labelIds,
      sizeEstimate: email.sizeEstimate,
      historyId: email.historyId,
      internalDate: email.internalDate
    }));

    const response: any = {
      messages,
      resultSizeEstimate: matchingEmails.length
    };

    // Add nextPageToken if there are more results
    if (endIndex < matchingEmails.length) {
      response.nextPageToken = endIndex.toString();
    }

    return {
      data: response,
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'gmail-search'
      }
    };
  }

  /**
   * Mock Gmail get message
   */
  private mockGmailGetMessage(endpoint: string): APIResponse {
    if (!this.inboxData) {
      return this.getDefaultResponse({ endpoint, method: 'GET' });
    }

    const messageId = endpoint.split('/').pop();
    const email = this.inboxData.emails.find(e => e.id === messageId);

    if (!email) {
      return {
        data: { error: 'Message not found' },
        status: 404,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          mockSource: 'gmail-get-message'
        }
      };
    }

    return {
      data: {
        id: email.id,
        threadId: email.threadId,
        labelIds: email.labelIds,
        snippet: email.snippet,
        sizeEstimate: email.sizeEstimate,
        historyId: email.historyId,
        internalDate: email.internalDate,
        payload: email.payload
      },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'gmail-get-message'
      }
    };
  }

  /**
   * Mock Gmail get thread
   */
  private mockGmailGetThread(endpoint: string): APIResponse {
    if (!this.inboxData) {
      return this.getDefaultResponse({ endpoint, method: 'GET' });
    }

    const threadId = endpoint.split('/').pop();
    const threadEmails = this.inboxData.emails.filter(email => email.threadId === threadId);

    if (threadEmails.length === 0) {
      return {
        data: { error: 'Thread not found' },
        status: 404,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          mockSource: 'gmail-get-thread'
        }
      };
    }

    // Sort emails by date
    threadEmails.sort((a, b) => {
      const dateA = this.getDateFromHeaders(a.payload.headers);
      const dateB = this.getDateFromHeaders(b.payload.headers);
      return dateA.getTime() - dateB.getTime();
    });

    return {
      data: {
        id: threadId,
        snippet: threadEmails[0].snippet,
        historyId: threadEmails[0].historyId,
        messages: threadEmails.map(email => ({
          id: email.id,
          threadId: email.threadId,
          labelIds: email.labelIds,
          snippet: email.snippet,
          sizeEstimate: email.sizeEstimate,
          historyId: email.historyId,
          internalDate: email.internalDate,
          payload: email.payload
        }))
      },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'gmail-get-thread'
      }
    };
  }

  /**
   * Mock Gmail search threads
   */
  private mockGmailSearchThreads(query: string, maxResults: number = 100, pageToken?: string): APIResponse {
    if (!this.inboxData) {
      return this.getDefaultResponse({ endpoint: '/gmail/v1/users/me/threads', method: 'GET' });
    }

    const matchingEmails = this.inboxData.emails.filter(email => 
      this.emailMatchesQuery(email, query)
    );

    // Group by threadId
    const threadMap = new Map<string, Email[]>();
    matchingEmails.forEach(email => {
      if (!threadMap.has(email.threadId)) {
        threadMap.set(email.threadId, []);
      }
      threadMap.get(email.threadId)!.push(email);
    });

    const threads = Array.from(threadMap.values());
    
    // Handle pagination
    const startIndex = pageToken ? parseInt(pageToken) : 0;
    const endIndex = Math.min(startIndex + maxResults, threads.length);
    const paginatedThreads = threads.slice(startIndex, endIndex);

    const threadList = paginatedThreads.map(threadEmails => {
      // Sort emails in thread by date
      threadEmails.sort((a, b) => {
        const dateA = this.getDateFromHeaders(a.payload.headers);
        const dateB = this.getDateFromHeaders(b.payload.headers);
        return dateA.getTime() - dateB.getTime();
      });

      return {
        id: threadEmails[0].threadId,
        snippet: threadEmails[0].snippet,
        historyId: threadEmails[0].historyId
      };
    });

    const response: any = {
      threads: threadList,
      resultSizeEstimate: threads.length
    };

    // Add nextPageToken if there are more results
    if (endIndex < threads.length) {
      response.nextPageToken = endIndex.toString();
    }

    return {
      data: response,
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'gmail-search-threads'
      }
    };
  }

  /**
   * Get date from email headers
   */
  private getDateFromHeaders(headers: Array<{ name: string; value: string }>): Date {
    const dateHeader = headers.find(h => h.name === 'Date');
    if (dateHeader) {
      return new Date(dateHeader.value);
    }
    return new Date();
  }

  /**
   * Mock Gmail send message
   */
  private mockGmailSendMessage(data: any): APIResponse {
    return {
      data: {
        id: this.generateMessageId(),
        threadId: this.generateThreadId(),
        labelIds: ['SENT']
      },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'gmail-send-message'
      }
    };
  /**
   * Mock Calendar list events
   */
  private mockCalendarListEvents(query: any): APIResponse {
    if (!this.inboxData) {
      return this.getDefaultResponse({ endpoint: '/calendar/v3/calendars/primary/events', method: 'GET' });
    }

    const events = this.inboxData.calendar.map(event => ({
      id: event.id,
      summary: event.title,
      description: event.description,
      start: {
        dateTime: event.start,
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: event.end,
        timeZone: 'America/New_York'
      },
      attendees: event.attendees.map(email => ({ email })),
      location: event.location,
      status: event.status
    }));

    return {
      data: {
        items: events,
        kind: 'calendar#events'
      },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'calendar-list-events'
      }
    };
  }

  /**
   * Mock Calendar create event
   */
  private mockCalendarCreateEvent(data: any): APIResponse {
    return {
      data: {
        id: this.generateEventId(),
        summary: data.summary,
        description: data.description,
        start: data.start,
        end: data.end,
        attendees: data.attendees,
        location: data.location,
        status: 'confirmed'
      },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'calendar-create-event'
      }
    };
  }

  /**
   * Mock Contacts search
   */
  private mockContactsSearch(query: string): APIResponse {
    // Generate realistic contact data based on inbox emails
    const contacts = this.inboxData?.emails
      .filter(email => 
        email.sender.name.toLowerCase().includes(query.toLowerCase()) ||
        email.sender.email.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10)
      .map(email => ({
        resourceName: `people/${this.generateContactId()}`,
        names: [{
          displayName: email.sender.name,
          givenName: email.sender.name.split(' ')[0],
          familyName: email.sender.name.split(' ').slice(1).join(' ')
        }],
        emailAddresses: [{
          value: email.sender.email,
          type: 'work'
        }]
      })) || [];

    return {
      data: {
        results: contacts
      },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'contacts-search'
      }
    };
  }

  /**
   * Mock Slack post message
   */
  private mockSlackPostMessage(data: any): APIResponse {
    return {
      data: {
        ok: true,
        channel: data.channel,
        ts: Date.now().toString(),
        message: {
          text: data.text,
          user: 'U1234567890',
          type: 'message'
        }
      },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'slack-post-message'
      }
    };
  }

  /**
   * Mock Slack list channels
   */
  private mockSlackListChannels(query: any): APIResponse {
    return {
      data: {
        ok: true,
        channels: [
          {
            id: 'C1234567890',
            name: 'general',
            is_channel: true,
            is_member: true
          },
          {
            id: 'C0987654321',
            name: 'random',
            is_channel: true,
            is_member: true
          }
        ]
      },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'slack-list-channels'
      }
    };
  }

  /**
   * Check if email matches search query
   */
  private emailMatchesQuery(email: Email, query: string): boolean {
    const queryLower = query.toLowerCase();
    
    // Check subject from headers
    const subjectHeader = email.payload.headers.find(h => h.name.toLowerCase() === 'subject');
    if (subjectHeader && subjectHeader.value.toLowerCase().includes(queryLower)) return true;
    
    // Check sender from headers
    const fromHeader = email.payload.headers.find(h => h.name.toLowerCase() === 'from');
    if (fromHeader && fromHeader.value.toLowerCase().includes(queryLower)) return true;
    
    // Check snippet
    if (email.snippet.toLowerCase().includes(queryLower)) return true;
    
    // Check labels
    if (email.labelIds.some(label => label.toLowerCase().includes(queryLower))) return true;
    
    // Check metadata for internal categorization
    if (email.metadata.category.toLowerCase().includes(queryLower)) return true;
    
    // Check body content from metadata
    if (email.metadata.content.body.toLowerCase().includes(queryLower)) return true;
    
    return false;
  }

  /**
   * Record API call for analysis
   */
  private recordApiCall(clientName: string, request: APIRequest, response: APIResponse, duration: number): void {
    const record: ApiCallRecord = {
      id: this.generateRequestId(),
      timestamp: new Date(),
      clientName,
      request,
      response,
      duration
    };
    
    this.callRecords.push(record);
    
    // Keep only last 1000 records
    if (this.callRecords.length > 1000) {
      this.callRecords = this.callRecords.slice(-1000);
    }
  }

  /**
   * Get API call records
   */
  getApiCallRecords(): ApiCallRecord[] {
    return [...this.callRecords];
  }

  /**
   * Clear API call records
   */
  clearApiCallRecords(): void {
    this.callRecords = [];
  }

  /**
   * Get default response
   */
  private getDefaultResponse(request: APIRequest): APIResponse {
    return {
      data: { message: 'Mock response' },
      status: 200,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'default'
      }
    };
  }

  /**
   * Get error response
   */
  private getErrorResponse(request: APIRequest, error: any): APIResponse {
    return {
      data: { error: error.message },
      status: 500,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        mockSource: 'error'
      }
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique thread ID
   */
  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique contact ID
   */
  private generateContactId(): string {
    return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
