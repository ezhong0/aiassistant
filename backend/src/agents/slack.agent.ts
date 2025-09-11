import { AIAgent } from '../framework/ai-agent';
import { ToolExecutionContext, SlackAgentParams } from '../types/tools';
import { PreviewGenerationResult } from '../types/api.types';
import { getService } from '../services/service-manager';
import { SlackInterfaceService } from '../services/slack-interface.service';
import { SlackMessageReaderService } from '../services/slack-message-reader.service';
import { SlackContext, SlackMessageEvent, SlackResponse } from '../types/slack.types';
import { SlackMessage as ReaderSlackMessage, SlackMessageReaderError } from '../types/slack-message-reader.types';
import { AIClassificationService } from '../services/ai-classification.service';
import { SLACK_CONSTANTS } from '../config/constants';

/**
 * Slack message data structure
 */
export interface SlackMessage {
  id: string;
  text: string;
  userId: string;
  channelId: string;
  timestamp: string;
  threadTs?: string;
  isBot: boolean;
  attachments?: any[];
  blocks?: any[];
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
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
  threadTs?: string;
  content: string;
  attachments?: any[];
  blocks?: any[];
  createdAt: string;
  updatedAt: string;
  isPendingConfirmation: boolean;
  confirmationId?: string;
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
  channelId?: string;
  threadTs?: string;
  searchTerm?: string;
  confirmationStatus?: 'pending' | 'confirmed' | 'rejected' | 'expired';
}

/**
 * Slack agent parameters with access token
 */
export interface SlackAgentRequest extends SlackAgentParams {
  accessToken: string;
  operation?: 'read_messages' | 'read_thread' | 'detect_drafts' | 'manage_drafts' | 'confirmation_handling';
  channelId?: string;
  threadTs?: string;
  limit?: number;
  includeReactions?: boolean;
  includeAttachments?: boolean;
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
  protected async executeCustomTool(toolName: string, parameters: any, context: ToolExecutionContext): Promise<any> {
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
    summary: any,
    successfulResults: any[],
    failedResults: any[],
    params: SlackAgentRequest,
    _context: ToolExecutionContext
  ): SlackAgentResult {
    // For Slack operations, we typically want the first successful result
    if (successfulResults.length > 0) {
      return successfulResults[0] as SlackAgentResult;
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

      const operation = await aiClassificationService.detectOperation(query, 'slackAgent');
      
      // Convert AI result to expected format
      switch (operation) {
        case 'read':
          if (query.toLowerCase().includes('thread') || query.toLowerCase().includes('conversation')) {
            return 'read_thread';
          } else {
            return 'read_messages';
          }
        case 'write':
          if (query.toLowerCase().includes('draft') || query.toLowerCase().includes('pending')) {
            return 'detect_drafts';
          } else if (query.toLowerCase().includes('manage') || query.toLowerCase().includes('update')) {
            return 'manage_drafts';
          } else {
            return 'manage_drafts';
          }
        case 'search':
          return 'read_messages';
        default:
          // Default to reading messages for unknown operations
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
      channelId,
      limit
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
    const slackMessageReaderService = getService<SlackMessageReaderService>('slackMessageReaderService');
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
      const messages: SlackMessage[] = readerMessages.map(msg => ({
        id: msg.id,
        text: msg.text,
        userId: msg.userId,
        channelId: msg.channelId,
        timestamp: msg.timestamp.toISOString(),
        threadTs: msg.threadTs,
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
    const slackMessageReaderService = getService<SlackMessageReaderService>('slackMessageReaderService');
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
      const messages: SlackMessage[] = readerMessages.map(msg => ({
        id: msg.id,
        text: msg.text,
        userId: msg.userId,
        channelId: msg.channelId,
        timestamp: msg.timestamp.toISOString(),
        threadTs: msg.threadTs,
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
    const slackMessageReaderService = getService<SlackMessageReaderService>('slackMessageReaderService');
    if (!slackMessageReaderService) {
      throw new Error('SlackMessageReaderService not available');
    }

    try {
      // Use SlackMessageReaderService to search messages
      const readerMessages = await slackMessageReaderService.searchMessages(query, {
        channels: channelId ? [channelId] : undefined,
        limit,
        sort: 'timestamp',
        sortDir: 'desc'
      });

      // Convert ReaderSlackMessage to SlackMessage format
      const messages: SlackMessage[] = readerMessages.map(msg => ({
        id: msg.id,
        text: msg.text,
        userId: msg.userId,
        channelId: msg.channelId,
        timestamp: msg.timestamp.toISOString(),
        threadTs: msg.threadTs,
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
    const slackService = getService<SlackInterfaceService>('slackInterfaceService');
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
