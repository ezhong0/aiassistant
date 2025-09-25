import { WebClient } from '@slack/web-api';
import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { TokenManager } from '../token-manager';
import { SlackContext, SlackEventType, SlackEvent, SlackResponse } from '../../types/slack/slack.types';
import { SlackConfig } from '../../types/slack/slack-config.types';
import { serviceManager } from '../service-manager';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { MasterAgent } from '../../agents/master.agent';
import { createMasterAgent } from '../../config/agent-factory-init';

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
  private masterAgent: MasterAgent | null = null;

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
      const apiKey = process.env.OPENAI_API_KEY;
      this.masterAgent = apiKey ? createMasterAgent({ openaiApiKey: apiKey, model: 'gpt-4o-mini' }) : createMasterAgent();

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
    try {
      // Event deduplication (optional)
      if (this.config.enableDeduplication && this.isDuplicateEvent(event)) {
        this.logInfo('Duplicate event ignored', { eventId: (event as any).event_id });
        return { success: true, message: 'Duplicate event ignored' };
      }

      // Bot message filtering
      if (this.config.enableBotMessageFiltering && this.isBotMessage(event)) {
        this.logInfo('Bot message ignored', { eventType: (event as any).type });
        return { success: true, message: 'Bot message ignored' };
      }

      // DM only mode
      if (this.config.enableDMOnlyMode && !this.isDirectMessage(event)) {
        this.logInfo('Non-DM message ignored', { eventType: (event as any).type });
        return { success: true, message: 'Non-DM message ignored' };
      }

      // Process the event
      return await this.handleEventByType(event, context);

    } catch (error) {
      this.logError('Failed to process Slack event', error);
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
    switch ((event as any).type) {
      case 'message':
        return await this.handleMessageEvent(event, context);
      case 'app_mention':
        return await this.handleAppMentionEvent(event, context);
      default:
        this.logInfo('Unhandled event type', { eventType: (event as any).type });
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

      // Check for OAuth requirements
      if (await this.requiresOAuth(messageText, context)) {
        return {
          success: true,
          message: 'OAuth required',
          requiresOAuth: true,
          oauthUrl: await this.generateOAuthUrl(context)
        };
      }

      // Check for confirmation patterns
      if (this.isConfirmationMessage(messageText)) {
        return await this.handleConfirmation(messageText, context);
      }

      // Process as regular message through tool executor
      return await this.processMessageWithMasterAgent(messageText, context);

    } catch (error) {
      this.logError('Failed to handle message event', error);
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
   * Process message through tool executor
   */
  private async processMessageWithMasterAgent(messageText: string, context: SlackContext): Promise<SlackResponse> {
    try {
      const sessionId = `slack:${context.teamId}:${context.userId}`;
      if (!this.masterAgent) {
        throw new Error('MasterAgent not available');
      }

      // Post "working on it" message immediately
      await this.postMessageToSlack(
        context.channelId,
        "🤔 Working on your request...",
        context.threadTs
      );

      const unified = await this.masterAgent.processUserInputWithDrafts(
        messageText,
        sessionId,
        context.userId,
        {
          context: { slackContext: context }
        }
      );

      // Post the final response back to Slack
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
          draftContents: unified.draftContents,
          toolResults: unified.toolResults
        }
      };

    } catch (error) {
      this.logError('Failed to process message with tools', error);
      
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
    // Simple OAuth detection - could be enhanced
    const oauthKeywords = ['email', 'calendar', 'gmail', 'google'];
    const hasKeyword = oauthKeywords.some(keyword =>
      messageText.toLowerCase().includes(keyword)
    );

    // Check if user has tokens
    const hasTokens = context.userId && this.tokenManager &&
      await this.tokenManager.hasValidOAuthTokens(context.teamId, context.userId);

    return hasKeyword && !hasTokens;
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

  /**
   * Check if message is a confirmation
   */
  private isConfirmationMessage(messageText: string): boolean {
    const confirmationPatterns = [
      /^(yes|y|confirm|ok|proceed|do it)/i,
      /^(no|n|cancel|stop|abort)/i
    ];

    return confirmationPatterns.some(pattern => pattern.test(messageText.trim()));
  }

  /**
   * Handle confirmation messages
   */
  private async handleConfirmation(messageText: string, context: SlackContext): Promise<SlackResponse> {
    try {
      const isPositive = /^(yes|y|confirm|ok|proceed|do it)/i.test(messageText.trim());

      // This would integrate with the existing confirmation system
      return {
        success: true,
        message: isPositive ? 'Confirmation received - proceeding' : 'Confirmation cancelled',
        data: {
          confirmed: isPositive,
          userId: context.userId
        }
      };
    } catch (error) {
      this.logError('Failed to handle confirmation', error);
      return {
        success: false,
        message: 'Failed to process confirmation',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

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

  /**
   * Get OpenAI service from MasterAgent or service manager
   */
  private getOpenAIService(): any {
    try {
      // Try to get from MasterAgent first
      if (this.masterAgent && typeof this.masterAgent.getOpenAIService === 'function') {
        return this.masterAgent.getOpenAIService();
      }

      // Fallback to service manager
      const serviceManager = require('../service-manager').serviceManager;
      return serviceManager.getService('OpenAIService');
    } catch {
      return null;
    }
  }
}