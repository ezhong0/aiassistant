import { google } from 'googleapis';
import { GmailServiceError } from '../types/gmail.types';
import { BaseService } from './base-service';
import logger from '../utils/logger';

export class GmailService extends BaseService {
  private gmailService: any;

  constructor() {
    super('GmailService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Initialize Gmail API service
      this.gmailService = google.gmail('v1');
      
      this.logInfo('Gmail service initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Gmail service', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('Gmail service destroyed');
  }

  /**
   * Send an email using Gmail API
   */
  async sendEmail(
    accessToken: string,
    to: string,
    subject: string,
    body: string,
    options: {
      from?: string;
      replyTo?: string;
      cc?: string[];
      bcc?: string[];
      attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
      }>;
    } = {}
  ): Promise<{ messageId: string; threadId: string }> {
    this.assertReady();
    
    try {
      this.logDebug('Sending email', { 
        to, 
        subject, 
        hasAttachments: !!(options.attachments?.length) 
      });

      // Build email message
      const message = this.buildEmailMessage({
        to,
        subject,
        body,
        from: options.from,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments
      });

      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken
      });

      // Send the email with proper OAuth authentication
      const response = await this.gmailService.users.messages.send({
        userId: 'me',
        requestBody: { raw: message },
        auth: auth
      });

      if (!response.data.id) {
        throw new GmailServiceError('No response data from Gmail API', 'SEND_FAILED');
      }

      const result = {
        messageId: response.data.id,
        threadId: response.data.threadId || response.data.id
      };

      this.logInfo('Email sent successfully', { 
        messageId: result.messageId,
        threadId: result.threadId,
        to 
      });

      return result;
    } catch (error) {
      this.handleError(error, 'sendEmail');
    }
  }

  /**
   * Get an email by ID
   */
  async getEmail(accessToken: string, messageId: string): Promise<any> {
    this.assertReady();
    
    try {
      this.logDebug('Getting email', { messageId });

      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken
      });

      const response = await this.gmailService.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
        auth: auth
      });

      if (!response.data) {
        throw new GmailServiceError(`Email not found: ${messageId}`, 'NOT_FOUND');
      }

      this.logDebug('Email retrieved successfully', { 
        messageId, 
        subject: response.data.payload?.headers?.find((h: any) => h.name === 'Subject')?.value 
      });

      return response.data;
    } catch (error) {
      this.handleError(error, 'getEmail');
    }
  }

  /**
   * Reply to an email
   */
  async replyToEmail(
    accessToken: string,
    messageId: string,
    replyBody: string,
    options: {
      attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
      }>;
    } = {}
  ): Promise<{ messageId: string; threadId: string }> {
    this.assertReady();
    
    try {
      this.logDebug('Replying to email', { 
        messageId, 
        hasAttachments: !!(options.attachments?.length) 
      });

      // Get the original email to extract headers
      const originalEmail = await this.getEmail(accessToken, messageId);
      
      if (!originalEmail.payload?.headers) {
        throw new GmailServiceError('Invalid email format', 'INVALID_EMAIL');
      }

      // Extract headers for reply
      const headers = originalEmail.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'Re: No Subject';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const references = headers.find((h: any) => h.name === 'Message-ID')?.value || '';
      const inReplyTo = headers.find((h: any) => h.name === 'Message-ID')?.value || '';

      // Build reply message
      const message = this.buildEmailMessage({
        to: from, // Reply to sender
        subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        body: replyBody,
        references,
        inReplyTo,
        attachments: options.attachments
      });

      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken
      });

      // Send the reply
      const response = await this.gmailService.users.messages.send({
        userId: 'me',
        requestBody: { raw: message },
        auth: auth
      });

      if (!response.data.id) {
        throw new GmailServiceError('No response data from Gmail API', 'REPLY_FAILED');
      }

      const result = {
        messageId: response.data.id,
        threadId: response.data.threadId || response.data.id
      };

      this.logInfo('Reply sent successfully', { 
        messageId: result.messageId,
        threadId: result.threadId,
        originalMessageId: messageId 
      });

      return result;
    } catch (error) {
      this.handleError(error, 'replyToEmail');
    }
  }

  /**
   * Get email thread
   */
  async getEmailThread(accessToken: string, threadId: string): Promise<any> {
    this.assertReady();
    
    try {
      this.logDebug('Getting email thread', { threadId });

      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken
      });

      const response = await this.gmailService.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
        auth: auth
      });

      if (!response.data) {
        throw new GmailServiceError(`Thread not found: ${threadId}`, 'NOT_FOUND');
      }

      this.logDebug('Email thread retrieved successfully', { 
        threadId, 
        messageCount: response.data.messages?.length || 0 
      });

      return response.data;
    } catch (error) {
      this.handleError(error, 'getEmailThread');
    }
  }

  /**
   * Search emails
   */
  async searchEmails(
    accessToken: string,
    query: string,
    options: {
      maxResults?: number;
      includeSpamTrash?: boolean;
    } = {}
  ): Promise<any[]> {
    this.assertReady();
    
    try {
      this.logDebug('Searching emails', { 
        query, 
        maxResults: options.maxResults || 10 
      });

      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken
      });

      const response = await this.gmailService.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: options.maxResults || 10,
        includeSpamTrash: options.includeSpamTrash || false,
        auth: auth
      });

      if (!response.data.messages) {
        this.logDebug('No emails found', { query });
        return [];
      }

      this.logInfo('Email search completed', { 
        query, 
        foundCount: response.data.messages.length 
      });

      return response.data.messages;
    } catch (error) {
      this.handleError(error, 'searchEmails');
    }
  }

  /**
   * Get email overview (basic metadata) for efficient data gathering
   */
  async getEmailOverview(
    accessToken: string,
    options: {
      maxResults?: number;
      query?: string;
      includeSpamTrash?: boolean;
    } = {}
  ): Promise<Array<{
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to?: string[];
    date: Date;
    snippet: string;
    labels: string[];
    isUnread: boolean;
    hasAttachments: boolean;
  }>> {
    this.assertReady();
    
    try {
      this.logDebug('Getting email overview', { 
        maxResults: options.maxResults || 20,
        query: options.query || 'in:inbox' 
      });

      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken
      });

      // Search for messages
      const response = await this.gmailService.users.messages.list({
        userId: 'me',
        q: options.query || 'in:inbox',
        maxResults: options.maxResults || 20,
        includeSpamTrash: options.includeSpamTrash || false,
        auth: auth
      });

      if (!response.data.messages || response.data.messages.length === 0) {
        this.logDebug('No messages found for overview');
        return [];
      }

      // Get basic details for each message (batch request for efficiency)
      const overviewPromises = response.data.messages.slice(0, options.maxResults || 20).map(async (msg: any) => {
        try {
          const messageResponse = await this.gmailService.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata', // Only get metadata, not full content
            metadataHeaders: ['Subject', 'From', 'To', 'Date'],
            auth: auth
          });

          const message = messageResponse.data;
          const headers = message.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
          
          const subject = getHeader('Subject');
          const from = getHeader('From');
          const to = getHeader('To').split(',').map((t: string) => t.trim()).filter((t: string) => t);
          const dateStr = getHeader('Date');

          return {
            id: message.id!,
            threadId: message.threadId!,
            subject,
            from,
            to: to.length > 0 ? to : undefined,
            date: dateStr ? new Date(dateStr) : new Date(),
            snippet: message.snippet || '',
            labels: message.labelIds || [],
            isUnread: (message.labelIds || []).includes('UNREAD'),
            hasAttachments: (message.payload?.parts || []).some((part: any) => part.filename && part.filename.length > 0)
          };
        } catch (error) {
          this.logWarn('Failed to get overview for message', { messageId: msg.id, error });
          return null;
        }
      });

      const overviewResults = await Promise.all(overviewPromises);
      const validResults = overviewResults.filter(result => result !== null);

      this.logInfo('Email overview retrieved successfully', { 
        requestedCount: response.data.messages.length,
        retrievedCount: validResults.length,
        query: options.query || 'in:inbox'
      });

      return validResults;

    } catch (error) {
      this.handleError(error, 'getEmailOverview');
    }
  }

  /**
   * Get full message details including content
   */
  async getFullMessage(
    accessToken: string,
    messageId: string
  ): Promise<{
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    date: Date;
    body: {
      text?: string;
      html?: string;
    };
    snippet: string;
    labels: string[];
    attachments?: Array<{
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
    }>;
  }> {
    this.assertReady();
    
    try {
      this.logDebug('Getting full message details', { messageId });

      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken
      });

      const response = await this.gmailService.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full', // Get full message including body
        auth: auth
      });

      const message = response.data;
      if (!message) {
        throw new GmailServiceError('Message not found', 'MESSAGE_NOT_FOUND');
      }

      // Extract headers
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      
      const subject = getHeader('Subject');
      const from = getHeader('From');
      const to = getHeader('To').split(',').map((t: string) => t.trim()).filter((t: string) => t);
      const cc = getHeader('Cc').split(',').map((t: string) => t.trim()).filter((t: string) => t);
      const bcc = getHeader('Bcc').split(',').map((t: string) => t.trim()).filter((t: string) => t);
      const dateStr = getHeader('Date');

      // Extract body content
      const body = this.extractMessageBody(message.payload);

      // Extract attachments
      const attachments = this.extractAttachments(message.payload);

      const fullMessage = {
        id: message.id!,
        threadId: message.threadId!,
        subject,
        from,
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        date: dateStr ? new Date(dateStr) : new Date(),
        body,
        snippet: message.snippet || '',
        labels: message.labelIds || [],
        attachments: attachments.length > 0 ? attachments : undefined
      };

      this.logInfo('Full message retrieved successfully', { 
        messageId, 
        subject: subject.substring(0, 50),
        hasTextBody: !!body.text,
        hasHtmlBody: !!body.html,
        attachmentCount: attachments.length
      });

      return fullMessage;

    } catch (error) {
      this.handleError(error, 'getFullMessage');
    }
  }

  /**
   * Extract message body from Gmail payload
   */
  private extractMessageBody(payload: any): { text?: string; html?: string } {
    if (!payload) return {};

    const body = { text: undefined as string | undefined, html: undefined as string | undefined };

    // Handle single part message
    if (payload.body?.data) {
      const content = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      if (payload.mimeType === 'text/plain') {
        body.text = content;
      } else if (payload.mimeType === 'text/html') {
        body.html = content;
      }
      return body;
    }

    // Handle multipart message
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body.text = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          body.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        // Recursively check nested parts
        else if (part.parts) {
          const nestedBody = this.extractMessageBody(part);
          if (nestedBody.text) body.text = nestedBody.text;
          if (nestedBody.html) body.html = nestedBody.html;
        }
      }
    }

    return body;
  }

  /**
   * Extract attachments from Gmail payload
   */
  private extractAttachments(payload: any): Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> {
    const attachments: Array<{
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
    }> = [];

    if (!payload) return attachments;

    // Check current level for attachments
    if (payload.body?.attachmentId && payload.filename) {
      attachments.push({
        filename: payload.filename,
        mimeType: payload.mimeType || 'application/octet-stream',
        size: payload.body.size || 0,
        attachmentId: payload.body.attachmentId
      });
    }

    // Recursively check parts
    if (payload.parts) {
      for (const part of payload.parts) {
        attachments.push(...this.extractAttachments(part));
      }
    }

    return attachments;
  }

  /**
   * Get email attachments
   */
  async getAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<{ data: string; contentType: string; filename?: string }> {
    this.assertReady();
    
    try {
      this.logDebug('Getting email attachment', { messageId, attachmentId });

      // Create OAuth2 client with access token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken
      });

      const response = await this.gmailService.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
        auth: auth
      });

      if (!response.data.data) {
        throw new GmailServiceError('No attachment data received', 'DOWNLOAD_FAILED');
      }

      const attachment = {
        data: response.data.data,
        contentType: response.data.mimeType || 'application/octet-stream',
        filename: response.data.filename
      };

      this.logInfo('Attachment retrieved successfully', { 
        messageId, 
        attachmentId,
        contentType: attachment.contentType,
        filename: attachment.filename 
      });

      return attachment;
    } catch (error) {
      this.handleError(error, 'getAttachment');
    }
  }

  /**
   * Build email message in RFC 2822 format
   */
  private buildEmailMessage(options: {
    to: string;
    subject: string;
    body: string;
    from?: string;
    replyTo?: string;
    cc?: string[];
    bcc?: string[];
    references?: string;
    inReplyTo?: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
  }): string {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let message = '';
    
    // Headers
    message += `To: ${options.to}\r\n`;
    message += `Subject: ${options.subject}\r\n`;
    if (options.from) message += `From: ${options.from}\r\n`;
    if (options.replyTo) message += `Reply-To: ${options.replyTo}\r\n`;
    if (options.cc?.length) message += `Cc: ${options.cc.join(', ')}\r\n`;
    if (options.bcc?.length) message += `Bcc: ${options.bcc.join(', ')}\r\n`;
    if (options.references) message += `References: ${options.references}\r\n`;
    if (options.inReplyTo) message += `In-Reply-To: ${options.inReplyTo}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    
    if (options.attachments?.length) {
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      
      // Text body
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
      message += `${options.body}\r\n\r\n`;
      
      // Attachments
      for (const attachment of options.attachments) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${attachment.contentType}\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n\r\n`;
        message += `${attachment.content}\r\n\r\n`;
      }
      
      message += `--${boundary}--\r\n`;
    } else {
      message += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
      message += `${options.body}\r\n`;
    }
    
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.gmailService;
      const details = {
        initialized: this.initialized,
        gmailService: !!this.gmailService,
        googleapis: !!google
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Handle Gmail service errors
   */
  private handleGmailError(error: any, operation: string): GmailServiceError {
    let message = 'Unknown error occurred';
    let code = 'UNKNOWN_ERROR';

    if (error instanceof Error) {
      message = error.message;
      
      if (message.includes('not found')) {
        code = 'NOT_FOUND';
      } else if (message.includes('permission')) {
        code = 'PERMISSION_DENIED';
      } else if (message.includes('invalid')) {
        code = 'INVALID_INPUT';
      } else if (message.includes('quota')) {
        code = 'QUOTA_EXCEEDED';
      } else if (message.includes('rate limit')) {
        code = 'RATE_LIMIT_EXCEEDED';
      }
    }

    return new GmailServiceError(message, code);
  }
}

// Export the class for registration with ServiceManager