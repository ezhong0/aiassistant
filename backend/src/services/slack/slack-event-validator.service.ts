import { BaseService } from '../base-service';
import { SlackEventType } from '../../types/slack/slack.types';
import logger from '../../utils/logger';

export interface SlackEventValidatorConfig {
  enableDeduplication: boolean;
  enableBotMessageFiltering: boolean;
  maxEventAge: number; // in milliseconds
  maxProcessedEvents: number;
}

export interface SlackEventValidationResult {
  isValid: boolean;
  eventId?: string;
  event?: any;
  eventType?: SlackEventType;
  userId?: string;
  channelId?: string;
  error?: string;
}

export interface SlackEventDeduplicationData {
  processedAt: number;
  eventType: SlackEventType;
  userId: string;
  channelId: string;
  teamId: string;
}

/**
 * SlackEventValidator - Focused service for Slack event validation and deduplication
 * Handles event validation, deduplication, and bot message filtering
 */
export class SlackEventValidator extends BaseService {
  private config: SlackEventValidatorConfig;
  private processedEvents = new Map<string, SlackEventDeduplicationData>();
  private botUserId: string | null = null;

  constructor(config: SlackEventValidatorConfig) {
    super('SlackEventValidator');
    this.config = config;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackEventValidator...');
      
      this.logInfo('SlackEventValidator initialized successfully', {
        enableDeduplication: this.config.enableDeduplication,
        enableBotMessageFiltering: this.config.enableBotMessageFiltering,
        maxEventAge: this.config.maxEventAge,
        maxProcessedEvents: this.config.maxProcessedEvents
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
      this.logInfo('SlackEventValidator destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackEventValidator destruction', error);
    }
  }

  /**
   * Validate a Slack event
   */
  async validateEvent(event: unknown, teamId: string): Promise<SlackEventValidationResult> {
    try {
      // Basic structure validation
      if (!event || typeof event !== 'object') {
        return {
          isValid: false,
          error: 'Invalid event structure'
        };
      }

      const eventObj = event as any;

      // Required fields validation
      if (!eventObj.type) {
        return {
          isValid: false,
          error: 'Missing event type'
        };
      }

      if (!eventObj.ts) {
        return {
          isValid: false,
          error: 'Missing event timestamp'
        };
      }

      // Generate event ID for deduplication
      const eventId = this.generateEventId(eventObj);

      // Check for duplicate events
      if (this.config.enableDeduplication && this.isEventProcessed(eventId)) {
        this.logInfo('Duplicate event detected', {
          eventId,
          eventType: eventObj.type,
          userId: eventObj.user,
          channelId: eventObj.channel
        });
        return {
          isValid: false,
          eventId,
          error: 'Duplicate event'
        };
      }

      // Bot message filtering
      if (this.config.enableBotMessageFiltering && this.isBotMessage(eventObj)) {
        this.logDebug('Bot message detected, skipping', {
          eventId,
          botId: eventObj.bot_id,
          subtype: eventObj.subtype,
          userId: eventObj.user
        });
        return {
          isValid: false,
          eventId,
          error: 'Bot message filtered'
        };
      }

      // Determine event type
      const eventType = this.determineEventType(eventObj);
      if (!eventType) {
        return {
          isValid: false,
          eventId,
          error: `Unsupported event type: ${eventObj.type}`
        };
      }

      // Mark event as processed
      if (this.config.enableDeduplication) {
        this.markEventProcessed(eventId, {
          processedAt: Date.now(),
          eventType,
          userId: eventObj.user || 'unknown',
          channelId: eventObj.channel || 'unknown',
          teamId
        });
      }

      return {
        isValid: true,
        eventId,
        event: eventObj,
        eventType,
        userId: eventObj.user,
        channelId: eventObj.channel
      };

    } catch (error) {
      this.logError('Error validating event', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Set bot user ID for filtering
   */
  setBotUserId(botUserId: string): void {
    this.botUserId = botUserId;
    this.logDebug('Bot user ID set', { botUserId });
  }

  /**
   * Generate unique event ID for deduplication
   */
  private generateEventId(event: any): string {
    return `${event.ts}-${event.user || 'unknown'}-${event.channel || 'unknown'}-${event.type}`;
  }

  /**
   * Check if event has already been processed
   */
  private isEventProcessed(eventId: string): boolean {
    const eventData = this.processedEvents.get(eventId);
    if (!eventData) {
      return false;
    }

    // Check if event is too old
    const age = Date.now() - eventData.processedAt;
    if (age > this.config.maxEventAge) {
      this.processedEvents.delete(eventId);
      return false;
    }

    return true;
  }

  /**
   * Mark event as processed
   */
  private markEventProcessed(eventId: string, data: SlackEventDeduplicationData): void {
    this.processedEvents.set(eventId, data);
    
    // Clean up old events to prevent memory leaks
    if (this.processedEvents.size > this.config.maxProcessedEvents) {
      this.cleanupOldEvents();
    }
  }

  /**
   * Clean up old events
   */
  private cleanupOldEvents(): void {
    const now = Date.now();
    const eventsToRemove: string[] = [];

    for (const [eventId, data] of this.processedEvents.entries()) {
      if (now - data.processedAt > this.config.maxEventAge) {
        eventsToRemove.push(eventId);
      }
    }

    eventsToRemove.forEach(eventId => this.processedEvents.delete(eventId));

    this.logDebug('Cleaned up old events', {
      removed: eventsToRemove.length,
      remaining: this.processedEvents.size
    });
  }

  /**
   * Check if message is from a bot
   */
  private isBotMessage(event: any): boolean {
    // Check for bot_id field
    if (event.bot_id) {
      return true;
    }

    // Check for bot_message subtype
    if (event.subtype === 'bot_message') {
      return true;
    }

    // Check if message is from the bot user itself
    if (this.botUserId && event.user === this.botUserId) {
      return true;
    }

    return false;
  }

  /**
   * Determine event type from raw event
   */
  private determineEventType(event: any): SlackEventType | null {
    switch (event.type) {
      case 'app_mention':
        return 'app_mention';
      case 'message':
        return 'message';
      default:
        return null;
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const baseHealth = super.getHealth();
    
    return {
      healthy: baseHealth.healthy,
      details: {
        ...baseHealth.details,
        config: this.config,
        processedEventsCount: this.processedEvents.size,
        botUserId: this.botUserId
      }
    };
  }
}
