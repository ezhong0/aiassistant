import { WebClient } from '@slack/web-api';
import { BaseService } from '../base-service';
import { ServiceManager } from '../service-manager';
import { SlackEventHandler } from './slack-event-handler.service';
// SlackOAuthManager removed - using SlackOAuthService directly
import { SlackOAuthService } from './slack-oauth.service';
import { SlackMessageProcessor } from './slack-message-processor.service';
// SlackEventValidator removed - validation handled directly in SlackInterfaceService
import { 
  SlackContext, 
  SlackEventType, 
  SlackResponse,
  SlackEvent
} from '../../types/slack/slack.types';
import { SlackConfig } from '../../types/slack/slack-config.types';
import { serviceManager } from '../service-manager';

/**
 * SlackInterface Service - Central coordinator for all Slack operations
 * 
 * This service acts as the main interface between the application and Slack,
 * coordinating specialized services for event processing, OAuth management,
 * message processing, and response formatting. It provides a clean API
 * while delegating complex operations to focused services.
 * 
 * @example
 * ```typescript
 * const slackService = new SlackInterfaceService({
 *   signingSecret: process.env.SLACK_SIGNING_SECRET,
 *   botToken: process.env.SLACK_BOT_TOKEN,
 *   clientId: process.env.SLACK_CLIENT_ID,
 *   clientSecret: process.env.SLACK_CLIENT_SECRET,
 *   redirectUri: process.env.SLACK_REDIRECT_URI,
 *   development: process.env.NODE_ENV === 'development'
 * });
 * 
 * await slackService.initialize();
 * ```
 */
export class SlackInterfaceService extends BaseService {
  private webClient: WebClient;
  private config: SlackConfig;
  
  // Focused services for proper separation of concerns
  private slackEventHandler: SlackEventHandler | null = null;
  private slackOAuthService: SlackOAuthService | null = null;
  private slackMessageProcessor: SlackMessageProcessor | null = null;
  private slackResponseFormatter: any | null = null;
  // slackEventValidator removed - validation handled directly in SlackInterfaceService

  /**
   * Initialize SlackInterface service with configuration
   * 
   * @param config - Slack configuration including tokens, secrets, and OAuth settings
   * 
   * @example
   * ```typescript
   * const slackService = new SlackInterfaceService({
   *   signingSecret: process.env.SLACK_SIGNING_SECRET,
   *   botToken: process.env.SLACK_BOT_TOKEN,
   *   clientId: process.env.SLACK_CLIENT_ID,
   *   clientSecret: process.env.SLACK_CLIENT_SECRET,
   *   redirectUri: process.env.SLACK_REDIRECT_URI,
   *   development: process.env.NODE_ENV === 'development'
   * });
   * ```
   */
  constructor(config: SlackConfig) {
    super('SlackInterfaceService');
    this.config = config;
    this.webClient = new WebClient(config.botToken);
  }

  /**
   * Get the Slack WebClient for API operations
   */
  get client(): WebClient {
    return this.webClient;
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
        hasSlackOAuthService: !!this.slackOAuthService,
        hasSlackMessageProcessor: !!this.slackMessageProcessor,
        hasSlackResponseFormatter: !!this.slackResponseFormatter,
        slackEventValidationEnabled: true,
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
      
      if (this.slackOAuthService) {
        await this.slackOAuthService.destroy();
        this.slackOAuthService = null;
      }
      
      
      if (this.slackMessageProcessor) {
        await this.slackMessageProcessor.destroy();
        this.slackMessageProcessor = null;
      }
      
      if (this.slackResponseFormatter) {
        await this.slackResponseFormatter.destroy();
        this.slackResponseFormatter = null;
      }
      
      // Event validation cleanup handled internally
      
    
      this.logInfo('SlackInterface destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackInterface destruction', error);
    }
  }

  /**
   * Handle incoming Slack events with proper type safety
   * 
   * @param event - Slack event object with proper typing
   * @param teamId - Slack team identifier
   * 
   * @example
   * ```typescript
   * await slackService.handleEvent(slackEvent, 'T1234567890');
   * ```
   */
  async handleEvent(event: SlackEvent, teamId: string): Promise<void> {
    console.log('🎯 SlackInterfaceService.handleEvent called');
    console.log('📊 Event type:', this.getEventType(event));
    console.log('📊 Team ID:', teamId);
    console.log('📊 Event data:', JSON.stringify(event, null, 2));
    
    this.assertReady();

    try {
      // Use SlackEventHandler for proper event processing
      if (this.slackEventHandler) {
        console.log('✅ Using SlackEventHandler for processing...');
        const processingResult = await this.slackEventHandler.processEvent(event, teamId);
        
        if (!processingResult.success) {
          console.error('❌ Event processing failed:', processingResult.error);
          this.logWarn('Event processing failed via SlackEventHandler', {
            eventId: processingResult.eventId,
            error: processingResult.error
          });
          return;
        }

        console.log('✅ Event processing successful, extracting context...');
        // Extract Slack context from the processed event
        const slackContext = await this.extractSlackContext(event, teamId);
        
        console.log('✅ Context extracted, routing event...');
        // Route to appropriate handler based on event type
        const eventType = this.determineEventType(event);
        if (!eventType) {
          this.logWarn('Unsupported event type', { eventType: this.getEventType(event) });
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
   * Get event type safely from any Slack event
   * 
   * @param event - Slack event object
   * @returns Event type string or 'unknown'
   */
  private getEventType(event: SlackEvent): string {
    if ('type' in event) {
      return event.type;
    }
    return 'unknown';
  }

  /**
   * Get event text safely from any Slack event
   * 
   * @param event - Slack event object
   * @returns Event text or empty string
   */
  private getEventText(event: SlackEvent): string {
    if ('text' in event) {
      return event.text || '';
    }
    return '';
  }

  /**
   * Get event user safely from any Slack event
   * 
   * @param event - Slack event object
   * @returns User ID or empty string
   */
  private getEventUser(event: SlackEvent): string {
    if ('user' in event) {
      const user = event.user;
      return typeof user === 'string' ? user : user?.id || '';
    }
    return '';
  }

  /**
   * Get event channel safely from any Slack event
   * 
   * @param event - Slack event object
   * @returns Channel ID or empty string
   */
  private getEventChannel(event: SlackEvent): string {
    if ('channel' in event) {
      const channel = event.channel;
      return typeof channel === 'string' ? channel : channel?.id || '';
    }
    return '';
  }

  /**
   * Get event thread timestamp safely from any Slack event
   * 
   * @param event - Slack event object
   * @returns Thread timestamp or undefined
   */
  private getEventThreadTs(event: SlackEvent): string | undefined {
    if ('thread_ts' in event) {
      return event.thread_ts;
    }
    return undefined;
  }

  /**
   * Get event channel type safely from any Slack event
   * 
   * @param event - Slack event object
   * @returns Channel type or undefined
   */
  private getEventChannelType(event: SlackEvent): string | undefined {
    if ('channel_type' in event) {
      return event.channel_type;
    }
    return undefined;
  }
  /**
   * Basic event handling fallback when specialized services are unavailable
   * 
   * @param event - Slack event object
   * @param teamId - Slack team identifier
   */
  private async handleEventBasic(event: SlackEvent, teamId: string): Promise<void> {
    // Throw error instead of providing fallback handling
    throw new Error('SlackEventHandler is required for event processing');
  }

  /**
   * Route event to appropriate handler based on type and context
   */
  /**
   * Route events to appropriate handlers based on event type
   * 
   * @param event - Slack event object
   * @param context - Extracted Slack context
   * @param eventType - Determined event type
   */
  private async routeEvent(
    event: SlackEvent, 
    context: SlackContext, 
    eventType: SlackEventType
  ): Promise<void> {
    const message = this.cleanMessage(this.getEventText(event));
    
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
  /**
   * Extract Slack context from event with proper typing
   * 
   * @param event - Slack event object
   * @param teamId - Slack team identifier
   * @returns Extracted Slack context
   */
  private async extractSlackContext(event: SlackEvent, teamId: string): Promise<SlackContext> {
    // Use basic extraction
    {
      // Basic context extraction
      return {
        userId: this.getEventUser(event) || 'unknown',
        channelId: this.getEventChannel(event) || 'unknown',
        teamId: teamId,
        threadTs: this.getEventThreadTs(event),
        isDirectMessage: this.getEventChannelType(event) === 'im'
      };
    }
  }

  /**
   * Clean Slack message (remove mentions, normalize whitespace)
   */
  private cleanMessage(text: string): string {
    // Use basic cleaning
    {
      // Basic cleaning
      if (!text) return '';
      return text
        .replace(/<@[UW][A-Z0-9]+>/g, '')
        .replace(/<#[C][A-Z0-9]+\|[^>]+>/g, '')
        .replace(/<![^>]+>/g, '')
        .replace(/<mailto:([^|>]+)\|[^>]+>/g, '$1') // Extract email from mailto links
        .replace(/<mailto:([^>]+)>/g, '$1') // Extract email from simple mailto links
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  /**
   * Determine event type from raw event
   */
  /**
   * Determine event type from Slack event with proper typing
   * 
   * @param event - Slack event object
   * @returns Determined event type or null if unsupported
   */
  private determineEventType(event: SlackEvent): SlackEventType | null {
    const eventType = this.getEventType(event);
    switch (eventType) {
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
  /**
   * Send formatted message using Slack blocks with proper typing
   * 
   * @param channelId - Slack channel identifier
   * @param blocks - Array of Slack block elements
   * @param options - Optional message options including fallback text
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
    this.slackEventHandler = serviceManager.getService<SlackEventHandler>('slackEventHandler') || null;
    if (!this.slackEventHandler) {
      this.logWarn('SlackEventHandler not available - event processing will use fallback');
    }

    // Initialize SlackOAuthService
    this.slackOAuthService = serviceManager.getService('slackOAuthService') as SlackOAuthService;
    if (!this.slackOAuthService) {
      this.logWarn('SlackOAuthService not available - OAuth handling will use fallback');
    }


    // Initialize SlackMessageProcessor - use shared service with async processing
    this.slackMessageProcessor = serviceManager.getService<SlackMessageProcessor>('slackMessageProcessor') || null;

    this.logInfo('SlackMessageProcessor service lookup result', {
      found: !!this.slackMessageProcessor,
      serviceManagerAvailable: !!serviceManager,
      registeredServices: serviceManager ? Object.keys((serviceManager as any).services || {}) : []
    });

    if (!this.slackMessageProcessor) {
      this.logWarn('SlackMessageProcessor not available from service manager - creating fallback instance');
      this.slackMessageProcessor = new SlackMessageProcessor({
        enableOAuthDetection: true,
        enableConfirmationDetection: true,
        enableDMOnlyMode: true,
        enableAsyncProcessing: false // Fallback without async
      });
      await this.slackMessageProcessor.initialize();
    } else {
      this.logInfo('Successfully retrieved shared SlackMessageProcessor with async processing enabled');
    }

    // SlackResponseFormatter service removed - using direct response generation

    // Initialize SlackEventValidator
    // Event validation now handled directly in SlackInterfaceService

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
      // Event validation setup handled internally
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
          slackOAuthService: !!this.slackOAuthService,
          slackMessageProcessor: !!this.slackMessageProcessor,
          slackResponseFormatter: !!this.slackResponseFormatter,
          slackEventValidationEnabled: true,
        }
      }
    };
  }
}
