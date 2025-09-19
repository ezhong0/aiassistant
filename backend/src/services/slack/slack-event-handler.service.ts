import { WebClient } from '@slack/web-api';
import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { SlackContext, SlackEventType, SlackEvent } from '../../types/slack/slack.types';
import {
  SlackEventProcessingResult,
  SlackEventValidationResult,
  SlackEventDeduplicationData,
  SlackEventHandlerConfig,
  SlackEventContextData,
  SlackEventMetadata
} from '../../types/slack/slack-event-definitions';
import {
  validateSlackEvent,
  validateSlackContext,
  isSlackEvent,
  isSlackContext
} from '../../utils/type-guards';

/**
 * SlackEventHandler - Focused service for Slack event processing
 * Handles event validation, deduplication, and context creation
 */
export class SlackEventHandler extends BaseService {
  private client: WebClient;
  private config: SlackEventHandlerConfig;
  private processedEvents = new Map<string, SlackEventDeduplicationData>();
  private botUserId: string | null = null;

  constructor(config: SlackEventHandlerConfig, client: WebClient) {
    super('SlackEventHandler');
    this.config = config;
    this.client = client;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackEventHandler...');
      
      // Initialize bot user ID
      await this.initializeBotUserId();
      
      this.logInfo('SlackEventHandler initialized successfully', {
        enableDeduplication: this.config.enableDeduplication,
        enableBotMessageFiltering: this.config.enableBotMessageFiltering,
        enableDMOnlyMode: this.config.enableDMOnlyMode,
        botUserId: this.botUserId
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
      this.botUserId = null;
      this.logInfo('SlackEventHandler destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackEventHandler destruction', error);
    }
  }

  /**
   * Process a Slack event with validation and deduplication
   */
  async processEvent(event: unknown, teamId: string): Promise<SlackEventProcessingResult> {
    const startTime = Date.now();
    const metadata: SlackEventMetadata = {
      eventId: '',
      processingStartTime: startTime,
      retryCount: 0,
      maxRetries: 3
    };

    try {
      // Validate event structure
      const validationResult = await this.validateEvent(event);
      if (!validationResult.isValid) {
        return {
          success: false,
          eventId: validationResult.eventId || 'unknown',
          eventType: 'message' as SlackEventType,
          userId: 'unknown',
          channelId: 'unknown',
          teamId,
          processedAt: startTime,
          error: validationResult.error
        };
      }

      metadata.eventId = validationResult.eventId!;
      const validatedEvent = validationResult.event!;

      // Check for duplicate events
      if (this.config.enableDeduplication && this.isDuplicateEvent(metadata.eventId)) {
        this.logDebug('Duplicate event detected, skipping', { eventId: metadata.eventId });
        return {
          success: false,
          eventId: metadata.eventId,
          eventType: this.determineEventType(validatedEvent),
          userId: this.extractUserId(validatedEvent),
          channelId: this.extractChannelId(validatedEvent),
          teamId,
          processedAt: startTime,
          error: 'Duplicate event'
        };
      }

      // Mark event as processed
      if (this.config.enableDeduplication) {
        this.markEventProcessed(metadata.eventId);
      }

      // Filter bot messages
      if (this.config.enableBotMessageFiltering && await this.isBotMessage(validatedEvent)) {
        this.logDebug('Bot message detected, skipping', { eventId: metadata.eventId });
        return {
          success: false,
          eventId: metadata.eventId,
          eventType: this.determineEventType(validatedEvent),
          userId: this.extractUserId(validatedEvent),
          channelId: this.extractChannelId(validatedEvent),
          teamId,
          processedAt: startTime,
          error: 'Bot message filtered'
        };
      }

      // Create Slack context
      const contextData = await this.createEventContext(validatedEvent, teamId);
      
      // Enforce DM-only mode if enabled
      if (this.config.enableDMOnlyMode && !contextData.isDirectMessage) {
        await this.handleDMOnlyViolation(contextData);
        return {
          success: false,
          eventId: metadata.eventId,
          eventType: contextData.eventType,
          userId: contextData.userId,
          channelId: contextData.channelId,
          teamId,
          processedAt: startTime,
          error: 'DM-only mode violation'
        };
      }

      metadata.processingEndTime = Date.now();
      metadata.processingDuration = metadata.processingEndTime - metadata.processingStartTime;

      this.logInfo('Event processed successfully', {
        eventId: metadata.eventId,
        processingDuration: metadata.processingDuration,
        eventType: contextData.eventType,
        userId: contextData.userId,
        channelId: contextData.channelId
      });

      return {
        success: true,
        eventId: metadata.eventId,
        eventType: contextData.eventType,
        userId: contextData.userId,
        channelId: contextData.channelId,
        teamId,
        processedAt: startTime
      };

    } catch (error) {
      metadata.processingEndTime = Date.now();
      metadata.processingDuration = metadata.processingEndTime - metadata.processingStartTime;
      
      this.logError('Error processing Slack event', error, {
        eventId: metadata.eventId,
        processingDuration: metadata.processingDuration,
        retryCount: metadata.retryCount
      });

      return {
        success: false,
        eventId: metadata.eventId,
        eventType: 'message' as SlackEventType,
        userId: 'unknown',
        channelId: 'unknown',
        teamId,
        processedAt: startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate Slack event structure
   */
  private async validateEvent(event: unknown): Promise<SlackEventValidationResult> {
    try {
      const validatedEvent = validateSlackEvent(event);
      
      // Create unique event ID for deduplication
      const ts = 'ts' in validatedEvent ? validatedEvent.ts : Date.now().toString();
      const user = this.extractUserId(validatedEvent);
      const channel = this.extractChannelId(validatedEvent);
      const eventType = this.determineEventType(validatedEvent);
      const eventId = `${ts}-${user}-${channel}-${eventType}`;

      return {
        isValid: true,
        event: validatedEvent,
        eventId
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Event validation failed'
      };
    }
  }

  /**
   * Check if event is a duplicate
   */
  private isDuplicateEvent(eventId: string): boolean {
    this.cleanupExpiredEvents();
    return this.processedEvents.has(eventId);
  }

  /**
   * Mark event as processed
   */
  private markEventProcessed(eventId: string): void {
    this.processedEvents.set(eventId, {
      eventId,
      timestamp: Date.now(),
      ttl: this.config.deduplicationTTL
    });
  }

  /**
   * Check if event is from a bot
   */
  private async isBotMessage(event: SlackEvent): Promise<boolean> {
    // Check for bot_id or bot_message subtype
    if ((event as any).bot_id || (event as any).subtype === 'bot_message') {
      return true;
    }

    // Check if message is from the bot user itself
    const userId = this.extractUserId(event);
    if (this.botUserId && userId === this.botUserId) {
      return true;
    }

    return false;
  }

  /**
   * Create Slack context from event
   */
  private async createEventContext(event: SlackEvent, teamId: string): Promise<SlackEventContextData> {
    const userId = this.extractUserId(event);
    const channelId = this.extractChannelId(event);
    const eventType = this.determineEventType(event);
    const threadTs = 'thread_ts' in event ? event.thread_ts : undefined;
    const isDirectMessage = (event as any).channel_type === 'im';

    return {
      userId,
      channelId,
      teamId,
      threadTs,
      isDirectMessage,
      eventType,
      timestamp: 'ts' in event ? event.ts : Date.now().toString()
    };
  }

  /**
   * Handle DM-only mode violation
   */
  private async handleDMOnlyViolation(contextData: SlackEventContextData): Promise<void> {
    try {
      await this.client.chat.postMessage({
        channel: contextData.channelId,
        text: "🔒 AI Assistant works exclusively through direct messages to protect your privacy. Please send me a direct message to get assistance."
      });
      
      this.logWarn('DM-only mode violation handled', {
        userId: contextData.userId,
        channelId: contextData.channelId,
        eventType: contextData.eventType
      });
    } catch (error) {
      this.logError('Failed to send DM-only violation message', error);
    }
  }

  /**
   * Extract user ID from event
   */
  private extractUserId(event: SlackEvent): string {
    const user = 'user' in event ? event.user : 
                 'user_id' in event ? (event as any).user_id : 
                 'unknown';
    return typeof user === 'string' ? user : 
           typeof user === 'object' && user && 'id' in user ? (user as any).id : 
           'unknown';
  }

  /**
   * Extract channel ID from event
   */
  private extractChannelId(event: SlackEvent): string {
    const channel = 'channel' in event ? event.channel : 
                   'channel_id' in event ? (event as any).channel_id : 
                   'unknown';
    return typeof channel === 'string' ? channel : 
           typeof channel === 'object' && channel && 'id' in channel ? (channel as any).id : 
           'unknown';
  }

  /**
   * Determine event type
   */
  private determineEventType(event: SlackEvent): SlackEventType {
    return 'type' in event ? event.type as SlackEventType : 'slash_command';
  }

  /**
   * Initialize bot user ID
   */
  private async initializeBotUserId(): Promise<void> {
    try {
      const authTest = await this.client.auth.test();
      this.botUserId = authTest.user_id as string;
      this.logDebug('Bot user ID initialized', { botUserId: this.botUserId });
    } catch (error) {
      this.logWarn('Could not initialize bot user ID', { error });
    }
  }

  /**
   * Cleanup expired events from deduplication cache
   */
  private cleanupExpiredEvents(): void {
    const now = Date.now();
    for (const [eventId, data] of this.processedEvents.entries()) {
      if (now - data.timestamp > data.ttl) {
        this.processedEvents.delete(eventId);
      }
    }
  }

  /**
   * Get event processing statistics
   */
  getProcessingStats(): {
    processedEventsCount: number;
    botUserId: string | null;
    config: SlackEventHandlerConfig;
  } {
    return {
      processedEventsCount: this.processedEvents.size,
      botUserId: this.botUserId,
      config: this.config
    };
  }
}
