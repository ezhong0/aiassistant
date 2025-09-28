import { WebClient } from '@slack/web-api';
import { BaseService } from '../base-service';
import { ServiceManager } from "../service-manager";
import { TokenManager } from '../token-manager';
import { SlackContext, SlackEventType, SlackEvent, SlackResponse } from '../../types/slack/slack.types';
import { SlackConfig } from '../../types/slack/slack-config.types';
import { serviceManager } from "../service-manager";
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { MasterAgent } from '../../agents/master.agent';
// Removed createMasterAgent import - no longer needed

export interface SlackServiceConfig {
  signingSecret: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  development?: boolean;
  enableDeduplication?: boolean;
  enableBotMessageFiltering?: boolean;
  enableDMOnlyMode?: boolean;
  enableAsyncProcessing?: boolean;
}

export interface AsyncSlackResponse {
  shouldProcessAsync: boolean;
  immediateResponse?: {
    text: string;
    response_type?: 'in_channel' | 'ephemeral';
  };
  jobId?: string;
  estimatedCompletion?: Date;
}

/**
 * SlackService - Consolidated service for all Slack operations
 *
 * Handles event processing, message processing, and basic OAuth integration.
 * Consolidates functionality from SlackEventHandler, SlackMessageProcessor,
 * and SlackInterfaceService for simplified architecture.
 */
export class SlackService extends BaseService {
  private webClient: WebClient;
  private config: SlackServiceConfig;
  private tokenManager: TokenManager | null = null;
  private masterAgent: any | null = null;

  // Event handling state
  private processedEvents = new Map<string, any>();
  private botUserId: string | null = null;

  constructor(config: SlackServiceConfig) {
    super('SlackService');
    this.config = config;
    this.webClient = new WebClient(config.botToken);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing consolidated SlackService...');

      // Initialize dependencies
      await this.initializeDependencies();

      // Initialize bot user ID
      await this.initializeBotUserId();

      // Test connection
      await this.testSlackConnection();

      // Create MasterAgent directly
      const { MasterAgent } = await import('../../agents/master.agent');
      this.masterAgent = new MasterAgent();
      
      // Initialize MasterAgent
      await this.masterAgent!.initialize();

      this.logInfo('SlackService initialized successfully', {
        hasTokenManager: !!this.tokenManager,
        hasToolExecutor: false,
        botUserId: this.botUserId,
        enableDeduplication: this.config.enableDeduplication,
        enableDMOnlyMode: this.config.enableDMOnlyMode
      });
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.processedEvents.clear();
      this.logInfo('SlackService destroyed successfully');
    } catch (error) {
      this.handleError(error, 'onDestroy');
    }
  }

  /**
   * Initialize service dependencies
   */
  private async initializeDependencies(): Promise<void> {
    this.tokenManager = serviceManager.getService('tokenManager') as TokenManager;

    if (!this.tokenManager) {
      throw new Error('TokenManager dependency not available');
    }
  }

  /**
   * Initialize bot user ID
   */
  private async initializeBotUserId(): Promise<void> {
    try {
      const authTest = await this.webClient.auth.test();
      this.botUserId = authTest.user_id as string;
      this.logInfo('Bot user ID initialized', { botUserId: this.botUserId });
    } catch (error) {
      this.logError('Failed to initialize bot user ID', error);
      throw error;
    }
  }

  /**
   * Test Slack client connection
   */
  private async testSlackConnection(): Promise<void> {
    try {
      const authTest = await this.webClient.auth.test();
      this.logInfo('Slack connection verified', {
        ok: authTest.ok,
        team: authTest.team,
        user: authTest.user,
        userId: authTest.user_id,
        botId: authTest.bot_id
      });
    } catch (error) {
      this.logError('Failed to verify Slack connection', error);
      throw new Error('Slack client authentication failed');
    }
  }

  /**
   * Process Slack events with deduplication and validation
   */
  async processEvent(event: SlackEvent, context: SlackContext): Promise<SlackResponse> {
    const eventType = (event as any).type;
    const eventText = (event as any).text?.substring(0, 100) || '';
    
    this.logInfo('=== SlackService.processEvent CALLED ===', {
      eventType,
      eventText,
      userId: context.userId,
      channelId: context.channelId,
      teamId: context.teamId,
      isDirectMessage: context.isDirectMessage,
      serviceName: this.name,
      serviceState: this.state,
      operation: 'slack_event_start'
    });

    try {
      // Event deduplication (optional)
      if (this.config.enableDeduplication && this.isDuplicateEvent(event)) {
        this.logInfo('Duplicate event ignored', { 
          eventId: (event as any).event_id,
          eventType,
          operation: 'duplicate_event_ignored'
        });
        return { success: true, message: 'Duplicate event ignored' };
      }

      // Bot message filtering
      if (this.config.enableBotMessageFiltering && this.isBotMessage(event)) {
        this.logInfo('Bot message ignored', { 
          eventType,
          operation: 'bot_message_ignored'
        });
        return { success: true, message: 'Bot message ignored' };
      }

      // DM only mode
      if (this.config.enableDMOnlyMode && !this.isDirectMessage(event)) {
        this.logInfo('Non-DM message ignored', { 
          eventType,
          channelType: (event as any).channel_type,
          operation: 'non_dm_ignored'
        });
        return { success: true, message: 'Non-DM message ignored' };
      }

      this.logInfo('Event passed all filters, processing by type', {
        eventType,
        operation: 'event_processing_by_type'
      });

      // Process the event
      const result = await this.handleEventByType(event, context);
      
      this.logInfo('Event processing completed', {
        eventType,
        success: result.success,
        hasMessage: !!result.message,
        operation: 'event_processing_complete'
      });

      return result;

    } catch (error) {
      this.logError('Failed to process Slack event', error, {
        eventType,
        eventText,
        operation: 'slack_event_error'
      });
      return {
        success: false,
        message: 'Failed to process event',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle events by type
   */
  private async handleEventByType(event: SlackEvent, context: SlackContext): Promise<SlackResponse> {
    const eventType = (event as any).type;
    
    this.logInfo('Handling event by type', {
      eventType,
      userId: context.userId,
      operation: 'handle_event_by_type'
    });

    switch (eventType) {
      case 'message':
        // Check for message subtypes
        const subtype = (event as any).subtype;
        if (subtype === 'message_changed') {
          this.logInfo('Processing message_changed event', {
            eventType,
            subtype,
            userId: context.userId,
            operation: 'message_changed_event_start'
          });
          return await this.handleMessageChangedEvent(event, context);
        }
        
        this.logInfo('Processing message event', {
          eventType,
          userId: context.userId,
          operation: 'message_event_start'
        });
        return await this.handleMessageEvent(event, context);
      case 'app_mention':
        this.logInfo('Processing app mention event', {
          eventType,
          userId: context.userId,
          operation: 'app_mention_event_start'
        });
        return await this.handleAppMentionEvent(event, context);
      default:
        this.logInfo('Unhandled event type', { 
          eventType,
          userId: context.userId,
          operation: 'unhandled_event_type'
        });
        return { success: true, message: 'Event type not handled' };
    }
  }

  /**
   * Handle message events
   */
  private async handleMessageEvent(event: SlackEvent, context: SlackContext): Promise<SlackResponse> {
    try {
      // Extract message text
      const messageText = (event as any).text || '';
      
      this.logInfo('Handling message event', {
        messageText: messageText.substring(0, 100),
        messageLength: messageText.length,
        userId: context.userId,
        channelId: context.channelId,
        operation: 'message_event_processing'
      });

      // Check for OAuth requirements
      this.logInfo('Checking OAuth requirements', {
        userId: context.userId,
        operation: 'oauth_check_start'
      });
      
      if (await this.requiresOAuth(messageText, context)) {
        this.logInfo('OAuth required for message', {
          userId: context.userId,
          messageText: messageText.substring(0, 50),
          operation: 'oauth_required'
        });
        return {
          success: true,
          message: 'OAuth required',
          requiresOAuth: true,
          oauthUrl: await this.generateOAuthUrl(context)
        };
      }

      // Check for confirmation patterns
      this.logInfo('Checking for confirmation patterns', {
        userId: context.userId,
        operation: 'confirmation_check_start'
      });
      
      // Removed confirmation detection - no longer needed

      // Process as regular message through tool executor
      this.logInfo('Processing as regular message with MasterAgent', {
        userId: context.userId,
        messageText: messageText.substring(0, 50),
        operation: 'master_agent_processing_start'
      });
      
      return await this.processMessageWithMasterAgent(messageText, context);

    } catch (error) {
      this.logError('Failed to handle message event', error, {
        userId: context.userId,
        operation: 'message_event_error'
      });
      return {
        success: false,
        message: 'Failed to handle message',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle app mention events
   */
  private async handleAppMentionEvent(event: SlackEvent, context: SlackContext): Promise<SlackResponse> {
    // Similar to message handling but for mentions
    return await this.handleMessageEvent(event, context);
  }

  /**
   * Handle message_changed events (when bot messages are updated)
   */
  private async handleMessageChangedEvent(event: SlackEvent, context: SlackContext): Promise<SlackResponse> {
    try {
      const messageChangedEvent = event as any;
      
      this.logInfo('Handling message_changed event', {
        userId: context.userId,
        channelId: context.channelId,
        messageTs: messageChangedEvent.ts,
        operation: 'message_changed_processing'
      });

      // For message_changed events, we typically want to ignore them
      // as they represent bot message updates, not user input
      // This prevents infinite loops when the bot updates its own messages
      
      this.logInfo('Message_changed event ignored (bot message update)', {
        userId: context.userId,
        channelId: context.channelId,
        operation: 'message_changed_ignored'
      });

      return { 
        success: true, 
        message: 'Message_changed event ignored - bot message update' 
      };

    } catch (error) {
      this.logError('Failed to handle message_changed event', error, {
        userId: context.userId,
        operation: 'message_changed_event_error'
      });
      return {
        success: false,
        message: 'Failed to handle message_changed event',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process message through tool executor
   */
  private async processMessageWithMasterAgent(messageText: string, context: SlackContext): Promise<SlackResponse> {
    try {
      const sessionId = `slack:${context.teamId}:${context.userId}`;
      
      this.logInfo('Starting MasterAgent processing', {
        sessionId,
        userId: context.userId,
        teamId: context.teamId,
        messageText: messageText.substring(0, 50),
        hasMasterAgent: !!this.masterAgent,
        operation: 'master_agent_start'
      });

      if (!this.masterAgent) {
        this.logError('MasterAgent not available', new Error('MasterAgent not initialized'), {
          sessionId,
          userId: context.userId,
          operation: 'master_agent_unavailable'
        });
        throw new Error('MasterAgent not available');
      }

      // Post "working on it" message immediately
      this.logInfo('Posting working message to Slack', {
        sessionId,
        userId: context.userId,
        channelId: context.channelId,
        operation: 'slack_working_message'
      });
      
      await this.postMessageToSlack(
        context.channelId,
        "🤔 Working on your request...",
        context.threadTs
      );

      this.logInfo('Calling MasterAgent.processUserInput', {
        sessionId,
        userId: context.userId,
        messageText: messageText.substring(0, 50),
        operation: 'master_agent_process_start'
      });

      const unified = await this.masterAgent.processUserInput(
        messageText,
        sessionId,
        context.userId,
        context
      );

      this.logInfo('MasterAgent processing completed', {
        sessionId,
        userId: context.userId,
        success: unified.success,
        hasMessage: !!unified.message,
        messageLength: unified.message?.length || 0,
        needsConfirmation: unified.needsConfirmation,
        hasDraftId: !!unified.draftId,
        operation: 'master_agent_process_complete'
      });

      // Post the final response back to Slack
      this.logInfo('Posting final response to Slack', {
        sessionId,
        userId: context.userId,
        channelId: context.channelId,
        responseLength: unified.message?.length || 0,
        operation: 'slack_final_response'
      });
      
      await this.postMessageToSlack(
        context.channelId,
        unified.message,
        context.threadTs
      );

      return {
        success: unified.success,
        message: unified.message,
        data: {
          needsConfirmation: unified.needsConfirmation,
          draftId: unified.draftId,
          draftContents: unified.draftContents
        }
      };

    } catch (error) {
      this.logError('Failed to process message with tools', error, {
        userId: context.userId,
        sessionId: `slack:${context.teamId}:${context.userId}`,
        operation: 'master_agent_error'
      });
      
      // Generate user-friendly error message
      const userFriendlyError = await this.generateUserFriendlyErrorMessage(error, messageText);

      // Post error message to Slack
      await this.postMessageToSlack(
        context.channelId,
        userFriendlyError,
        context.threadTs
      ).catch(() => {}); // Don't fail if we can't post the error message

      return {
        success: false,
        message: 'Failed to process message',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if OAuth is required
   */
  private async requiresOAuth(messageText: string, context: SlackContext): Promise<boolean> {
    // Disable early OAuth check - let MasterAgent handle OAuth requirements when actually needed
    // This allows all messages to be processed through the MasterAgent pipeline
    return false;

    // TODO: Re-implement smarter OAuth detection if needed
    // const oauthKeywords = ['email', 'calendar', 'gmail', 'google'];
    // const hasKeyword = oauthKeywords.some(keyword =>
    //   messageText.toLowerCase().includes(keyword)
    // );
    // const hasTokens = context.userId && this.tokenManager &&
    //   await this.tokenManager.hasValidOAuthTokens(context.teamId, context.userId);
    // return hasKeyword && !hasTokens;
  }

  /**
   * Generate OAuth URL (basic implementation)
   */
  private async generateOAuthUrl(context: SlackContext): Promise<string> {
    // Basic OAuth URL generation - SlackOAuthService would handle full implementation
    const state = `slack_${context.userId}_${Date.now()}`;
    const scopes = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar';

    return `https://accounts.google.com/o/oauth2/auth?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;
  }

  // Removed confirmation message detection - no longer needed

  // Removed confirmation handling - no longer needed

  /**
   * Check for duplicate events
   */
  private isDuplicateEvent(event: SlackEvent): boolean {
    // Use stable ID if available
    const eventId = (event as any).event_id || this.generateEventId(event);
    if (!eventId) return false;
    const now = Date.now();
    const eventData = this.processedEvents.get(eventId);
    if (eventData && (now - eventData.timestamp) < 300000) { // 5 minutes
      return true;
    }
    this.processedEvents.set(eventId, { timestamp: now });
    this.cleanupOldEvents();
    return false;
  }

  /**
   * Generate event ID from event properties
   */
  private generateEventId(event: SlackEvent): string | null {
    try {
      const team = (event as any).team_id || (event as any).authorizations?.[0]?.team_id || 'unknown';
      const channel = (event as any).event?.channel || (event as any).channel || 'unknown';
      const ts = (event as any).event?.ts || (event as any).ts || 'unknown';
      const clientMsgId = (event as any).event?.client_msg_id || (event as any).client_msg_id || 'na';
      return `${team}:${channel}:${ts}:${clientMsgId}`;
    } catch {
      return null;
    }
  }

  /**
   * Check if message is from bot
   */
  private isBotMessage(event: SlackEvent): boolean {
    const subtype = (event as any).event?.subtype || (event as any).subtype;
    if (subtype === 'bot_message') return true;
    const botProfile = (event as any).event?.bot_profile || (event as any).bot_profile;
    if (botProfile) return true;
    if (this.botUserId) {
      const user = (event as any).event?.user || (event as any).user;
      if (user && user === this.botUserId) return true;
    }
    return false;
  }

  /**
   * Check if message is direct message
   */
  private isDirectMessage(event: SlackEvent): boolean {
    const channel = (event as any).event?.channel || (event as any).channel;
    if (typeof channel === 'string' && channel.startsWith('D')) return true; // IM channels
    const channelType = (event as any).event?.channel_type;
    if (channelType === 'im') return true;
    return false;
  }

  /**
   * Cleanup old processed events
   */
  private cleanupOldEvents(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [eventId, data] of this.processedEvents.entries()) {
      if (now - data.timestamp > maxAge) {
        this.processedEvents.delete(eventId);
      }
    }
  }

  /**
   * Post message to Slack with thread support
   */
  private async postMessageToSlack(channel: string, text: string, threadTs?: string): Promise<any> {
    const options: any = {};
    if (threadTs) {
      options.thread_ts = threadTs;
    }
    return await this.sendMessage(channel, text, options);
  }

  /**
   * Send message to Slack
   */
  async sendMessage(channel: string, text: string, options?: any): Promise<any> {
    try {
      return await this.webClient.chat.postMessage({
        channel,
        text,
        ...options
      });
    } catch (error) {
      this.logError('Failed to send Slack message', error);
      throw error;
    }
  }

  /**
   * Send response via response_url (for slash commands)
   */
  async sendToResponseUrl(responseUrl: string, payload: any): Promise<void> {
    try {
      const response = await fetch(responseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Response URL request failed: ${response.statusText}`);
      }

      this.logInfo('Sent response via response_url', {
        operation: 'response_url_send',
        statusCode: response.status
      });
    } catch (error) {
      this.logError('Failed to send to response_url', error as Error, {
        operation: 'response_url_error',
        responseUrl
      });
      throw error;
    }
  }

  /**
   * Get Slack client for advanced operations
   */
  getClient(): WebClient {
    return this.webClient;
  }

  /**
   * Get service health information
   */
  getHealth(): any {
    return {
      healthy: this.isReady(),
      botUserId: this.botUserId,
      hasTokenManager: !!this.tokenManager,
      hasToolExecutor: false,
      processedEventsCount: this.processedEvents.size
    };
  }

  /**
   * Typed helper: get channel history
   */
  async getChannelHistory(channelId: string, limit = 20): Promise<{ messages: any[]; hasMore: boolean; nextCursor?: string; }> {
    const resp: any = await this.webClient.conversations.history({ channel: channelId, limit });
    const messages = Array.isArray(resp.messages) ? resp.messages : [];
    return { messages, hasMore: !!resp.response_metadata?.next_cursor, nextCursor: resp.response_metadata?.next_cursor };
  }

  /**
   * Typed helper: get thread messages
   */
  async getThreadMessages(channelId: string, threadTs: string, limit = 20): Promise<{ messages: any[]; hasMore: boolean; nextCursor?: string; }> {
    const resp: any = await this.webClient.conversations.replies({ channel: channelId, ts: threadTs, limit });
    const messages = Array.isArray(resp.messages) ? resp.messages : [];
    return { messages, hasMore: !!resp.response_metadata?.next_cursor, nextCursor: resp.response_metadata?.next_cursor };
  }

  /**
   * Generate user-friendly error messages using AI intelligence
   */
  private async generateUserFriendlyErrorMessage(error: unknown, userInput: string): Promise<string> {
    try {
      // Try to get OpenAI service for intelligent error message generation
      const openaiService = this.getOpenAIService();
      if (openaiService) {
        return await this.generateAIErrorMessage(error, userInput, openaiService);
      }

      // Only fallback to generic message if AI services are completely unavailable
      return this.getGenericErrorMessage(error, userInput);
    } catch (aiError) {
      // Only use generic fallback when AI generation fails
      return this.getGenericErrorMessage(error, userInput);
    }
  }

  /**
   * Generate AI-powered error message using OpenAI service directly
   */
  private async generateAIErrorMessage(error: unknown, userInput: string, openaiService: any): Promise<string> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = this.extractErrorCode(error);
    const errorCategory = this.extractErrorCategory(error);

    const errorAnalysisPrompt = `
You are an expert error message translator for a Slack assistant. Convert technical error messages into user-friendly responses.

ORIGINAL ERROR: "${errorMessage}"
ERROR CODE: "${errorCode || 'UNKNOWN'}"
ERROR CATEGORY: "${errorCategory || 'UNKNOWN'}"
USER REQUEST: "${userInput}"

TASK: Create a helpful, non-technical error message that:
1. Explains what went wrong in simple terms
2. Suggests what the user can do about it
3. Is empathetic and professional
4. Avoids technical jargon
5. Includes relevant emojis for better Slack experience

RESPONSE FORMAT: Return only the user-friendly error message, no JSON or additional formatting.

GUIDELINES:
- For authentication errors: Suggest using /auth command to reconnect
- For timeout errors: Suggest simpler requests or trying again
- For rate limit errors: Suggest waiting and trying again
- For service errors: Suggest checking configuration or trying later
- For permission errors: Suggest checking account permissions
- For unknown errors: Provide general troubleshooting advice

Be concise but helpful. Slack users prefer shorter, actionable messages.
`;

    const response = await openaiService.generateText(
      errorAnalysisPrompt,
      'You are an error message translator for Slack. Return only the user-friendly message.',
      { temperature: 0.3, maxTokens: 150 }
    );

    return response.trim();
  }

  /**
   * Extract error code from various error types
   */
  private extractErrorCode(error: unknown): string | null {
    if (!error) return null;

    // AppError has structured code
    if (error && typeof error === 'object' && 'code' in error) {
      return (error as any).code;
    }

    // Check for common error patterns in message
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Map common patterns to error codes
    if (/oauth|token|auth/i.test(errorMessage)) return 'AUTH_FAILED';
    if (/timeout|deadline/i.test(errorMessage)) return 'OPERATION_TIMEOUT';
    if (/rate.?limit/i.test(errorMessage)) return 'RATE_LIMIT_EXCEEDED';
    if (/network|connection|fetch/i.test(errorMessage)) return 'NETWORK_ERROR';
    if (/not.?found|404/i.test(errorMessage)) return 'RESOURCE_NOT_FOUND';
    if (/permission|forbidden|403/i.test(errorMessage)) return 'INSUFFICIENT_PERMISSIONS';
    if (/calendar/i.test(errorMessage)) return 'CALENDAR_ERROR';
    if (/email|gmail/i.test(errorMessage)) return 'EMAIL_ERROR';

    return null;
  }

  /**
   * Extract error category from various error types
   */
  private extractErrorCategory(error: unknown): string | null {
    if (!error) return null;

    // AppError has structured category
    if (error && typeof error === 'object' && 'category' in error) {
      return (error as any).category;
    }

    // Infer category from error code
    const errorCode = this.extractErrorCode(error);
    if (!errorCode) return null;

    if (errorCode.includes('AUTH')) return 'auth';
    if (errorCode.includes('TIMEOUT') || errorCode.includes('RATE_LIMIT')) return 'service';
    if (errorCode.includes('PERMISSION') || errorCode.includes('NOT_FOUND')) return 'api';
    if (errorCode.includes('NETWORK')) return 'external';
    if (errorCode.includes('CALENDAR') || errorCode.includes('EMAIL')) return 'service';

    return 'service';
  }

  /**
   * Get generic error message only when AI services are unavailable
   */
  private getGenericErrorMessage(error: unknown, userInput: string): string {
    const errorCode = this.extractErrorCode(error);
    
    // Only provide generic messages for critical system failures
    if (errorCode === 'SERVICE_UNAVAILABLE' || errorCode === 'AI_SERVICE_ERROR') {
      return '🤖 I\'m having trouble processing your request right now. Please try again in a moment.';
    }

    // For other errors, provide a more specific generic message
    return `❌ I encountered an issue processing your request. Please try rephrasing it or contact support if the issue persists.`;
  }

  // Removed IntentAnalysisService getter - no longer needed

  /**
   * Get OpenAI service from service manager
   */
  private getOpenAIService(): any {
    try {
      const serviceManager = require('../service-manager').serviceManager;
      return serviceManager.getService('openaiService');
    } catch {
      return null;
    }
  }
}