import { WebClient } from '@slack/web-api';
import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { SlackEventHandler } from './slack-event-handler.service';
import { SlackOAuthManager } from './slack-oauth-manager.service';
import { SlackConfirmationHandler } from './slack-confirmation-handler.service';
import { SlackMessageProcessor } from './slack-message-processor.service';
import { SlackResponseFormatter } from './slack-response-formatter.service';
import { SlackEventValidator } from './slack-event-validator.service';
import { SlackContextExtractor } from './slack-context-extractor.service';
import { 
  SlackContext, 
  SlackEventType, 
  SlackResponse 
} from '../../types/slack/slack.types';
import { serviceManager } from '../service-manager';
import logger from '../../utils/logger';

export interface SlackConfig {
  signingSecret: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  development: boolean;
}

/**
 * SlackInterface Service - Refactored coordinator for Slack event processing
 * Now delegates to focused services for proper separation of concerns
 */
export class SlackInterfaceService extends BaseService {
  private client: WebClient;
  private config: SlackConfig;
  
  // Focused services for proper separation of concerns
  private slackEventHandler: SlackEventHandler | null = null;
  private slackOAuthManager: SlackOAuthManager | null = null;
  private slackConfirmationHandler: SlackConfirmationHandler | null = null;
  private slackMessageProcessor: SlackMessageProcessor | null = null;
  private slackResponseFormatter: SlackResponseFormatter | null = null;
  private slackEventValidator: SlackEventValidator | null = null;
  private slackContextExtractor: SlackContextExtractor | null = null;

  constructor(config: SlackConfig) {
    super('SlackInterfaceService');
    this.config = config;
    this.client = new WebClient(config.botToken);
  }

  /**
   * Service-specific initialization
   * Sets up focused services and validates configuration
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Starting SlackInterface initialization...', {
        development: this.config.development,
        hasSigningSecret: !!this.config.signingSecret,
        hasBotToken: !!this.config.botToken,
        hasClientId: !!this.config.clientId
      });

      // Validate configuration
      this.validateConfig();

      // Initialize focused services
      await this.initializeFocusedServices();

      // Test Slack client connection
      await this.testSlackConnection();

      this.logInfo('SlackInterface initialized successfully', {
        hasSlackEventHandler: !!this.slackEventHandler,
        hasSlackOAuthManager: !!this.slackOAuthManager,
        hasSlackConfirmationHandler: !!this.slackConfirmationHandler,
        hasSlackMessageProcessor: !!this.slackMessageProcessor,
        hasSlackResponseFormatter: !!this.slackResponseFormatter,
        hasSlackEventValidator: !!this.slackEventValidator,
        hasSlackContextExtractor: !!this.slackContextExtractor
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
      // Destroy focused services
      if (this.slackEventHandler) {
        await this.slackEventHandler.destroy();
        this.slackEventHandler = null;
      }
      
      if (this.slackOAuthManager) {
        await this.slackOAuthManager.destroy();
        this.slackOAuthManager = null;
      }
      
      if (this.slackConfirmationHandler) {
        await this.slackConfirmationHandler.destroy();
        this.slackConfirmationHandler = null;
      }
      
      if (this.slackMessageProcessor) {
        await this.slackMessageProcessor.destroy();
        this.slackMessageProcessor = null;
      }
      
      if (this.slackResponseFormatter) {
        await this.slackResponseFormatter.destroy();
        this.slackResponseFormatter = null;
      }
      
      if (this.slackEventValidator) {
        await this.slackEventValidator.destroy();
        this.slackEventValidator = null;
      }
      
      if (this.slackContextExtractor) {
        await this.slackContextExtractor.destroy();
        this.slackContextExtractor = null;
      }

      this.logInfo('SlackInterface destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackInterface destruction', error);
    }
  }

  /**
   * Main entry point for handling Slack events
   * Now delegates to focused services for proper separation of concerns
   */
  async handleEvent(event: any, teamId: string): Promise<void> {
    this.assertReady();

    try {
      // Use SlackEventHandler for proper event processing
      if (this.slackEventHandler) {
        const processingResult = await this.slackEventHandler.processEvent(event, teamId);
        
        if (!processingResult.success) {
          this.logWarn('Event processing failed via SlackEventHandler', {
            eventId: processingResult.eventId,
            error: processingResult.error
          });
          return;
        }

        // Extract Slack context from the processed event
        const slackContext = await this.extractSlackContext(event, teamId);
        
        // Route to appropriate handler based on event type
        const eventType = this.determineEventType(event);
        if (!eventType) {
          this.logWarn('Unsupported event type', { eventType: event.type });
          return;
        }

        await this.routeEvent(event, slackContext, eventType);
        
        this.logInfo('Slack event processed successfully via SlackEventHandler', {
          eventId: processingResult.eventId,
          eventType: processingResult.eventType,
          userId: processingResult.userId,
          channelId: processingResult.channelId
        });
      } else {
        // Fallback to basic processing if SlackEventHandler not available
        this.logWarn('SlackEventHandler not available, using basic event processing');
        await this.handleEventBasic(event, teamId);
      }
    } catch (error) {
      this.logError('Error handling Slack event', error);
    }
  }

  /**
   * Basic event handling fallback when SlackEventHandler is not available
   */
  private async handleEventBasic(event: any, teamId: string): Promise<void> {
    try {
      // Basic validation
      if (!event || !event.type || !event.ts) {
        this.logWarn('Invalid event structure', { event });
        return;
      }

      // Skip bot messages
      if (event.bot_id || event.subtype === 'bot_message') {
        this.logDebug('Bot message detected, skipping', { eventId: event.ts });
        return;
      }

      // Extract Slack context
      const slackContext = await this.extractSlackContext(event, teamId);
      
      // Determine event type
      const eventType = this.determineEventType(event);
      if (!eventType) {
        this.logWarn('Unsupported event type', { eventType: event.type });
        return;
      }

      // Route to appropriate handler
      await this.routeEvent(event, slackContext, eventType);

    } catch (error) {
      this.logError('Error in basic event handling', error);
    }
  }

  /**
   * Route event to appropriate handler based on type and context
   */
  private async routeEvent(
    event: any, 
    context: SlackContext, 
    eventType: SlackEventType
  ): Promise<void> {
    const message = this.cleanMessage(event.text || '');
    
    // Validate message
    if (!message || message.trim().length === 0) {
      await this.sendMessage(context.channelId, {
        text: 'I received your message but it appears to be empty. Please try sending a message with some content.'
      });
      return;
    }

    // Use SlackMessageProcessor for comprehensive message processing
    if (this.slackMessageProcessor) {
      const processingResult = await this.slackMessageProcessor.processMessage(message, context, eventType);
      
      if (processingResult.shouldRespond && processingResult.response) {
        // Use SlackResponseFormatter for response formatting
        if (this.slackResponseFormatter) {
          const formattedResponse = await this.slackResponseFormatter.formatAgentResponse(
            { message: processingResult.response.text, toolResults: [] },
            context
          );
          await this.sendAgentResponse(formattedResponse, context);
        } else {
          await this.sendMessage(context.channelId, processingResult.response);
        }
      }
    } else {
      // Fallback to basic processing
      this.logWarn('SlackMessageProcessor not available, using basic message processing');
      await this.sendMessage(context.channelId, {
        text: 'I received your message but I\'m having trouble processing it right now. Please try again.'
      });
    }
  }

  /**
   * Extract Slack context from raw event
   */
  private async extractSlackContext(event: any, teamId: string): Promise<SlackContext> {
    if (this.slackContextExtractor) {
      return await this.slackContextExtractor.extractSlackContext(event, teamId);
    } else {
      // Fallback to basic context extraction
      return {
        userId: event.user || 'unknown',
        channelId: event.channel || 'unknown',
        teamId: teamId,
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im'
      };
    }
  }

  /**
   * Clean Slack message (remove mentions, normalize whitespace)
   */
  private cleanMessage(text: string): string {
    if (this.slackContextExtractor) {
      return this.slackContextExtractor.cleanMessage(text);
    } else {
      // Fallback to basic cleaning
      if (!text) return '';
      return text
        .replace(/<@[UW][A-Z0-9]+>/g, '')
        .replace(/<#[C][A-Z0-9]+\|[^>]+>/g, '')
        .replace(/<![^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
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
   * Send agent response back to Slack
   */
  private async sendAgentResponse(response: SlackResponse, context: SlackContext): Promise<void> {
    try {
      if (response.blocks && response.blocks.length > 0) {
        await this.sendFormattedMessage(context.channelId, response.blocks, {
          text: response.text || undefined
        });
      } else if (response.text) {
        await this.sendMessage(context.channelId, {
          text: response.text
        });
      }
    } catch (error) {
      this.logError('Error sending agent response to Slack', error);
    }
  }

  /**
   * Send simple text message to Slack
   */
  private async sendMessage(channelId: string, message: { text: string }): Promise<void> {
    try {
      const messagePayload = {
        channel: channelId,
        text: message.text
      };
      
      this.logDebug('Sending message to Slack', { 
        channel: channelId,
        messageLength: message.text.length
      });
      
      await this.client.chat.postMessage(messagePayload);
    } catch (error) {
      this.logError('Error sending message to Slack', error);
    }
  }

  /**
   * Send formatted message with blocks to Slack
   */
  private async sendFormattedMessage(
    channelId: string, 
    blocks: any[], 
    options?: { text?: string }
  ): Promise<void> {
    try {
      const messagePayload: any = {
        channel: channelId,
        blocks: blocks
      };

      if (options?.text) messagePayload.text = options.text;

      await this.client.chat.postMessage(messagePayload);
    } catch (error) {
      this.logError('Error sending formatted message to Slack', error);
      
      // Fallback to simple text message
      if (options?.text) {
        await this.sendMessage(channelId, { 
          text: options.text
        });
      }
    }
  }

  /**
   * Validate required configuration
   */
  private validateConfig(): void {
    const requiredFields = ['signingSecret', 'botToken', 'clientId', 'clientSecret'];
    const missingFields = requiredFields.filter(field => !this.config[field as keyof SlackConfig]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required Slack configuration: ${missingFields.join(', ')}`);
    }

    this.logDebug('Slack configuration validated successfully');
  }

  /**
   * Initialize focused services
   */
  private async initializeFocusedServices(): Promise<void> {
    // Initialize SlackEventHandler
    this.slackEventHandler = serviceManager.getService('slackEventHandler') as unknown as SlackEventHandler;
    if (!this.slackEventHandler) {
      this.logWarn('SlackEventHandler not available - event processing will use fallback');
    }

    // Initialize SlackOAuthManager
    this.slackOAuthManager = serviceManager.getService('slackOAuthManager') as SlackOAuthManager;
    if (!this.slackOAuthManager) {
      this.logWarn('SlackOAuthManager not available - OAuth handling will use fallback');
    }

    // Initialize SlackConfirmationHandler
    this.slackConfirmationHandler = serviceManager.getService('slackConfirmationHandler') as SlackConfirmationHandler;
    if (!this.slackConfirmationHandler) {
      this.logWarn('SlackConfirmationHandler not available - confirmation handling will use fallback');
    }

    // Initialize SlackMessageProcessor
    this.slackMessageProcessor = new SlackMessageProcessor({
      enableOAuthDetection: true,
      enableConfirmationDetection: true,
      enableDMOnlyMode: true
    });
    await this.slackMessageProcessor.initialize();

    // Initialize SlackResponseFormatter
    this.slackResponseFormatter = new SlackResponseFormatter({
      enableRichFormatting: true,
      maxTextLength: 3800,
      enableProposalFormatting: true
    });
    await this.slackResponseFormatter.initialize();

    // Initialize SlackEventValidator
    this.slackEventValidator = new SlackEventValidator({
      enableDeduplication: true,
      enableBotMessageFiltering: true,
      maxEventAge: 300000, // 5 minutes
      maxProcessedEvents: 1000
    });
    await this.slackEventValidator.initialize();

    // Initialize SlackContextExtractor
    this.slackContextExtractor = new SlackContextExtractor({
      enableUserInfoFetching: true,
      enableEmailExtraction: true,
      maxRetries: 3,
      retryDelay: 1000
    }, this.client);
    await this.slackContextExtractor.initialize();
  }

  /**
   * Test Slack client connection
   */
  private async testSlackConnection(): Promise<void> {
    try {
      const authTest = await this.client.auth.test();
      this.logInfo('Slack connection verified', {
        teamId: authTest.team_id,
        userId: authTest.user_id,
        botId: authTest.bot_id
      });

      // Set bot user ID in event validator if available
      if (this.slackEventValidator && authTest.user_id) {
        this.slackEventValidator.setBotUserId(authTest.user_id as string);
      }
    } catch (error) {
      this.logError('Failed to verify Slack connection', error);
      throw new Error('Slack client authentication failed');
    }
  }

  /**
   * Get service health status
   */
  getHealth(): { healthy: boolean; details?: any } {
    const baseHealth = super.getHealth();
    
    return {
      healthy: baseHealth.healthy && !!this.client,
      details: {
        ...baseHealth.details,
        configured: !!(
          this.config.signingSecret &&
          this.config.botToken &&
          this.config.clientId
        ),
        development: this.config.development,
        hasClient: !!this.client,
        focusedServices: {
          slackEventHandler: !!this.slackEventHandler,
          slackOAuthManager: !!this.slackOAuthManager,
          slackConfirmationHandler: !!this.slackConfirmationHandler,
          slackMessageProcessor: !!this.slackMessageProcessor,
          slackResponseFormatter: !!this.slackResponseFormatter,
          slackEventValidator: !!this.slackEventValidator,
          slackContextExtractor: !!this.slackContextExtractor
        }
      }
    };
  }
}
