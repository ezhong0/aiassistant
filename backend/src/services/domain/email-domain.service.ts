import { BaseService } from '../base-service';
import { getAPIClient } from '../api';
import { GoogleAPIClient } from '../api/clients/google-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { APIClientError, APIClientErrorCode } from '../../errors/api-client.errors';
import { ValidationHelper, EmailValidationSchemas } from '../../validation/api-client.validation';
import { IEmailDomainService, EmailThread } from './interfaces/email-domain.interface';
import { GoogleOAuthManager } from '../oauth/google-oauth-manager';
import { SlackContext } from '../../types/slack/slack.types';

/**
 * Email Domain Service - High-level email operations using standardized API client
 * 
 * This service provides domain-specific email operations that wrap the Google Gmail API.
 * It handles email sending, searching, retrieval, and management with a clean interface
 * that's easy to use from agents and other services.
 * 
 * Features:
 * - Send emails with rich formatting and attachments
 * - Search emails with advanced query capabilities
 * - Retrieve email details and threads
 * - Manage email drafts and replies
 * - Handle attachments and file operations
 * - OAuth2 authentication management
 */
export class EmailDomainService extends BaseService implements Partial<IEmailDomainService> {
  private googleClient: GoogleAPIClient | null = null;

  constructor(private readonly googleOAuthManager: GoogleOAuthManager) {
    super('EmailDomainService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing Email Domain Service');
      
      // Get Google API client
      this.googleClient = await getAPIClient<GoogleAPIClient>('google');
      
      this.logInfo('Email Domain Service initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Email Domain Service', error);
      throw error;
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.googleClient = null;
      this.logInfo('Email Domain Service destroyed');
    } catch (error) {
      this.logError('Error destroying Email Domain Service', error);
    }
  }

  /**
   * OAuth management methods
   */
  async initializeOAuth(userId: string, context: SlackContext): Promise<{ authUrl: string; state: string }> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const authUrl = await this.googleOAuthManager.generateAuthUrl(context);
    return { authUrl, state: 'generated' }; // TODO: Return actual state from OAuth manager
  }

  async completeOAuth(userId: string, code: string, state: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const result = await this.googleOAuthManager.exchangeCodeForTokens(code, state);
    if (!result.success) {
      throw new Error(result.error || 'OAuth completion failed');
    }
  }

  async refreshTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const success = await this.googleOAuthManager.refreshTokens(userId);
    if (!success) {
      throw new Error('Token refresh failed');
    }
  }

  async revokeTokens(userId: string): Promise<void> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      throw new Error('GoogleOAuthManager not available');
    }
    
    const success = await this.googleOAuthManager.revokeTokens(userId);
    if (!success) {
      throw new Error('Token revocation failed');
    }
  }

  async requiresOAuth(userId: string): Promise<boolean> {
    this.assertReady();
    
    if (!this.googleOAuthManager) {
      return true; // Assume OAuth required if manager not available
    }
    
    return await this.googleOAuthManager.requiresOAuth(userId);
  }


  /**
   * Send an email (with automatic authentication)
   */
  async sendEmail(userId: string, params: {
    to: string;
    subject: string;
    body: string;
    from?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
  }): Promise<{ messageId: string; threadId: string }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Google client not available',
        { serviceName: 'EmailDomainService' }
      );
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      // Authentication handled automatically by OAuth manager
      
      // Validate input parameters
      const validatedParams = ValidationHelper.validate(EmailValidationSchemas.sendEmail, params);

      this.logInfo('Sending email', {
        to: validatedParams.to,
        subject: validatedParams.subject,
        hasAttachments: !!(validatedParams.attachments?.length)
      });

      // Build email message in RFC 2822 format
      const message = this.buildEmailMessage(validatedParams);

      const response = await this.googleClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/send',
        data: { raw: message }
      });

      const result = {
        messageId: response.data.id,
        threadId: response.data.threadId || response.data.id
      };

      this.logInfo('Email sent successfully', {
        messageId: result.messageId,
        threadId: result.threadId
      });

      return result;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }
      throw APIClientError.fromError(error, {
        serviceName: 'EmailDomainService',
        endpoint: 'sendEmail',
        method: 'POST'
      });
    }
  }

  /**
   * Search emails
   */
  async searchEmails(userId: string, params: {
    query: string;
    maxResults?: number;
    includeSpamTrash?: boolean;
  }): Promise<Array<{
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to: string[];
    date: Date;
    snippet: string;
    labels: string[];
    isUnread: boolean;
    hasAttachments: boolean;
  }>> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Google client not available',
        { serviceName: 'EmailDomainService' }
      );
    }

    try {
      // Get valid tokens for user
      const token = await this.googleOAuthManager!.getValidTokens(userId);
      if (!token) {
        throw new Error('OAuth required - call initializeOAuth first');
      }
      
      // Authenticate with valid token
      // Authentication handled automatically by OAuth manager
      
      // Validate input parameters
      const validatedParams = ValidationHelper.validate(EmailValidationSchemas.searchEmails, params);

      this.logInfo('Searching emails', {
        query: validatedParams.query,
        maxResults: validatedParams.maxResults || 10
      });

      // First, get message IDs
      const listResponse = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/gmail/v1/users/me/messages/list',
        query: {
          q: validatedParams.query,
          maxResults: validatedParams.maxResults || 10,
          includeSpamTrash: validatedParams.includeSpamTrash || false
        }
      });

      if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
        return [];
      }

      // Get detailed information for each message
      const emailPromises = listResponse.data.messages.map(async (message: any) => {
        try {
          const detailResponse = await this.googleClient!.makeRequest({
            method: 'GET',
            endpoint: '/gmail/v1/users/me/messages/get',
            query: {
              id: message.id,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Date']
            }
          });

          const msg = detailResponse.data;
          const headers = msg.payload?.headers || [];
          const getHeader = (name: string) => 
            headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
          
          return {
            id: msg.id,
            threadId: msg.threadId,
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: getHeader('To').split(',').map((t: string) => t.trim()).filter((t: string) => t),
            date: new Date(getHeader('Date') || Date.now()),
            snippet: msg.snippet || '',
            labels: msg.labelIds || [],
            isUnread: (msg.labelIds || []).includes('UNREAD'),
            hasAttachments: (msg.payload?.parts || []).some((part: any) => 
              part.filename && part.filename.length > 0
            )
          };
        } catch (error) {
          this.logError('Failed to get email details', error, { messageId: message.id });
          return null;
        }
      });

      const emails = await Promise.all(emailPromises);
      const validEmails = emails.filter(email => email !== null);

      this.logInfo('Email search completed', {
        query: validatedParams.query,
        foundCount: validEmails.length
      });

      return validEmails;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }
      throw APIClientError.fromError(error, {
        serviceName: 'EmailDomainService',
        endpoint: 'searchEmails',
        method: 'GET'
      });
    }
  }

  /**
   * Get email details
   */
  async getEmail(messageId: string): Promise<{
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
    
    if (!this.googleClient) {
      throw APIClientError.nonRetryable(
        APIClientErrorCode.CLIENT_NOT_INITIALIZED,
        'Google client not available',
        { serviceName: 'EmailDomainService' }
      );
    }

    try {
      // Validate input parameters
      const validatedParams = ValidationHelper.validate(EmailValidationSchemas.getEmail, { messageId });

      this.logInfo('Getting email details', { messageId: validatedParams.messageId });

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/gmail/v1/users/me/messages/get',
        query: {
          id: validatedParams.messageId,
          format: 'full'
        }
      });

      const message = response.data;
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      
      // Extract body content
      const body = this.extractMessageBody(message.payload);
      
      // Extract attachments
      const attachments = this.extractAttachments(message.payload);

      const result: any = {
        id: message.id,
        threadId: message.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To').split(',').map((t: string) => t.trim()).filter((t: string) => t),
        date: new Date(getHeader('Date') || Date.now()),
        body,
        snippet: message.snippet || '',
        labels: message.labelIds || []
      };

      // Add optional fields
      const cc = getHeader('Cc');
      if (cc) {
        result.cc = cc.split(',').map((t: string) => t.trim()).filter((t: string) => t);
      }

      const bcc = getHeader('Bcc');
      if (bcc) {
        result.bcc = bcc.split(',').map((t: string) => t.trim()).filter((t: string) => t);
      }

      if (attachments.length > 0) {
        result.attachments = attachments;
      }

      this.logInfo('Email details retrieved successfully', {
        messageId: validatedParams.messageId,
        subject: result.subject.substring(0, 50)
      });

      return result;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }
      throw APIClientError.fromError(error, {
        serviceName: 'EmailDomainService',
        endpoint: 'getEmail',
        method: 'GET',
        context: { messageId }
      });
    }
  }

  /**
   * Reply to an email
   */
  async replyToEmail(params: {
    messageId: string;
    replyBody: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
  }): Promise<{ messageId: string; threadId: string }> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Replying to email', { messageId: params.messageId });

      // Get the original email to extract headers
      const originalEmail = await this.getEmail(params.messageId);
      
      // Extract headers for reply
      const subject = originalEmail.subject;
      const from = originalEmail.from;
      const references = originalEmail.id;
      const inReplyTo = originalEmail.id;

      // Build reply message
      const replyMessage = this.buildEmailMessage({
        to: from,
        subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        body: params.replyBody,
        attachments: params.attachments,
        references,
        inReplyTo
      });

      const response = await this.googleClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/send',
        data: { raw: replyMessage }
      });

      const result = {
        messageId: response.data.id,
        threadId: response.data.threadId || response.data.id
      };

      this.logInfo('Reply sent successfully', {
        messageId: result.messageId,
        originalMessageId: params.messageId
      });

      return result;
    } catch (error) {
      this.logError('Failed to reply to email', error, { messageId: params.messageId });
      throw error;
    }
  }

  /**
   * Get email thread
   */
  async getEmailThread(threadId: string): Promise<EmailThread> {
    this.assertReady();
    
    if (!this.googleClient) {
      throw new Error('Google client not available');
    }

    try {
      this.logInfo('Getting email thread', { threadId });

      const response = await this.googleClient.makeRequest({
        method: 'GET',
        endpoint: '/gmail/v1/users/me/threads/get',
        query: {
          id: threadId,
          format: 'full'
        }
      });

      const thread = response.data;
      const messages = thread.messages?.map((message: any) => {
        const headers = message.payload?.headers || [];
        const getHeader = (name: string) => 
          headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
        
        return {
          id: message.id,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To').split(',').map((t: string) => t.trim()).filter((t: string) => t),
          date: new Date(getHeader('Date') || Date.now()),
          body: this.extractMessageBody(message.payload),
          snippet: message.snippet || '',
          labels: message.labelIds || []
        };
      }) || [];

      this.logInfo('Email thread retrieved successfully', {
        threadId,
        messageCount: messages.length
      });

      return {
        id: thread.id,
        messages
      };
    } catch (error) {
      this.logError('Failed to get email thread', error, { threadId });
      throw error;
    }
  }

  /**
   * Build email message in RFC 2822 format
   */
  private buildEmailMessage(params: {
    to: string;
    subject: string;
    body: string;
    from?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
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
    message += `To: ${params.to}\r\n`;
    message += `Subject: ${params.subject}\r\n`;
    if (params.from) message += `From: ${params.from}\r\n`;
    if (params.replyTo) message += `Reply-To: ${params.replyTo}\r\n`;
    if (params.cc?.length) message += `Cc: ${params.cc.join(', ')}\r\n`;
    if (params.bcc?.length) message += `Bcc: ${params.bcc.join(', ')}\r\n`;
    if (params.references) message += `References: ${params.references}\r\n`;
    if (params.inReplyTo) message += `In-Reply-To: ${params.inReplyTo}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    
    if (params.attachments?.length) {
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      
      // Text body
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
      message += `${params.body}\r\n\r\n`;
      
      // Attachments
      for (const attachment of params.attachments) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${attachment.contentType}\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n\r\n`;
        message += `${attachment.content}\r\n\r\n`;
      }
      
      message += `--${boundary}--\r\n`;
    } else {
      message += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
      message += `${params.body}\r\n`;
    }
    
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Extract message body from Gmail payload
   */
  private extractMessageBody(payload: any): { text?: string; html?: string } {
    if (!payload) return {};

    const body: { text?: string; html?: string } = {};

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
          const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
          body.text = content;
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
          body.html = content;
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
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.googleClient;
      const details = {
        initialized: this.initialized,
        hasGoogleClient: !!this.googleClient,
        authenticated: this.googleClient?.isAuthenticated() || false
      };

      return { healthy, details };
    } catch (error) {
      return { 
        healthy: false, 
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
