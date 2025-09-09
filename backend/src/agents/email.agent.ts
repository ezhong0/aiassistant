import { BaseAgent } from '../framework/base-agent';
import { ToolExecutionContext, EmailAgentParams } from '../types/tools';
import { ActionPreview, PreviewGenerationResult, EmailPreviewData, ActionRiskAssessment } from '../types/api.types';
import { getService } from '../services/service-manager';
import { GmailService } from '../services/gmail.service';
import { ThreadManager } from '../utils/thread-manager';
import { OpenAIService } from '../services/openai.service';
import { 
  SendEmailRequest, 
  SearchEmailsRequest, 
  ReplyEmailRequest,
  GmailMessage,
  EmailDraft
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

  constructor() {
    super({
      name: 'emailAgent',
      description: 'Handles email operations via Gmail API',
      enabled: true,
      timeout: 30000,
      retryCount: 3
    });
    
    // Initialize OpenAI service if available
    // OpenAI service will be retrieved from service registry when needed
  }

  /**
   * Get OpenAI service from the service registry
   */
  private getOpenAIService(): OpenAIService | null {
    try {
      const openaiService = getService('openaiService') as OpenAIService | null;
      return openaiService || null;
    } catch (error) {
      this.logger.warn('Failed to get OpenAI service from registry', { error });
      return null;
    }
  }
  
  /**
   * Core email processing logic - no boilerplate!
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async processQuery(params: EmailAgentRequest, _context: ToolExecutionContext): Promise<EmailResult> {
    const { query } = params;
    
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

  /**
   * Enhanced operation detection for email agent
   */
  protected detectOperation(params: EmailAgentRequest): string {
    const { query } = params;
    const lowerQuery = query.toLowerCase();

    // Check for specific email operations
    if (lowerQuery.includes('send') && (lowerQuery.includes('email') || lowerQuery.includes('message'))) {
      return 'send';
    }
    
    if (lowerQuery.includes('reply') || lowerQuery.includes('respond')) {
      return 'reply';
    }
    
    if (lowerQuery.includes('search') || lowerQuery.includes('find') || lowerQuery.includes('look for')) {
      return 'search';
    }
    
    if (lowerQuery.includes('draft') || (lowerQuery.includes('create') && lowerQuery.includes('email'))) {
      return 'draft';
    }
    
    if (lowerQuery.includes('get email') || lowerQuery.includes('show email')) {
      return 'get';
    }
    
    if (lowerQuery.includes('thread') || lowerQuery.includes('conversation')) {
      return 'get';
    }
    
    // Default to search for read operations
    return 'search';
  }

  /**
   * Generate detailed email action preview with risk assessment
   */
  protected async generatePreview(params: EmailAgentRequest, context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    try {
      const { query } = params;
      
      // Use enhanced operation detection
      const operation = this.detectOperation(params);
      
      // Check if this operation actually needs confirmation
      const needsConfirmation = this.operationRequiresConfirmation(operation);
      
      if (!needsConfirmation) {
        this.logger.info('Email operation does not require confirmation', {
          operation,
          reason: this.getOperationConfirmationReason(operation)
        });
        return {
          success: true,
          fallbackMessage: `${operation} operation does not require confirmation`
        };
      }
      
      // Determine action type from query for preview generation
      const action = this.determineAction(query);
      
      // Generate action ID
      const actionId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Build email request to extract details
      let emailRequest: SendEmailRequest;
      let previewData: EmailPreviewData;
      let riskAssessment: ActionRiskAssessment;
      let title: string;
      let description: string;
      
      switch (action.type) {
        case 'SEND_EMAIL':
          emailRequest = await this.buildSendEmailRequest(params, action.params);
          previewData = await this.generateEmailPreviewData(emailRequest, params);
          riskAssessment = this.assessEmailRisk(emailRequest, previewData);
          title = `Send Email: ${emailRequest.subject}`;
          description = `Send email to ${this.formatRecipients(emailRequest)} with subject "${emailRequest.subject}"`;
          break;
          
        case 'REPLY_EMAIL':
          const replyRequest = await this.buildReplyEmailRequest(params, action.params);
          // Convert reply to send format for preview purposes
          emailRequest = {
            to: '', // Will be filled from thread
            subject: `Re: ${params.subject || 'Previous Email'}`,
            body: replyRequest.body,
            cc: [],
            bcc: []
          };
          previewData = await this.generateEmailPreviewData(emailRequest, params);
          riskAssessment = this.assessEmailRisk(emailRequest, previewData);
          title = `Reply to Email`;
          description = `Reply to email thread with message`;
          break;
          
        default:
          // This should not happen since we check needsConfirmation above
          return {
            success: true,
            fallbackMessage: `${action.type} operation does not require confirmation`
          };
      }
      
      const preview: ActionPreview = {
        actionId,
        actionType: 'email',
        title,
        description,
        riskAssessment,
        estimatedExecutionTime: this.estimateExecutionTime(action.type),
        reversible: false, // Email sending is not reversible
        requiresConfirmation: true,
        awaitingConfirmation: true,
        previewData,
        originalQuery: query,
        parameters: params as unknown as Record<string, unknown>
      };
      
      this.logger.info('Email preview generated', {
        actionId,
        actionType: action.type,
        operation,
        recipientCount: previewData.recipientCount,
        riskLevel: riskAssessment.level,
        externalDomains: previewData.externalDomains?.length || 0
      });
      
      return {
        success: true,
        preview
      };
      
    } catch (error) {
      this.logger.error('Failed to generate email preview', {
        error: error instanceof Error ? error.message : error,
        sessionId: context.sessionId
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate email preview',
        fallbackMessage: `Email operation requires confirmation: ${params.query}`
      };
    }
  }

  /**
   * Generate detailed email preview data
   */
  private async generateEmailPreviewData(emailRequest: SendEmailRequest, params: EmailAgentRequest): Promise<EmailPreviewData> {
    const toList = Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to];
    const ccList = Array.isArray(emailRequest.cc) ? emailRequest.cc : emailRequest.cc ? [emailRequest.cc] : [];
    const bccList = Array.isArray(emailRequest.bcc) ? emailRequest.bcc : emailRequest.bcc ? [emailRequest.bcc] : [];
    
    const allRecipients = [...toList, ...ccList, ...bccList].filter(Boolean);
    const externalDomains = this.extractExternalDomains(allRecipients);
    
    // Generate content summary
    const contentSummary = this.generateContentSummary(emailRequest.body);
    
    return {
      recipients: {
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: bccList.length > 0 ? bccList : undefined
      },
      subject: emailRequest.subject,
      contentSummary,
      recipientCount: allRecipients.length,
      externalDomains: externalDomains.length > 0 ? externalDomains : undefined,
      sendTimeEstimate: 'Immediate'
    };
  }

  /**
   * Assess risk level for email operation
   */
  private assessEmailRisk(emailRequest: SendEmailRequest, previewData: EmailPreviewData): ActionRiskAssessment {
    const factors: string[] = [];
    const warnings: string[] = [];
    let level: 'low' | 'medium' | 'high' = 'low';
    
    // Check recipient count
    if (previewData.recipientCount > 10) {
      factors.push('Large recipient count');
      level = 'medium';
      if (previewData.recipientCount > 50) {
        level = 'high';
        warnings.push(`Email will be sent to ${previewData.recipientCount} recipients`);
      }
    }
    
    // Check external domains
    if (previewData.externalDomains && previewData.externalDomains.length > 0) {
      factors.push('External recipients');
      if (level === 'low') level = 'medium';
      warnings.push(`Email contains external recipients: ${previewData.externalDomains.join(', ')}`);
    }
    
    // Check content length
    if (emailRequest.body.length > 5000) {
      factors.push('Long email content');
      if (level === 'low') level = 'medium';
    }
    
    // Check for sensitive keywords
    const sensitiveKeywords = ['confidential', 'secret', 'password', 'urgent', 'immediate', 'deadline'];
    const bodyLower = emailRequest.body.toLowerCase();
    const subjectLower = emailRequest.subject.toLowerCase();
    
    for (const keyword of sensitiveKeywords) {
      if (bodyLower.includes(keyword) || subjectLower.includes(keyword)) {
        factors.push('Contains sensitive keywords');
        if (level === 'low') level = 'medium';
        break;
      }
    }
    
    // If no risk factors, ensure we have at least basic factors
    if (factors.length === 0) {
      factors.push('Standard email operation');
    }
    
    return {
      level,
      factors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Extract external domains from email addresses
   */
  private extractExternalDomains(emails: string[]): string[] {
    const domains = new Set<string>();
    const emailRegex = /@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    
    for (const email of emails) {
      const match = email.match(emailRegex);
      if (match && match[1]) {
        const domain = match[1].toLowerCase();
        // Consider common public email domains as external
        if (!domain.includes('gmail.com') && !domain.includes('company.com')) {
          domains.add(domain);
        }
      }
    }
    
    return Array.from(domains);
  }

  /**
   * Generate content summary
   */
  private generateContentSummary(content: string): string {
    if (!content) return 'No content';
    
    // Remove HTML tags and extra whitespace
    const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    
    if (cleanContent.length <= 200) {
      return cleanContent;
    }
    
    // Find a good break point near 200 characters
    const truncated = cleanContent.substring(0, 200);
    const lastSpace = truncated.lastIndexOf(' ');
    const lastPeriod = truncated.lastIndexOf('.');
    
    const breakPoint = Math.max(lastSpace, lastPeriod);
    if (breakPoint > 150) {
      return cleanContent.substring(0, breakPoint) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Format recipients for display
   */
  private formatRecipients(emailRequest: SendEmailRequest): string {
    const toList = Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to];
    const ccList = Array.isArray(emailRequest.cc) ? emailRequest.cc : emailRequest.cc ? [emailRequest.cc] : [];
    
    if (toList.length === 1 && ccList.length === 0) {
      return toList[0] || 'Unknown recipient';
    }
    
    if (toList.length + ccList.length <= 3) {
      return [...toList, ...ccList].join(', ');
    }
    
    return `${toList[0]} and ${(toList.length + ccList.length - 1)} others`;
  }

  /**
   * Estimate execution time for different operations
   */
  private estimateExecutionTime(actionType: string): string {
    switch (actionType) {
      case 'SEND_EMAIL':
        return '2-5 seconds';
      case 'REPLY_EMAIL':
        return '1-3 seconds';
      case 'SEARCH_EMAILS':
        return '1-2 seconds';
      default:
        return '1-5 seconds';
    }
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
    const openAIService = this.getOpenAIService();
    if (!openAIService) {
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

      const response = await openAIService.createChatCompletion(messages);
      
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