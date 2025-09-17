import { AIAgent } from '../framework/ai-agent';
import { ToolExecutionContext, EmailAgentParams } from '../types/tools';
import { ActionPreview, PreviewGenerationResult, EmailPreviewData, ActionRiskAssessment } from '../types/api/api.types';
import { ServiceManager } from '../services/service-manager';
import { EmailOperationHandler } from '../services/email/email-operation-handler.service';
import { EmailValidator } from '../services/email/email-validator.service';
import { EmailFormatter } from '../services/email/email-formatter.service';
import {
  SendEmailRequest,
  SearchEmailsRequest,
  ReplyEmailRequest,
  GmailMessage,
  EmailDraft
} from '../types/email/gmail.types';
import { EMAIL_CONSTANTS } from '../config/constants';
import { EMAIL_SERVICE_CONSTANTS } from '../config/email-service-constants';
import {
  ToolParameters,
  ToolExecutionResult,
  AgentExecutionSummary
} from '../types/agents/agent-parameters';
import {
  SendEmailActionParams,
  SearchEmailActionParams,
  EmailSummaryParams
} from '../types/agents/agent-specific-parameters';
import logger from '../utils/logger';

/**
 * Email operation result interface - Intent-agnostic
 * No hardcoded action strings - result content determines formatting
 */
export interface EmailResult {
  /** Gmail message ID for sent emails */
  messageId?: string;
  /** Gmail thread ID for email threads */
  threadId?: string;
  /** Array of Gmail messages for search results */
  emails?: GmailMessage[];
  /** Email draft for draft operations */
  draft?: EmailDraft;
  /** Count of emails for summary operations */
  count?: number;
  /** Recipient email address */
  recipient?: string;
  /** Email subject line */
  subject?: string;
}

/**
 * Email agent parameters with access token and optional contacts
 */
export interface EmailAgentRequest extends EmailAgentParams {
  /** OAuth access token for Gmail API access */
  accessToken: string;
  /** Optional contact information for enhanced processing */
  contacts?: Array<{
    name: string;
    email: string;
    phone?: string;
  }>;
}

/**
 * EmailAgent - Specialized agent for all email operations via Gmail API
 * 
 * The EmailAgent handles email sending, searching, drafting, and management
 * operations through the Gmail API. It coordinates with specialized services
 * for validation, formatting, and operation handling to provide a clean,
 * type-safe interface for email operations.
 * 
 * Key Features:
 * - Email sending with validation and formatting
 * - Email search with advanced query support
 * - Draft creation and management
 * - AI-powered operation planning
 * - Comprehensive error handling and logging
 * 
 * Supported Operations:
 * - send: Send emails with validation
 * - search: Search emails with Gmail queries
 * - draft: Create and manage email drafts
 * - reply: Reply to existing emails (planned)
 * 
 * @example
 * ```typescript
 * const emailAgent = new EmailAgent();
 * 
 * // Send an email
 * const result = await emailAgent.execute({
 *   operation: 'send',
 *   query: 'Send email to john@example.com about meeting',
 *   accessToken: 'oauth_token_here'
 * });
 * 
 * console.log(result.messageId); // Gmail message ID
 * ```
 */
export class EmailAgent extends AIAgent<EmailAgentRequest, EmailResult> {
  
  // Focused component services
  private emailOps: EmailOperationHandler | null = null;
  private emailValidator: EmailValidator | null = null;
  private emailFormatter: EmailFormatter | null = null;

  /**
   * Initialize EmailAgent with AI planning capabilities
   * 
   * Sets up the agent with specialized configuration for email operations,
   * including AI planning, timeout settings, and retry policies optimized
   * for Gmail API interactions.
   * 
   * @example
   * ```typescript
   * const emailAgent = new EmailAgent();
   * await emailAgent.initialize();
   * ```
   */
  constructor() {
    super({
      name: EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_OPERATION_HANDLER,
      description: 'Handles email operations via Gmail API',
      enabled: true,
      timeout: 30000,
      retryCount: 3,
      aiPlanning: {
        enableAIPlanning: true,
        maxPlanningSteps: 5,
        planningTimeout: 20000,
        cachePlans: true,
        planningTemperature: 0.1,
        planningMaxTokens: 1500
      }
    });
  }

  /**
   * Lazy initialization of email services
   */
  private ensureServices(): void {
    if (!this.emailOps) {
      this.emailOps = ServiceManager.getInstance().getService(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_OPERATION_HANDLER) as EmailOperationHandler;
    }
    if (!this.emailValidator) {
      this.emailValidator = ServiceManager.getInstance().getService(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_VALIDATOR) as EmailValidator;
    }
    if (!this.emailFormatter) {
      this.emailFormatter = ServiceManager.getInstance().getService(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_FORMATTER) as EmailFormatter;
    }
  }

  /**
   * Required method to process incoming requests - routes to appropriate handlers
   */
  protected async processQuery(params: EmailAgentRequest, context: ToolExecutionContext): Promise<any> {
    logger.info('EmailAgent.processQuery - Starting email processing', {
      operation: params.operation,
      hasAccessToken: !!params.accessToken,
      sessionId: context.sessionId
    });

    // Ensure services are initialized
    this.ensureServices();

    logger.info('EmailAgent.processQuery - Services ensured', {
      hasEmailOps: !!this.emailOps,
      hasEmailValidator: !!this.emailValidator,
      hasEmailFormatter: !!this.emailFormatter
    });

    // Route to appropriate handler based on operation
    switch (params.operation?.toLowerCase()) {
      case 'search':
        logger.info('EmailAgent.processQuery - Routing to handleSearchEmails');
        return await this.handleSearchEmails(params, {
          query: params.query || '',
          maxResults: params.maxResults || 10
        });

      case 'send':
        logger.info('EmailAgent.processQuery - Routing to handleSendEmail');

        // Validate that we have proper email recipients, not person names
        if (params.recipientName && !params.contactEmail) {
          logger.error('EmailAgent.processQuery - Received recipientName without contactEmail', {
            recipientName: params.recipientName,
            hasContactEmail: !!params.contactEmail
          });
          return {
            success: false,
            error: `Cannot send email to "${params.recipientName}" - this appears to be a person's name. The system should resolve contact information first to get the email address. Please ensure the MasterAgent calls ContactAgent before EmailAgent.`,
            executionTime: 0
          };
        }

        // Get recipients from various sources
        let recipients: string[] = [];

        // First check if we have recipients from MasterAgent parameters
        if ((params as any).recipients && Array.isArray((params as any).recipients)) {
          recipients = (params as any).recipients;
        } else if (params.contactEmail) {
          recipients = [params.contactEmail];
        }

        logger.info('EmailAgent.processQuery - Recipient resolution', {
          hasContactEmail: !!params.contactEmail,
          hasRecipientsParam: !!((params as any).recipients),
          resolvedRecipients: recipients,
          recipientsCount: recipients.length
        });

        // Validate that we have recipients
        if (!recipients || recipients.length === 0) {
          logger.error('EmailAgent.processQuery - No recipients found', {
            params: Object.keys(params),
            contactEmail: params.contactEmail,
            recipientsParam: (params as any).recipients
          });
          return {
            success: false,
            error: 'No recipient email addresses found. Please provide recipient email addresses.',
            executionTime: 0
          };
        }

        return await this.handleSendEmail(params, {
          recipients,
          subject: params.subject || '',
          body: params.body || ''
        });

      case 'reply':
        logger.info('EmailAgent.processQuery - Reply operation requested but not yet implemented');
        return {
          success: false,
          error: 'Reply email operation not yet implemented in EmailAgent',
          executionTime: 0
        };

      default:
        logger.warn('EmailAgent.processQuery - Unknown operation, defaulting to search', {
          operation: params.operation
        });
        const preprocessedQuery = this.preprocessEmailQuery(params.query || 'in:inbox');
        return await this.handleSearchEmails(params, {
          query: preprocessedQuery,
          maxResults: params.maxResults || 10
        });
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.emailOps = null;
      this.emailValidator = null;
      this.emailFormatter = null;
      logger.info('EmailAgent destroyed successfully');
    } catch (error) {
      logger.error('Error during EmailAgent destruction', error);
    }
  }

  private readonly systemPrompt = `# Email Agent - Intelligent Email Management
You are a specialized email management agent powered by Gmail API.

## Core Personality
- Professional yet conversational tone
- Proactive in suggesting email best practices
- Respectful of privacy and email etiquette
- Context-aware for email threading and relationships
- Helpful but not overwhelming
- Empathetic when handling email errors or issues

## Capabilities
- Send professional, well-formatted emails with proper structure
- Search and organize email communications intelligently
- Manage email threads and conversations with context awareness
- Handle attachments and complex formatting requirements
- Maintain email etiquette and professional communication standards
- Provide smart suggestions for follow-up actions

## Email Best Practices & Intelligence
- Always craft clear, descriptive subject lines that reflect email content
- Use appropriate greeting and closing based on recipient relationship
- Maintain thread context when replying to preserve conversation flow
- Suggest follow-up actions when appropriate (scheduling, tasks, etc.)
- Respect recipient's time with concise, actionable content
- Consider business hours and timezone awareness for timing
- Use proper formatting for readability (bullet points, paragraphs, etc.)
- Suggest CC/BCC appropriately based on content and context

## Error Handling & User Experience
- Gracefully handle authentication issues with clear, actionable next steps
- Provide helpful suggestions when email addresses cannot be found
- Offer practical alternatives when original email strategy won't work
- Explain technical limitations in user-friendly, non-technical language
- Progressive error disclosure: start simple, provide details if requested
- Acknowledge user frustration empathetically and provide reassurance
- Suggest preventive measures to avoid similar issues in the future

## Response Quality Standards
- Always provide specific, actionable information rather than vague responses
- Include relevant details like sent status, thread information, search results count
- Proactively suggest next steps or related actions when appropriate
- Use clear, structured formatting for multiple emails or search results
- Maintain consistency in tone and helpfulness across all interactions`;

  /**
   * Get system prompt for AI planning
   */
  protected getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Build final result from execution
   */
  protected buildFinalResult(
    summary: AgentExecutionSummary,
    successfulResults: ToolExecutionResult[],
    failedResults: ToolExecutionResult[],
    params: EmailAgentRequest,
    context: ToolExecutionContext
  ): EmailResult {
    // Extract the action from the first successful result
    const firstResult = successfulResults[0];
    if (firstResult?.result && typeof firstResult.result === 'object' && 'data' in firstResult.result) {
      return (firstResult.result as any).data as EmailResult;
    }

    // Fallback to basic result
    return {
      count: successfulResults.length
    };
  }

  /**
   * Execute custom tool with focused components
   */
  protected async executeCustomTool(
    toolName: string, 
    parameters: ToolParameters, 
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    try {
      const params = parameters as EmailAgentRequest;
      
      // Validate request
      if (!this.emailValidator) {
        throw new Error(EMAIL_SERVICE_CONSTANTS.ERRORS.EMAIL_VALIDATOR_NOT_AVAILABLE);
      }

      const permissionCheck = await this.emailValidator.checkEmailPermissions(
        context.userId || 'unknown',
        params.accessToken
      );

      if (!permissionCheck.hasPermission) {
        throw new Error(`Missing permissions: ${permissionCheck.missingPermissions.join(', ')}`);
      }

      // Route to appropriate handler based on tool name - Intent-agnostic routing
      // Let OpenAI determine the operation from the parameters
      const operation = (parameters as any).operation;
      
      if (operation === EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS.SEND) {
        return await this.handleSendEmail(params, parameters as SendEmailActionParams);
      } else if (operation === EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS.SEARCH) {
        return await this.handleSearchEmails(params, parameters as SearchEmailActionParams);
      } else if (operation === EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS.REPLY) {
        return await this.handleReplyEmail(params, parameters);
      } else if (operation === EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS.GET) {
        return await this.handleGetEmail(params, parameters);
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      logger.error('Error executing custom tool', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : EMAIL_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR,
        executionTime: 0
      };
    }
  }

  /**
   * Detect operation type from email parameters
   */
  protected async detectOperation(params: EmailAgentRequest): Promise<string> {
    // Check if operation is explicitly specified
    if (params.operation) {
      return params.operation;
    }

    // Detect operation from query or parameters
    if (params.query) {
      const queryLower = params.query.toLowerCase();
      if (queryLower.includes('send') || queryLower.includes('email')) {
        return 'send';
      } else if (queryLower.includes('search') || queryLower.includes('find')) {
        return 'search';
      } else if (queryLower.includes('reply')) {
        return 'reply';
      } else if (queryLower.includes('get') || queryLower.includes('read')) {
        return 'get';
      }
    }

    // Check for recipients (indicates send operation)
    if ((params as any).recipients || params.contactEmail || params.subject || params.body) {
      return 'send';
    }

    // Default to send if we have email-related parameters
    return 'send';
  }

  /**
   * Check if operation requires confirmation
   */
  protected async operationRequiresConfirmation(operation: string): Promise<boolean> {
    // Send operations always require confirmation
    if (operation === 'send' || operation === 'reply') {
      return true;
    }

    // Search and get operations don't require confirmation
    return false;
  }

  /**
   * Generate preview for Email operations
   */
  protected async generatePreview(params: EmailAgentRequest, context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    try {
      logger.info('EmailAgent.generatePreview - Generating email preview', {
        operation: params.operation,
        hasRecipients: !!((params as any).recipients),
        subject: params.subject,
        sessionId: context.sessionId
      });

      // Get recipients from various sources
      let recipients: string[] = [];
      if ((params as any).recipients && Array.isArray((params as any).recipients)) {
        recipients = (params as any).recipients;
      } else if (params.contactEmail) {
        recipients = [params.contactEmail];
      }

      // Validate that we have recipients
      if (!recipients || recipients.length === 0) {
        return {
          success: false,
          error: 'No recipient email addresses found for email preview'
        };
      }

      // Create preview data for email operations
      const previewData: EmailPreviewData = {
        recipients: {
          to: recipients,
          cc: [],
          bcc: []
        },
        subject: params.subject || 'No Subject',
        contentSummary: params.body || 'No content provided',
        recipientCount: recipients.length,
        externalDomains: recipients.map(email => email.split('@')[1]).filter((domain): domain is string => Boolean(domain)).filter((domain, index, self) => self.indexOf(domain) === index)
      };

      // Generate action ID for confirmation tracking
      const actionId = `email-${params.operation || 'send'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create action preview
      const actionPreview: ActionPreview = {
        actionId,
        actionType: 'email',
        title: `${params.operation || 'Send'} Email`,
        description: `Send email to ${recipients.join(', ')}: ${params.subject || 'No Subject'}`,
        riskAssessment: {
          level: 'medium',
          factors: ['external_communication', 'email_sending'],
          warnings: ['Email will be sent to external recipients', 'This action cannot be undone']
        },
        estimatedExecutionTime: '2-3 seconds',
        reversible: false,
        requiresConfirmation: true,
        awaitingConfirmation: true,
        originalQuery: params.query || `Send email operation`,
        parameters: params as any,
        previewData
      };

      logger.info('EmailAgent.generatePreview - Preview generated successfully', {
        actionId,
        actionType: 'email',
        recipientCount: recipients.length,
        requiresConfirmation: true
      });

      return {
        success: true,
        preview: actionPreview
      };
    } catch (error) {
      logger.error('EmailAgent.generatePreview - Failed to generate preview', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate email preview'
      };
    }
  }

  /**
   * Handle send email operation
   */
  private async handleSendEmail(
    params: EmailAgentRequest, 
    actionParams: SendEmailActionParams
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Ensure services are initialized
      this.ensureServices();

      if (!this.emailOps || !this.emailValidator || !this.emailFormatter) {
        throw new Error('Required services not available');
      }

      // Expect pre-resolved recipient email from MasterAgent
      const recipientEmail = Array.isArray(actionParams.recipients) ? actionParams.recipients[0] : actionParams.recipients;
      if (!recipientEmail) {
        throw new Error('No recipient email specified - MasterAgent should resolve contacts before calling EmailAgent');
      }

      // Check if recipient looks like a person name instead of email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        logger.error('EmailAgent received person name instead of email address', {
          recipient: recipientEmail,
          isEmail: emailRegex.test(recipientEmail)
        });
        throw new Error(`Cannot send email to "${recipientEmail}" - this appears to be a person's name, not an email address. The system should resolve contact information first. Please ensure contact resolution is working properly.`);
      }

      // Create send request
      const sendRequest: SendEmailRequest = {
        to: recipientEmail,
        subject: actionParams.subject || 'No Subject',
        body: actionParams.body || '',
        cc: actionParams.cc,
        bcc: actionParams.bcc
      };

      // Validate request
      const validation = this.emailValidator.validateSendEmailRequest(sendRequest);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Send email
      const operationResult = await this.emailOps.sendEmail(sendRequest, params.accessToken);
      
      if (!operationResult.success) {
        throw new Error(operationResult.error || 'Email sending failed');
      }

      // Format response
      const emailResult: EmailResult = {
        messageId: operationResult.result?.messageId,
        threadId: operationResult.result?.threadId,
        recipient: recipientEmail,
        subject: actionParams.subject
      };

      const formattingResult = this.emailFormatter.formatEmailResult(emailResult);
      
      return {
        success: true,
        result: {
          message: formattingResult.formattedText || 'Email sent successfully',
          data: emailResult
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error handling send email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Handle search emails operation
   */
  private async handleSearchEmails(
    params: EmailAgentRequest,
    actionParams: SearchEmailActionParams
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Ensure services are initialized
      this.ensureServices();

      if (!this.emailOps || !this.emailValidator || !this.emailFormatter) {
        throw new Error('Required services not available');
      }

      // Preprocess query to convert natural language to Gmail API syntax
      const processedQuery = this.preprocessEmailQuery(actionParams.query || '');

      // Create search request
      const searchRequest: SearchEmailsRequest = {
        query: processedQuery,
        maxResults: actionParams.maxResults || 10
      };

      // Validate request
      const validation = this.emailValidator.validateSearchEmailsRequest(searchRequest);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // DEBUG: Log search request
      logger.info('EmailAgent.handleSearchEmails - Search request debug', {
        searchQuery: searchRequest.query,
        maxResults: searchRequest.maxResults,
        hasAccessToken: !!params.accessToken
      });

      // Search emails
      const operationResult = await this.emailOps.searchEmails(searchRequest, params.accessToken);

      // DEBUG: Log operation result
      logger.info('EmailAgent.handleSearchEmails - Operation result debug', {
        success: operationResult.success,
        hasResult: !!operationResult.result,
        hasEmails: !!(operationResult.result?.emails),
        emailsLength: operationResult.result?.emails?.length || 0,
        count: operationResult.result?.count,
        error: operationResult.error,
        executionTime: operationResult.executionTime,
        resultKeys: operationResult.result ? Object.keys(operationResult.result) : [],
        emailsSample: operationResult.result?.emails?.length && operationResult.result.emails.length > 0 ? {
          id: operationResult.result.emails[0]?.id,
          subject: operationResult.result.emails[0]?.subject,
          from: operationResult.result.emails[0]?.from
        } : null
      });

      if (!operationResult.success) {
        throw new Error(operationResult.error || 'Email search failed');
      }

      // Format response
      const emailResult: EmailResult = {
        emails: operationResult.result?.emails,
        count: operationResult.result?.count
      };

      // DEBUG: Log email result construction
      logger.info('EmailAgent.handleSearchEmails - EmailResult construction debug', {
        emailResultEmails: emailResult.emails?.length || 0,
        emailResultCount: emailResult.count,
        emailResultKeys: Object.keys(emailResult),
        firstEmailFromResult: emailResult.emails?.[0] ? {
          id: emailResult.emails[0].id,
          subject: emailResult.emails[0].subject,
          from: emailResult.emails[0].from
        } : null
      });

      const formattingResult = this.emailFormatter.formatEmailResult(emailResult);

      // DEBUG: Log formatting result
      logger.info('EmailAgent.handleSearchEmails - Formatting result debug', {
        formattingSuccess: formattingResult.success,
        hasFormattedText: !!formattingResult.formattedText,
        formattedTextLength: formattingResult.formattedText?.length || 0,
        formattedTextPreview: formattingResult.formattedText?.substring(0, 200),
        formattingError: formattingResult.error
      });
      
      return {
        success: true,
        result: {
          message: formattingResult.formattedText || 'Email search completed',
          data: emailResult
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error handling search emails', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Handle reply email operation
   */
  private async handleReplyEmail(
    params: EmailAgentRequest,
    actionParams: ToolParameters
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Ensure services are initialized
      this.ensureServices();

      if (!this.emailOps || !this.emailValidator || !this.emailFormatter) {
        throw new Error('Required services not available');
      }

      // Create reply request
      const replyRequest: ReplyEmailRequest = {
        messageId: actionParams.messageId as string,
        threadId: actionParams.threadId as string,
        body: actionParams.body as string
      };

      // Validate request
      const validation = this.emailValidator.validateReplyEmailRequest(replyRequest);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Reply to email
      const operationResult = await this.emailOps.replyToEmail(replyRequest, params.accessToken);
      
      if (!operationResult.success) {
        throw new Error(operationResult.error || 'Email reply failed');
      }

      // Format response
      const emailResult: EmailResult = {
        messageId: operationResult.result?.messageId,
        threadId: operationResult.result?.threadId
      };

      const formattingResult = this.emailFormatter.formatEmailResult(emailResult);
      
      return {
        success: true,
        result: {
          message: formattingResult.formattedText || 'Email reply sent',
          data: emailResult
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error handling reply email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Handle get email operation
   */
  private async handleGetEmail(
    params: EmailAgentRequest,
    actionParams: ToolParameters
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Ensure services are initialized
      this.ensureServices();

      if (!this.emailOps || !this.emailFormatter) {
        throw new Error('Required services not available');
      }

      const emailId = actionParams.emailId as string;
      if (!emailId) {
        throw new Error('Email ID is required');
      }

      // Get email
      const operationResult = await this.emailOps.getEmail(emailId, params.accessToken);
      
      if (!operationResult.success) {
        throw new Error(operationResult.error || 'Email retrieval failed');
      }

      // Format response
      const emailResult: EmailResult = {
        emails: operationResult.result?.emails,
        count: operationResult.result?.count
      };

      const formattingResult = this.emailFormatter.formatEmailResult(emailResult);
      
      return {
        success: true,
        result: {
          message: formattingResult.formattedText || 'Email retrieved',
          data: emailResult
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error handling get email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Preprocess email query to convert natural language time expressions to Gmail API syntax
   */
  private preprocessEmailQuery(query: string): string {
    let processedQuery = query.toLowerCase().trim();
    
    // First, detect and extract time expressions
    let timeFilter = '';
    const timeConversions = [
      // Recently/recent = last 7 days
      { patterns: ['recently', 'recent'], replacement: 'newer_than:7d' },

      // Today
      { patterns: ['today', 'this morning', 'this afternoon'], replacement: 'newer_than:1d' },

      // Yesterday
      { patterns: ['yesterday'], replacement: `after:${this.getDateString(-1)} before:${this.getDateString(0)}` },

      // This week
      { patterns: ['this week', 'past week'], replacement: 'newer_than:7d' },

      // Last week
      { patterns: ['last week'], replacement: `after:${this.getDateString(-14)} before:${this.getDateString(-7)}` },

      // This month
      { patterns: ['this month', 'past month'], replacement: 'newer_than:30d' },

      // Last few days
      { patterns: ['last few days', 'past few days'], replacement: 'newer_than:3d' },

      // Last 24 hours
      { patterns: ['last 24 hours', 'past 24 hours'], replacement: 'newer_than:1d' }
    ];

    // Apply time conversions
    for (const conversion of timeConversions) {
      for (const pattern of conversion.patterns) {
        if (processedQuery.includes(pattern)) {
          timeFilter = conversion.replacement;
          processedQuery = processedQuery.replace(new RegExp(pattern, 'gi'), '').trim();
          break;
        }
      }
    }

    // Remove all natural language phrases completely
    const cleanupPatterns = [
      'what emails did i get',
      'show me emails',
      'emails from',
      'my emails',
      'emails that',
      'did i receive',
      'show me my',
      'emails',
      'what',
      'did',
      'i',
      'get',
      'show',
      'me',
      'my'
    ];

    for (const pattern of cleanupPatterns) {
      processedQuery = processedQuery.replace(new RegExp(pattern, 'gi'), '').trim();
    }

    // Build final query
    let finalQuery = '';
    if (timeFilter) {
      finalQuery += timeFilter;
    }
    
    // Always add inbox filter
    finalQuery += ' in:inbox';
    
    // Clean up extra spaces and ensure proper formatting
    finalQuery = finalQuery.replace(/\s+/g, ' ').trim();

    logger.info('EmailAgent.preprocessEmailQuery - Query conversion', {
      originalQuery: query,
      processedQuery: finalQuery,
      timeFilter: timeFilter || 'none'
    });

    return finalQuery;
  }

  /**
   * Get date string for Gmail API (YYYY/MM/DD format) relative to today
   */
  private getDateString(daysOffset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /**
   * Generate OpenAI function calling schema for this agent - Intent-agnostic
   */
  static getOpenAIFunctionSchema(): any {
    return {
      name: 'manage_emails',
      description: 'Comprehensive email management using Gmail API. Send emails, search through inbox, list emails, reply to messages, and manage email communications. Let OpenAI determine the operation from natural language.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The email request in natural language. Examples: "Send an email to John about the meeting", "What emails do I have from Sarah?", "Show me emails about project updates", "Reply to that message", "Create a draft email"'
          },
          operation: {
            type: 'string',
            description: 'The type of email operation to perform - determined by OpenAI from the query',
            enum: Object.values(EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS)
          },
          recipients: {
            type: 'array',
            description: 'Email addresses of recipients',
            items: { type: 'string' },
            nullable: true
          },
          recipientName: {
            type: 'string',
            description: 'Name of recipient to resolve from contacts',
            nullable: true
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
            nullable: true
          },
          body: {
            type: 'string',
            description: 'Email body content',
            nullable: true
          },
          cc: {
            type: 'array',
            description: 'CC recipients',
            items: { type: 'string' },
            nullable: true
          },
          bcc: {
            type: 'array',
            description: 'BCC recipients',
            items: { type: 'string' },
            nullable: true
          },
          messageId: {
            type: 'string',
            description: 'Message ID for reply operations',
            nullable: true
          },
          threadId: {
            type: 'string',
            description: 'Thread ID for reply operations',
            nullable: true
          },
          emailId: {
            type: 'string',
            description: 'Email ID for get operations',
            nullable: true
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results for search operations',
            nullable: true
          }
        },
        required: ['query']
      }
    };
  }

  /**
   * Get agent capabilities
   */
  static getCapabilities(): string[] {
    return [
      'Send emails with attachments and formatting',
      'Search through email inbox and folders',
      'List emails with filtering and sorting',
      'Reply to existing email conversations',
      'Create and manage email drafts',
      'Handle email threading and conversations',
      'Manage email labels and organization',
      'Process email attachments and content'
    ];
  }

  /**
   * Get agent limitations
   */
  static getLimitations(): string[] {
    return [
      'Requires Gmail API access and proper OAuth permissions',
      'Limited by Gmail API rate limits and quotas',
      'Cannot access emails from other email providers',
      'Cannot send emails to invalid or non-existent addresses',
      'Limited by Gmail storage and attachment size limits',
      'Cannot access private or restricted email accounts'
    ];
  }

  /**
   * Get agent statistics
   */
  getAgentStats(): {
    agentName: string;
    hasEmailOps: boolean;
    hasEmailValidator: boolean;
    hasEmailFormatter: boolean;
  } {
    return {
      agentName: EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_OPERATION_HANDLER,
      hasEmailOps: !!this.emailOps,
      hasEmailValidator: !!this.emailValidator,
      hasEmailFormatter: !!this.emailFormatter
    };
  }
}
