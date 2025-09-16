import { BaseService } from './base-service';
import { ServiceManager } from './service-manager';
import { GmailService } from './gmail.service';
import { SendEmailRequest, SearchEmailsRequest, ReplyEmailRequest, GmailMessage } from '../types/gmail.types';
import { EMAIL_SERVICE_CONSTANTS } from '../config/email-service-constants';
import logger from '../utils/logger';

/**
 * Email operation result for handler
 */
export interface EmailOperationResult {
  success: boolean;
  result?: {
    messageId?: string;
    threadId?: string;
    emails?: GmailMessage[];
    count?: number;
  };
  error?: string;
  executionTime: number;
}

/**
 * EmailOperationHandler - Focused service for Gmail API operations
 * Handles all direct Gmail API interactions (send, search, reply, get)
 */
export class EmailOperationHandler extends BaseService {
  private gmailService: GmailService | null = null;

  constructor() {
    super(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_OPERATION_HANDLER);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing EmailOperationHandler...');

      // Get Gmail service from service manager
      const serviceManager = ServiceManager.getInstance();
      this.gmailService = serviceManager.getService(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.GMAIL_SERVICE) as GmailService;

      if (!this.gmailService) {
        throw new Error(EMAIL_SERVICE_CONSTANTS.ERRORS.GMAIL_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('EmailOperationHandler initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.gmailService = null;
      this.logInfo('EmailOperationHandler destroyed successfully');
    } catch (error) {
      this.logError('Error during EmailOperationHandler destruction', error);
    }
  }

  /**
   * Send email via Gmail API
   */
  async sendEmail(request: SendEmailRequest, accessToken: string): Promise<EmailOperationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.gmailService) {
        throw new Error(EMAIL_SERVICE_CONSTANTS.ERRORS.GMAIL_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('Sending email', {
        to: request.to,
        subject: request.subject,
        hasBody: !!request.body
      });

      // Use the existing GmailService interface
      const toEmail = Array.isArray(request.to) ? request.to[0] : request.to;
      if (!toEmail) {
        throw new Error(EMAIL_SERVICE_CONSTANTS.ERRORS.RECIPIENT_EMAIL_REQUIRED);
      }

      const result = await this.gmailService.sendEmail(
        accessToken,
        toEmail,
        request.subject,
        request.body,
        {
          replyTo: request.replyTo,
          cc: Array.isArray(request.cc) ? request.cc : request.cc ? [request.cc] : undefined,
          bcc: Array.isArray(request.bcc) ? request.bcc : request.bcc ? [request.bcc] : undefined,
          attachments: request.attachments?.map(att => ({
            filename: att.filename,
            content: att.data || '',
            contentType: att.mimeType
          }))
        }
      );
      
      this.logInfo(EMAIL_SERVICE_CONSTANTS.SUCCESS.EMAIL_SENT, {
        messageId: result.messageId,
        threadId: result.threadId,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        result: {
          messageId: result.messageId,
          threadId: result.threadId
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.logError('Error sending email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : EMAIL_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Search emails via Gmail API
   */
  async searchEmails(request: SearchEmailsRequest, accessToken: string): Promise<EmailOperationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.gmailService) {
        throw new Error(EMAIL_SERVICE_CONSTANTS.ERRORS.GMAIL_SERVICE_NOT_AVAILABLE);
      }

      this.logInfo('Searching emails', {
        query: request.query,
        maxResults: request.maxResults
      });

      // Use the existing GmailService interface
      if (!request.query) {
        throw new Error(EMAIL_SERVICE_CONSTANTS.ERRORS.SEARCH_QUERY_REQUIRED);
      }

      const result = await this.gmailService.searchEmails(
        accessToken,
        request.query,
        {
          maxResults: request.maxResults || 10
        }
      );
      
      this.logInfo('Email search completed', {
        resultCount: result.length,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        result: {
          emails: result,
          count: result.length
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.logError('Error searching emails', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Reply to email via Gmail API
   */
  async replyToEmail(request: ReplyEmailRequest, accessToken: string): Promise<EmailOperationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.gmailService) {
        throw new Error('GmailService not available');
      }

      this.logInfo('Replying to email', {
        messageId: request.messageId,
        threadId: request.threadId,
        hasBody: !!request.body
      });

      // Use the existing GmailService interface
      const result = await this.gmailService.replyToEmail(
        accessToken,
        request.messageId,
        request.body,
        {
          attachments: request.attachments?.map(att => ({
            filename: att.filename,
            content: att.data || '',
            contentType: att.mimeType
          }))
        }
      );
      
      this.logInfo('Email reply sent successfully', {
        messageId: result.messageId,
        threadId: result.threadId,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        result: {
          messageId: result.messageId,
          threadId: result.threadId
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.logError('Error replying to email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get email by ID via Gmail API
   */
  async getEmail(emailId: string, accessToken: string): Promise<EmailOperationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.gmailService) {
        throw new Error('GmailService not available');
      }

      this.logInfo('Getting email', { emailId });

      // Use the existing GmailService interface
      const email = await this.gmailService.getEmail(accessToken, emailId);
      
      this.logInfo('Email retrieved successfully', {
        emailId,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        result: {
          emails: [email],
          count: 1
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.logError('Error getting email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get email thread via Gmail API
   */
  async getEmailThread(threadId: string, accessToken: string): Promise<EmailOperationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.gmailService) {
        throw new Error('GmailService not available');
      }

      this.logInfo('Getting email thread', { threadId });

      // Use the existing GmailService interface
      const thread = await this.gmailService.getEmailThread(accessToken, threadId);
      
      this.logInfo('Email thread retrieved successfully', {
        threadId,
        messageCount: thread.messages?.length || 0,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        result: {
          emails: thread.messages || [],
          count: thread.messages?.length || 0
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.logError('Error getting email thread', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get operation statistics
   */
  getOperationStats(): {
    serviceName: string;
    hasGmailService: boolean;
  } {
    return {
      serviceName: 'EmailOperationHandler',
      hasGmailService: !!this.gmailService
    };
  }
}
