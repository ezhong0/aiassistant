import { AIAgent } from '../framework/ai-agent';
import { ToolExecutionContext, SlackAgentParams } from '../types/tools';
import { PreviewGenerationResult } from '../types/api.types';
import { resolveSlackService } from '../services/service-resolver';
import { getService } from '../services/service-manager';
import { SlackInterfaceService } from '../services/slack-interface.service';
import { SlackMessageReaderService } from '../services/slack-message-reader.service';
import { SlackContext, SlackMessageEvent, SlackResponse, SlackBlock } from '../types/slack.types';
import { SlackMessage as ReaderSlackMessage, SlackMessageReaderError, SlackAttachment } from '../types/slack-message-reader.types';
import { AIClassificationService } from '../services/ai-classification.service';
import { SLACK_CONSTANTS } from '../config/constants';
import {
  ToolParameters,
  ToolExecutionResult,
  AgentExecutionSummary
} from '../types/agent-parameters';
import {
  SlackReadMessagesParams,
  SlackMessageSummary,
  SlackReadResult
} from '../types/agent-specific-parameters';

/**
 * Slack message data structure
 */
export interface SlackMessage {
  id: string;
  text: string;
  userId: string;
  channelId: string;
  timestamp: string;
  threadTs?: string | undefined;
  isBot: boolean;
  attachments?: Array<Record<string, unknown> | SlackAttachment> | undefined;
  blocks?: SlackBlock[] | undefined;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
    [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
  }> | undefined;
}

/**
 * Slack conversation thread data
 */
export interface SlackThread {
  channelId: string;
  threadTs: string;
  messages: SlackMessage[];
  participantCount: number;
  lastActivity: string;
  isActive: boolean;
}

/**
 * Slack draft message data
 */
export interface SlackDraft {
  id: string;
  channelId: string;
  threadTs?: string | undefined;
  content: string;
  attachments?: any[] | undefined;
  blocks?: any[] | undefined;
  createdAt: string;
  updatedAt: string;
  isPendingConfirmation: boolean;
  confirmationId?: string | undefined;
}

/**
 * Slack agent operation result
 */
export interface SlackAgentResult {
  messages: SlackMessage[];
  threads: SlackThread[];
  drafts: SlackDraft[];
  operation: 'read_messages' | 'read_thread' | 'detect_drafts' | 'manage_drafts' | 'confirmation_handling';
  totalCount: number;
  channelId?: string | undefined;
  threadTs?: string | undefined;
  searchTerm?: string | undefined;
  confirmationStatus?: 'pending' | 'confirmed' | 'rejected' | 'expired' | undefined;
}

/**
 * Slack agent parameters with access token
 */
export interface SlackAgentRequest extends SlackAgentParams {
  accessToken: string;
  operation?: 'read_messages' | 'read_thread' | 'detect_drafts' | 'manage_drafts' | 'confirmation_handling' | undefined;
  channelId?: string | undefined;
  threadTs?: string | undefined;
  limit?: number | undefined;
  includeReactions?: boolean | undefined;
  includeAttachments?: boolean | undefined;
}

/**
 * Enhanced SlackAgent using AIAgent framework
 * Handles Slack message reading, draft management, and confirmation handling using AI planning
 */
export class SlackAgent extends AIAgent<SlackAgentRequest, SlackAgentResult> {

  constructor() {
    super({
      name: 'slackAgent',
      description: 'Read Slack message history, manage drafts, and handle confirmations',
      enabled: true,
      timeout: 15000,
      retryCount: 2,
      aiPlanning: {
        enableAIPlanning: true,
        maxPlanningSteps: 5,
        planningTimeout: 10000,
        cachePlans: true,
        planningTemperature: 0.1,
        planningMaxTokens: 1500
      }
    });
  }

  private readonly systemPrompt = `# Slack Agent - Intelligent Workspace Communication
You are a specialized Slack workspace management agent focused on reading and understanding conversations.

## Core Personality
- Respectful of workspace culture and communication norms
- Efficient with team communication understanding
- Context-aware for thread management and conversation flow
- Professional but appropriately casual for Slack environment
- Helpful in organizing and interpreting team communications
- Mindful of workspace hierarchy and permissions

## Capabilities
- Read and analyze Slack conversations intelligently
- Understand thread context and conversation relationships
- Respect channel purposes and target audiences
- Manage draft messages and scheduling considerations
- Navigate workspace hierarchy and permission structures
- Detect and manage confirmation workflows and pending actions
- Provide conversation summaries and context extraction

## Slack Communication Intelligence
- Respect channel purposes and intended audiences
- Use threads appropriately to avoid cluttering main channels
- Consider timezone and working hours for communication context
- Maintain appropriate tone for specific workspace culture
- Suggest optimal communication channels for different content types
- Understand urgency levels and appropriate response expectations
- Recognize formal vs informal communication patterns

## Conversation Context & Analysis
- Extract key information from message histories accurately
- Understand conversation threads and participant relationships
- Identify action items, decisions, and follow-up requirements
- Recognize sentiment and communication patterns
- Provide relevant context for ongoing conversations
- Summarize key points from long conversation threads
- Identify mentions, reactions, and engagement patterns

## Workspace Etiquette & Best Practices
- Respect privacy and confidentiality of workspace communications
- Understand different channel types (public, private, DM) and their purposes
- Recognize appropriate times for interruptions vs asynchronous communication
- Consider cultural norms around response times and availability
- Respect "do not disturb" settings and offline status indicators
- Understand escalation paths for urgent vs routine communications

## Error Handling & User Experience
- Clear guidance for permission-related issues with helpful alternatives
- Suggestions for alternative communication methods when primary approach fails
- Respectful handling of private/restricted channels with appropriate explanations
- Context-aware error recovery for failed operations
- Progressive disclosure: start simple, provide details when requested
- Acknowledge limitations while providing practical workarounds

## Privacy & Security Standards
- Never expose private conversation content inappropriately
- Respect channel privacy settings and access controls
- Maintain confidentiality of team communications and sensitive information
- Provide clear explanations when access is restricted
- Suggest appropriate ways to request access or information when needed`;

  /**
   * Get system prompt for AI planning
   */
  protected getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Generate OpenAI function calling schema for this agent
   */
  static getOpenAIFunctionSchema(): any {
    return {
      name: 'slack_operations',
      description: 'Read Slack message history, detect drafts, and manage confirmation workflows. Use this to understand conversation context and manage pending actions.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The Slack operation request in natural language (e.g., "Read recent messages", "Check for drafts", "Show conversation history")'
          },
          operation: {
            type: 'string',
            description: 'The type of operation to perform',
            enum: ['read_messages', 'read_thread', 'detect_drafts', 'manage_drafts', 'confirmation_handling'],
            nullable: true
          },
          channelId: {
            type: 'string',
            description: 'Specific channel ID to read messages from',
            nullable: true
          },
          threadTs: {
            type: 'string',
            description: 'Specific thread timestamp to read messages from',
            nullable: true
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to retrieve',
            nullable: true
          },
          includeReactions: {
            type: 'boolean',
            description: 'Whether to include message reactions',
            nullable: true
          },
          includeAttachments: {
            type: 'boolean',
            description: 'Whether to include message attachments',
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
      'Read Slack message history from channels and threads',
      'Detect and manage draft messages',
      'Handle confirmation workflows for pending actions',
      'Parse conversation context and extract key information',
      'Support thread-based conversation tracking',
      'Manage message reactions and attachments',
      'Provide conversation summaries and highlights'
    ];
  }

  /**
   * Get agent specialties for capability-based routing
   */
  static getSpecialties(): string[] {
    return [
      'Slack conversation analysis',
      'Thread tracking and management',
      'Draft message detection',
      'Context-aware message reading',
      'Conversation intelligence',
      'Workflow confirmation handling'
    ];
  }

  /**
   * Get agent description for AI routing
   */
  static getDescription(): string {
    return 'Specialized agent for Slack message operations including reading conversations, detecting drafts, and analyzing thread context with AI-powered insights.';
  }

  /**
   * Get agent limitations for OpenAI function calling
   */
  static getLimitations(): string[] {
    return [
      'Requires Slack bot token and proper permissions',
      'Limited to channels the bot has access to',
      'Cannot send messages (read-only operations)',
      'Draft detection depends on message metadata',
      'Confirmation handling requires proper workflow setup',
      'Message history limited by Slack API constraints'
    ];
  }

  /**
   * Register Slack-specific tools for AI planning
   */
  protected registerDefaultTools(): void {
    // Call parent to register base tools like 'think'
    super.registerDefaultTools();

    // Register Slack-specific AI planning tools
    this.registerTool({
      name: 'read_slack_messages',
      description: 'Read recent messages from Slack channels or DMs',
      parameters: {
        type: 'object',
        properties: {
          channelId: {
            type: 'string',
            description: 'Specific channel ID to read from (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to retrieve (default: 50)',
            minimum: 1,
            maximum: 200
          },
          includeReactions: {
            type: 'boolean',
            description: 'Whether to include message reactions (default: false)'
          }
        }
      },
      capabilities: ['message_reading', 'channel_access', 'conversation_context'],
      requiresConfirmation: false,
      estimatedExecutionTime: 3000,
      examples: [
        'Read recent messages from #general channel',
        'Get last 20 messages from current conversation',
        'Read messages with reactions included'
      ]
    });

    this.registerTool({
      name: 'read_slack_thread',
      description: 'Read a specific conversation thread from Slack',
      parameters: {
        type: 'object',
        properties: {
          channelId: {
            type: 'string',
            description: 'Channel ID where the thread exists'
          },
          threadTs: {
            type: 'string',
            description: 'Thread timestamp identifier'
          },
          includeReactions: {
            type: 'boolean',
            description: 'Whether to include message reactions (default: false)'
          }
        },
        required: ['channelId', 'threadTs']
      },
      capabilities: ['thread_reading', 'conversation_tracking', 'context_analysis'],
      requiresConfirmation: false,
      estimatedExecutionTime: 2000,
      examples: [
        'Read specific thread conversation',
        'Get thread replies and context',
        'Follow conversation thread history'
      ]
    });

    this.registerTool({
      name: 'detect_slack_drafts',
      description: 'Detect and find pending/unsent draft messages in Slack',
      parameters: {
        type: 'object',
        properties: {
          channelId: {
            type: 'string',
            description: 'Specific channel to check for drafts (optional)'
          },
          includeAll: {
            type: 'boolean',
            description: 'Whether to include all draft types (default: true)'
          }
        }
      },
      capabilities: ['draft_detection', 'pending_message_management', 'workflow_tracking'],
      requiresConfirmation: false,
      estimatedExecutionTime: 2500,
      examples: [
        'Find all pending draft messages',
        'Check for unsent messages in specific channel',
        'Detect pending confirmations'
      ]
    });

    this.registerTool({
      name: 'analyze_slack_context',
      description: 'Analyze Slack conversation context and extract relevant information',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to analyze or extract from the Slack context'
          },
          messages: {
            type: 'array',
            items: { type: 'object' },
            description: 'Messages to analyze (from previous tool calls)'
          },
          focusArea: {
            type: 'string',
            description: 'Specific area to focus analysis on',
            enum: ['sentiment', 'topics', 'action_items', 'participants', 'timeline']
          }
        },
        required: ['query']
      },
      capabilities: ['context_analysis', 'conversation_intelligence', 'information_extraction'],
      requiresConfirmation: false,
      estimatedExecutionTime: 1500,
      examples: [
        'Analyze conversation sentiment and tone',
        'Extract action items from thread',
        'Identify key participants and topics'
      ]
    });

    this.logger.debug('Slack-specific tools registered for AI planning', {
      registeredTools: Array.from(this.toolRegistry.keys()),
      agent: this.config.name
    });
  }

  /**
   * Generate preview for Slack operations (read-only, no confirmation needed)
   */
  protected async generatePreview(params: SlackAgentRequest, _context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    return {
      success: true,
      fallbackMessage: 'Slack operations are read-only and do not require confirmation'
    };
  }

  /**
   * Execute Slack-specific tools during AI planning
   */
  protected async executeCustomTool(toolName: string, parameters: ToolParameters, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    this.logger.debug(`Executing Slack tool: ${toolName}`, {
      toolName,
      parametersKeys: Object.keys(parameters),
      sessionId: context.sessionId
    });

    // Handle Slack-specific tools
    switch (toolName.toLowerCase()) {
      case 'slackagent':
      case 'slack_operations':
      case 'slack_read':
        // Execute Slack operations directly using AI planning
        try {
          const slackParams = {
            ...parameters,
            accessToken: parameters.accessToken
          } as SlackAgentRequest;
          
          // Execute the Slack operation using AI planning
          const result = await this.executeWithAIPlanning(slackParams, context);
          this.logger.info('Slack tool executed successfully in AI plan', {
            toolName,
            operation: result.operation,
            messagesFound: result.totalCount,
            sessionId: context.sessionId
          });
          
          return {
            success: true,
            data: result
          };
        } catch (error) {
          this.logger.error('Slack tool execution failed in AI plan', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Slack tool execution failed'
          };
        }

      case 'read_slack_messages':
        // Handle reading Slack messages
        try {
          const slackParams = {
            ...parameters,
            accessToken: parameters.accessToken,
            operation: 'read_messages'
          } as SlackAgentRequest;
          
          const result = await this.handleReadMessages(slackParams);
          this.logger.info('Read Slack messages executed successfully', {
            toolName,
            messagesCount: result.totalCount,
            sessionId: context.sessionId
          });
          
          return {
            success: true,
            data: result
          };
        } catch (error) {
          this.logger.error('Read Slack messages failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read Slack messages'
          };
        }

      case 'read_slack_thread':
        // Handle reading specific Slack thread
        try {
          const slackParams = {
            ...parameters,
            accessToken: parameters.accessToken,
            operation: 'read_thread'
          } as SlackAgentRequest;
          
          const result = await this.handleReadThread(slackParams);
          this.logger.info('Read Slack thread executed successfully', {
            toolName,
            threadMessages: result.totalCount,
            sessionId: context.sessionId
          });
          
          return {
            success: true,
            data: result
          };
        } catch (error) {
          this.logger.error('Read Slack thread failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read Slack thread'
          };
        }

      case 'detect_slack_drafts':
        // Handle detecting Slack drafts
        try {
          const slackParams = {
            ...parameters,
            accessToken: parameters.accessToken,
            operation: 'detect_drafts'
          } as SlackAgentRequest;
          
          const result = await this.handleDetectDrafts(slackParams);
          this.logger.info('Detect Slack drafts executed successfully', {
            toolName,
            draftsCount: result.drafts.length,
            sessionId: context.sessionId
          });
          
          return {
            success: true,
            data: result
          };
        } catch (error) {
          this.logger.error('Detect Slack drafts failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to detect Slack drafts'
          };
        }

      case 'analyze_slack_context':
        // Handle analyzing Slack context using AI
        try {
          const openaiService = this.getOpenAIService();
          if (!openaiService) {
            throw new Error('OpenAI service not available for context analysis');
          }

          const query = parameters.query || 'Analyze the conversation context';
          const messages = parameters.messages || [];
          const focusArea = parameters.focusArea || 'general';

          if (!Array.isArray(messages) || messages.length === 0) {
            return {
              success: true,
              data: {
                analysis: 'No messages provided for analysis',
                focusArea,
                insights: []
              }
            };
          }

          // Create AI prompt for context analysis
          const analysisPrompt = `Analyze the following Slack conversation context and provide insights.

Query: "${query}"
Focus Area: ${focusArea}

Messages:
${messages.map((msg: SlackMessage, index: number) => 
  `${index + 1}. ${msg.userId || 'Unknown'}: ${msg.text || 'No text'}`
).join('\n')}

Based on the focus area "${focusArea}", provide analysis in the following areas:
- Key topics and themes
- Participant sentiment and engagement
- Important information or action items
- Context and conversation flow
- Relevant insights for the user's query

Provide a clear, structured analysis.`;

          const analysis = await openaiService.generateText(
            analysisPrompt,
            'Analyze Slack conversation context and extract insights',
            { temperature: 0.3, maxTokens: 800 }
          );

          this.logger.info('Slack context analysis completed', {
            toolName,
            messagesAnalyzed: messages.length,
            focusArea,
            sessionId: context.sessionId
          });

          return {
            success: true,
            data: {
              analysis: analysis.trim(),
              focusArea,
              messagesAnalyzed: messages.length,
              query
            }
          };
        } catch (error) {
          this.logger.error('Slack context analysis failed', {
            toolName,
            error: error instanceof Error ? error.message : error,
            sessionId: context.sessionId
          });

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to analyze Slack context'
          };
        }

      default:
        // Call parent implementation for unknown tools
        return super.executeCustomTool(toolName, parameters, context);
    }
  }

  /**
   * Enhanced parameter validation for Slack operations
   */
  protected validateParams(params: SlackAgentRequest): void {
    super.validateParams(params);
    
    if (!params.accessToken || typeof params.accessToken !== 'string') {
      throw this.createError('Access token is required for Slack operations', 'MISSING_ACCESS_TOKEN');
    }
    
    if (params.query && params.query.length > SLACK_CONSTANTS.MAX_QUERY_LENGTH) {
      throw this.createError('Query is too long for Slack search', 'QUERY_TOO_LONG');
    }

    if (params.limit && (params.limit < 1 || params.limit > SLACK_CONSTANTS.MAX_MESSAGE_LIMIT)) {
      throw this.createError(`Message limit must be between 1 and ${SLACK_CONSTANTS.MAX_MESSAGE_LIMIT}`, 'INVALID_LIMIT');
    }
  }

  /**
   * Create user-friendly error messages for Slack operations
   */
  protected createUserFriendlyErrorMessage(error: Error, params: SlackAgentRequest): string {
    const errorCode = (error as any).code;
    
    switch (errorCode) {
      case 'MISSING_ACCESS_TOKEN':
        return 'I need access to your Slack workspace to read messages. Please check your Slack authentication settings.';
      
      case 'QUERY_TOO_LONG':
        return 'Your search query is too long. Please try a shorter search term.';
      
      case 'INVALID_LIMIT':
        return 'The message limit you specified is invalid. Please use a number between 1 and 100.';
      
      case 'SERVICE_UNAVAILABLE':
        return 'Slack service is temporarily unavailable. Please try again in a few moments.';
      
      case 'NOT_IMPLEMENTED':
        return 'This Slack operation is not yet available. Please try reading messages instead.';
      
      default:
        return super.createUserFriendlyErrorMessage(error, params);
    }
  }

  /**
   * Build final result from AI planning execution
   */
  protected buildFinalResult(
    summary: AgentExecutionSummary,
    successfulResults: ToolExecutionResult[],
    failedResults: ToolExecutionResult[],
    params: SlackAgentRequest,
    _context: ToolExecutionContext
  ): SlackAgentResult {
    // For Slack operations, we typically want the first successful result
    if (successfulResults.length > 0) {
      const firstResult = successfulResults[0];
      if (firstResult && firstResult.result && typeof firstResult.result === 'object') {
        return firstResult.result as SlackAgentResult;
      }
    }

    // If no successful results, create a summary result
    return {
      messages: [],
      threads: [],
      drafts: [],
      operation: 'read_messages',
      totalCount: 0,
      channelId: params.channelId,
      threadTs: params.threadTs,
      searchTerm: params.query
    };
  }
  
  /**
   * Pre-execution hook - validate Slack access
   */
  protected async beforeExecution(params: SlackAgentRequest, context: ToolExecutionContext): Promise<void> {
    await super.beforeExecution(params, context);
    
    // Log Slack operation start
    this.logger.debug('Slack access validated', { 
      sessionId: context.sessionId,
      operation: params.operation || 'read_messages',
      hasChannelId: !!params.channelId,
      hasThreadTs: !!params.threadTs
    });
  }
  
  /**
   * Post-execution hook - log Slack metrics
   */
  protected async afterExecution(result: SlackAgentResult, context: ToolExecutionContext): Promise<void> {
    await super.afterExecution(result, context);
    
    // Log Slack operation metrics
    this.logger.info('Slack operation completed', {
      operation: result.operation,
      messagesFound: result.totalCount,
      threadsFound: result.threads.length,
      draftsFound: result.drafts.length,
      channelId: result.channelId,
      sessionId: context.sessionId
    });
  }
  
  /**
   * Sanitize sensitive data from logs
   */
  protected sanitizeForLogging(params: SlackAgentRequest): any {
    return {
      query: params.query?.substring(0, 100) + (params.query?.length > 100 ? '...' : ''),
      accessToken: '[REDACTED]',
      operation: params.operation,
      channelId: params.channelId,
      threadTs: params.threadTs,
      limit: params.limit,
      includeReactions: params.includeReactions,
      includeAttachments: params.includeAttachments
    };
  }
  
  // PRIVATE IMPLEMENTATION METHODS
  
  /**
   * Handle message reading operations
   */
  private async handleReadMessages(params: SlackAgentRequest): Promise<SlackAgentResult> {
    // Extract search parameters from query
    const searchParams = this.extractSearchParameters(params.query);
    
    // Use retry mechanism from AIAgent for reliability
    const messages = await this.withRetries(async () => {
      // If there's a search term, use search functionality
      if (searchParams.searchTerm && searchParams.searchTerm.trim().length > 0) {
        return await this.searchMessages(
          searchParams.searchTerm,
          params.channelId || searchParams.channelId || undefined,
          params.limit || SLACK_CONSTANTS.DEFAULT_MESSAGE_LIMIT
        );
      } else {
        // Otherwise, read recent messages
        return await this.readChannelMessages(
          params.channelId || searchParams.channelId || 'C123456789', // Default channel ID
          params.limit || SLACK_CONSTANTS.DEFAULT_MESSAGE_LIMIT,
          params.includeReactions,
          params.includeAttachments
        );
      }
    });

    this.logger.info('Message reading completed successfully', {
      query: searchParams.searchTerm,
      messagesFound: messages.length,
      channelId: params.channelId,
      operation: searchParams.searchTerm ? 'search_messages' : 'read_messages'
    });

    return {
      messages,
      threads: [],
      drafts: [],
      operation: 'read_messages',
      totalCount: messages.length,
      channelId: params.channelId,
      searchTerm: searchParams.searchTerm
    };
  }
  
  /**
   * Handle thread reading operations
   */
  private async handleReadThread(params: SlackAgentRequest): Promise<SlackAgentResult> {
    if (!params.threadTs) {
      throw this.createError('Thread timestamp is required for thread reading', 'MISSING_THREAD_TS');
    }

    const messages = await this.withRetries(async () => {
      return await this.readThreadMessages(
        params.channelId!,
        params.threadTs!,
        params.limit || SLACK_CONSTANTS.DEFAULT_MESSAGE_LIMIT,
        params.includeReactions,
        params.includeAttachments
      );
    });

    const thread: SlackThread = {
      channelId: params.channelId!,
      threadTs: params.threadTs!,
      messages,
      participantCount: new Set(messages.map(m => m.userId)).size,
      lastActivity: messages[messages.length - 1]?.timestamp || '',
      isActive: true
    };

    this.logger.info('Thread reading completed successfully', {
      threadTs: params.threadTs,
      messagesFound: messages.length,
      participants: thread.participantCount
    });

    return {
      messages,
      threads: [thread],
      drafts: [],
      operation: 'read_thread',
      totalCount: messages.length,
      channelId: params.channelId,
      threadTs: params.threadTs
    };
  }
  
  /**
   * Handle draft detection operations
   */
  private async handleDetectDrafts(params: SlackAgentRequest): Promise<SlackAgentResult> {
    const drafts = await this.withRetries(async () => {
      return await this.detectDraftMessages(params.channelId);
    });

    this.logger.info('Draft detection completed successfully', {
      draftsFound: drafts.length,
      channelId: params.channelId
    });

    return {
      messages: [],
      threads: [],
      drafts,
      operation: 'detect_drafts',
      totalCount: drafts.length,
      channelId: params.channelId
    };
  }
  
  /**
   * Handle draft management operations
   */
  private async handleManageDrafts(params: SlackAgentRequest): Promise<SlackAgentResult> {
    this.logger.info('Draft management requested (not implemented)', { query: params.query });
    
    throw this.createError(
      'Draft management not yet implemented. This requires additional Slack API permissions.',
      'NOT_IMPLEMENTED'
    );
  }
  
  /**
   * Handle confirmation workflow operations
   */
  private async handleConfirmationHandling(params: SlackAgentRequest): Promise<SlackAgentResult> {
    const confirmationStatus = await this.withRetries(async () => {
      return await this.checkConfirmationStatus(params.channelId, params.threadTs);
    });

    this.logger.info('Confirmation handling completed successfully', {
      confirmationStatus,
      channelId: params.channelId,
      threadTs: params.threadTs
    });

    return {
      messages: [],
      threads: [],
      drafts: [],
      operation: 'confirmation_handling',
      totalCount: 0,
      channelId: params.channelId,
      threadTs: params.threadTs,
      confirmationStatus
    };
  }
  
  /**
   * Determine operation type from query using AI instead of string matching
   */
  private async determineOperation(query: string): Promise<'read_messages' | 'read_thread' | 'detect_drafts' | 'manage_drafts' | 'confirmation_handling'> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        throw new Error('AI Classification Service is not available. AI Slack operation detection is required for this operation.');
      }

      // Direct AI-driven intent classification - no more string matching!
      const intent = await aiClassificationService.classifySlackIntent(query);
      
      this.logger.debug('Slack intent classified by AI', { 
        query: query.substring(0, 100), 
        intent 
      });
      
      // Map AI intent to expected operation types (if needed for compatibility)
      switch (intent) {
        case 'read_messages':
        case 'read_thread':
        case 'detect_drafts':
        case 'manage_drafts':
          return intent;
        case 'send_message':
          return 'manage_drafts'; // Sending falls under draft management for this agent
        case 'search_messages':
          return 'read_messages'; // Search falls under reading for this agent
        default:
          return 'read_messages';
      }
    } catch (error) {
      this.logger.error('Failed to determine Slack operation with AI:', error);
      throw new Error('AI Slack operation detection failed. Please check your OpenAI configuration.');
    }
  }
  
  /**
   * Extract search parameters from natural language query
   */
  private extractSearchParameters(query: string): {
    searchTerm: string;
    channelId?: string;
    limit?: number;
  } {
    // Remove common search phrases to extract the actual search term
    const cleanedQuery = query
      .replace(/^(read|get|show|find|search|look for|check)\s+/i, '')
      .replace(/\s+(messages?|history|conversation|thread|drafts?)$/i, '')
      .trim();
    
    // Look for channel mentions
    let channelId: string | undefined;
    const channelMatch = query.match(/<#([C][A-Z0-9]+)\|([^>]+)>/);
    if (channelMatch && channelMatch[1]) {
      channelId = channelMatch[1];
    }
    
    // Look for result limit requests
    let limit: number | undefined;
    const limitMatch = query.match(/(?:first|last|limit)\s+(\d+)/i);
    if (limitMatch && limitMatch[1]) {
      limit = Math.min(parseInt(limitMatch[1]), SLACK_CONSTANTS.MAX_MESSAGE_LIMIT);
    }

    return {
      searchTerm: cleanedQuery || query,
      channelId: channelId || undefined,
      limit: limit || undefined
    };
  }

  /**
   * Read messages from a Slack channel
   */
  private async readChannelMessages(
    channelId: string,
    limit: number,
    includeReactions?: boolean,
    includeAttachments?: boolean
  ): Promise<SlackMessage[]> {
    const slackMessageReaderService = await resolveSlackService();
    if (!slackMessageReaderService) {
      throw new Error('SlackMessageReaderService not available');
    }

    try {
      // Use SlackMessageReaderService to read messages
      const readerMessages = await slackMessageReaderService.readMessageHistory(channelId, {
        limit,
        filter: {
          excludeBotMessages: false, // Include all messages for now
          excludeSystemMessages: false,
          excludeSensitiveContent: false // Let the service handle redaction
        }
      });

      // Convert ReaderSlackMessage to SlackMessage format
      const messages: SlackMessage[] = readerMessages.map((msg: any) => ({
        id: msg.id,
        text: msg.text,
        userId: msg.userId,
        channelId: msg.channelId,
        timestamp: msg.timestamp.toISOString(),
        threadTs: msg.threadTs || undefined,
        isBot: !!msg.botId,
        attachments: includeAttachments ? msg.attachments : undefined,
        reactions: includeReactions ? msg.reactions : undefined,
        blocks: undefined // Not available in reader service yet
      }));

      this.logger.info('Successfully read messages from Slack channel', {
        channelId,
        messageCount: messages.length,
        limit,
        includeReactions,
        includeAttachments
      });

      return messages;

    } catch (error) {
      this.logger.error('Failed to read messages from Slack channel', {
        channelId,
        limit,
        error: error instanceof Error ? error.message : error
      });

      if (error instanceof SlackMessageReaderError) {
        throw new Error(`Slack message reading failed: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Read messages from a specific thread
   */
  private async readThreadMessages(
    channelId: string,
    threadTs: string,
    limit: number,
    includeReactions?: boolean,
    includeAttachments?: boolean
  ): Promise<SlackMessage[]> {
    const slackMessageReaderService = await resolveSlackService();
    if (!slackMessageReaderService) {
      throw new Error('SlackMessageReaderService not available');
    }

    try {
      // Use SlackMessageReaderService to read thread messages
      const readerMessages = await slackMessageReaderService.readThreadMessages(channelId, threadTs, {
        limit,
        filter: {
          excludeBotMessages: false,
          excludeSystemMessages: false,
          excludeSensitiveContent: false
        }
      });

      // Convert ReaderSlackMessage to SlackMessage format
      const messages: SlackMessage[] = readerMessages.map((msg: any) => ({
        id: msg.id,
        text: msg.text,
        userId: msg.userId,
        channelId: msg.channelId,
        timestamp: msg.timestamp.toISOString(),
        threadTs: msg.threadTs || undefined,
        isBot: !!msg.botId,
        attachments: includeAttachments ? msg.attachments : undefined,
        reactions: includeReactions ? msg.reactions : undefined,
        blocks: undefined
      }));

      this.logger.info('Successfully read thread messages from Slack', {
        channelId,
        threadTs,
        messageCount: messages.length,
        limit
      });

      return messages;

    } catch (error) {
      this.logger.error('Failed to read thread messages from Slack', {
        channelId,
        threadTs,
        limit,
        error: error instanceof Error ? error.message : error
      });

      if (error instanceof SlackMessageReaderError) {
        throw new Error(`Slack thread reading failed: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Search messages across channels
   */
  private async searchMessages(
    query: string,
    channelId?: string,
    limit: number = 20
  ): Promise<SlackMessage[]> {
    const slackMessageReaderService = await resolveSlackService();
    if (!slackMessageReaderService) {
      throw new Error('SlackMessageReaderService not available');
    }

    try {
      // Use SlackMessageReaderService to search messages
      const searchOptions: {
        channels?: string[];
        limit?: number;
        sort?: 'timestamp' | 'score';
        sortDir?: 'asc' | 'desc';
      } = {
        limit: limit || undefined,
        sort: 'timestamp',
        sortDir: 'desc'
      };
      
      if (channelId) {
        searchOptions.channels = [channelId];
      }
      
      const readerMessages = await slackMessageReaderService.searchMessages(query, searchOptions);

      // Convert ReaderSlackMessage to SlackMessage format
      const messages: SlackMessage[] = readerMessages.map((msg: any) => ({
        id: msg.id,
        text: msg.text,
        userId: msg.userId,
        channelId: msg.channelId,
        timestamp: msg.timestamp.toISOString(),
        threadTs: msg.threadTs || undefined,
        isBot: !!msg.botId,
        attachments: msg.attachments,
        reactions: msg.reactions,
        blocks: undefined
      }));

      this.logger.info('Successfully searched Slack messages', {
        query,
        channelId,
        messageCount: messages.length,
        limit
      });

      return messages;

    } catch (error) {
      this.logger.error('Failed to search Slack messages', {
        query,
        channelId,
        limit,
        error: error instanceof Error ? error.message : error
      });

      if (error instanceof SlackMessageReaderError) {
        throw new Error(`Slack message search failed: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Detect draft messages in a channel
   */
  private async detectDraftMessages(channelId?: string): Promise<SlackDraft[]> {
    const slackService = await resolveSlackService();
    if (!slackService) {
      throw new Error('Slack service not available');
    }

    // This would integrate with draft detection logic
    // For now, return mock data structure
    return [];
  }

  /**
   * Check confirmation status for a channel/thread
   */
  private async checkConfirmationStatus(channelId?: string, threadTs?: string): Promise<'pending' | 'confirmed' | 'rejected' | 'expired'> {
    const confirmationService = getService<any>('confirmationService');
    if (!confirmationService) {
      return 'expired';
    }

    // This would integrate with the confirmation service
    // For now, return mock status
    return 'pending';
  }
  
  // STATIC UTILITY METHODS (for other agents to use)
  
  /**
   * Format Slack messages for use by other agents
   */
  static formatMessagesForAgent(messages: SlackMessage[]): Array<{
    id: string;
    text: string;
    userId: string;
    timestamp: string;
    threadTs?: string;
  }> {
    return messages.map(message => ({
      id: message.id,
      text: message.text,
      userId: message.userId,
      timestamp: message.timestamp,
      threadTs: message.threadTs
    }));
  }
  
  /**
   * Get the most recent message from a list
   */
  static getMostRecentMessage(messages: SlackMessage[]): SlackMessage | null {
    if (messages.length === 0) return null;
    
    return messages.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    });
  }
  
  /**
   * Check if a conversation has active drafts
   */
  static hasActiveDrafts(drafts: SlackDraft[]): boolean {
    return drafts.some(draft => draft.isPendingConfirmation);
  }
  
  /**
   * Filter messages by user
   */
  static filterMessagesByUser(messages: SlackMessage[], userId: string): SlackMessage[] {
    return messages.filter(message => message.userId === userId);
  }
  
  /**
   * Get conversation summary from messages
   */
  static getConversationSummary(messages: SlackMessage[]): {
    messageCount: number;
    participantCount: number;
    timeSpan: string;
    lastActivity: string;
  } {
    if (messages.length === 0) {
      return {
        messageCount: 0,
        participantCount: 0,
        timeSpan: '0 minutes',
        lastActivity: ''
      };
    }

    const participants = new Set(messages.map(m => m.userId));
    const timestamps = messages.map(m => new Date(m.timestamp)).sort();
    const firstMessage = timestamps[0];
    const lastMessage = timestamps[timestamps.length - 1];
    
    if (!firstMessage || !lastMessage) {
      return {
        messageCount: messages.length,
        participantCount: participants.size,
        timeSpan: '0 minutes',
        lastActivity: ''
      };
    }
    
    const timeSpanMs = lastMessage.getTime() - firstMessage.getTime();
    const timeSpanMinutes = Math.round(timeSpanMs / (1000 * 60));

    return {
      messageCount: messages.length,
      participantCount: participants.size,
      timeSpan: `${timeSpanMinutes} minutes`,
      lastActivity: lastMessage.toISOString()
    };
  }
}
