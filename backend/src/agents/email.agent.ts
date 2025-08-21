import logger from '../utils/logger';
import { gmailService } from '../services/gmail.service';
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
  private openAIService?: OpenAIService;

  constructor(openAIService?: OpenAIService) {
    this.openAIService = openAIService;
  }

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
        const errorMessage = await this.generateResponseMessage('error', {
          type: 'missing_access_token',
          query: request.query
        });
        return {
          success: false,
          message: errorMessage,
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
          const unknownActionMessage = await this.generateResponseMessage('error', {
            type: 'unknown_action',
            query: request.query
          });
          return {
            success: false,
            message: unknownActionMessage,
            error: 'UNKNOWN_ACTION'
          };
      }

    } catch (error) {
      logger.error('Error in EmailAgent.processQuery:', error);
      const errorMessage = await this.generateResponseMessage('error', {
        type: 'processing_error',
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        message: errorMessage,
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
      const emailRequest = await this.buildSendEmailRequest(request, params);
      
      if (!emailRequest.to || (!emailRequest.subject && !emailRequest.body)) {
        const errorMessage = await this.generateResponseMessage('error', {
          type: 'missing_email_info',
          query: request.query,
          missing: !emailRequest.to ? 'recipient' : 'subject or body'
        });
        return {
          success: false,
          message: errorMessage,
          error: 'INVALID_EMAIL_REQUEST'
        };
      }

      const sentEmail = await gmailService.sendEmail(request.accessToken, emailRequest);

      logger.info('Email sent successfully', { 
        messageId: sentEmail.id, 
        threadId: sentEmail.threadId,
        to: emailRequest.to 
      });

      const successMessage = await this.generateResponseMessage('success', {
        type: 'email_sent',
        recipients: Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to],
        subject: emailRequest.subject,
        query: request.query
      });

      return {
        success: true,
        message: successMessage,
        data: {
          emailId: sentEmail.id,
          threadId: sentEmail.threadId
        }
      };

    } catch (error) {
      logger.error('Failed to send email:', error);
      
      // Provide more specific error messages for common issues
      let errorMessage: string;
      let errorCode = 'SEND_FAILED';
      
      if (error instanceof GmailServiceError) {
        errorCode = error.code;
        errorMessage = await this.generateResponseMessage('error', {
          type: 'gmail_service_error',
          query: request.query,
          errorCode: error.code,
          errorMessage: error.message
        });
      } else if (error && typeof error === 'object' && 'message' in error) {
        const errorStr = String(error.message);
        if (errorStr.includes('insufficient authentication scopes') || errorStr.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
          errorCode = 'INSUFFICIENT_SCOPE';
          errorMessage = await this.generateResponseMessage('error', {
            type: 'insufficient_scope',
            query: request.query
          });
        } else if (errorStr.includes('403')) {
          errorCode = 'ACCESS_DENIED';
          errorMessage = await this.generateResponseMessage('error', {
            type: 'access_denied',
            query: request.query
          });
        } else if (errorStr.includes('401')) {
          errorCode = 'AUTH_FAILED';
          errorMessage = await this.generateResponseMessage('error', {
            type: 'auth_failed',
            query: request.query
          });
        } else {
          errorMessage = await this.generateResponseMessage('error', {
            type: 'send_failed',
            query: request.query,
            error: errorStr
          });
        }
      } else {
        errorMessage = await this.generateResponseMessage('error', {
          type: 'send_failed',
          query: request.query,
          error: 'Unknown error'
        });
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
      const replyRequest = await this.buildReplyEmailRequest(request, params);
      
      if (!replyRequest.messageId || !replyRequest.threadId || !replyRequest.body) {
        const errorMessage = await this.generateResponseMessage('error', {
          type: 'missing_reply_info',
          query: request.query
        });
        return {
          success: false,
          message: errorMessage,
          error: 'INVALID_REPLY_REQUEST'
        };
      }

      const replyEmail = await gmailService.replyToEmail(request.accessToken, replyRequest);

      logger.info('Email reply sent successfully', { 
        messageId: replyEmail.id, 
        threadId: replyEmail.threadId 
      });

      const successMessage = await this.generateResponseMessage('success', {
        type: 'reply_sent',
        query: request.query
      });

      return {
        success: true,
        message: successMessage,
        data: {
          emailId: replyEmail.id,
          threadId: replyEmail.threadId
        }
      };

    } catch (error) {
      logger.error('Failed to send reply:', error);
      const errorMessage = await this.generateResponseMessage('error', {
        type: 'reply_failed',
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        message: errorMessage,
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

      const successMessage = await this.generateResponseMessage('success', {
        type: 'search_completed',
        query: request.query,
        count: searchResult.messages.length
      });

      return {
        success: true,
        message: successMessage,
        data: {
          emails: searchResult.messages,
          count: searchResult.messages.length
        }
      };

    } catch (error) {
      logger.error('Failed to search emails:', error);
      const errorMessage = await this.generateResponseMessage('error', {
        type: 'search_failed',
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        message: errorMessage,
        error: error instanceof GmailServiceError ? error.code : 'SEARCH_FAILED'
      };
    }
  }

  /**
   * Handle creating a draft email
   */
  private async handleCreateDraft(request: EmailAgentRequest, params: any): Promise<EmailAgentResponse> {
    try {
      const emailRequest = await this.buildSendEmailRequest(request, params);
      
      if (!emailRequest.to) {
        const errorMessage = await this.generateResponseMessage('error', {
          type: 'missing_recipient',
          query: request.query
        });
        return {
          success: false,
          message: errorMessage,
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

      const successMessage = await this.generateResponseMessage('success', {
        type: 'draft_created',
        query: request.query,
        recipients: Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to]
      });

      return {
        success: true,
        message: successMessage,
        data: {
          draft
        }
      };

    } catch (error) {
      logger.error('Failed to create draft:', error);
      const errorMessage = await this.generateResponseMessage('error', {
        type: 'draft_failed',
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        message: errorMessage,
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
        const errorMessage = await this.generateResponseMessage('error', {
          type: 'missing_message_id',
          query: request.query
        });
        return {
          success: false,
          message: errorMessage,
          error: 'MISSING_MESSAGE_ID'
        };
      }

      const email = await gmailService.getEmailById(request.accessToken, params.messageId);

      logger.info('Email retrieved successfully', { messageId: params.messageId });

      const successMessage = await this.generateResponseMessage('success', {
        type: 'email_retrieved',
        query: request.query
      });

      return {
        success: true,
        message: successMessage,
        data: {
          emails: [email]
        }
      };

    } catch (error) {
      logger.error('Failed to get email:', error);
      const errorMessage = await this.generateResponseMessage('error', {
        type: 'get_email_failed',
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        message: errorMessage,
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
        const errorMessage = await this.generateResponseMessage('error', {
          type: 'missing_thread_id',
          query: request.query
        });
        return {
          success: false,
          message: errorMessage,
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

      const successMessage = await this.generateResponseMessage('success', {
        type: 'thread_retrieved',
        query: request.query,
        messageCount: enhancedThread.thread.messages.length
      });

      return {
        success: true,
        message: successMessage,
        data: {
          threadId: enhancedThread.thread.id,
          emails: enhancedThread.thread.messages,
          count: enhancedThread.thread.messages.length
        }
      };

    } catch (error) {
      logger.error('Failed to get thread:', error);
      const errorMessage = await this.generateResponseMessage('error', {
        type: 'get_thread_failed',
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        message: errorMessage,
        error: error instanceof GmailServiceError ? error.code : 'THREAD_FAILED'
      };
    }
  }

  /**
   * Build SendEmailRequest from user input and contacts
   */
  private async buildSendEmailRequest(request: EmailAgentRequest, params: any): Promise<SendEmailRequest> {
    const { to, cc, bcc, subject, body } = await this.extractEmailContent(request.query, request.contacts);

    return {
      to: to || params.to,
      cc: cc || params.cc,
      bcc: bcc || params.bcc,
      subject: subject || params.subject,
      body: body || params.body
    };
  }

  /**
   * Build ReplyEmailRequest from user input  
   */
  private async buildReplyEmailRequest(request: EmailAgentRequest, params: any): Promise<ReplyEmailRequest> {
    const { body } = await this.extractEmailContent(request.query, request.contacts);

    return {
      messageId: params.messageId,
      threadId: params.threadId,
      body: body || params.body
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
        const emailDetails = JSON.parse(response.content);
        logger.info('OpenAI extracted email details', { query: query.substring(0, 100), hasDetails: !!emailDetails });
        return emailDetails;
      } catch (parseError) {
        logger.error('Failed to parse OpenAI email extraction response', { error: parseError, response: response.content });
        return this.extractEmailContentBasic(query, contacts);
      }

    } catch (error) {
      logger.error('OpenAI email content extraction failed, using fallback', { error });
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
   * Generate dynamic response messages using OpenAI
   */
  private async generateResponseMessage(
    type: 'success' | 'error' | 'confirmation',
    context: {
      type: string;
      query: string;
      [key: string]: any;
    }
  ): Promise<string> {
    if (!this.openAIService) {
      return this.generateFallbackMessage(type, context);
    }

    try {
      const prompt = this.buildResponsePrompt(type, context);
      const messages = [
        {
          role: 'system' as const,
          content: 'You are an email assistant. Generate natural, helpful response messages. Keep responses concise and professional. Do not use quotes around the response.'
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ];

      const response = await this.openAIService.createChatCompletion(messages, 150);
      const message = response.content.trim().replace(/^"|"$/g, ''); // Remove quotes if present
      
      logger.info('Generated dynamic response message', { 
        type, 
        contextType: context.type,
        messageLength: message.length 
      });
      
      return message;
      
    } catch (error) {
      logger.error('Failed to generate response message, using fallback', { error });
      return this.generateFallbackMessage(type, context);
    }
  }

  /**
   * Build prompt for response message generation
   */
  private buildResponsePrompt(type: 'success' | 'error' | 'confirmation', context: any): string {
    const baseContext = `User query: "${context.query}"`;
    
    switch (type) {
      case 'success':
        return this.buildSuccessPrompt(context, baseContext);
      case 'error':
        return this.buildErrorPrompt(context, baseContext);
      case 'confirmation':
        return this.buildConfirmationPrompt(context, baseContext);
      default:
        return `${baseContext}\n\nGenerate a helpful response message.`;
    }
  }

  /**
   * Build success message prompt
   */
  private buildSuccessPrompt(context: any, baseContext: string): string {
    switch (context.type) {
      case 'email_sent':
        return `${baseContext}\n\nEmail successfully sent to: ${context.recipients?.join(', ')}\nSubject: ${context.subject || 'N/A'}\n\nGenerate a natural success message confirming the email was sent.`;
      
      case 'reply_sent':
        return `${baseContext}\n\nEmail reply sent successfully.\n\nGenerate a natural success message confirming the reply was sent.`;
      
      case 'search_completed':
        return `${baseContext}\n\nFound ${context.count} emails matching the search.\n\nGenerate a natural message describing the search results.`;
      
      case 'draft_created':
        return `${baseContext}\n\nDraft created for: ${context.recipients?.join(', ')}\n\nGenerate a natural success message confirming the draft was created.`;
      
      case 'email_retrieved':
        return `${baseContext}\n\nEmail retrieved successfully.\n\nGenerate a natural success message confirming the email was retrieved.`;
      
      case 'thread_retrieved':
        return `${baseContext}\n\nRetrieved conversation with ${context.messageCount} messages.\n\nGenerate a natural success message describing the thread retrieval.`;
      
      default:
        return `${baseContext}\n\nOperation completed successfully.\n\nGenerate a natural success message.`;
    }
  }

  /**
   * Build error message prompt
   */
  private buildErrorPrompt(context: any, baseContext: string): string {
    switch (context.type) {
      case 'missing_access_token':
        return `${baseContext}\n\nError: Missing Google access token for email operations.\n\nGenerate a helpful error message asking the user to authenticate.`;
      
      case 'insufficient_scope':
        return `${baseContext}\n\nError: Insufficient Gmail permissions.\n\nGenerate a helpful message explaining the user needs to re-authenticate with Gmail permissions.`;
      
      case 'missing_email_info':
        return `${baseContext}\n\nError: Missing ${context.missing} for email.\n\nGenerate a helpful message explaining what information is needed.`;
      
      case 'send_failed':
        return `${baseContext}\n\nError: Failed to send email. ${context.error || ''}\n\nGenerate a helpful error message suggesting next steps.`;
      
      case 'unknown_action':
        return `${baseContext}\n\nError: Could not determine what email action to perform.\n\nGenerate a helpful message asking for clarification.`;
      
      default:
        return `${baseContext}\n\nError: ${context.error || 'An error occurred'}\n\nGenerate a helpful error message.`;
    }
  }

  /**
   * Build confirmation message prompt
   */
  private buildConfirmationPrompt(context: any, baseContext: string): string {
    return `${baseContext}\n\nGenerate a natural confirmation message asking the user if they want to proceed with this email action.`;
  }

  /**
   * Generate fallback messages when OpenAI is not available
   */
  private generateFallbackMessage(type: 'success' | 'error' | 'confirmation', context: any): string {
    switch (type) {
      case 'success':
        switch (context.type) {
          case 'email_sent':
            return `Email sent successfully to ${context.recipients?.join(', ')}`;
          case 'reply_sent':
            return 'Reply sent successfully';
          case 'search_completed':
            return `Found ${context.count} emails matching your search`;
          default:
            return 'Operation completed successfully';
        }
      case 'error':
        switch (context.type) {
          case 'missing_access_token':
            return 'Access token required for email operations';
          case 'insufficient_scope':
            return 'Insufficient permissions. Please re-authenticate with Gmail access.';
          default:
            return context.error || 'An error occurred';
        }
      case 'confirmation':
        return 'Would you like me to proceed with this email action?';
      default:
        return 'Processing your request...';
    }
  }

  /**
   * Get system prompt for external use
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
}

// Initialize EmailAgent with OpenAI if available
let emailAgent: EmailAgent;
try {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    const openAIService = new OpenAIService({
      apiKey: openaiApiKey,
      model: 'gpt-4o-mini'
    });
    emailAgent = new EmailAgent(openAIService);
    logger.info('EmailAgent initialized with OpenAI integration');
  } else {
    emailAgent = new EmailAgent();
    logger.info('EmailAgent initialized without OpenAI (fallback mode)');
  }
} catch (error) {
  logger.error('Failed to initialize EmailAgent with OpenAI, using fallback', error);
  emailAgent = new EmailAgent();
}

export { emailAgent };