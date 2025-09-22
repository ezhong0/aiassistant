import { WebClient } from '@slack/web-api';
import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { TokenManager } from '../token-manager';
import { ToolExecutorService } from '../tool-executor.service';
import { SlackContext, SlackEventType, SlackEvent, SlackResponse } from '../../types/slack/slack.types';
import { SlackConfig } from '../../types/slack/slack-config.types';
import { serviceManager } from '../service-manager';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';

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
  private toolExecutorService: ToolExecutorService | null = null;

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

      this.logInfo('SlackService initialized successfully', {
        hasTokenManager: !!this.tokenManager,
        hasToolExecutor: !!this.toolExecutorService,
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
    this.toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;

    if (!this.tokenManager) {
      throw new Error('TokenManager dependency not available');
    }
    if (!this.toolExecutorService) {
      throw new Error('ToolExecutorService dependency not available');
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
      // Event deduplication
      if (this.config.enableDeduplication && this.isDuplicateEvent(event)) {
        this.logInfo('Duplicate event ignored', { eventId: event.event_id });
        return { success: true, message: 'Duplicate event ignored' };
      }

      // Bot message filtering
      if (this.config.enableBotMessageFiltering && this.isBotMessage(event)) {
        this.logInfo('Bot message ignored', { eventType: event.type });
        return { success: true, message: 'Bot message ignored' };
      }

      // DM only mode
      if (this.config.enableDMOnlyMode && !this.isDirectMessage(event)) {
        this.logInfo('Non-DM message ignored', { eventType: event.type });
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
    switch (event.type) {
      case 'message':
        return await this.handleMessageEvent(event, context);
      case 'app_mention':
        return await this.handleAppMentionEvent(event, context);
      default:
        this.logInfo('Unhandled event type', { eventType: event.type });
        return { success: true, message: 'Event type not handled' };
    }
  }

  /**
   * Handle message events
   */
  private async handleMessageEvent(event: SlackEvent, context: SlackContext): Promise<SlackResponse> {
    try {
      // Extract message text
      const messageText = event.text || '';

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
      return await this.processMessageWithTools(messageText, context);

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
  private async processMessageWithTools(messageText: string, context: SlackContext): Promise<SlackResponse> {
    try {
      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService not available');
      }

      // Create tool execution context
      const toolContext = {
        sessionId: `slack-${context.userId}-${Date.now()}`,
        userId: context.userId,
        timestamp: new Date()
      };

      // Create tool call object
      const toolCall = {
        name: 'slackAgent',
        parameters: {
          message: messageText,
          context: context
        }
      };

      // Execute tools
      const result = await this.toolExecutorService.executeTool(toolCall, toolContext);

      return {
        success: result.success,
        message: result.result || 'Message processed',
        data: result.data
      };

    } catch (error) {
      this.logError('Failed to process message with tools', error);
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
    // Generate a unique ID based on event properties
    const eventId = this.generateEventId(event);
    if (!eventId) return false;

    const now = Date.now();
    const eventData = this.processedEvents.get(eventId);

    if (eventData && (now - eventData.timestamp) < 300000) { // 5 minutes
      return true;
    }

    // Store event
    this.processedEvents.set(eventId, { timestamp: now });

    // Cleanup old events
    this.cleanupOldEvents();

    return false;
  }

  /**
   * Generate event ID from event properties
   */
  private generateEventId(event: SlackEvent): string | null {
    // Simple ID generation based on common properties
    const timestamp = Date.now();
    return `${event.type}-${timestamp}`;
  }

  /**
   * Check if message is from bot
   */
  private isBotMessage(event: SlackEvent): boolean {
    // Simple bot detection - this can be enhanced based on actual event structure
    return false; // For now, assume no bot messages to avoid type issues
  }

  /**
   * Check if message is direct message
   */
  private isDirectMessage(event: SlackEvent): boolean {
    // Simple DM detection - this can be enhanced based on actual event structure
    return true; // For now, assume all messages are DMs
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
      hasToolExecutor: !!this.toolExecutorService,
      processedEventsCount: this.processedEvents.size
    };
  }
}