import logger from '../utils/logger';
import { gmailService } from '../services/gmail.service';
import { EmailParser } from '../utils/email-parser';
import { ThreadManager } from '../utils/thread-manager';
import { 
  SendEmailRequest, 
  SearchEmailsRequest, 
  ReplyEmailRequest,
  GmailMessage,
  EmailDraft,
  GmailServiceError 
} from '../types/gmail.types';

export interface EmailAgentRequest {
  query: string;
  accessToken: string;
  contacts?: Array<{
    name: string;
    email: string;
    phone?: string;
  }>;
}

export interface EmailAgentResponse {
  success: boolean;
  message: string;
  data?: {
    emailId?: string;
    threadId?: string;
    emails?: GmailMessage[];
    draft?: EmailDraft;
    count?: number;
  };
  error?: string;
}

export class EmailAgent {
  private readonly systemPrompt = `# Email Agent
You are a specialized email agent that handles all email-related tasks using Gmail API.

## Capabilities
- Send emails to contacts
- Reply to existing emails
- Search and retrieve emails
- Create and manage drafts
- Handle email threads and conversations

## Input Format
You receive queries with contact information already resolved when needed.

## Actions Available
1. SEND_EMAIL - Send a new email
2. REPLY_EMAIL - Reply to an existing email
3. SEARCH_EMAILS - Search for emails
4. CREATE_DRAFT - Create an email draft
5. GET_EMAIL - Get specific email details
6. GET_THREAD - Get email conversation thread

## Response Format
Always return structured execution status with confirmation details.
`;

  /**
   * Process email-related queries
   */
  async processQuery(request: EmailAgentRequest): Promise<EmailAgentResponse> {
    try {
      logger.info('EmailAgent processing query', { query: request.query });

      if (!request.accessToken) {
        return {
          success: false,
          message: 'Access token required for email operations',
          error: 'MISSING_ACCESS_TOKEN'
        };
      }

      // Analyze the query to determine the action
      const action = this.determineAction(request.query);
      
      switch (action.type) {
        case 'SEND_EMAIL':
          return await this.handleSendEmail(request, action.params);
        
        case 'REPLY_EMAIL':
          return await this.handleReplyEmail(request, action.params);
        
        case 'SEARCH_EMAILS':
          return await this.handleSearchEmails(request, action.params);
        
        case 'CREATE_DRAFT':
          return await this.handleCreateDraft(request, action.params);
        
        case 'GET_EMAIL':
          return await this.handleGetEmail(request, action.params);
        
        case 'GET_THREAD':
          return await this.handleGetThread(request, action.params);
        
        default:
          return {
            success: false,
            message: 'Unable to determine the email action requested',
            error: 'UNKNOWN_ACTION'
          };
      }

    } catch (error) {
      logger.error('Error in EmailAgent.processQuery:', error);
      return {
        success: false,
        message: 'An error occurred while processing your email request',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Determine the action type from user query
   */
  private determineAction(query: string): { type: string; params: any } {
    const lowerQuery = query.toLowerCase();

    // Send email patterns
    if (lowerQuery.includes('send') && (lowerQuery.includes('email') || lowerQuery.includes('message'))) {
      return {
        type: 'SEND_EMAIL',
        params: this.extractSendEmailParams(query)
      };
    }

    // Reply patterns
    if (lowerQuery.includes('reply') || lowerQuery.includes('respond')) {
      return {
        type: 'REPLY_EMAIL',
        params: this.extractReplyParams(query)
      };
    }

    // Search patterns
    if (lowerQuery.includes('search') || lowerQuery.includes('find') || lowerQuery.includes('look for')) {
      return {
        type: 'SEARCH_EMAILS',
        params: this.extractSearchParams(query)
      };
    }

    // Draft patterns
    if (lowerQuery.includes('draft') || (lowerQuery.includes('create') && lowerQuery.includes('email'))) {
      return {
        type: 'CREATE_DRAFT',
        params: this.extractSendEmailParams(query)
      };
    }

    // Get specific email
    if (lowerQuery.includes('get email') || lowerQuery.includes('show email')) {
      return {
        type: 'GET_EMAIL',
        params: this.extractGetEmailParams(query)
      };
    }

    // Get thread/conversation
    if (lowerQuery.includes('thread') || lowerQuery.includes('conversation')) {
      return {
        type: 'GET_THREAD',
        params: this.extractGetThreadParams(query)
      };
    }

    // Default to search if no specific action detected
    return {
      type: 'SEARCH_EMAILS',
      params: { query: query }
    };
  }

  /**
   * Handle sending a new email
   */
  private async handleSendEmail(request: EmailAgentRequest, params: any): Promise<EmailAgentResponse> {
    try {
      const emailRequest = this.buildSendEmailRequest(request, params);
      
      if (!emailRequest.to || (!emailRequest.subject && !emailRequest.body)) {
        return {
          success: false,
          message: 'Missing required email information (recipient, subject, or body)',
          error: 'INVALID_EMAIL_REQUEST'
        };
      }

      const sentEmail = await gmailService.sendEmail(request.accessToken, emailRequest);

      logger.info('Email sent successfully', { 
        messageId: sentEmail.id, 
        threadId: sentEmail.threadId,
        to: emailRequest.to 
      });

      return {
        success: true,
        message: `Email sent successfully to ${Array.isArray(emailRequest.to) ? emailRequest.to.join(', ') : emailRequest.to}`,
        data: {
          emailId: sentEmail.id,
          threadId: sentEmail.threadId
        }
      };

    } catch (error) {
      logger.error('Failed to send email:', error);
      
      // Provide more specific error messages for common issues
      let errorMessage = 'Failed to send email';
      let errorCode = 'SEND_FAILED';
      
      if (error instanceof GmailServiceError) {
        errorCode = error.code;
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        const errorStr = String(error.message);
        if (errorStr.includes('insufficient authentication scopes') || errorStr.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
          errorMessage = 'Insufficient permissions. Please re-authenticate with Gmail access.';
          errorCode = 'INSUFFICIENT_SCOPE';
        } else if (errorStr.includes('403')) {
          errorMessage = 'Gmail access denied. Please check your permissions.';
          errorCode = 'ACCESS_DENIED';
        } else if (errorStr.includes('401')) {
          errorMessage = 'Authentication failed. Please re-login.';
          errorCode = 'AUTH_FAILED';
        } else {
          errorMessage = errorStr;
        }
      }
      
      return {
        success: false,
        message: errorMessage,
        error: errorCode
      };
    }
  }

  /**
   * Handle replying to an email
   */
  private async handleReplyEmail(request: EmailAgentRequest, params: any): Promise<EmailAgentResponse> {
    try {
      const replyRequest = this.buildReplyEmailRequest(request, params);
      
      if (!replyRequest.messageId || !replyRequest.threadId || !replyRequest.body) {
        return {
          success: false,
          message: 'Missing required information for reply (message ID, thread ID, or body)',
          error: 'INVALID_REPLY_REQUEST'
        };
      }

      const replyEmail = await gmailService.replyToEmail(request.accessToken, replyRequest);

      logger.info('Email reply sent successfully', { 
        messageId: replyEmail.id, 
        threadId: replyEmail.threadId 
      });

      return {
        success: true,
        message: 'Reply sent successfully',
        data: {
          emailId: replyEmail.id,
          threadId: replyEmail.threadId
        }
      };

    } catch (error) {
      logger.error('Failed to send reply:', error);
      return {
        success: false,
        message: 'Failed to send reply',
        error: error instanceof GmailServiceError ? error.code : 'REPLY_FAILED'
      };
    }
  }

  /**
   * Handle searching for emails
   */
  private async handleSearchEmails(request: EmailAgentRequest, params: any): Promise<EmailAgentResponse> {
    try {
      const searchRequest: SearchEmailsRequest = {
        query: params.query,
        maxResults: params.maxResults || 20,
        includeSpamTrash: params.includeSpamTrash || false
      };

      const searchResult = await gmailService.searchEmails(request.accessToken, searchRequest);

      logger.info('Email search completed', { 
        query: searchRequest.query, 
        count: searchResult.messages.length 
      });

      return {
        success: true,
        message: `Found ${searchResult.messages.length} emails matching your search`,
        data: {
          emails: searchResult.messages,
          count: searchResult.messages.length
        }
      };

    } catch (error) {
      logger.error('Failed to search emails:', error);
      return {
        success: false,
        message: 'Failed to search emails',
        error: error instanceof GmailServiceError ? error.code : 'SEARCH_FAILED'
      };
    }
  }

  /**
   * Handle creating a draft email
   */
  private async handleCreateDraft(request: EmailAgentRequest, params: any): Promise<EmailAgentResponse> {
    try {
      const emailRequest = this.buildSendEmailRequest(request, params);
      
      if (!emailRequest.to) {
        return {
          success: false,
          message: 'Recipient required for draft email',
          error: 'INVALID_DRAFT_REQUEST'
        };
      }

      const draft: EmailDraft = {
        message: emailRequest,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // In a real implementation, you'd store this draft
      // For now, we'll just return it as confirmation
      
      logger.info('Email draft created', { 
        to: emailRequest.to, 
        subject: emailRequest.subject 
      });

      return {
        success: true,
        message: `Draft created for ${Array.isArray(emailRequest.to) ? emailRequest.to.join(', ') : emailRequest.to}`,
        data: {
          draft
        }
      };

    } catch (error) {
      logger.error('Failed to create draft:', error);
      return {
        success: false,
        message: 'Failed to create draft',
        error: 'DRAFT_FAILED'
      };
    }
  }

  /**
   * Handle getting a specific email
   */
  private async handleGetEmail(request: EmailAgentRequest, params: any): Promise<EmailAgentResponse> {
    try {
      if (!params.messageId) {
        return {
          success: false,
          message: 'Message ID required to get specific email',
          error: 'MISSING_MESSAGE_ID'
        };
      }

      const email = await gmailService.getEmailById(request.accessToken, params.messageId);

      logger.info('Email retrieved successfully', { messageId: params.messageId });

      return {
        success: true,
        message: 'Email retrieved successfully',
        data: {
          emails: [email]
        }
      };

    } catch (error) {
      logger.error('Failed to get email:', error);
      return {
        success: false,
        message: 'Failed to retrieve email',
        error: error instanceof GmailServiceError ? error.code : 'GET_FAILED'
      };
    }
  }

  /**
   * Handle getting an email thread
   */
  private async handleGetThread(request: EmailAgentRequest, params: any): Promise<EmailAgentResponse> {
    try {
      if (!params.threadId) {
        return {
          success: false,
          message: 'Thread ID required to get conversation',
          error: 'MISSING_THREAD_ID'
        };
      }

      const enhancedThread = await ThreadManager.getEnhancedThread(
        request.accessToken, 
        params.threadId
      );

      logger.info('Thread retrieved successfully', { 
        threadId: params.threadId, 
        messageCount: enhancedThread.thread.messages.length 
      });

      return {
        success: true,
        message: `Retrieved conversation with ${enhancedThread.thread.messages.length} messages`,
        data: {
          threadId: enhancedThread.thread.id,
          emails: enhancedThread.thread.messages,
          count: enhancedThread.thread.messages.length
        }
      };

    } catch (error) {
      logger.error('Failed to get thread:', error);
      return {
        success: false,
        message: 'Failed to retrieve conversation',
        error: error instanceof GmailServiceError ? error.code : 'THREAD_FAILED'
      };
    }
  }

  /**
   * Build SendEmailRequest from user input and contacts
   */
  private buildSendEmailRequest(request: EmailAgentRequest, params: any): SendEmailRequest {
    const { to, cc, bcc, subject, body } = this.extractEmailContent(request.query, request.contacts);

    return {
      to: to || params.to,
      cc: cc || params.cc,
      bcc: bcc || params.bcc,
      subject: subject || params.subject || 'No Subject',
      body: body || params.body || 'This email was sent via your assistant.'
    };
  }

  /**
   * Build ReplyEmailRequest from user input
   */
  private buildReplyEmailRequest(request: EmailAgentRequest, params: any): ReplyEmailRequest {
    const { body } = this.extractEmailContent(request.query, request.contacts);

    return {
      messageId: params.messageId,
      threadId: params.threadId,
      body: body || params.body || 'Reply sent via your assistant.'
    };
  }

  /**
   * Extract email content from natural language query
   */
  private extractEmailContent(query: string, contacts?: Array<{ name: string; email: string; phone?: string; }>): {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
  } {
    const result: any = {};

    // Extract recipients
    if (contacts && contacts.length > 0) {
      result.to = contacts.map(contact => contact.email);
    }

    // Extract subject
    const subjectMatch = query.match(/(?:subject|about|regarding)[\s:]+([^,.]+)/i);
    if (subjectMatch && subjectMatch[1]) {
      result.subject = subjectMatch[1].trim();
    }

    // Extract body content - everything after common phrases
    const bodyPatterns = [
      /(?:tell|ask|saying|message)[\s:]+([^$]+)/i,
      /(?:email|send).+(?:that|saying)[\s:]+([^$]+)/i,
      /"([^"]+)"/g  // Content in quotes
    ];

    for (const pattern of bodyPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        result.body = match[1].trim();
        break;
      }
    }

    return result;
  }

  /**
   * Extract parameters for send email action
   */
  private extractSendEmailParams(query: string): any {
    const params: any = {};

    // Extract email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = query.match(emailRegex);
    if (emails) {
      params.to = emails;
    }

    return params;
  }

  /**
   * Extract parameters for reply action
   */
  private extractReplyParams(query: string): any {
    const params: any = {};

    // Extract message/thread IDs (would typically come from context)
    const messageIdMatch = query.match(/message[:\s]+(\w+)/i);
    const threadIdMatch = query.match(/thread[:\s]+(\w+)/i);

    if (messageIdMatch) params.messageId = messageIdMatch[1];
    if (threadIdMatch) params.threadId = threadIdMatch[1];

    return params;
  }

  /**
   * Extract parameters for search action
   */
  private extractSearchParams(query: string): any {
    const params: any = {};

    // Extract search terms
    const searchPatterns = [
      /(?:search|find|look for)[\s:]+([^$]+)/i,
      /emails?.+(?:from|about|containing)[\s:]+([^$]+)/i
    ];

    for (const pattern of searchPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        params.query = match[1].trim();
        break;
      }
    }

    if (!params.query) {
      params.query = query;
    }

    return params;
  }

  /**
   * Extract parameters for get email action
   */
  private extractGetEmailParams(query: string): any {
    const params: any = {};

    const messageIdMatch = query.match(/(?:email|message)[\s:]+(\w+)/i);
    if (messageIdMatch) {
      params.messageId = messageIdMatch[1];
    }

    return params;
  }

  /**
   * Extract parameters for get thread action
   */
  private extractGetThreadParams(query: string): any {
    const params: any = {};

    const threadIdMatch = query.match(/(?:thread|conversation)[\s:]+(\w+)/i);
    if (threadIdMatch) {
      params.threadId = threadIdMatch[1];
    }

    return params;
  }

  /**
   * Get system prompt for external use
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
}

export const emailAgent = new EmailAgent();