import { AIAgent } from '../framework/ai-agent';
import { ToolExecutionContext, EmailAgentParams } from '../types/tools';
import { ActionPreview, PreviewGenerationResult, EmailPreviewData, ActionRiskAssessment } from '../types/api.types';
import { ServiceManager } from '../services/service-manager';
import { EmailOperationHandler } from '../services/email-operation-handler.service';
import { ContactResolver } from '../services/contact-resolver.service';
import { EmailValidator } from '../services/email-validator.service';
import { EmailFormatter } from '../services/email-formatter.service';
import {
  SendEmailRequest,
  SearchEmailsRequest,
  ReplyEmailRequest,
  GmailMessage,
  EmailDraft
} from '../types/gmail.types';
import { EMAIL_CONSTANTS } from '../config/constants';
import { EMAIL_SERVICE_CONSTANTS } from '../config/email-service-constants';
import {
  ToolParameters,
  ToolExecutionResult,
  AgentExecutionSummary
} from '../types/agent-parameters';
import {
  SendEmailActionParams,
  SearchEmailActionParams,
  EmailSummaryParams
} from '../types/agent-specific-parameters';
import logger from '../utils/logger';

/**
 * Email operation result interface - Intent-agnostic
 * No hardcoded action strings - result content determines formatting
 */
export interface EmailResult {
  messageId?: string;
  threadId?: string;
  emails?: GmailMessage[];
  draft?: EmailDraft;
  count?: number;
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
 * Refactored EmailAgent using focused services
 * Coordinates between specialized services for email operations
 */
export class EmailAgent extends AIAgent<EmailAgentRequest, EmailResult> {
  
  // Focused component services
  private emailOps: EmailOperationHandler | null = null;
  private contactResolver: ContactResolver | null = null;
  private emailValidator: EmailValidator | null = null;
  private emailFormatter: EmailFormatter | null = null;

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
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      logger.info('Initializing refactored EmailAgent...');

      // Get focused component services
      const serviceManager = ServiceManager.getInstance();
      this.emailOps = serviceManager.getService(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_OPERATION_HANDLER) as EmailOperationHandler;
      this.contactResolver = serviceManager.getService(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.CONTACT_RESOLVER) as ContactResolver;
      this.emailValidator = serviceManager.getService(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_VALIDATOR) as EmailValidator;
      this.emailFormatter = serviceManager.getService(EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_FORMATTER) as EmailFormatter;

      logger.info('EmailAgent initialized with focused components', {
        hasEmailOps: !!this.emailOps,
        hasContactResolver: !!this.contactResolver,
        hasEmailValidator: !!this.emailValidator,
        hasEmailFormatter: !!this.emailFormatter
      });
    } catch (error) {
      logger.error('Error initializing EmailAgent', error);
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.emailOps = null;
      this.contactResolver = null;
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
   * Handle send email operation
   */
  private async handleSendEmail(
    params: EmailAgentRequest, 
    actionParams: SendEmailActionParams
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      if (!this.emailOps || !this.contactResolver || !this.emailValidator || !this.emailFormatter) {
        throw new Error('Required services not available');
      }

      // Resolve contact if needed
      let recipientEmail = Array.isArray(actionParams.recipients) ? actionParams.recipients[0] : actionParams.recipients;
      if (!recipientEmail && actionParams.recipientName) {
        const contactResolution = await this.contactResolver.resolveByName(
          actionParams.recipientName as string,
          params.accessToken
        );
        
        if (!contactResolution.success || !contactResolution.contact) {
          throw new Error(`Could not find contact: ${actionParams.recipientName}`);
        }
        
        recipientEmail = contactResolution.contact.email;
        if (!recipientEmail) {
          throw new Error(`Contact ${actionParams.recipientName} has no email address`);
        }
      }

      if (!recipientEmail) {
        throw new Error('No recipient email specified');
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
      if (!this.emailOps || !this.emailValidator || !this.emailFormatter) {
        throw new Error('Required services not available');
      }

      // Create search request
      const searchRequest: SearchEmailsRequest = {
        query: actionParams.query || '',
        maxResults: actionParams.maxResults || 10
      };

      // Validate request
      const validation = this.emailValidator.validateSearchEmailsRequest(searchRequest);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Search emails
      const operationResult = await this.emailOps.searchEmails(searchRequest, params.accessToken);
      
      if (!operationResult.success) {
        throw new Error(operationResult.error || 'Email search failed');
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
   * Get agent statistics
   */
  getAgentStats(): {
    agentName: string;
    hasEmailOps: boolean;
    hasContactResolver: boolean;
    hasEmailValidator: boolean;
    hasEmailFormatter: boolean;
  } {
    return {
      agentName: EMAIL_SERVICE_CONSTANTS.SERVICE_NAMES.EMAIL_OPERATION_HANDLER,
      hasEmailOps: !!this.emailOps,
      hasContactResolver: !!this.contactResolver,
      hasEmailValidator: !!this.emailValidator,
      hasEmailFormatter: !!this.emailFormatter
    };
  }
}
