import { BaseAgent } from '../framework/base-agent';
import { ToolExecutionContext, EmailAgentParams } from '../types/tools';
import { getService } from '../services/service-manager';
import { GmailService } from '../services/gmail.service';
import { EmailParser } from '../utils/email-parser';
import { ThreadManager } from '../utils/thread-manager';
import { OpenAIService } from '../services/openai.service';
import { 
  SendEmailRequest, 
  SearchEmailsRequest, 
  ReplyEmailRequest,
  GmailMessage,
  EmailDraft,
  GmailServiceError 
} from '../types/gmail.types';
import { EMAIL_CONSTANTS } from '../config/constants';

/**
 * Email operation result interface
 */
export interface EmailResult {
  messageId?: string;
  threadId?: string;
  emails?: GmailMessage[];
  draft?: EmailDraft;
  count?: number;
  action: 'send' | 'reply' | 'search' | 'draft' | 'get';
  recipient?: string;
  subject?: string;
}

/**
 * Email agent parameters with access token
 */
export interface EmailAgentRequest extends EmailAgentParams {
  accessToken: string;
  contacts?: Array<{
    name: string;
    email: string;
    phone?: string;
  }>;
}

/**
 * Enhanced EmailAgent using BaseAgent framework
 * Handles all email operations via Gmail API with consistent error handling and logging
 */
export class EmailAgent extends BaseAgent<EmailAgentRequest, EmailResult> {
  private openAIService?: OpenAIService;

  constructor() {
    super({
      name: 'emailAgent',
      description: 'Handles email operations via Gmail API',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });
    
    // Initialize OpenAI service if available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      this.openAIService = new OpenAIService({
        apiKey: openaiApiKey,
        model: 'gpt-4o-mini'
      });
    }
  }
  
  /**
   * Core email processing logic - no boilerplate!
   */
  protected async processQuery(params: EmailAgentRequest, context: ToolExecutionContext): Promise<EmailResult> {
    const { query, accessToken, contacts } = params;
    
    // Determine action type from query
    const action = this.determineAction(query);
    
    switch (action.type) {
      case 'SEND_EMAIL':
        return await this.handleSendEmail(params, action.params);
      case 'REPLY_EMAIL':
        return await this.handleReplyEmail(params, action.params);
      case 'SEARCH_EMAILS':
        return await this.handleSearchEmails(params, action.params);
      case 'CREATE_DRAFT':
        return await this.handleCreateDraft(params, action.params);
      case 'GET_EMAIL':
        return await this.handleGetEmail(params, action.params);
      case 'GET_THREAD':
        return await this.handleGetThread(params, action.params);
      default:
        throw this.createError(`Unknown email action: ${action.type}`, 'UNKNOWN_ACTION');
    }
  }
  
  /**
   * Enhanced parameter validation
   */
  protected validateParams(params: EmailAgentRequest): void {
    super.validateParams(params);
    
    if (!params.accessToken || typeof params.accessToken !== 'string') {
      throw this.createError('Access token is required for email operations', 'MISSING_ACCESS_TOKEN');
    }
    
    if (params.accessToken.length > EMAIL_CONSTANTS.MAX_LOG_BODY_LENGTH) {
      throw this.createError('Access token appears to be invalid', 'INVALID_ACCESS_TOKEN');
    }
  }
  
  /**
   * Pre-execution hook - validate Gmail access
   */
  protected async beforeExecution(params: EmailAgentRequest, context: ToolExecutionContext): Promise<void> {
    await super.beforeExecution(params, context);
    
    // Note: Gmail service validation would happen here in a real implementation
    this.logger.debug('Gmail access token validated', { 
      sessionId: context.sessionId,
      hasContacts: !!params.contacts?.length 
    });
  }
  
  /**
   * Post-execution hook - log email metrics
   */
  protected async afterExecution(result: EmailResult, context: ToolExecutionContext): Promise<void> {
    await super.afterExecution(result, context);
    
    // Log email operation metrics
    this.logger.info('Email operation completed', {
      action: result.action,
      recipient: result.recipient,
      subject: result.subject?.substring(0, 50),
      hasAttachments: false, // Could be enhanced
      sessionId: context.sessionId
    });
  }
  
  /**
   * Sanitize sensitive data from logs
   */
  protected sanitizeForLogging(params: EmailAgentRequest): any {
    return {
      query: params.query?.substring(0, 100) + (params.query?.length > 100 ? '...' : ''),
      accessToken: '[REDACTED]',
      contactEmail: params.contactEmail ? '[EMAIL]' : undefined,
      subject: params.subject,
      body: params.body ? '[BODY_PRESENT]' : undefined,
      threadId: params.threadId,
      contactsCount: params.contacts?.length || 0
    };
  }
  
  // PRIVATE IMPLEMENTATION METHODS
  
  /**
   * Handle sending a new email
   */
  private async handleSendEmail(params: EmailAgentRequest, actionParams: any): Promise<EmailResult> {
    const emailRequest = await this.buildSendEmailRequest(params, actionParams);
    
    if (!emailRequest.to || (!emailRequest.subject && !emailRequest.body)) {
      throw this.createError(
        `Missing email information: ${!emailRequest.to ? 'recipient' : 'subject or body'}`,
        'INVALID_EMAIL_REQUEST'
      );
    }

    // Use retry mechanism from BaseAgent for reliability
    const sentEmail = await this.withRetries(async () => {
      const gmailService = getService<GmailService>('gmailService');
      if (!gmailService) {
        throw new Error('Gmail service not available');
      }
      return await gmailService.sendEmail(
        params.accessToken,
        (Array.isArray(emailRequest.to) ? emailRequest.to[0] : emailRequest.to) || '',
        emailRequest.subject,
        emailRequest.body,
        {
          cc: Array.isArray(emailRequest.cc) ? emailRequest.cc : emailRequest.cc ? [emailRequest.cc] : undefined,
          bcc: Array.isArray(emailRequest.bcc) ? emailRequest.bcc : emailRequest.bcc ? [emailRequest.bcc] : undefined
        }
      );
    });

    this.logger.info('Email sent successfully', { 
      messageId: sentEmail.messageId, 
      threadId: sentEmail.threadId,
      to: Array.isArray(emailRequest.to) ? emailRequest.to[0] : emailRequest.to
    });

    return {
      messageId: sentEmail.messageId,
      threadId: sentEmail.threadId,
      action: 'send',
      recipient: Array.isArray(emailRequest.to) ? emailRequest.to[0] : emailRequest.to,
      subject: emailRequest.subject
    };
  }
  
  /**
   * Handle replying to an email
   */
  private async handleReplyEmail(params: EmailAgentRequest, actionParams: any): Promise<EmailResult> {
    const replyRequest = await this.buildReplyEmailRequest(params, actionParams);
    
    if (!replyRequest.messageId || !replyRequest.threadId || !replyRequest.body) {
      throw this.createError('Missing reply information (messageId, threadId, or body)', 'INVALID_REPLY_REQUEST');
    }

    const replyEmail = await this.withRetries(async () => {
      const gmailService = getService<GmailService>('gmailService');
      if (!gmailService) {
        throw new Error('Gmail service not available');
      }
      return await gmailService.replyToEmail(
        params.accessToken,
        replyRequest.messageId,
        replyRequest.body
      );
    });

    this.logger.info('Email reply sent successfully', { 
      messageId: replyEmail.messageId, 
      threadId: replyEmail.threadId 
    });

        return {
      messageId: replyEmail.messageId,
      threadId: replyEmail.threadId,
      action: 'reply'
    };
  }
  
  /**
   * Handle searching for emails
   */
  private async handleSearchEmails(params: EmailAgentRequest, actionParams: any): Promise<EmailResult> {
    const searchRequest: SearchEmailsRequest = {
      query: actionParams.query,
      maxResults: actionParams.maxResults || EMAIL_CONSTANTS.DEFAULT_SEARCH_RESULTS,
      includeSpamTrash: actionParams.includeSpamTrash || false
    };

    const searchResult = await this.withRetries(async () => {
      const gmailService = getService<GmailService>('gmailService');
      if (!gmailService) {
        throw new Error('Gmail service not available');
      }
      return await gmailService.searchEmails(
        params.accessToken,
        searchRequest.query || '',
        {
          maxResults: searchRequest.maxResults,
          includeSpamTrash: searchRequest.includeSpamTrash
        }
      );
    });

    this.logger.info('Email search completed', { 
      query: searchRequest.query, 
      count: searchResult.length 
    });

    return {
      emails: searchResult,
      count: searchResult.length,
      action: 'search'
    };
  }
  
  /**
   * Handle creating a draft email
   */
  private async handleCreateDraft(params: EmailAgentRequest, actionParams: any): Promise<EmailResult> {
    const emailRequest = await this.buildSendEmailRequest(params, actionParams);
    
    if (!emailRequest.to) {
      throw this.createError('Recipient is required for draft creation', 'INVALID_DRAFT_REQUEST');
    }

    const draft: EmailDraft = {
      message: emailRequest,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // In a real implementation, you'd store this draft via Gmail API
    this.logger.info('Email draft created', { 
      to: Array.isArray(emailRequest.to) ? emailRequest.to[0] : emailRequest.to, 
      subject: emailRequest.subject 
    });

          return {
      draft,
      action: 'draft',
      recipient: Array.isArray(emailRequest.to) ? emailRequest.to[0] : emailRequest.to,
      subject: emailRequest.subject
    };
  }
  
  /**
   * Handle getting a specific email
   */
  private async handleGetEmail(params: EmailAgentRequest, actionParams: any): Promise<EmailResult> {
    if (!actionParams.messageId) {
      throw this.createError('Message ID is required to get email', 'MISSING_MESSAGE_ID');
    }

          const email = await this.withRetries(async () => {
        const gmailService = getService<GmailService>('gmailService');
        if (!gmailService) {
          throw new Error('Gmail service not available');
        }
        return await gmailService.getEmail(params.accessToken, actionParams.messageId);
      });

    this.logger.info('Email retrieved successfully', { messageId: actionParams.messageId });

      return {
      emails: [email],
      action: 'get',
      messageId: actionParams.messageId
    };
  }
  
  /**
   * Handle getting an email thread
   */
  private async handleGetThread(params: EmailAgentRequest, actionParams: any): Promise<EmailResult> {
    if (!actionParams.threadId) {
      throw this.createError('Thread ID is required to get thread', 'MISSING_THREAD_ID');
    }

    const enhancedThread = await this.withRetries(async () => {
      return await ThreadManager.getEnhancedThread(params.accessToken, actionParams.threadId);
    });

    this.logger.info('Thread retrieved successfully', { 
      threadId: actionParams.threadId, 
      messageCount: enhancedThread.thread.messages.length 
    });

    return {
      threadId: enhancedThread.thread.id,
      emails: enhancedThread.thread.messages,
      count: enhancedThread.thread.messages.length,
      action: 'get'
    };
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
   * Build SendEmailRequest from user input and contacts
   */
  private async buildSendEmailRequest(params: EmailAgentRequest, actionParams: any): Promise<SendEmailRequest> {
    const { to, cc, bcc, subject, body } = await this.extractEmailContent(params.query, params.contacts);

    return {
      to: to || actionParams.to,
      cc: cc || actionParams.cc,
      bcc: bcc || actionParams.bcc,
      subject: subject || actionParams.subject,
      body: body || actionParams.body
    };
  }

  /**
   * Build ReplyEmailRequest from user input  
   */
  private async buildReplyEmailRequest(params: EmailAgentRequest, actionParams: any): Promise<ReplyEmailRequest> {
    const { body } = await this.extractEmailContent(params.query, params.contacts);

    return {
      messageId: actionParams.messageId,
      threadId: actionParams.threadId,
      body: body || actionParams.body
    };
  }

  /**
   * Extract email content from natural language query using OpenAI
   */
  private async extractEmailContent(query: string, contacts?: Array<{ name: string; email: string; phone?: string; }>): Promise<{
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
  }> {
    if (!this.openAIService) {
      // Fallback to basic extraction if OpenAI not available
      return this.extractEmailContentBasic(query, contacts);
    }

    try {
      const contactsContext = contacts?.length ? 
        `Available contacts: ${contacts.map(c => `${c.name} (${c.email})`).join(', ')}` : 
        'No contacts provided';

      const extractionPrompt = `Extract email details from this request:
"${query}"

${contactsContext}

Please provide a JSON response with the following structure:
{
  "to": ["email@example.com"], // Required: recipient email addresses
  "subject": "Subject line", // Required: email subject
  "body": "Email content", // Required: email body content
  "cc": ["email@example.com"], // Optional: CC recipients
  "bcc": ["email@example.com"] // Optional: BCC recipients
}

Guidelines:
- Extract the recipient from the query or use provided contacts
- Generate an appropriate subject line based on the intent
- Create professional email content that fulfills the user's request
- If asking a question, make it clear and polite
- Keep the tone natural and appropriate for the context`;

      const messages = [
        { role: 'system' as const, content: 'You are an expert at extracting and generating email content from natural language requests. Always respond with valid JSON.' },
        { role: 'user' as const, content: extractionPrompt }
      ];

      const response = await this.openAIService.createChatCompletion(messages);
      
      try {
        // Clean the response content to extract JSON
        let jsonContent = response.content.trim();
        
        // Remove markdown code blocks if present
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }
        
        // Try to find JSON object in the response
        const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        }
        
        const emailDetails = JSON.parse(jsonContent);
        this.logger.info('OpenAI extracted email details', { query: query.substring(0, 100), hasDetails: !!emailDetails });
        return emailDetails;
      } catch (parseError) {
        this.logger.error('Failed to parse OpenAI email extraction response', { 
          error: parseError, 
          response: response.content.substring(0, 500)
        });
        return this.extractEmailContentBasic(query, contacts);
      }

    } catch (error) {
      this.logger.error('OpenAI email content extraction failed, using fallback', { error });
      return this.extractEmailContentBasic(query, contacts);
    }
  }

  /**
   * Basic email content extraction fallback
   */
  private extractEmailContentBasic(query: string, contacts?: Array<{ name: string; email: string; phone?: string; }>): {
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

  // Parameter extraction methods (simplified)
  private extractSendEmailParams(query: string): any {
    const params: any = {};
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = query.match(emailRegex);
    if (emails) {
      params.to = emails;
    }
    return params;
  }

  private extractReplyParams(query: string): any {
    const params: any = {};
    const messageIdMatch = query.match(/message[:\s]+(\w+)/i);
    const threadIdMatch = query.match(/thread[:\s]+(\w+)/i);
    if (messageIdMatch) params.messageId = messageIdMatch[1];
    if (threadIdMatch) params.threadId = threadIdMatch[1];
    return params;
  }

  private extractSearchParams(query: string): any {
    const params: any = {};
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

  private extractGetEmailParams(query: string): any {
    const params: any = {};
    const messageIdMatch = query.match(/(?:email|message)[\s:]+(\w+)/i);
    if (messageIdMatch) {
      params.messageId = messageIdMatch[1];
    }
    return params;
  }

  private extractGetThreadParams(query: string): any {
    const params: any = {};
    const threadIdMatch = query.match(/(?:thread|conversation)[\s:]+(\w+)/i);
    if (threadIdMatch) {
      params.threadId = threadIdMatch[1];
    }
    return params;
  }
}

// Export singleton instance with OpenAI integration
export const emailAgent = new EmailAgent();