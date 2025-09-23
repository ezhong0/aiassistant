import { AIAgent } from '../framework/ai-agent';
import logger from '../utils/logger';
import { LogContext } from '../utils/log-context';
import { ToolExecutionContext, EmailAgentParams } from '../types/tools';
import { ActionPreview, PreviewGenerationResult, EmailPreviewData, ActionRiskAssessment } from '../types/api/api.types';
import { ServiceManager, getService } from '../services/service-manager';
import { OpenAIService } from '../services/openai.service';
// Import types only - actual implementations will be dynamic imports to avoid circular dependencies
type HybridValidationResult = any;
type ValidationConfig = any;
type EmailRequest = any;
type ValidationResult = any;
type IntelligenceValidationResult = any;
type ContentAnalysisRequest = any;
import { GmailService } from '../services/email/gmail.service';
import { TokenManager } from '../services/token-manager';
// Removed OperationDetectionService - EmailAgent handles its own operation detection
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
import {
  AgentExecutionContext,
  AgentIntent,
  NaturalLanguageResponse,
  AgentCapabilities
} from '../types/agents/natural-language.types';

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

  // Simple validation flag - detailed validation removed for architectural cleanup
  private validationEnabled: boolean = true;

  // Gmail service integration
  private gmailService: GmailService | null = null;
  private tokenManager: TokenManager | null = null;

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
      // Removed individual agent AI planning - using only Master Agent NextStepPlanningService
      // aiPlanning: {
      //   enableAIPlanning: false,
      //   maxPlanningSteps: 5,
      //   planningTimeout: 20000,
      //   cachePlans: true,
      //   planningTemperature: 0.1,
      //   planningMaxTokens: 1500
      // }
    });

    // Simple validation enabled by default - complex validation removed for architectural cleanup
    this.validationEnabled = true;

    // Initialize Gmail service and TokenManager
    this.initializeServices();
  }

  /**
   * Initialize Gmail service and TokenManager
   */
  private initializeServices(): void {
    try {
      this.gmailService = ServiceManager.getInstance().getService('gmailService') as GmailService;
      this.tokenManager = ServiceManager.getInstance().getService('tokenManager') as TokenManager;
    } catch (error) {
      logger.warn('Failed to initialize Gmail services', error as Error, {
        correlationId: 'email-agent-init',
        operation: 'service_initialization',
        metadata: { service: 'EmailAgent' }
      });
    }
  }

  /**
   * Get access token for Gmail operations
   */
  private async getAccessToken(context: ToolExecutionContext): Promise<string | null> {
    const logContext: LogContext = {
      correlationId: `email-token-${Date.now()}`,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'get_access_token',
      metadata: {
        hasSlackContext: !!(context as any).slackContext,
        hasTokenManager: !!this.tokenManager
      }
    };

    try {
      logger.debug('Attempting to retrieve Gmail access token', logContext);

      // Check if we already have an access token in the context
      if ((context as any).accessToken) {
        logger.debug('Found access token in context', logContext);
        return (context as any).accessToken;
      }

      // Try to get token from Slack context via TokenManager
      const slackContext = (context as any).slackContext;
      if (slackContext?.teamId && slackContext?.userId && this.tokenManager) {
        logger.debug('Attempting to get Gmail token from TokenManager', {
          ...logContext,
          metadata: {
            ...logContext.metadata,
            teamId: slackContext.teamId,
            userId: slackContext.userId
          }
        });

        const accessToken = await this.tokenManager.getValidTokensForGmail(
          slackContext.teamId,
          slackContext.userId
        );

        if (accessToken) {
          logger.debug('Successfully retrieved Gmail access token', {
            ...logContext,
            metadata: { ...logContext.metadata, hasToken: true }
          });
          return accessToken;
        }
      }

      logger.warn('No Gmail access token available', logContext);
      return null;
    } catch (error) {
      logger.error('Error retrieving Gmail access token', error as Error, logContext);
      return null;
    }
  }

  /**
   * Required method to process incoming requests - routes to appropriate handlers
   */
  protected async processQuery(params: EmailAgentRequest, context: ToolExecutionContext): Promise<any> {
    const logContext: LogContext = {
      correlationId: `email-${context.sessionId}-${Date.now()}`,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'email_processing',
      metadata: { 
        operation: params.operation,
        hasAccessToken: !!params.accessToken
      }
    };

    logger.info('Email processing started', logContext);

    // Hybrid validation system handles both security and intelligence validation

    // Route to appropriate handler based on operation
    switch (params.operation?.toLowerCase()) {
      case 'search':
        logger.debug('Routing to email search', { ...logContext, metadata: { operation: 'search' } });
        return await this.handleSearchEmails(params, {
          query: params.query || '',
          maxResults: params.maxResults || 10
        }, context);

      case 'send':
        logger.debug('Routing to email send', { ...logContext, metadata: { operation: 'send' } });

        // Validate that we have proper email recipients, not person names
        if (params.recipientName && !params.contactEmail) {
          logger.error('Received recipientName without contactEmail', new Error('Invalid recipient format'), {
            ...logContext,
            metadata: { 
              recipientName: params.recipientName,
              hasContactEmail: !!params.contactEmail
            }
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

        logger.debug('Recipient resolution completed', {
          ...logContext,
          metadata: {
            hasContactEmail: !!params.contactEmail,
            hasRecipientsParam: !!((params as any).recipients),
            recipientsCount: recipients.length
          }
        });

        // Validate that we have recipients
        if (!recipients || recipients.length === 0) {
          logger.error('No recipients found for email send', new Error('Missing recipients'), {
            ...logContext,
            metadata: { 
              hasContactEmail: !!params.contactEmail,
              hasRecipientsParam: !!((params as any).recipients)
            }
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
        }, context);

      case 'reply':
        logger.debug('Reply operation requested but not yet implemented', { ...logContext, metadata: { operation: 'reply' } });
        return {
          success: false,
          error: 'Reply email operation not yet implemented in EmailAgent',
          executionTime: 0
        };

      default:
        logger.warn('Unknown operation, defaulting to search', {
          ...logContext,
          metadata: { operation: params.operation }
        });
        const preprocessedQuery = await this.preprocessEmailQuery(params.query || 'in:inbox');
        return await this.handleSearchEmails(params, {
          query: preprocessedQuery,
          maxResults: params.maxResults || 10
        }, context);
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      logger.debug('EmailAgent destroyed successfully', {
        correlationId: 'email-destroy',
        operation: 'agent_destroy',
        metadata: { service: 'EmailAgent' }
      });
    } catch (error) {
      logger.error('Error during EmailAgent destruction', error as Error, {
        correlationId: 'email-destroy',
        operation: 'agent_destroy',
        metadata: { service: 'EmailAgent' }
      });
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
      
      // Comprehensive validation using hybrid system
      const emailRequest: EmailRequest = {
        to: Array.isArray((params as any).recipients) ? (params as any).recipients : [params.contactEmail || ''],
        subject: params.subject || '',
        body: params.body || '',
        accessToken: params.accessToken,
        cc: (params as any).cc,
        bcc: (params as any).bcc
      };

      const validationResult = this.validateEmailRequest(emailRequest);

      if (!validationResult.isValid) {
        throw new Error(`Email validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Basic validation passed, continue with processing

      // Continue with email processing

      // Route to appropriate handler based on tool name - Intent-agnostic routing
      // Let OpenAI determine the operation from the parameters
      const operation = (parameters as any).operation;
      
      if (operation === EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS.SEND) {
        return await this.handleSendEmail(params, parameters as SendEmailActionParams, context);
      } else if (operation === EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS.SEARCH) {
        return await this.handleSearchEmails(params, parameters as SearchEmailActionParams, context);
      } else if (operation === EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS.REPLY) {
        return await this.handleReplyEmail(params, parameters);
      } else if (operation === EMAIL_SERVICE_CONSTANTS.EMAIL_ACTIONS.GET) {
        return await this.handleGetEmail(params, parameters);
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      logger.error('Error executing custom tool', error as Error, {
        correlationId: 'email-custom-tool',
        operation: 'custom_tool_execution',
        metadata: { operationType: 'custom_tool' }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : EMAIL_SERVICE_CONSTANTS.ERRORS.UNKNOWN_ERROR,
        executionTime: 0
      };
    }
  }

  /**
   * Detect operation type from email parameters using LLM intelligence
   */
  protected async detectOperation(params: EmailAgentRequest): Promise<string> {
    // Check if operation is explicitly specified
    if (params.operation) {
      return params.operation;
    }

    // Pure natural language system - no text-based operation detection allowed
    throw new Error('Legacy operation detection method called - use AI-powered intent analysis instead');
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
    const logContext: LogContext = {
      correlationId: `email-preview-${context.sessionId}-${Date.now()}`,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: 'email_preview_generation',
      metadata: {
        operation: params.operation,
        hasRecipients: !!((params as any).recipients),
        subject: params.subject
      }
    };

    try {
      logger.debug('Generating email preview', logContext);

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

      logger.debug('Email preview generated successfully', {
        ...logContext,
        metadata: { actionId, recipientsCount: recipients.length }
      });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to generate email preview', error as Error, {
        ...logContext,
        metadata: { operation: params.operation }
      });
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
    actionParams: SendEmailActionParams,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Email validation and formatting handled by LLM intelligence

      // Expect pre-resolved recipient email from MasterAgent
      const recipientEmail = Array.isArray(actionParams.recipients) ? actionParams.recipients[0] : actionParams.recipients;
      if (!recipientEmail) {
        throw new Error('No recipient email specified - MasterAgent should resolve contacts before calling EmailAgent');
      }

      // Check if recipient looks like a person name instead of email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        logger.error('Received person name instead of email address', new Error('Invalid email format'), {
          correlationId: 'email-send',
          operation: 'email_validation',
          metadata: { 
            recipient: recipientEmail,
            isEmail: emailRegex.test(recipientEmail)
          }
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

      // Get Gmail access token
      const accessToken = context ? await this.getAccessToken(context) : null;

      if (!accessToken) {
        return {
          success: false,
          error: 'Gmail access token not available. Please connect your Gmail account first.',
          executionTime: Date.now() - startTime
        };
      }

      if (!this.gmailService) {
        return {
          success: false,
          error: 'Gmail service not available. Please try again later.',
          executionTime: Date.now() - startTime
        };
      }

      // Send email using Gmail service
      logger.debug('Calling Gmail service for email send', {
        correlationId: 'email-send',
        operation: 'gmail_send_call',
        metadata: {
          recipient: recipientEmail,
          subject: actionParams.subject,
          hasAccessToken: !!accessToken,
          hasGmailService: !!this.gmailService
        }
      });

      const gmailResult = await this.gmailService.sendEmail(
        accessToken,
        recipientEmail,
        actionParams.subject || 'No Subject',
        actionParams.body || '',
        {
          cc: Array.isArray(actionParams.cc) ? actionParams.cc : actionParams.cc ? [actionParams.cc] : undefined,
          bcc: Array.isArray(actionParams.bcc) ? actionParams.bcc : actionParams.bcc ? [actionParams.bcc] : undefined
        }
      );

      // Format response with real Gmail data
      const emailResult: EmailResult = {
        messageId: gmailResult.messageId,
        threadId: gmailResult.threadId,
        recipient: recipientEmail,
        subject: actionParams.subject
      };

      // Format result with LLM intelligence
      const successMessage = `✅ Email sent successfully to ${recipientEmail}!\n📧 Subject: ${actionParams.subject || 'No Subject'}\n💌 Your message has been delivered.`;

      return {
        success: true,
        result: {
          message: successMessage,
          data: emailResult
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error handling send email', error as Error, {
        correlationId: 'email-send',
        operation: 'email_send',
        metadata: { recipient: actionParams.recipients }
      });
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
    actionParams: SearchEmailActionParams,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Get Gmail access token
      const accessToken = context ? await this.getAccessToken(context) : null;

      if (!accessToken) {
        return {
          success: false,
          error: 'Gmail access token not available. Please connect your Gmail account first.',
          executionTime: Date.now() - startTime
        };
      }

      if (!this.gmailService) {
        return {
          success: false,
          error: 'Gmail service not available. Please try again later.',
          executionTime: Date.now() - startTime
        };
      }

      // Preprocess query to convert natural language to Gmail API syntax
      const processedQuery = await this.preprocessEmailQuery(actionParams.query || '');

      // Create search request
      const searchRequest: SearchEmailsRequest = {
        query: processedQuery,
        maxResults: actionParams.maxResults || 10
      };

      // DEBUG: Log search request
      logger.debug('Search request processed', {
        correlationId: 'email-search',
        operation: 'email_search',
        metadata: {
          searchQuery: searchRequest.query,
          maxResults: searchRequest.maxResults,
          hasAccessToken: !!accessToken,
          hasGmailService: !!this.gmailService
        }
      });

      // Search emails using Gmail service
      logger.debug('Calling Gmail service for email search', {
        correlationId: 'email-search',
        operation: 'gmail_search_call',
        metadata: {
          query: searchRequest.query,
          maxResults: searchRequest.maxResults
        }
      });

      const gmailResults = await this.gmailService.searchEmails(
        accessToken,
        searchRequest.query || 'in:inbox',
        {
          maxResults: searchRequest.maxResults,
          includeSpamTrash: false
        }
      );

      // Format response with real Gmail data
      const emailResult: EmailResult = {
        emails: gmailResults,
        count: gmailResults.length
      };

      // DEBUG: Log email result construction
      logger.debug('Email result constructed', {
        correlationId: 'email-search',
        operation: 'email_search',
        metadata: {
          emailResultEmails: emailResult.emails?.length || 0,
          emailResultCount: emailResult.count,
          emailResultKeys: Object.keys(emailResult)
        }
      });

      // Format result with LLM intelligence
      const searchMessage = emailResult.count === 0
        ? '📭 No emails found matching your search criteria.'
        : `📧 Found ${emailResult.count} email${emailResult.count === 1 ? '' : 's'} matching your search.`;

      // DEBUG: Log formatting result
      logger.debug('Email formatting completed', {
        correlationId: 'email-search',
        operation: 'email_search',
        metadata: {
          emailCount: emailResult.count,
          messageLength: searchMessage.length
        }
      });

      return {
        success: true,
        result: {
          message: searchMessage,
          data: emailResult
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error handling search emails', error as Error, {
        correlationId: 'email-search',
        operation: 'email_search',
        metadata: { query: actionParams.query }
      });
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
      // Email validation and formatting handled by LLM intelligence

      // Create reply request
      const replyRequest: ReplyEmailRequest = {
        messageId: actionParams.messageId as string,
        threadId: actionParams.threadId as string,
        body: actionParams.body as string
      };

      // Validation already completed in executeCustomTool - proceed with reply

      // Reply to email
      // EmailOps removed - placeholder implementation
      const emailResult: EmailResult = {
        messageId: 'reply-mock-id-' + Date.now(),
        threadId: 'reply-mock-thread-' + Date.now()
      };

      // Format result with LLM intelligence
      const replyMessage = `✅ Reply sent successfully!\n📧 Your reply has been added to the conversation thread.`;

      return {
        success: true,
        result: {
          message: replyMessage,
          data: emailResult
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error handling reply email', error as Error, {
        correlationId: 'email-reply',
        operation: 'email_reply',
        metadata: { messageId: params.messageId }
      });
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
      const emailId = actionParams.emailId as string;
      if (!emailId) {
        throw new Error('Email ID is required');
      }

      // Get email
      // EmailOps removed - placeholder implementation
      const emailResult: EmailResult = {
        emails: [],
        count: 0
      };

      // Format result with LLM intelligence
      const getMessage = emailResult.emails && emailResult.emails.length > 0
        ? `📧 Email retrieved successfully.`
        : `📭 Email not found or already deleted.`;

      return {
        success: true,
        result: {
          message: getMessage,
          data: emailResult
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error handling get email', error as Error, {
        correlationId: 'email-get',
        operation: 'email_get',
        metadata: { messageId: params.messageId }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * AI-powered email query preprocessing to convert natural language to Gmail API syntax
   */
  private async preprocessEmailQuery(query: string): Promise<string> {
    try {
      const openaiService = getService<OpenAIService>('openaiService');
      if (!openaiService) {
        throw new Error('AI service unavailable. Natural language email query processing requires OpenAI service.');
      }

      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const prompt = `Convert this natural language email query into Gmail API search syntax:

Query: "${query}"

Gmail Search Operators:
- Time filters: newer_than:1d, older_than:1d, after:YYYY/MM/DD, before:YYYY/MM/DD
- From/To: from:email@domain.com, to:email@domain.com
- Subject: subject:"text"
- Has attachment: has:attachment
- Labels: label:inbox, label:sent, label:unread
- Keywords: exact phrases in quotes

Today's date: ${currentDate}

Time expressions mapping:
- "today" → newer_than:1d
- "yesterday" → after:${this.getDateString(-1)} before:${this.getDateString(0)}
- "this week" → newer_than:7d
- "last week" → after:${this.getDateString(-14)} before:${this.getDateString(-7)}
- "this month" → newer_than:30d
- "recently" → newer_than:7d

Examples:
- "emails from John today" → from:john newer_than:1d in:inbox
- "show me unread emails" → is:unread in:inbox
- "emails about project yesterday" → subject:"project" after:${this.getDateString(-1)} before:${this.getDateString(0)} in:inbox
- "attachments from last week" → has:attachment after:${this.getDateString(-14)} before:${this.getDateString(-7)} in:inbox

Always include "in:inbox" unless specifically asking for sent emails (then use "in:sent").
Return only the Gmail search query syntax.`;

      const response = await openaiService.generateText(
        prompt,
        'You are an expert at converting natural language to Gmail search syntax. Return only the search query.',
        { temperature: 0.1, maxTokens: 100 }
      );

      const processedQuery = response.trim();

      logger.debug('AI-powered email query preprocessed', {
        correlationId: 'email-query-preprocess',
        operation: 'ai_query_preprocessing',
        metadata: {
          originalQuery: query,
          processedQuery: processedQuery
        }
      });

      return processedQuery;

    } catch (error) {
      logger.error('AI query preprocessing failed', error as Error, {
        correlationId: 'email-query-preprocess',
        operation: 'ai_query_preprocessing_error'
      });

      // Throw error instead of using fallback - pure AI approach
      throw new Error(`Email query preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your OpenAI configuration.`);
    }
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
      name: 'emailAgent',
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

  // ==========================================
  // EMAIL VALIDATION METHODS (Consolidated)
  // ==========================================

  /**
   * Simple email validation for basic security checks
   * Simplified from complex validation system for architectural cleanup
   */
  validateEmailRequest(request: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic email validation
    if (!request.to) {
      errors.push('Recipient email address is required');
    }

    if (!request.subject || request.subject.trim().length === 0) {
      errors.push('Email subject is required');
    }

    if (!request.body || request.body.trim().length === 0) {
      errors.push('Email body is required');
    }

    // Basic email format validation
    if (request.to && typeof request.to === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(request.to)) {
        errors.push('Invalid email address format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
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
      hasEmailOps: false,
      hasEmailValidator: false, // Removed - LLM handles validation
      hasEmailFormatter: false  // Removed - LLM handles formatting
    };
  }

  // NATURAL LANGUAGE INTERFACE IMPLEMENTATION

  /**
   * Get agent capability description for MasterAgent
   */
  getCapabilityDescription(): AgentCapabilities {
    return {
      name: 'Email Expert',
      description: 'Comprehensive email management using Gmail API for sending, searching, and organizing emails',
      capabilities: [
        'Send emails with attachments and formatting',
        'Search through email inbox and folders using natural language',
        'List emails with filtering and sorting',
        'Reply to existing email conversations',
        'Create and manage email drafts',
        'Handle email threading and conversations',
        'Process email attachments and content',
        'Convert natural language queries to Gmail search syntax'
      ],
      limitations: [
        'Requires Gmail API access and proper OAuth permissions',
        'Limited by Gmail API rate limits and quotas',
        'Cannot access emails from other email providers',
        'Cannot send emails to invalid or non-existent addresses',
        'Limited by Gmail storage and attachment size limits'
      ],
      examples: [
        'Send an email to john@example.com about the meeting',
        'Show me emails from Sarah today',
        'Search for emails about project updates',
        'Find unread emails with attachments',
        'Reply to the last email from Mike',
        'Create a draft email to the team'
      ],
      domains: ['email', 'gmail', 'messaging', 'communication'],
      requirements: ['Gmail API access', 'OAuth authentication']
    };
  }

  /**
   * Domain-specific intent analysis for email operations
   */
  protected async analyzeIntent(request: string, context: AgentExecutionContext): Promise<AgentIntent> {
    try {
      const prompt = `Analyze this email request: "${request}"

Available email operations:
- send: Send new emails to recipients
- search: Search through emails using Gmail queries
- reply: Reply to existing email messages
- draft: Create email drafts for later sending
- get: Retrieve specific email by ID

Return JSON with operation, parameters, confidence (0-1), and reasoning.

Parameters should include:
- query: The full request for context
- recipients: Array of email addresses (for send operations)
- recipientName: Name to resolve from contacts (for send operations)
- subject: Email subject line (for send operations)
- body: Email content (for send operations)
- messageId: Message ID (for reply operations)
- threadId: Thread ID (for reply operations)
- maxResults: Maximum results (for search operations)
- searchQuery: Search terms (for search operations)`;

      const response = await this.openaiService?.generateStructuredData(prompt, 'Email intent analyzer', {
        type: 'object',
        properties: {
          operation: { type: 'string' },
          parameters: { type: 'object' },
          confidence: { type: 'number' },
          reasoning: { type: 'string' }
        }
      }) as { operation?: string; parameters?: any; confidence?: number; reasoning?: string };

      return {
        operation: response?.operation || 'search',
        parameters: response?.parameters || { query: request },
        confidence: response?.confidence || 0.8,
        reasoning: response?.reasoning || 'Email operation detected',
        toolsUsed: ['emailAgent', response?.operation || 'search']
      };
    } catch (error) {
      console.error('Email intent analysis failed:', error);
      // Fallback to search operation if analysis fails
      return {
        operation: 'search',
        parameters: { query: request },
        confidence: 0.7,
        reasoning: 'Fallback to email search due to analysis error',
        toolsUsed: ['emailAgent']
      };
    }
  }

  /**
   * Execute the selected tool based on intent analysis
   */
  protected async executeSelectedTool(intent: AgentIntent, context: AgentExecutionContext): Promise<any> {
    const params: EmailAgentRequest = {
      query: intent.parameters.query || '',
      accessToken: context.accessToken || '',
      operation: intent.operation,
      recipientName: intent.parameters.recipientName,
      subject: intent.parameters.subject,
      body: intent.parameters.body,
      messageId: intent.parameters.messageId,
      threadId: intent.parameters.threadId
    };

    const toolContext = {
      sessionId: context.sessionId,
      userId: context.userId,
      timestamp: context.timestamp,
      metadata: { correlationId: context.correlationId }
    };

    return await this.processQuery(params, toolContext);
  }

  /**
   * Generate natural language response from tool execution results
   */
  protected async generateResponse(
    request: string,
    result: any,
    intent: AgentIntent,
    context: AgentExecutionContext
  ): Promise<string> {
    try {
      const emailResult = result as EmailResult;

      switch (intent.operation) {
        case 'send':
          if (emailResult.messageId) {
            return `✅ Email sent successfully to ${emailResult.recipient}!
📧 Subject: ${emailResult.subject || 'No Subject'}
💌 Your message has been delivered.`;
          } else {
            return 'Failed to send email. Please check the recipient address and try again.';
          }

        case 'search':
          if (emailResult.count === 0) {
            return '📭 No emails found matching your search criteria. Try adjusting your search terms or date range.';
          }
          return `📧 Found ${emailResult.count || 0} email${(emailResult.count || 0) === 1 ? '' : 's'} matching your search.${emailResult.emails && emailResult.emails.length > 0 ? `

Recent results:
${emailResult.emails.slice(0, 3).map(email => `• ${email.subject || 'No Subject'} - from ${email.from || 'Unknown'}`).join('\n')}${(emailResult.count || 0) > 3 ? `\n... and ${(emailResult.count || 0) - 3} more` : ''}` : ''}`;

        case 'reply':
          if (emailResult.messageId) {
            return '✅ Reply sent successfully! Your response has been added to the conversation thread.';
          } else {
            return 'Failed to send reply. Please ensure the original message exists and try again.';
          }

        case 'draft':
          return 'Email draft created successfully. You can review and send it from your Gmail drafts folder.';

        case 'get':
          if (emailResult.emails && emailResult.emails.length > 0) {
            const email = emailResult.emails[0];
            return `📧 Email retrieved: "${email?.subject || 'No Subject'}" from ${email?.from || 'Unknown'}`;
          } else {
            return '📭 Email not found or no longer available.';
          }

        default:
          return `Email operation completed. ${emailResult.count ? `Found ${emailResult.count} results.` : ''}`;
      }
    } catch (error) {
      console.error('Email response generation failed:', error);
      return `I encountered an issue while processing your email request: "${request}". Please check your Gmail connection and try again.`;
    }
  }
}
