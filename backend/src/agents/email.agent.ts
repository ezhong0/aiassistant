import { AIAgent } from '../framework/ai-agent';
import { ToolExecutionContext, EmailAgentParams } from '../types/tools';
import { ActionPreview, PreviewGenerationResult, EmailPreviewData, ActionRiskAssessment } from '../types/api.types';
import { getService } from '../services/service-manager';
import { GmailService } from '../services/gmail.service';
import { ThreadManager } from '../utils/thread-manager';
import { OpenAIService } from '../services/openai.service';
import { AIClassificationService } from '../services/ai-classification.service';
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
   * Enhanced EmailAgent using AIAgent framework
   * Handles all email operations via Gmail API with AI planning and manual fallbacks
   */
  export class EmailAgent extends AIAgent<EmailAgentRequest, EmailResult> {

    constructor() {
      super({
        name: 'emailAgent',
        description: 'Handles email operations via Gmail API',
        enabled: true,
        timeout: 30000,
        retryCount: 3,
        aiPlanning: {
          enableAIPlanning: true, // Enable AI planning by default
          maxPlanningSteps: 5,
          planningTimeout: 20000,
          cachePlans: true,
          planningTemperature: 0.1,
          planningMaxTokens: 1500
        }
      });
    }

    /**
     * Generate OpenAI function calling schema for this agent
     */
    static getOpenAIFunctionSchema(): any {
      return {
        name: 'manage_emails',
        description: 'Comprehensive email management using Gmail API. Send emails, search through inbox, list emails, reply to messages, and manage email communications. Use this for ALL email-related operations including checking inbox, finding emails, sending messages, and viewing email content.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The email request in natural language. Examples: "Send an email to John about the meeting", "What emails do I have from Sarah?", "Show me emails about project updates", "List my unread emails", "Find emails with attachments", "What emails do I have todo?"'
            },
            operation: {
              type: 'string',
              description: 'The type of email operation to perform',
              enum: ['send', 'search', 'list', 'reply', 'get', 'draft'],
              nullable: true
            },
            recipients: {
              type: 'array',
              description: 'Email addresses of recipients',
              items: { type: 'string' },
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
            threadId: {
              type: 'string',
              description: 'Thread ID for replies',
              nullable: true
            },
            messageId: {
              type: 'string',
              description: 'Message ID for replies',
              nullable: true
            },
            contacts: {
              type: 'array',
              description: 'Contact information from contact agent',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string', nullable: true }
                }
              },
              nullable: true
            }
          },
          required: ['query']
        }
      };
    }

    /**
     * Get agent capabilities for OpenAI function calling
     */
    static getCapabilities(): string[] {
      return [
        'Send new emails with natural language composition',
        'Reply to existing email threads',
        'Search and retrieve emails',
        'Create email drafts',
        'Extract email content from natural language',
        'Integrate with contact information',
        'Handle multiple recipients (TO, CC, BCC)',
        'Support email threading and conversations'
      ];
    }

    /**
     * Get agent specialties for capability-based routing
     */
    static getSpecialties(): string[] {
      return [
        'Email composition and sending',
        'Email thread management',
        'Intelligent email search and filtering',
        'Draft creation and management',
        'Email priority classification',
        'Multi-recipient handling'
      ];
    }

    /**
     * Get agent description for AI routing
     */
    static getDescription(): string {
      return 'Specialized agent for Gmail operations including sending emails, searching messages, managing drafts, and intelligent email processing with AI-powered content analysis.';
    }

    /**
     * Get agent limitations for OpenAI function calling
     */
    static getLimitations(): string[] {
      return [
        'Requires Gmail API access token',
        'Cannot send emails without recipient information',
        'Email content must comply with Gmail policies',
        'Limited to Gmail accounts only',
        'Cannot access emails from other email providers'
      ];
    }

  /**
   * Register email-specific tools for AI planning
   */
  protected registerDefaultTools(): void {
    // Call parent to register base tools like 'think'
    super.registerDefaultTools();

    // Register email-specific tools
    this.registerTool({
      name: 'send_email',
      description: 'Send an email to one or more recipients with subject and body',
      parameters: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: 'Natural language email request (e.g., "Send email to john@example.com about meeting")' 
          },
          recipients: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email addresses of recipients'
          },
          subject: {
            type: 'string',
            description: 'Email subject line'
          },
          body: {
            type: 'string', 
            description: 'Email body content'
          },
          cc: {
            type: 'array',
            items: { type: 'string' },
            description: 'CC recipients (optional)'
          },
          bcc: {
            type: 'array',
            items: { type: 'string' },
            description: 'BCC recipients (optional)'
          }
        },
        required: ['query']
      },
      capabilities: ['compose_email', 'send_message', 'recipient_handling'],
      requiresConfirmation: false, // We handle confirmation at tool level
      estimatedExecutionTime: 5000
    });

    this.registerTool({
      name: 'emailAgent',
      description: 'General email operations agent for sending, searching, and managing emails',
      parameters: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: 'Natural language email operation request' 
          },
          action: {
            type: 'string',
            enum: ['send', 'search', 'reply', 'draft'],
            description: 'Specific email action to perform'
          }
        },
        required: ['query']
      },
      capabilities: ['send_email', 'search_email', 'reply_email', 'draft_email'],
      requiresConfirmation: false,
      estimatedExecutionTime: 4000
    });

    this.registerTool({
      name: 'search_emails',
      description: 'Search for emails in Gmail by sender, subject, content, or date',
      parameters: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: 'Search query or natural language search request' 
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)'
          }
        },
        required: ['query']
      },
      capabilities: ['search_gmail', 'filter_emails'],
      requiresConfirmation: false,
      estimatedExecutionTime: 3000
    });

    // AI-driven email data fetching tools
    this.registerTool({
      name: 'get_email_overview',
      description: 'Get basic metadata for recent emails (subjects, senders, dates, snippets) for efficient analysis',
      parameters: {
        type: 'object',
        properties: {
          maxResults: {
            type: 'number',
            description: 'Maximum number of emails to retrieve (default: 20, max: 50)',
            minimum: 1,
            maximum: 50
          },
          query: {
            type: 'string',
            description: 'Gmail search query (default: "in:inbox") - e.g., "is:unread", "from:sender@email.com"'
          },
          includeSpamTrash: {
            type: 'boolean',
            description: 'Whether to include spam and trash emails (default: false)'
          }
        }
      },
      capabilities: ['efficient_metadata_fetching', 'email_overview', 'quick_analysis'],
      requiresConfirmation: false,
      estimatedExecutionTime: 2000,
      examples: [
        'Get overview of 10 most recent emails',
        'Get overview of unread emails',
        'Get overview of emails from specific sender'
      ]
    });

    this.registerTool({
      name: 'get_full_email_content',
      description: 'Get complete email content including body, attachments, and headers for specific email IDs',
      parameters: {
        type: 'object',
        properties: {
          emailIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of email message IDs to fetch full content for',
            minItems: 1,
            maxItems: 5
          }
        },
        required: ['emailIds']
      },
      capabilities: ['full_content_retrieval', 'email_body_access', 'attachment_metadata'],
      requiresConfirmation: false,
      estimatedExecutionTime: 3000,
      examples: [
        'Get full content for specific email IDs',
        'Retrieve complete email body and attachments',
        'Access detailed email headers and metadata'
      ]
    });

    this.registerTool({
      name: 'analyze_email_relevance',
      description: 'Use AI to analyze which emails from an overview are relevant to a user query and need full content',
      parameters: {
        type: 'object',
        properties: {
          userQuery: {
            type: 'string',
            description: 'The original user query/request'
          },
          emailOverview: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                subject: { type: 'string' },
                from: { type: 'string' },
                date: { type: 'string' },
                snippet: { type: 'string' }
              }
            },
            description: 'Array of email overview objects to analyze'
          },
          maxRelevant: {
            type: 'number',
            description: 'Maximum number of relevant emails to select (default: 3)',
            minimum: 1,
            maximum: 10
          }
        },
        required: ['userQuery', 'emailOverview']
      },
      capabilities: ['ai_relevance_analysis', 'smart_filtering', 'content_prioritization'],
      requiresConfirmation: false,
      estimatedExecutionTime: 1500,
      examples: [
        'Analyze which emails are relevant to "latest meeting notes"',
        'Determine most important emails for summarization',
        'Filter emails based on user intent and context'
      ]
    });

    this.logger.debug('Email-specific tools registered for AI planning', {
      registeredTools: Array.from(this.toolRegistry.keys()),
      agent: this.config.name
    });
  }

  /**
   * Execute email-specific tools during AI planning
   */
  protected async executeCustomTool(toolName: string, parameters: any, context: ToolExecutionContext): Promise<any> {
    this.logger.debug(`Executing email tool: ${toolName}`, {
      toolName,
      parametersKeys: Object.keys(parameters),
      sessionId: context.sessionId
    });

    // Handle email-specific tools by calling direct handler methods (NO RECURSION)
    switch (toolName.toLowerCase()) {
      case 'emailagent':
        // Route emailAgent calls to appropriate handler based on action
        try {
          const emailParams = {
            ...parameters,
            accessToken: parameters.accessToken
          } as EmailAgentRequest;
          
          // Determine action from query using AI
          const operation = await this.detectOperation(emailParams);
          const result = await this.executeDirectEmailOperation(operation, emailParams, parameters);
          
          this.logger.info('EmailAgent tool executed successfully', {
            toolName,
            operation,
            action: result.action,
            sessionId: context.sessionId
          });
          
          return {
            success: true,
            data: result
          };
        } catch (error) {
          this.logger.error('EmailAgent tool execution failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : 'EmailAgent execution failed'
          };
        }
      
      case 'send_email':
      case 'email_send':
        // Handle send email directly
        try {
          const emailParams = {
            ...parameters,
            accessToken: parameters.accessToken
          } as EmailAgentRequest;
          
          const result = await this.handleSendEmail(emailParams, parameters);
          this.logger.info('Send email tool executed successfully', {
            toolName,
            action: result.action,
            recipient: result.recipient,
            sessionId: context.sessionId
          });
          
          return {
            success: true,
            data: result
          };
        } catch (error) {
          this.logger.error('Send email tool execution failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Send email failed'
          };
        }
        
      case 'search_emails':
        // Handle search emails directly
        try {
          const emailParams = {
            ...parameters,
            accessToken: parameters.accessToken
          } as EmailAgentRequest;
          
          const result = await this.handleSearchEmails(emailParams, parameters);
          this.logger.info('Search emails tool executed successfully', {
            toolName,
            action: result.action,
            count: result.count,
            sessionId: context.sessionId
          });
          
          return {
            success: true,
            data: result
          };
        } catch (error) {
          this.logger.error('Search emails tool execution failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search emails failed'
          };
        }

      case 'get_email_overview':
        // Handle email overview fetching
        try {
          const gmailService = getService<GmailService>('gmailService');
          if (!gmailService) {
            throw new Error('Gmail service not available');
          }

          const overview = await gmailService.getEmailOverview(parameters.accessToken, {
            maxResults: parameters.maxResults || 20,
            query: parameters.query || 'in:inbox',
            includeSpamTrash: parameters.includeSpamTrash || false
          });

          this.logger.info('Email overview fetched successfully', {
            toolName,
            emailCount: overview.length,
            sessionId: context.sessionId
          });

          return {
            success: true,
            data: overview
          };
        } catch (error) {
          this.logger.error('Get email overview failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get email overview'
          };
        }

      case 'get_full_email_content':
        // Handle full email content fetching
        try {
          const gmailService = getService<GmailService>('gmailService');
          if (!gmailService) {
            throw new Error('Gmail service not available');
          }

          const emailIds = parameters.emailIds || [];
          if (!Array.isArray(emailIds) || emailIds.length === 0) {
            throw new Error('Email IDs are required');
          }

          const fullEmails = await Promise.all(
            emailIds.slice(0, 5).map(async (emailId: string) => {
              try {
                return await gmailService.getFullMessage(parameters.accessToken, emailId);
              } catch (error) {
                this.logger.warn('Failed to get full content for email', { emailId, error });
                return null;
              }
            })
          );

          const validEmails = fullEmails.filter(email => email !== null);

          this.logger.info('Full email content fetched successfully', {
            toolName,
            requestedCount: emailIds.length,
            retrievedCount: validEmails.length,
            sessionId: context.sessionId
          });

          return {
            success: true,
            data: validEmails
          };
        } catch (error) {
          this.logger.error('Get full email content failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get full email content'
          };
        }

      case 'analyze_email_relevance':
        // Handle AI-driven email relevance analysis
        try {
          const openaiService = this.getOpenAIService();
          if (!openaiService) {
            throw new Error('OpenAI service not available for relevance analysis');
          }

          const userQuery = parameters.userQuery || '';
          const emailOverview = parameters.emailOverview || [];
          const maxRelevant = parameters.maxRelevant || 3;

          if (!Array.isArray(emailOverview) || emailOverview.length === 0) {
            return {
              success: true,
              data: {
                relevantEmails: [],
                reasoning: 'No emails provided for analysis'
              }
            };
          }

          // Create AI prompt for relevance analysis
          const analysisPrompt = `Analyze which emails are most relevant to the user's query and should have their full content retrieved.

User Query: "${userQuery}"

Available Emails:
${emailOverview.map((email: any, index: number) => 
  `${index + 1}. ID: ${email.id}
     Subject: ${email.subject}
     From: ${email.from}
     Date: ${email.date}
     Snippet: ${email.snippet}`
).join('\n\n')}

Select the ${maxRelevant} most relevant emails that would help answer the user's query. Consider:
- Recency for "latest" requests
- Subject matter relevance
- Sender importance
- Content hints from snippets

Return JSON with:
{
  "relevantEmailIds": ["id1", "id2", ...],
  "reasoning": "explanation of selection criteria and why these emails are relevant"
}`;

          const response = await openaiService.generateStructuredData<{
            relevantEmailIds: string[];
            reasoning: string;
          }>(
            userQuery,
            analysisPrompt,
            {
              type: 'object',
              properties: {
                relevantEmailIds: {
                  type: 'array',
                  items: { type: 'string' },
                  maxItems: maxRelevant
                },
                reasoning: { type: 'string' }
              },
              required: ['relevantEmailIds', 'reasoning']
            },
            { temperature: 0.3, maxTokens: 500 }
          );

          this.logger.info('Email relevance analysis completed', {
            toolName,
            userQuery,
            totalEmails: emailOverview.length,
            selectedEmails: response.relevantEmailIds.length,
            sessionId: context.sessionId
          });

          return {
            success: true,
            data: {
              relevantEmailIds: response.relevantEmailIds,
              reasoning: response.reasoning,
              totalAnalyzed: emailOverview.length
            }
          };
        } catch (error) {
          this.logger.error('Email relevance analysis failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to analyze email relevance'
          };
        }

      case 'think':
        // Handle thinking/analysis steps
        return {
          success: true,
          analysis: 'Email operation analyzed',
          reasoning: parameters.query || 'Email planning step'
        };

      default:
        // Call parent implementation for unknown tools
        return super.executeCustomTool(toolName, parameters, context);
    }
  }

  /**
   * Execute email operation directly based on detected operation (prevents recursion)
   */
  private async executeDirectEmailOperation(operation: string, params: EmailAgentRequest, actionParams: any): Promise<EmailResult> {
    this.logger.debug('Executing direct email operation', {
      operation,
      hasAccessToken: !!params.accessToken,
      sessionId: actionParams.sessionId
    });

    switch (operation) {
      case 'send':
      case 'compose':
      case 'write':
        return await this.handleSendEmail(params, actionParams);
        
      case 'reply':
        return await this.handleReplyEmail(params, actionParams);
        
      case 'search':
      case 'find':
      case 'get':
        return await this.handleSearchEmails(params, actionParams);
        
      case 'draft':
        return await this.handleCreateDraft(params, actionParams);
        
      default:
        // Default to send for ambiguous cases
        this.logger.debug('Ambiguous operation, defaulting to send', { 
          operation, 
          query: params.query?.substring(0, 100) 
        });
        return await this.handleSendEmail(params, actionParams);
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
   * Build final result from AI planning execution
   */
  protected buildFinalResult(
    summary: any,
    successfulResults: any[],
    failedResults: any[],
    params: EmailAgentRequest,
    _context: ToolExecutionContext
  ): EmailResult {
    this.logger.debug('Building final result from AI planning', {
      successfulResultsCount: successfulResults.length,
      failedResultsCount: failedResults.length,
      planId: summary?.planId,
      sessionId: _context.sessionId
    });

    // For email operations, we typically want the first successful result
    if (successfulResults.length > 0) {
      const firstResult = successfulResults[0];
      
      // If the result has email-specific data, use it directly
      if (firstResult && typeof firstResult === 'object' && 'action' in firstResult) {
        this.logger.info('Using successful AI planning result', {
          action: firstResult.action,
          hasMessageId: !!firstResult.messageId,
          sessionId: _context.sessionId
        });
        return firstResult as EmailResult;
      }
      
      // If it's a nested result from executeCustomTool
      if (firstResult && firstResult.data && typeof firstResult.data === 'object' && 'action' in firstResult.data) {
        this.logger.info('Using nested successful AI planning result', {
          action: firstResult.data.action,
          hasMessageId: !!firstResult.data.messageId,
          sessionId: _context.sessionId
        });
        return firstResult.data as EmailResult;
      }
      
      // Fallback - try to extract meaningful data
      return firstResult as EmailResult;
    }

    // If no successful results, create an error result (not placeholder data)
    this.logger.warn('No successful results from AI planning, creating error result', {
      failedCount: failedResults.length,
      planId: summary?.planId,
      sessionId: _context.sessionId
    });
    
    return {
      action: 'send', // Use the intended action based on params
      count: 0,
      messageId: undefined,
      threadId: undefined,
      // Add error information
      error: failedResults.length > 0 ? 
        `Plan execution failed: ${failedResults[0]?.error || 'Unknown error'}` : 
        'No results from AI planning execution'
    } as EmailResult;
  }
  /**
   * Create user-friendly error messages for email operations
   */
  protected createUserFriendlyErrorMessage(error: Error, params: EmailAgentRequest): string {
    const errorCode = (error as any).code;
    
    switch (errorCode) {
      case 'MISSING_ACCESS_TOKEN':
        return 'I need access to your Gmail account to send emails. Please check your Google authentication settings.';
      
      case 'INVALID_ACCESS_TOKEN':
        return 'Your Gmail access has expired. Please re-authenticate with Google to continue.';
      
      case 'INVALID_EMAIL_REQUEST':
        return 'I need more information to send this email. Please provide the recipient, subject, and message content.';
      
      case 'INVALID_REPLY_REQUEST':
        return 'I need the email thread information to reply. Please specify which email you want to reply to.';
      
      case 'SERVICE_UNAVAILABLE':
        return 'Gmail service is temporarily unavailable. Please try again in a few moments.';
      
      case 'TIMEOUT':
        return 'Email operation is taking longer than expected. Please try again with a simpler request.';
      
      default:
        return super.createUserFriendlyErrorMessage(error, params);
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

  // Operation detection now uses AI-powered base implementation
  // No more string matching overrides

  /**
   * Generate detailed email action preview with risk assessment
   */
  protected async generatePreview(params: EmailAgentRequest, context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    try {
      const { query } = params;
      
      // Use AI-powered operation detection
      const operation = await this.detectOperation(params);
      
      // Check if this operation actually needs confirmation
      const needsConfirmation = this.operationRequiresConfirmation(operation);
      
      if (!needsConfirmation) {
        this.logger.info('Email operation does not require confirmation', {
          operation,
          reason: await this.getOperationConfirmationReason(operation)
        });
        return {
          success: true,
          fallbackMessage: `${operation} operation does not require confirmation`
        };
      }
      
      // Determine action type from query for preview generation
      const action = await this.determineAction(query);
      
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
          riskAssessment = await this.assessEmailRisk(emailRequest, previewData);
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
          riskAssessment = await this.assessEmailRisk(emailRequest, previewData);
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
  private async assessEmailRisk(emailRequest: SendEmailRequest, previewData: EmailPreviewData): Promise<ActionRiskAssessment> {
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
    
    // Check for sensitive content using AI
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (aiClassificationService) {
        const emailContent = `${emailRequest.subject || ''} ${emailRequest.body || ''}`;
        const priority = await aiClassificationService.classifyEmailPriority(emailContent);
        
        if (priority === 'urgent') {
          factors.push('Contains sensitive keywords');
          if (level === 'low') level = 'medium';
        }
      }
    } catch (error) {
      this.logger.warn('Failed to classify email priority for risk assessment:', error);
      // Continue without AI classification
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

    // Use retry mechanism from AIAgent for reliability
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
   * Determine the action type from user query using AI instead of string matching
   */
  private async determineAction(query: string): Promise<{ type: string; params: any }> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        throw new Error('AI Classification Service is not available. AI email operation detection is required for this operation.');
      }

      const operation = await aiClassificationService.detectOperation(query, 'emailAgent');
      
      // Convert AI result to expected format
      switch (operation) {
        case 'write':
          // Determine if it's send, reply, or draft based on context
          if (query.toLowerCase().includes('reply') || query.toLowerCase().includes('respond')) {
            return {
              type: 'REPLY_EMAIL',
              params: this.extractReplyParams(query)
            };
          } else if (query.toLowerCase().includes('draft')) {
            return {
              type: 'CREATE_DRAFT',
              params: this.extractSendEmailParams(query)
            };
          } else {
            return {
              type: 'SEND_EMAIL',
              params: this.extractSendEmailParams(query)
            };
          }
        case 'read':
          if (query.toLowerCase().includes('thread') || query.toLowerCase().includes('conversation')) {
            return {
              type: 'GET_THREAD',
              params: this.extractGetThreadParams(query)
            };
          } else if (query.toLowerCase().includes('get email') || query.toLowerCase().includes('show email')) {
            return {
              type: 'GET_EMAIL',
              params: this.extractGetEmailParams(query)
            };
          } else {
            return {
              type: 'SEARCH_EMAILS',
              params: this.extractSearchParams(query)
            };
          }
        case 'search':
          return {
            type: 'SEARCH_EMAILS',
            params: this.extractSearchParams(query)
          };
        default:
          // Default to search for unknown operations
          return {
            type: 'SEARCH_EMAILS',
            params: { query: query }
          };
      }
    } catch (error) {
      this.logger.error('Failed to determine email action with AI:', error);
      throw new Error('AI email operation detection failed. Please check your OpenAI configuration.');
    }
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