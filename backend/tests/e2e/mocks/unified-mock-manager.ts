/**
 * Unified Mock Manager for E2E Testing
 *
 * Manages API mocking based on whole inbox data for comprehensive testing.
 * Provides realistic API responses that match the generated inbox data.
 */

import { GeneratedInbox, GeneratedEmail } from '../generators/hyper-realistic-inbox';

// Gmail API compatible email structure
interface Email {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  sizeEstimate?: number;
  historyId?: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data: string };
    parts?: Array<{ filename?: string; body?: { data: string } }>;
  };
  internalDate: string;
  metadata?: any;
}

interface CalendarEvent {
  id: string;
  summary: string;
  title?: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
  status?: string;
}

// Extended InboxData with calendar
interface InboxData extends GeneratedInbox {
  calendar?: CalendarEvent[];
}

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
export class UnifiedMockManager {
  private static instance: UnifiedMockManager;
  private callRecords: ApiCallRecord[] = [];
  private mockContext: MockContext | null = null;
  private inboxData: InboxData | null = null;

  constructor() {
    // Constructor
  }

  static getInstance(): UnifiedMockManager {
    if (!UnifiedMockManager.instance) {
      UnifiedMockManager.instance = new UnifiedMockManager();
    }
    return UnifiedMockManager.instance;
  }

  /**
   * Initialize the mock manager
   */
  async initialize(): Promise<void> {
    this.logInfo('UnifiedMockManager initialized');
  }

  /**
   * Log info message
   */
  private logInfo(message: string, data?: any): void {
    console.log(`[UnifiedMockManager] ${message}`, data || '');
  }

  /**
   * Log error message
   */
  private logError(message: string, data?: any): void {
    console.error(`[UnifiedMockManager ERROR] ${message}`, data || '');
  }

  /**
   * Convert GeneratedEmail to Gmail API format
   */
  private convertToGmailFormat(email: GeneratedEmail): Email {
    return {
      id: email.id,
      threadId: email.threadId,
      snippet: email.body.substring(0, 100),
      labelIds: ['INBOX'],
      sizeEstimate: email.body.length,
      historyId: '1',
      payload: {
        headers: [
          { name: 'From', value: email.from },
          { name: 'To', value: email.to },
          { name: 'Subject', value: email.subject },
          { name: 'Date', value: email.sentDate.toISOString() },
          ...(email.cc ? [{ name: 'Cc', value: email.cc.join(', ') }] : []),
        ],
        body: {
          data: Buffer.from(email.body).toString('base64'),
        },
      },
      internalDate: email.sentDate.getTime().toString(),
      metadata: {
        labels: email.label,
        groundTruth: email.label,
      },
    };
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

    const calendarCount = inboxData.calendar?.length || 0;
    this.logInfo(`Mock context setup with ${inboxData.emails.length} emails and ${calendarCount} calendar events`);
  }

  /**
   * Load inbox data from generated inbox
   */
  async loadInbox(inbox: GeneratedInbox): Promise<void> {
    const inboxData: InboxData = {
      ...inbox,
      calendar: [], // Empty calendar for now
    };
    await this.setupMockContext(inboxData, {});
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
   * Returns Gmail API v1 messages.list format
   */
  private mockGmailSearch(query: string, maxResults: number = 100, pageToken?: string): APIResponse {
    if (!this.inboxData) {
      return {
        data: { messages: [], resultSizeEstimate: 0 },
        status: 200,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          mockSource: 'gmail-search-empty'
        }
      };
    }

    // Convert all GeneratedEmails to Email format for filtering
    const convertedEmails = this.inboxData.emails.map(e => this.convertToGmailFormat(e));
    const matchingEmails = convertedEmails.filter(email =>
      this.emailMatchesQuery(email, query)
    );

    // Handle pagination
    const startIndex = pageToken ? parseInt(pageToken) : 0;
    const endIndex = Math.min(startIndex + maxResults, matchingEmails.length);
    const paginatedEmails = matchingEmails.slice(startIndex, endIndex);

    // Gmail API messages.list returns ONLY id and threadId (minimal format)
    const messages = paginatedEmails.map(email => ({
      id: email.id,
      threadId: email.threadId
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
   * Returns full Gmail API v1 message format
   */
  private mockGmailGetMessage(endpoint: string): APIResponse {
    if (!this.inboxData) {
      return {
        data: { error: { message: 'No inbox data available', code: 500 } },
        status: 500,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          mockSource: 'gmail-get-message-error'
        }
      };
    }

    const messageId = endpoint.split('/').pop()?.split('?')[0]; // Remove query params
    const email = this.inboxData.emails.find(e => e.id === messageId);

    if (!email) {
      return {
        data: {
          error: {
            message: `Message not found: ${messageId}`,
            code: 404,
            status: 'NOT_FOUND'
          }
        },
        status: 404,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          mockSource: 'gmail-get-message-not-found'
        }
      };
    }

    // Return complete Gmail message object (format=full)
    const gmailEmail = this.convertToGmailFormat(email);
    return {
      data: {
        id: gmailEmail.id,
        threadId: gmailEmail.threadId,
        labelIds: ['INBOX'],
        snippet: gmailEmail.snippet,
        sizeEstimate: gmailEmail.snippet.length,
        historyId: '1',
        internalDate: gmailEmail.internalDate,
        payload: gmailEmail.payload
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
    const threadEmailsRaw = this.inboxData.emails.filter(email => email.threadId === threadId);

    if (threadEmailsRaw.length === 0) {
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

    // Convert to Gmail format
    const threadEmails = threadEmailsRaw.map(e => this.convertToGmailFormat(e));

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
        historyId: threadEmails[0].historyId || '1',
        messages: threadEmails.map(email => ({
          id: email.id,
          threadId: email.threadId,
          labelIds: email.labelIds || ['INBOX'],
          snippet: email.snippet,
          sizeEstimate: email.sizeEstimate || 0,
          historyId: email.historyId || '1',
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

    // Convert and filter
    const convertedEmails = this.inboxData.emails.map(e => this.convertToGmailFormat(e));
    const matchingEmails = convertedEmails.filter(email =>
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
  }

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
    if (!this.inboxData) {
      return {
        data: { results: [] },
        status: 200,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          mockSource: 'contacts-search-empty'
        }
      };
    }

    // Helper to extract sender info from headers
    const getSenderInfo = (email: Email) => {
      const fromHeader = email.payload.headers.find(h => h.name.toLowerCase() === 'from');
      if (!fromHeader) return null;

      const match = fromHeader.value.match(/(?:"?([^"]*)"?\s)?<?([^>]+)>?/);
      return {
        name: match?.[1] || email.metadata?.sender?.name || '',
        email: match?.[2] || email.metadata?.sender?.email || fromHeader.value
      };
    };

    // Generate realistic contact data based on inbox emails
    const uniqueContacts = new Map<string, any>();

    this.inboxData.emails.forEach(genEmail => {
      const email = this.convertToGmailFormat(genEmail);
      const senderInfo = getSenderInfo(email);
      if (!senderInfo) return;

      const queryLower = query.toLowerCase();
      if (senderInfo.name.toLowerCase().includes(queryLower) ||
          senderInfo.email.toLowerCase().includes(queryLower)) {

        if (!uniqueContacts.has(senderInfo.email)) {
          uniqueContacts.set(senderInfo.email, {
            resourceName: `people/${this.generateContactId()}`,
            names: [{
              displayName: senderInfo.name || senderInfo.email
            }],
            emailAddresses: [{
              value: senderInfo.email
            }]
          });
        }
      }
    });

    const contacts = Array.from(uniqueContacts.values()).slice(0, 10);

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
  /**
   * Parse and match Gmail query syntax
   * Supports: is:unread, is:read, from:email, to:email, subject:text, has:attachment, label:name
   */
  private emailMatchesQuery(email: Email, query: string): boolean {
    if (!query) return true;

    const queryLower = query.toLowerCase();

    // Helper to extract header value
    const getHeader = (name: string): string => {
      const header = email.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    // Extract operators from query
    const operators = {
      isUnread: /is:unread/i.test(query),
      isRead: /is:read/i.test(query),
      isImportant: /is:important/i.test(query),
      isStarred: /is:starred/i.test(query),
      hasAttachment: /has:attachment/i.test(query),
      from: query.match(/from:(\S+)/i)?.[1],
      to: query.match(/to:(\S+)/i)?.[1],
      subject: query.match(/subject:"([^"]+)"|subject:(\S+)/i)?.[1] || query.match(/subject:(\S+)/i)?.[1],
      label: query.match(/label:(\S+)/i)?.[1],
    };

    // Remove operators from query to get plain text search
    const plainText = query
      .replace(/is:\w+/gi, '')
      .replace(/from:\S+/gi, '')
      .replace(/to:\S+/gi, '')
      .replace(/subject:"[^"]+"|subject:\S+/gi, '')
      .replace(/has:\w+/gi, '')
      .replace(/label:\S+/gi, '')
      .trim()
      .toLowerCase();

    // Check is:unread
    if (operators.isUnread && !(email.labelIds || []).includes('UNREAD')) {
      return false;
    }

    // Check is:read
    if (operators.isRead && (email.labelIds || []).includes('UNREAD')) {
      return false;
    }

    // Check is:important
    if (operators.isImportant && !(email.labelIds || []).includes('IMPORTANT')) {
      return false;
    }

    // Check is:starred
    if (operators.isStarred && !(email.labelIds || []).includes('STARRED')) {
      return false;
    }

    // Check has:attachment
    if (operators.hasAttachment) {
      const hasAttachment = email.payload.parts?.some(part => part.filename && part.filename.length > 0);
      if (!hasAttachment) return false;
    }

    // Check from:
    if (operators.from) {
      const from = getHeader('From').toLowerCase();
      if (!from.includes(operators.from.toLowerCase())) {
        return false;
      }
    }

    // Check to:
    if (operators.to) {
      const to = getHeader('To').toLowerCase();
      if (!to.includes(operators.to.toLowerCase())) {
        return false;
      }
    }

    // Check subject:
    if (operators.subject) {
      const subject = getHeader('Subject').toLowerCase();
      if (!subject.includes(operators.subject.toLowerCase())) {
        return false;
      }
    }

    // Check label:
    if (operators.label) {
      const labelMatch = (email.labelIds || []).some(label =>
        label.toLowerCase() === operators.label?.toLowerCase()
      );
      if (!labelMatch) return false;
    }

    // Check plain text search (searches in subject, from, snippet, body)
    if (plainText) {
      const subject = getHeader('Subject').toLowerCase();
      const from = getHeader('From').toLowerCase();
      const snippet = (email.snippet || '').toLowerCase();
      const body = email.metadata?.content?.body?.toLowerCase() || '';

      const matches = subject.includes(plainText) ||
                     from.includes(plainText) ||
                     snippet.includes(plainText) ||
                     body.includes(plainText);

      if (!matches) return false;
    }

    return true;
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
