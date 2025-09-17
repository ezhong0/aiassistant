import { google } from 'googleapis';
import { GmailServiceError } from '../../types/email/gmail.types';
import { BaseService } from '../base-service';
import logger from '../../utils/logger';

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  filename?: string;
  mimeType?: string;
  body?: {
    attachmentId?: string;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessagePayload {
  headers?: GmailHeader[];
  parts?: GmailMessagePart[];
  body?: {
    attachmentId?: string;
    data?: string;
  };
}

interface GmailMessage {
  id: string;
  payload?: GmailMessagePayload;
}

interface GmailAttachment {
  filename: string;
  mimeType: string;
  attachmentId: string;
}

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

      const emailOptions: {
        from?: string;
        replyTo?: string;
        cc?: string[];
        bcc?: string[];
        attachments?: Array<{
          filename: string;
          content: string;
          contentType: string;
        }>;
      } = {};
      
      if (options.from) emailOptions.from = options.from;
      if (options.replyTo) emailOptions.replyTo = options.replyTo;
      if (options.cc) emailOptions.cc = options.cc;
      if (options.bcc) emailOptions.bcc = options.bcc;
      if (options.attachments) emailOptions.attachments = options.attachments;
      
      // Build email message
      const message = this.buildEmailMessage({
        to,
        subject,
        body,
        ...emailOptions
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
        subject: response.data.payload?.headers?.find((h: GmailHeader) => h.name === 'Subject')?.value 
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
      const subject = headers.find((h: GmailHeader) => h.name === 'Subject')?.value || 'Re: No Subject';
      const from = headers.find((h: GmailHeader) => h.name === 'From')?.value || '';
      const to = headers.find((h: GmailHeader) => h.name === 'To')?.value || '';
      const references = headers.find((h: GmailHeader) => h.name === 'Message-ID')?.value || '';
      const inReplyTo = headers.find((h: GmailHeader) => h.name === 'Message-ID')?.value || '';

      // Build reply message
      const replyOptions: {
        to: string;
        subject: string;
        body: string;
        references?: string;
        inReplyTo?: string;
        attachments?: Array<{
          filename: string;
          content: string;
          contentType: string;
        }>;
      } = {
        to: from, // Reply to sender
        subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        body: replyBody,
        references,
        inReplyTo
      };
      
      if (options.attachments) {
        replyOptions.attachments = options.attachments;
      }
      
      const message = this.buildEmailMessage(replyOptions);

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

      // First, get the message IDs
      const response = await this.gmailService.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: options.maxResults || 10,
        includeSpamTrash: options.includeSpamTrash || false,
        auth: auth
      });

      // Log the raw Gmail API response for debugging
      this.logDebug('Gmail API raw response', {
        query,
        hasMessages: !!response.data.messages,
        messageCount: response.data.messages?.length || 0,
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate,
        fullResponse: {
          messages: response.data.messages,
          nextPageToken: response.data.nextPageToken,
          resultSizeEstimate: response.data.resultSizeEstimate
        }
      });

      if (!response.data.messages || response.data.messages.length === 0) {
        this.logDebug('No emails found', { 
          query,
          resultSizeEstimate: response.data.resultSizeEstimate,
          nextPageToken: response.data.nextPageToken
        });
        return [];
      }

      this.logInfo('Found message IDs', { 
        query, 
        messageCount: response.data.messages.length 
      });

      // Now fetch the actual email content for each message
      const emailPromises = response.data.messages.map(async (message: any) => {
        try {
          this.logDebug('Fetching email details', { messageId: message.id });
          const emailData = await this.getFullMessage(accessToken, message.id);
          this.logDebug('Email details fetched', { 
            messageId: message.id, 
            hasEmailData: !!emailData,
            emailDataKeys: emailData ? Object.keys(emailData) : []
          });
          return emailData;
        } catch (error) {
          this.logError('Error fetching email details', { messageId: message.id, error });
          return null;
        }
      });

      const emails = await Promise.all(emailPromises);
      const validEmails = emails.filter(email => email !== null);

      this.logInfo('Email search completed', { 
        query, 
        foundCount: validEmails.length,
        requestedCount: response.data.messages.length
      });

      return validEmails;
    } catch (error) {
      this.handleError(error, 'searchEmails');
      return [];
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
      const overviewPromises = response.data.messages.slice(0, options.maxResults || 20).map(async (msg: GmailMessage) => {
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
            hasAttachments: (message.payload?.parts || []).some((part: GmailMessagePart) => part.filename && part.filename.length > 0)
          };
        } catch (error) {
          this.logWarn('Failed to get overview for message', { messageId: msg.id, error });
          return null;
        }
      });

      const overviewResults = await Promise.all(overviewPromises);
      const validResults = overviewResults.filter((result: any) => result !== null);

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
  } | null> {
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

      // DEBUG: Log header extraction
      this.logInfo('GmailService.getFullMessage - Header extraction debug', {
        messageId,
        headersCount: headers.length,
        availableHeaders: headers.map((h: any) => h.name),
        extractedSubject: subject,
        extractedFrom: from,
        extractedTo: to,
        extractedDate: dateStr
      });

      // Extract body content
      const body = this.extractMessageBody(message.payload);

      // DEBUG: Log body extraction
      this.logInfo('GmailService.getFullMessage - Body extraction debug', {
        messageId,
        hasPayload: !!message.payload,
        bodyTextLength: body.text?.length || 0,
        bodyHtmlLength: body.html?.length || 0,
        bodyTextPreview: body.text?.substring(0, 100),
        bodyHtmlPreview: body.html?.substring(0, 100)
      });

      // Extract attachments
      const attachments = this.extractAttachments(message.payload);

      const fullMessage: {
        id: string;
        threadId: string;
        subject: string;
        from: string;
        to: string[];
        cc?: string[];
        bcc?: string[];
        date: Date;
        body: { text?: string; html?: string };
        snippet: string;
        labels: string[];
        attachments?: Array<{
          filename: string;
          mimeType: string;
          size: number;
          attachmentId: string;
        }>;
      } = {
        id: message.id!,
        threadId: message.threadId!,
        subject,
        from,
        to,
        date: dateStr ? new Date(dateStr) : new Date(),
        body,
        snippet: message.snippet || '',
        labels: message.labelIds || []
      };

      if (cc.length > 0) fullMessage.cc = cc;
      if (bcc.length > 0) fullMessage.bcc = bcc;
      if (attachments.length > 0) fullMessage.attachments = attachments;

      // DEBUG: Log final constructed message
      this.logInfo('GmailService.getFullMessage - Final message constructed', {
        messageId,
        subject: subject.substring(0, 50),
        hasTextBody: !!body.text,
        hasHtmlBody: !!body.html,
        attachmentCount: attachments.length,
        finalMessageKeys: Object.keys(fullMessage),
        fullMessageSample: {
          id: fullMessage.id,
          subject: fullMessage.subject,
          from: fullMessage.from,
          to: fullMessage.to,
          hasBody: !!(fullMessage.body.text || fullMessage.body.html),
          snippet: fullMessage.snippet?.substring(0, 50)
        }
      });

      return fullMessage;

    } catch (error) {
      this.handleError(error, 'getFullMessage');
      return null;
    }
  }

  /**
   * Extract message body from Gmail payload with aggressive truncation to prevent context length issues
   */
  private extractMessageBody(payload: any): { text?: string; html?: string } {
    if (!payload) return {};

    const body: { text?: string; html?: string } = {};

    // Handle single part message
    if (payload.body?.data) {
      const content = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      if (payload.mimeType === 'text/plain') {
        body.text = this.truncateEmailContent(content, 'text');
      } else if (payload.mimeType === 'text/html') {
        body.html = this.truncateEmailContent(content, 'html');
      }
      return body;
    }

    // Handle multipart message
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
          body.text = this.truncateEmailContent(content, 'text');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
          body.html = this.truncateEmailContent(content, 'html');
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
   * Truncate email content to prevent OpenAI context length issues
   */
  private truncateEmailContent(content: string, type: 'text' | 'html'): string {
    if (!content) return '';

    // Different limits for different content types
    const limits = {
      text: 2000,  // 2000 chars for plain text
      html: 1000   // 1000 chars for HTML (more aggressive due to tags)
    };

    const maxLength = limits[type];
    
    if (content.length <= maxLength) {
      return content;
    }

    // For HTML, try to extract meaningful content before truncating
    if (type === 'html') {
      // Remove excessive whitespace and normalize
      let cleaned = content.replace(/\s+/g, ' ').trim();
      
      // Try to extract text content from HTML
      const textMatch = cleaned.match(/<body[^>]*>(.*?)<\/body>/is);
      if (textMatch && textMatch[1]) {
        cleaned = textMatch[1];
      }
      
      // Remove HTML tags for better content extraction
      const textContent = cleaned.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Use the shorter of cleaned HTML or extracted text
      const finalContent = textContent.length < cleaned.length ? textContent : cleaned;
      
      if (finalContent.length <= maxLength) {
        return finalContent;
      }
      
      // Truncate with ellipsis
      return finalContent.substring(0, maxLength - 3) + '...';
    }

    // For plain text, simple truncation
    return content.substring(0, maxLength - 3) + '...';
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
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
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
  private handleGmailError(error: unknown, operation: string): GmailServiceError {
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