import { AIAgentWithPreview } from '../framework/ai-agent';
import { ToolExecutionContext } from '../types/tools';
import { getService } from '../services/service-manager';
import { GmailService } from '../services/gmail.service';
import { 
  SendEmailRequest, 
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
  aiPlanExecuted?: boolean;
  executionSummary?: string;
}

/**
 * Email agent parameters with access token
 */
export interface EmailAgentRequest {
  query: string;
  accessToken: string;
  contacts?: Array<{
    name: string;
    email: string;
    phone?: string;
  }>;
  contactEmail?: string;
  subject?: string;
  body?: string;
  threadId?: string;
  messageId?: string;
}

/**
 * AI-Enhanced EmailAgent that uses AI planning as the primary execution method
 * 
 * This demonstrates how to transform a traditional BaseAgent into an AIAgent:
 * 1. Extends AIAgentWithPreview instead of BaseAgent
 * 2. Registers email-specific tools for AI planning
 * 3. Implements AI-driven workflow orchestration
 * 4. Falls back to traditional logic when AI planning fails
 * 5. Provides enhanced preview generation using AI planning
 */
export class AIEmailAgent extends AIAgentWithPreview<EmailAgentRequest, EmailResult> {

  constructor() {
    super({
      name: 'ai-emailAgent',
      description: 'AI-powered email agent with intelligent planning and tool orchestration',
      enabled: true,
      timeout: 45000, // Increased for AI planning
      retryCount: 2,
      aiPlanning: {
        enableAIPlanning: true,
        maxPlanningSteps: 8,
        planningTimeout: 15000,
        cachePlans: true,
        planningTemperature: 0.1,
        planningMaxTokens: 1500
      }
    });

    // Register email-specific tools for AI planning
    this.registerEmailTools();
  }

  /**
   * Register email-specific tools for AI planning
   */
  private registerEmailTools(): void {
    // Send email tool
    this.registerTool({
      name: 'sendEmail',
      description: 'Send a new email to specified recipients',
      parameters: {
        type: 'object',
        properties: {
          to: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'Recipient email addresses' 
          },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Email content' },
          cc: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'CC recipients',
            nullable: true
          },
          bcc: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'BCC recipients',
            nullable: true
          }
        },
        required: ['to', 'subject', 'body']
      },
      examples: [
        'send email to john@example.com with subject "Meeting tomorrow"',
        'email the team about the project update'
      ],
      estimatedExecutionTime: 3000,
      requiresConfirmation: true,
      capabilities: ['email-sending', 'external-communication'],
      limitations: ['cannot recall sent emails', 'requires valid email addresses']
    });

    // Search emails tool
    this.registerTool({
      name: 'searchEmails',
      description: 'Search for emails matching specific criteria',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          maxResults: { 
            type: 'number', 
            description: 'Maximum number of results',
            default: 10,
            nullable: true
          },
          includeSpamTrash: { 
            type: 'boolean', 
            description: 'Include spam and trash',
            default: false,
            nullable: true
          }
        },
        required: ['query']
      },
      examples: [
        'search for emails from john about meetings',
        'find emails with subject containing "urgent"'
      ],
      estimatedExecutionTime: 2000,
      requiresConfirmation: false,
      capabilities: ['email-search', 'content-analysis'],
      limitations: ['limited to Gmail search syntax', 'may not find very old emails']
    });

    // Reply to email tool
    this.registerTool({
      name: 'replyEmail',
      description: 'Reply to an existing email thread',
      parameters: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'ID of message to reply to' },
          threadId: { type: 'string', description: 'Thread ID' },
          body: { type: 'string', description: 'Reply content' }
        },
        required: ['messageId', 'threadId', 'body']
      },
      examples: [
        'reply to the last email saying I will attend',
        'respond to john\'s message with confirmation'
      ],
      estimatedExecutionTime: 2500,
      requiresConfirmation: true,
      capabilities: ['email-replying', 'thread-management'],
      limitations: ['cannot modify original message', 'reply-to restrictions may apply']
    });

    // Contact lookup tool (integration with contact system)
    this.registerTool({
      name: 'lookupContact',
      description: 'Find contact information for people mentioned in the query',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Person name to look up' },
          query: { type: 'string', description: 'Contact search query' }
        },
        required: ['query']
      },
      examples: [
        'find contact info for john',
        'lookup email for sarah from marketing'
      ],
      estimatedExecutionTime: 1500,
      requiresConfirmation: false,
      capabilities: ['contact-search', 'address-resolution'],
      limitations: ['limited to available contacts', 'may require manual verification']
    });

    // Email content generation tool
    this.registerTool({
      name: 'generateEmailContent',
      description: 'Generate professional email content based on intent and context',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', description: 'Purpose of the email' },
          context: { type: 'string', description: 'Additional context' },
          tone: { 
            type: 'string', 
            enum: ['professional', 'casual', 'friendly', 'formal'],
            description: 'Email tone',
            default: 'professional'
          },
          recipient: { type: 'string', description: 'Recipient name or type' }
        },
        required: ['intent']
      },
      examples: [
        'generate professional email asking about meeting availability',
        'create friendly follow-up email for project status'
      ],
      estimatedExecutionTime: 2000,
      requiresConfirmation: false,
      capabilities: ['content-generation', 'tone-adaptation'],
      limitations: ['may require human review', 'context-dependent quality']
    });
  }

  /**
   * Enhanced parameter validation for AI agent
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
   * Check if AI planning should be used for this email request
   */
  protected canUseAIPlanning(params: EmailAgentRequest): boolean {
    // Use AI planning for complex queries that mention multiple actions
    const query = params.query.toLowerCase();
    
    const complexIndicators = [
      'and then', 'after that', 'also', 'additionally',
      'multiple', 'several', 'both', 'all',
      'meeting', 'schedule', 'follow up', 'reminder'
    ];
    
    const hasComplexity = complexIndicators.some(indicator => query.includes(indicator));
    
    // Use AI planning if:
    // 1. Base conditions are met
    // 2. Query suggests complexity or multiple steps
    // 3. No specific technical identifiers (messageId, threadId) that suggest direct action
    const hasDirectAction = query.includes('messageId') || query.includes('threadId');
    
    return super.canUseAIPlanning(params) && (hasComplexity || query.length > 50) && !hasDirectAction;
  }

  /**
   * Execute custom email tools for AI planning
   */
  protected async executeCustomTool(toolName: string, parameters: any, context: ToolExecutionContext): Promise<any> {
    this.logger.debug(`Executing email tool: ${toolName}`, {
      agent: this.config.name,
      sessionId: context.sessionId,
      parameters: this.sanitizeToolParameters(parameters)
    });

    try {
      switch (toolName) {
        case 'sendEmail':
          return await this.executeSendEmailTool(parameters, context);
        
        case 'searchEmails':
          return await this.executeSearchEmailsTool(parameters, context);
        
        case 'replyEmail':
          return await this.executeReplyEmailTool(parameters, context);
        
        case 'lookupContact':
          return await this.executeLookupContactTool(parameters, context);
        
        case 'generateEmailContent':
          return await this.executeGenerateContentTool(parameters, context);
        
        default:
          return await super.executeCustomTool(toolName, parameters, context);
      }
    } catch (error) {
      this.logger.error(`Email tool execution failed: ${toolName}`, {
        error: error instanceof Error ? error.message : error,
        sessionId: context.sessionId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : `Tool ${toolName} failed`,
        toolName
      };
    }
  }

  /**
   * Execute send email tool
   */
  private async executeSendEmailTool(parameters: any, context: ToolExecutionContext): Promise<any> {
    const gmailService = getService<GmailService>('gmailService');
    if (!gmailService) {
      throw new Error('Gmail service not available');
    }

    // Get access token from context (should be passed down from main params)
    const accessToken = (context as any).accessToken || parameters.accessToken;
    if (!accessToken) {
      throw new Error('Access token not available for email sending');
    }

    const result = await gmailService.sendEmail(
      accessToken,
      parameters.to[0], // Primary recipient
      parameters.subject,
      parameters.body,
      {
        cc: parameters.cc,
        bcc: parameters.bcc
      }
    );

    return {
      success: true,
      messageId: result.messageId,
      threadId: result.threadId,
      action: 'send',
      recipient: parameters.to[0],
      subject: parameters.subject
    };
  }

  /**
   * Execute search emails tool
   */
  private async executeSearchEmailsTool(parameters: any, context: ToolExecutionContext): Promise<any> {
    const gmailService = getService<GmailService>('gmailService');
    if (!gmailService) {
      throw new Error('Gmail service not available');
    }

    const accessToken = (context as any).accessToken || parameters.accessToken;
    if (!accessToken) {
      throw new Error('Access token not available for email search');
    }

    const results = await gmailService.searchEmails(
      accessToken,
      parameters.query,
      {
        maxResults: parameters.maxResults || EMAIL_CONSTANTS.DEFAULT_SEARCH_RESULTS,
        includeSpamTrash: parameters.includeSpamTrash || false
      }
    );

    return {
      success: true,
      emails: results,
      count: results.length,
      action: 'search',
      query: parameters.query
    };
  }

  /**
   * Execute reply email tool
   */
  private async executeReplyEmailTool(parameters: any, context: ToolExecutionContext): Promise<any> {
    const gmailService = getService<GmailService>('gmailService');
    if (!gmailService) {
      throw new Error('Gmail service not available');
    }

    const accessToken = (context as any).accessToken || parameters.accessToken;
    if (!accessToken) {
      throw new Error('Access token not available for email reply');
    }

    const result = await gmailService.replyToEmail(
      accessToken,
      parameters.messageId,
      parameters.body
    );

    return {
      success: true,
      messageId: result.messageId,
      threadId: result.threadId,
      action: 'reply',
      originalMessageId: parameters.messageId
    };
  }

  /**
   * Execute contact lookup tool (integration with contact agent)
   */
  private async executeLookupContactTool(parameters: any, context: ToolExecutionContext): Promise<any> {
    // This would integrate with the contact agent or service
    // For now, return a mock response
    this.logger.info('Contact lookup requested', {
      query: parameters.query,
      sessionId: context.sessionId
    });

    // In a real implementation, this would call the ContactAgent or ContactService
    return {
      success: true,
      contacts: [],
      message: 'Contact lookup would be implemented here',
      query: parameters.query
    };
  }

  /**
   * Execute content generation tool
   */
  private async executeGenerateContentTool(parameters: any, _context: ToolExecutionContext): Promise<any> {
    if (!this.openaiService) {
      return {
        success: false,
        error: 'OpenAI service not available for content generation'
      };
    }

    try {
      const systemPrompt = `You are a professional email writer. Generate appropriate email content based on the user's intent and context. Keep the tone ${parameters.tone || 'professional'} and make it suitable for ${parameters.recipient || 'business communication'}.`;
      
      const userPrompt = `Generate email content for:
Intent: ${parameters.intent}
${parameters.context ? `Context: ${parameters.context}` : ''}
${parameters.recipient ? `Recipient: ${parameters.recipient}` : ''}

Provide a clear subject line and professional body text.`;

      const response = await this.openaiService.generateText(
        userPrompt,
        systemPrompt,
        {
          temperature: 0.3,
          maxTokens: 600
        }
      );

      // Parse the response to extract subject and body
      const lines = response.split('\n').filter(line => line.trim());
      let subject = '';
      let body = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.toLowerCase().includes('subject:')) {
          subject = line.replace(/subject:\s*/i, '').trim();
        } else if (line && line.trim() && !line.toLowerCase().includes('subject:') && !subject) {
          // First non-subject line might be the subject
          subject = line.trim();
        }
      }

      // Body is everything after subject identification
      const bodyStartIndex = lines.findIndex(line => 
        line.toLowerCase().includes('body:') || 
        line.toLowerCase().includes('message:') ||
        (subject && !line.includes(subject))
      );

      if (bodyStartIndex > -1) {
        body = lines.slice(bodyStartIndex)
          .join('\n')
          .replace(/^(body|message):\s*/i, '')
          .trim();
      } else {
        body = response.replace(subject, '').trim();
      }

      return {
        success: true,
        subject: subject || 'Generated Email',
        body: body || response,
        tone: parameters.tone || 'professional',
        intent: parameters.intent
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Content generation failed'
      };
    }
  }

  /**
   * Build final result from AI plan execution
   */
  protected buildFinalResult(
    summary: any,
    successfulResults: any[],
    _failedResults: any[],
    _params: EmailAgentRequest,
    _context: ToolExecutionContext
  ): EmailResult {
    // Find the primary email operation result
    const emailResult = successfulResults.find(result => 
      result.action && ['send', 'reply', 'search', 'draft', 'get'].includes(result.action)
    );

    if (emailResult) {
      return {
        ...emailResult,
        aiPlanExecuted: true,
        executionSummary: `AI plan completed with ${successfulResults.length}/${summary.totalSteps} successful steps`
      };
    }

    // If no email operation was found, synthesize from all results
    const actions = successfulResults.filter(r => r.action).map(r => r.action);
    const emails = successfulResults.flatMap(r => r.emails || []);
    const messageIds = successfulResults.filter(r => r.messageId).map(r => r.messageId);

    return {
      action: actions[0] || 'search',
      emails: emails.length > 0 ? emails : undefined,
      count: emails.length,
      messageId: messageIds[0],
      aiPlanExecuted: true,
      executionSummary: `AI plan executed ${actions.length} operations: ${actions.join(', ')}`
    };
  }

  /**
   * Manual execution fallback (traditional EmailAgent logic)
   */
  protected async executeManually(params: EmailAgentRequest, context: ToolExecutionContext): Promise<EmailResult> {
    this.logger.info('Executing email operation manually (fallback)', {
      agent: this.config.name,
      sessionId: context.sessionId
    });

    // Use the traditional email agent logic here
    // This is essentially the same as the original EmailAgent.processQuery method
    const { query } = params;
    
    // Determine action type from query
    const action = this.determineAction(query);
    
    // Add access token to context for tool execution
    const enhancedContext = { ...context, accessToken: params.accessToken };
    
    switch (action.type) {
      case 'SEND_EMAIL':
        return await this.handleSendEmailManually(params, action.params, enhancedContext);
      case 'REPLY_EMAIL':
        return await this.handleReplyEmailManually(params, action.params, enhancedContext);
      case 'SEARCH_EMAILS':
        return await this.handleSearchEmailsManually(params, action.params, enhancedContext);
      default:
        throw this.createError(`Unknown email action: ${action.type}`, 'UNKNOWN_ACTION');
    }
  }

  /**
   * Get action type for preview generation
   */
  protected getActionType(params: EmailAgentRequest): string {
    const operation = this.detectOperation(params);
    return operation === 'send' ? 'EMAIL_SEND' : 'EMAIL_OPERATION';
  }

  /**
   * Enhanced operation detection
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
    
    // Default to search for read operations
    return 'search';
  }

  // Traditional email handling methods (manual fallbacks)
  
  private async handleSendEmailManually(params: EmailAgentRequest, actionParams: any, context: ToolExecutionContext): Promise<EmailResult> {
    const emailRequest = await this.buildSendEmailRequest(params, actionParams);
    
    if (!emailRequest.to || (!emailRequest.subject && !emailRequest.body)) {
      throw this.createError(
        `Missing email information: ${!emailRequest.to ? 'recipient' : 'subject or body'}`,
        'INVALID_EMAIL_REQUEST'
      );
    }

    const result = await this.executeSendEmailTool({
      to: Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to],
      subject: emailRequest.subject,
      body: emailRequest.body,
      cc: emailRequest.cc,
      bcc: emailRequest.bcc,
      accessToken: params.accessToken
    }, context);

    return {
      ...result,
      aiPlanExecuted: false
    };
  }

  private async handleReplyEmailManually(params: EmailAgentRequest, actionParams: any, context: ToolExecutionContext): Promise<EmailResult> {
    if (!params.messageId || !params.threadId || !actionParams.body) {
      throw this.createError('Missing reply information (messageId, threadId, or body)', 'INVALID_REPLY_REQUEST');
    }

    const result = await this.executeReplyEmailTool({
      messageId: params.messageId,
      threadId: params.threadId,
      body: actionParams.body,
      accessToken: params.accessToken
    }, context);

    return {
      ...result,
      aiPlanExecuted: false
    };
  }

  private async handleSearchEmailsManually(params: EmailAgentRequest, actionParams: any, context: ToolExecutionContext): Promise<EmailResult> {
    const result = await this.executeSearchEmailsTool({
      query: actionParams.query || params.query,
      maxResults: actionParams.maxResults,
      includeSpamTrash: actionParams.includeSpamTrash,
      accessToken: params.accessToken
    }, context);

    return {
      ...result,
      aiPlanExecuted: false
    };
  }

  // Utility methods

  private determineAction(query: string): { type: string; params: any } {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('send') && (lowerQuery.includes('email') || lowerQuery.includes('message'))) {
      return {
        type: 'SEND_EMAIL',
        params: this.extractSendEmailParams(query)
      };
    }

    if (lowerQuery.includes('reply') || lowerQuery.includes('respond')) {
      return {
        type: 'REPLY_EMAIL',
        params: this.extractReplyParams(query)
      };
    }

    return {
      type: 'SEARCH_EMAILS',
      params: { query: query }
    };
  }

  private async buildSendEmailRequest(params: EmailAgentRequest, actionParams: any): Promise<SendEmailRequest> {
    // Extract email content using AI if available, otherwise use basic extraction
    const { to, cc, bcc, subject, body } = await this.extractEmailContent(params.query, params.contacts);

    return {
      to: to || actionParams.to,
      cc: cc || actionParams.cc,
      bcc: bcc || actionParams.bcc,
      subject: subject || actionParams.subject,
      body: body || actionParams.body
    };
  }

  private async extractEmailContent(query: string, contacts?: Array<{ name: string; email: string; phone?: string; }>): Promise<{
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
  }> {
    // Use the AI content generation tool if available
    if (this.openaiService) {
      try {
        const result = await this.executeGenerateContentTool({
          intent: query,
          context: contacts?.length ? `Available contacts: ${contacts.map(c => `${c.name} (${c.email})`).join(', ')}` : undefined,
          tone: 'professional'
        }, {} as ToolExecutionContext);

        if (result.success) {
          return {
            subject: result.subject,
            body: result.body,
            to: contacts?.map(c => c.email)
          };
        }
      } catch (error) {
        this.logger.warn('AI content extraction failed, using basic extraction', { error });
      }
    }

    // Fallback to basic extraction
    return this.extractEmailContentBasic(query, contacts);
  }

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
    } else {
      result.subject = 'Email from AI Assistant';
    }

    // Extract body content
    const bodyPatterns = [
      /(?:tell|ask|saying|message)[\s:]+([^$]+)/i,
      /(?:email|send).+(?:that|saying)[\s:]+([^$]+)/i,
      /"([^"]+)"/g
    ];

    for (const pattern of bodyPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        result.body = match[1].trim();
        break;
      }
    }

    if (!result.body) {
      result.body = `Regarding: ${query}`;
    }

    return result;
  }

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

  /**
   * Sanitize tool parameters for logging
   */
  private sanitizeToolParameters(parameters: any): any {
    const sanitized = { ...parameters };
    
    if (sanitized.accessToken) {
      sanitized.accessToken = '[REDACTED]';
    }
    
    if (sanitized.body && typeof sanitized.body === 'string' && sanitized.body.length > 100) {
      sanitized.body = sanitized.body.substring(0, 100) + '...';
    }
    
    return sanitized;
  }

  /**
   * Sanitize parameters for logging (override from BaseAgent)
   */
  protected sanitizeForLogging(params: EmailAgentRequest): any {
    return {
      query: params.query?.substring(0, 100) + (params.query?.length > 100 ? '...' : ''),
      accessToken: '[REDACTED]',
      contactEmail: params.contactEmail ? '[EMAIL]' : undefined,
      subject: params.subject,
      body: params.body ? '[BODY_PRESENT]' : undefined,
      threadId: params.threadId,
      messageId: params.messageId,
      contactsCount: params.contacts?.length || 0
    };
  }
}