import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { authService } from './auth.service';
import logger from '../utils/logger';
import { 
  GmailMessage, 
  GmailThread, 
  SendEmailRequest, 
  SearchEmailsRequest,
  ReplyEmailRequest,
  EmailAttachment,
  GmailServiceError
} from '../types/gmail.types';

export class GmailService {
  private gmail: gmail_v1.Gmail;

  constructor() {
    this.gmail = google.gmail('v1');
    logger.info('Gmail service initialized');
  }

  /**
   * Get authenticated Gmail client for a user
   */
  private getAuthenticatedClient(accessToken: string): OAuth2Client {
    const oauth2Client = authService.getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    return oauth2Client;
  }

  /**
   * Set authentication for Gmail API
   */
  private setAuth(accessToken: string): void {
    const oauth2Client = this.getAuthenticatedClient(accessToken);
    google.options({ auth: oauth2Client });
  }

  /**
   * Send an email
   */
  async sendEmail(accessToken: string, emailRequest: SendEmailRequest): Promise<GmailMessage> {
    try {
      this.setAuth(accessToken);
      
      logger.info('Sending email', { 
        to: emailRequest.to, 
        subject: emailRequest.subject 
      });

      // Create the email message
      const emailBody = this.createEmailBody(emailRequest);
      
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: emailBody
        }
      });

      if (!response.data) {
        throw new GmailServiceError('No response data from Gmail API', 'SEND_FAILED');
      }

      logger.info('Email sent successfully', { 
        messageId: response.data.id,
        threadId: response.data.threadId 
      });

      return this.formatGmailMessage(response.data);
    } catch (error) {
      logger.error('Failed to send email', { error, to: emailRequest.to });
      throw this.handleGmailError(error, 'SEND_FAILED');
    }
  }

  /**
   * Get emails with optional search criteria
   */
  async getEmails(
    accessToken: string, 
    options: SearchEmailsRequest = {}
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    try {
      this.setAuth(accessToken);
      
      logger.info('Fetching emails', { query: options.query, maxResults: options.maxResults });

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: options.query,
        maxResults: options.maxResults || 20,
        pageToken: options.pageToken,
        labelIds: options.labelIds,
        includeSpamTrash: options.includeSpamTrash || false
      });

      if (!response.data.messages) {
        return { messages: [] };
      }

      // Get full message details for each message
      const messages = await Promise.all(
        response.data.messages.map(async (message) => {
          if (!message.id) return null;
          
          const fullMessage = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });
          
          return this.formatGmailMessage(fullMessage.data);
        })
      );

      const filteredMessages = messages.filter(Boolean) as GmailMessage[];

      logger.info('Emails fetched successfully', { 
        count: filteredMessages.length,
        hasNextPage: !!response.data.nextPageToken 
      });

      return {
        messages: filteredMessages,
        nextPageToken: response.data.nextPageToken || undefined
      };
    } catch (error) {
      logger.error('Failed to fetch emails', { error, query: options.query });
      throw this.handleGmailError(error, 'FETCH_FAILED');
    }
  }

  /**
   * Get a specific email by ID
   */
  async getEmailById(accessToken: string, messageId: string): Promise<GmailMessage> {
    try {
      this.setAuth(accessToken);
      
      logger.info('Fetching email by ID', { messageId });

      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      if (!response.data) {
        throw new GmailServiceError(`Email not found: ${messageId}`, 'NOT_FOUND');
      }

      return this.formatGmailMessage(response.data);
    } catch (error) {
      logger.error('Failed to fetch email by ID', { error, messageId });
      throw this.handleGmailError(error, 'FETCH_FAILED');
    }
  }

  /**
   * Reply to an email
   */
  async replyToEmail(accessToken: string, replyRequest: ReplyEmailRequest): Promise<GmailMessage> {
    try {
      this.setAuth(accessToken);
      
      logger.info('Replying to email', { 
        messageId: replyRequest.messageId, 
        threadId: replyRequest.threadId 
      });

      // Get original message to extract references for proper threading
      const originalMessage = await this.getEmailById(accessToken, replyRequest.messageId);
      
      const emailBody = this.createReplyEmailBody(replyRequest, originalMessage);
      
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: emailBody,
          threadId: replyRequest.threadId
        }
      });

      if (!response.data) {
        throw new GmailServiceError('No response data from Gmail API', 'REPLY_FAILED');
      }

      logger.info('Reply sent successfully', { 
        messageId: response.data.id,
        threadId: response.data.threadId 
      });

      return this.formatGmailMessage(response.data);
    } catch (error) {
      logger.error('Failed to reply to email', { error, messageId: replyRequest.messageId });
      throw this.handleGmailError(error, 'REPLY_FAILED');
    }
  }

  /**
   * Search emails with advanced query
   */
  async searchEmails(accessToken: string, searchRequest: SearchEmailsRequest): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    return this.getEmails(accessToken, searchRequest);
  }

  /**
   * Get email thread
   */
  async getThread(accessToken: string, threadId: string): Promise<GmailThread> {
    try {
      this.setAuth(accessToken);
      
      logger.info('Fetching email thread', { threadId });

      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });

      if (!response.data || !response.data.messages) {
        throw new GmailServiceError(`Thread not found: ${threadId}`, 'NOT_FOUND');
      }

      const messages = response.data.messages.map(message => this.formatGmailMessage(message));

      return {
        id: response.data.id!,
        historyId: response.data.historyId!,
        messages,
        snippet: response.data.snippet || undefined
      };
    } catch (error) {
      logger.error('Failed to fetch thread', { error, threadId });
      throw this.handleGmailError(error, 'FETCH_FAILED');
    }
  }

  /**
   * Mark email as read
   */
  async markAsRead(accessToken: string, messageId: string): Promise<void> {
    try {
      this.setAuth(accessToken);
      
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });

      logger.info('Email marked as read', { messageId });
    } catch (error) {
      logger.error('Failed to mark email as read', { error, messageId });
      throw this.handleGmailError(error, 'UPDATE_FAILED');
    }
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(accessToken: string, messageId: string): Promise<void> {
    try {
      this.setAuth(accessToken);
      
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['UNREAD']
        }
      });

      logger.info('Email marked as unread', { messageId });
    } catch (error) {
      logger.error('Failed to mark email as unread', { error, messageId });
      throw this.handleGmailError(error, 'UPDATE_FAILED');
    }
  }

  /**
   * Delete email
   */
  async deleteEmail(accessToken: string, messageId: string): Promise<void> {
    try {
      this.setAuth(accessToken);
      
      await this.gmail.users.messages.delete({
        userId: 'me',
        id: messageId
      });

      logger.info('Email deleted', { messageId });
    } catch (error) {
      logger.error('Failed to delete email', { error, messageId });
      throw this.handleGmailError(error, 'DELETE_FAILED');
    }
  }

  /**
   * Create email body for sending
   */
  private createEmailBody(emailRequest: SendEmailRequest): string {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    let email = [
      `To: ${Array.isArray(emailRequest.to) ? emailRequest.to.join(', ') : emailRequest.to}`,
      emailRequest.cc ? `Cc: ${Array.isArray(emailRequest.cc) ? emailRequest.cc.join(', ') : emailRequest.cc}` : '',
      emailRequest.bcc ? `Bcc: ${Array.isArray(emailRequest.bcc) ? emailRequest.bcc.join(', ') : emailRequest.bcc}` : '',
      `Subject: ${emailRequest.subject}`,
      emailRequest.replyTo ? `Reply-To: ${emailRequest.replyTo}` : '',
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(emailRequest.body).toString('base64'),
      ''
    ].filter(Boolean).join('\r\n');

    // Add attachments if any
    if (emailRequest.attachments && emailRequest.attachments.length > 0) {
      for (const attachment of emailRequest.attachments) {
        email += [
          `--${boundary}`,
          `Content-Type: ${attachment.mimeType}`,
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          '',
          attachment.data,
          ''
        ].join('\r\n');
      }
    }

    email += `--${boundary}--`;

    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Create reply email body
   */
  private createReplyEmailBody(replyRequest: ReplyEmailRequest, originalMessage: GmailMessage): string {
    const subject = originalMessage.subject.startsWith('Re: ') 
      ? originalMessage.subject 
      : `Re: ${originalMessage.subject}`;

    const email = [
      `To: ${replyRequest.to || originalMessage.from}`,
      replyRequest.cc ? `Cc: ${Array.isArray(replyRequest.cc) ? replyRequest.cc.join(', ') : replyRequest.cc}` : '',
      `Subject: ${subject}`,
      `In-Reply-To: ${originalMessage.messageId}`,
      `References: ${originalMessage.messageId}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      replyRequest.body
    ].filter(Boolean).join('\r\n');

    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Format Gmail message response
   */
  private formatGmailMessage(gmailMessage: gmail_v1.Schema$Message): GmailMessage {
    const headers = gmailMessage.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: gmailMessage.id!,
      threadId: gmailMessage.threadId!,
      messageId: getHeader('message-id'),
      subject: getHeader('subject'),
      from: getHeader('from'),
      to: getHeader('to'),
      cc: getHeader('cc'),
      bcc: getHeader('bcc'),
      date: getHeader('date'),
      body: this.extractEmailBody(gmailMessage),
      snippet: gmailMessage.snippet || '',
      labelIds: gmailMessage.labelIds || [],
      attachments: this.extractAttachments(gmailMessage),
      isUnread: gmailMessage.labelIds?.includes('UNREAD') || false,
      historyId: gmailMessage.historyId!,
      internalDate: gmailMessage.internalDate || '',
      sizeEstimate: gmailMessage.sizeEstimate || 0
    };
  }

  /**
   * Extract email body from Gmail message
   */
  private extractEmailBody(gmailMessage: gmail_v1.Schema$Message): string {
    const payload = gmailMessage.payload;
    if (!payload) return '';

    // Single part message
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    // Multipart message
    if (payload.parts) {
      return this.extractBodyFromParts(payload.parts);
    }

    return '';
  }

  /**
   * Extract body from message parts (recursive)
   */
  private extractBodyFromParts(parts: gmail_v1.Schema$MessagePart[]): string {
    for (const part of parts) {
      // Check for text/html or text/plain
      if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
        if (part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
      }
      
      // Recursive search in nested parts
      if (part.parts) {
        const nestedBody = this.extractBodyFromParts(part.parts);
        if (nestedBody) return nestedBody;
      }
    }
    
    return '';
  }

  /**
   * Extract attachments from Gmail message
   */
  private extractAttachments(gmailMessage: gmail_v1.Schema$Message): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];
    const payload = gmailMessage.payload;
    
    if (!payload?.parts) return attachments;

    const extractFromParts = (parts: gmail_v1.Schema$MessagePart[]) => {
      for (const part of parts) {
        if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0
          });
        }
        
        if (part.parts) {
          extractFromParts(part.parts);
        }
      }
    };

    extractFromParts(payload.parts);
    return attachments;
  }

  /**
   * Download attachment
   */
  async downloadAttachment(accessToken: string, messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      this.setAuth(accessToken);
      
      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId
      });

      if (!response.data.data) {
        throw new GmailServiceError('No attachment data received', 'DOWNLOAD_FAILED');
      }

      return Buffer.from(response.data.data, 'base64');
    } catch (error) {
      logger.error('Failed to download attachment', { error, messageId, attachmentId });
      throw this.handleGmailError(error, 'DOWNLOAD_FAILED');
    }
  }

  /**
   * Handle Gmail API errors
   */
  private handleGmailError(error: any, operation: string): GmailServiceError {
    if (error instanceof GmailServiceError) {
      return error;
    }

    const message = error?.message || 'Unknown Gmail API error';
    const code = error?.code || operation;
    
    logger.error('Gmail API error', { operation, error: message, code });
    
    return new GmailServiceError(message, code);
  }
}

// Export singleton instance
export const gmailService = new GmailService();