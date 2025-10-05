import { ErrorFactory, ERROR_CATEGORIES, APIClientError } from '../../errors';
import { BaseService } from '../base-service';
import { GoogleAPIClient } from '../api/clients/google-api-client';
import { AuthCredentials } from '../../types/api/api-client.types';
import { ValidationHelper, EmailValidationSchemas } from '../../validation/api-client.validation';
import { IEmailDomainService, EmailThread, EmailLabel } from './interfaces/email-domain.interface';
import { SupabaseTokenProvider } from '../supabase-token-provider';

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
 *
 * OAuth is handled by Supabase Auth. This service fetches Google tokens from Supabase.
 * Dependencies are injected via constructor for better testability and explicit dependency management.
 */
export class EmailDomainService extends BaseService implements Partial<IEmailDomainService> {
  constructor(
    private readonly supabaseTokenProvider: SupabaseTokenProvider,
    private readonly googleAPIClient: GoogleAPIClient
  ) {
    super('EmailDomainService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing Email Domain Service');
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
      this.logInfo('Email Domain Service destroyed');
    } catch (error) {
      this.logError('Error destroying Email Domain Service', error);
    }
  }

  /**
   * Helper: Get OAuth2 credentials for a user
   * @private
   */
  private async getGoogleCredentials(userId: string): Promise<AuthCredentials> {
    const tokens = await this.supabaseTokenProvider.getGoogleTokens(userId);

    if (!tokens.access_token) {
      throw ErrorFactory.api.unauthorized('OAuth required - call initializeOAuth first');
    }

    return {
      type: 'oauth2',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token
    };
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

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError('EmailDomainService', 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      // Validate input parameters
      const validatedParams = ValidationHelper.validate(EmailValidationSchemas.sendEmail, params);

      this.logInfo('Sending email', {
        to: validatedParams.to,
        subject: validatedParams.subject,
        hasAttachments: !!(validatedParams.attachments?.length)
      });

      // Build email message in RFC 2822 format
      const message = this.buildEmailMessage(validatedParams as any);

      const response = await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/send',
        data: { raw: message },
        credentials
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
      throw ErrorFactory.util.wrapError(error instanceof Error ? error : new Error(String(error)), ERROR_CATEGORIES.SERVICE, {
        service: 'EmailDomainService',
        metadata: { endpoint: 'sendEmail', method: 'POST' }
      });
    }
  }

  /**
   * Search emails (with optional cross-account support)
   */
  async searchEmails(userId: string, params: {
    query: string;
    maxResults?: number;
    includeSpamTrash?: boolean;
    account_ids?: string[]; // Cross-account support
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

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError('EmailDomainService', 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      // Validate input parameters
      const validatedParams = ValidationHelper.validate(EmailValidationSchemas.searchEmails, params);

      this.logInfo('Searching emails', {
        query: validatedParams.query,
        maxResults: validatedParams.maxResults || 10
      });

      // First, get message IDs
      const listResponse = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/gmail/v1/users/me/messages/list',
        query: {
          q: validatedParams.query,
          maxResults: validatedParams.maxResults || 10,
          includeSpamTrash: validatedParams.includeSpamTrash || false
        },
        credentials
      });

      if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
        return [];
      }

      // Get detailed information for each message
      const emailPromises = listResponse.data.messages.map(async (message: any) => {
        try {
          const detailResponse = await this.googleAPIClient!.makeRequest({
            method: 'GET',
            endpoint: '/gmail/v1/users/me/messages/get',
            query: {
              id: message.id,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Date']
            },
            credentials
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
      throw ErrorFactory.util.wrapError(error instanceof Error ? error : new Error(String(error)), ERROR_CATEGORIES.SERVICE, {
        service: 'EmailDomainService',
        metadata: { endpoint: 'searchEmails', method: 'GET' }
      });
    }
  }

  /**
   * Get email details
   */
  async getEmail(userId: string, messageId: string): Promise<{
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

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError('EmailDomainService', 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      // Validate input parameters
      const validatedParams = ValidationHelper.validate(EmailValidationSchemas.getEmail, { messageId });

      this.logInfo('Getting email details', { messageId: validatedParams.messageId });

      const response = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/gmail/v1/users/me/messages/get',
        query: {
          id: validatedParams.messageId,
          format: 'full'
        },
        credentials
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
      throw ErrorFactory.util.wrapError(error instanceof Error ? error : new Error(String(error)), ERROR_CATEGORIES.SERVICE, {
        service: 'EmailDomainService',
        metadata: { endpoint: 'getEmail', method: 'GET', messageId }
      });
    }
  }

  /**
   * Reply to an email
   */
  async replyToEmail(userId: string, params: {
    messageId: string;
    replyBody: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
  }): Promise<{ messageId: string; threadId: string }> {
    this.assertReady();
    
    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Replying to email', { messageId: params.messageId });

      // Get the original email to extract headers
      const originalEmail = await this.getEmail(userId, params.messageId);

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

      const response = await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/send',
        data: { raw: replyMessage },
        credentials
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
  async getEmailThread(userId: string, threadId: string): Promise<EmailThread> {
    this.assertReady();
    
    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Getting email thread', { threadId });

      const response = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/gmail/v1/users/me/threads/get',
        query: {
          id: threadId,
          format: 'full'
        },
        credentials
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
   * Archive an email (remove from inbox)
   */
  async archiveEmail(userId: string, params: { messageId: string }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Archiving email', { messageId: params.messageId });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/modify',
        query: { id: params.messageId },
        data: {
          removeLabelIds: ['INBOX']
        },
        credentials
      });

      this.logInfo('Email archived successfully', { messageId: params.messageId });
    } catch (error) {
      this.logError('Failed to archive email', error, { messageId: params.messageId });
      throw error;
    }
  }

  /**
   * Mark an email as read
   */
  async markRead(userId: string, params: { messageId: string }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Marking email as read', { messageId: params.messageId });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/modify',
        query: { id: params.messageId },
        data: {
          removeLabelIds: ['UNREAD']
        },
        credentials
      });

      this.logInfo('Email marked as read', { messageId: params.messageId });
    } catch (error) {
      this.logError('Failed to mark email as read', error, { messageId: params.messageId });
      throw error;
    }
  }

  /**
   * Mark an email as unread
   */
  async markUnread(userId: string, params: { messageId: string }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Marking email as unread', { messageId: params.messageId });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/modify',
        query: { id: params.messageId },
        data: {
          addLabelIds: ['UNREAD']
        },
        credentials
      });

      this.logInfo('Email marked as unread', { messageId: params.messageId });
    } catch (error) {
      this.logError('Failed to mark email as unread', error, { messageId: params.messageId });
      throw error;
    }
  }

  /**
   * Star an email
   */
  async starEmail(userId: string, params: { messageId: string }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Starring email', { messageId: params.messageId });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/modify',
        query: { id: params.messageId },
        data: {
          addLabelIds: ['STARRED']
        },
        credentials
      });

      this.logInfo('Email starred successfully', { messageId: params.messageId });
    } catch (error) {
      this.logError('Failed to star email', error, { messageId: params.messageId });
      throw error;
    }
  }

  /**
   * Unstar an email
   */
  async unstarEmail(userId: string, params: { messageId: string }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Unstarring email', { messageId: params.messageId });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/modify',
        query: { id: params.messageId },
        data: {
          removeLabelIds: ['STARRED']
        },
        credentials
      });

      this.logInfo('Email unstarred successfully', { messageId: params.messageId });
    } catch (error) {
      this.logError('Failed to unstar email', error, { messageId: params.messageId });
      throw error;
    }
  }

  /**
   * Create a new label
   */
  async createLabel(userId: string, params: { name: string; color?: string }): Promise<EmailLabel> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Creating label', { name: params.name });

      const response = await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/labels',
        data: {
          name: params.name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          ...(params.color && { color: { backgroundColor: params.color } })
        },
        credentials
      });

      const result: EmailLabel = {
        id: response.data.id,
        name: response.data.name,
        type: 'user' as const
      };

      this.logInfo('Label created successfully', { labelId: result.id, labelName: result.name });

      return result;
    } catch (error) {
      this.logError('Failed to create label', error, { name: params.name });
      throw error;
    }
  }

  /**
   * Add a label to an email
   */
  async addLabel(userId: string, params: { messageId: string; labelId: string }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Adding label to email', { messageId: params.messageId, labelId: params.labelId });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/modify',
        query: { id: params.messageId },
        data: {
          addLabelIds: [params.labelId]
        },
        credentials
      });

      this.logInfo('Label added successfully', { messageId: params.messageId, labelId: params.labelId });
    } catch (error) {
      this.logError('Failed to add label', error, { messageId: params.messageId, labelId: params.labelId });
      throw error;
    }
  }

  /**
   * Remove a label from an email
   */
  async removeLabel(userId: string, params: { messageId: string; labelId: string }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Removing label from email', { messageId: params.messageId, labelId: params.labelId });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/modify',
        query: { id: params.messageId },
        data: {
          removeLabelIds: [params.labelId]
        },
        credentials
      });

      this.logInfo('Label removed successfully', { messageId: params.messageId, labelId: params.labelId });
    } catch (error) {
      this.logError('Failed to remove label', error, { messageId: params.messageId, labelId: params.labelId });
      throw error;
    }
  }

  /**
   * Download an email attachment
   */
  async downloadAttachment(userId: string, params: { messageId: string; attachmentId: string }): Promise<{
    data: string;
    size: number;
  }> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Downloading attachment', { messageId: params.messageId, attachmentId: params.attachmentId });

      const response = await this.googleAPIClient.makeRequest({
        method: 'GET',
        endpoint: '/gmail/v1/users/me/messages/attachments',
        query: {
          messageId: params.messageId,
          id: params.attachmentId
        },
        credentials
      });

      const result = {
        data: response.data.data, // Base64-encoded data
        size: response.data.size
      };

      this.logInfo('Attachment downloaded successfully', {
        messageId: params.messageId,
        attachmentId: params.attachmentId,
        size: result.size
      });

      return result;
    } catch (error) {
      this.logError('Failed to download attachment', error, {
        messageId: params.messageId,
        attachmentId: params.attachmentId
      });
      throw error;
    }
  }

  /**
   * Batch modify emails (add/remove labels in bulk)
   * Can modify up to 1000 messages in a single call
   */
  async batchModifyEmails(userId: string, params: {
    messageIds: string[];
    addLabelIds?: string[];
    removeLabelIds?: string[];
  }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    if (!params.messageIds || params.messageIds.length === 0) {
      throw ErrorFactory.domain.validationFailed('At least one message ID is required');
    }

    if (params.messageIds.length > 1000) {
      throw ErrorFactory.domain.validationFailed('Cannot modify more than 1000 messages at once');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Batch modifying emails', {
        count: params.messageIds.length,
        addingLabels: params.addLabelIds?.length || 0,
        removingLabels: params.removeLabelIds?.length || 0
      });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/batchModify',
        data: {
          ids: params.messageIds,
          addLabelIds: params.addLabelIds,
          removeLabelIds: params.removeLabelIds
        },
        credentials
      });

      this.logInfo('Batch modify completed successfully', {
        modifiedCount: params.messageIds.length
      });
    } catch (error) {
      this.logError('Failed to batch modify emails', error, {
        count: params.messageIds.length
      });
      throw error;
    }
  }

  /**
   * Batch delete emails (permanently delete in bulk)
   * Can delete up to 1000 messages in a single call
   */
  async batchDeleteEmails(userId: string, params: {
    messageIds: string[];
  }): Promise<void> {
    this.assertReady();

    if (!this.googleAPIClient) {
      throw ErrorFactory.domain.serviceError(this.name, 'Google client not available');
    }

    if (!params.messageIds || params.messageIds.length === 0) {
      throw ErrorFactory.domain.validationFailed('At least one message ID is required');
    }

    if (params.messageIds.length > 1000) {
      throw ErrorFactory.domain.validationFailed('Cannot delete more than 1000 messages at once');
    }

    try {
      // Get OAuth2 credentials for this user
      const credentials = await this.getGoogleCredentials(userId);

      this.logInfo('Batch deleting emails', {
        count: params.messageIds.length
      });

      await this.googleAPIClient.makeRequest({
        method: 'POST',
        endpoint: '/gmail/v1/users/me/messages/batchDelete',
        data: {
          ids: params.messageIds
        },
        credentials
      });

      this.logInfo('Batch delete completed successfully', {
        deletedCount: params.messageIds.length
      });
    } catch (error) {
      this.logError('Failed to batch delete emails', error, {
        count: params.messageIds.length
      });
      throw error;
    }
  }

  /**
   * Get service health information
   */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    try {
      const healthy = this.isReady() && this.initialized && !!this.googleAPIClient;
      const details = {
        initialized: this.initialized,
        hasGoogleClient: !!this.googleAPIClient,
        authenticated: this.googleAPIClient?.isAuthenticated() || false
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
