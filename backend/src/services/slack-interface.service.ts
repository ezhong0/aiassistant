import { WebClient } from '@slack/web-api';
import { BaseService } from './base-service';
import { ServiceManager } from './service-manager';
import { TokenManager } from './token-manager';
import { ToolExecutorService } from './tool-executor.service';
import { 
  SlackContext, 
  SlackEventType, 
  SlackAgentRequest, 
  SlackAgentResponse,
  SlackResponse 
} from '../types/slack.types';
import { ToolCall, ToolExecutionContext, ToolResult } from '../types/tools';
import { serviceManager } from './service-manager';
import logger from '../utils/logger';

export interface SlackConfig {
  signingSecret: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  development: boolean;
}

/**
 * SlackInterface Service - Main coordinator for Slack event processing
 * Extends BaseService and follows our established service lifecycle patterns
 * Delegates specialized handling to focused services while maintaining clean separation of concerns
 */
export class SlackInterfaceService extends BaseService {
  private client: WebClient;
  private config: SlackConfig;
  private processedEvents = new Set<string>(); // Track processed events to prevent duplicates
  
  // Injected service dependencies
  private tokenManager: TokenManager | null = null;
  private toolExecutorService: ToolExecutorService | null = null;

  constructor(config: SlackConfig) {
    super('SlackInterfaceService');
    this.config = config;
    this.client = new WebClient(config.botToken);
  }

  /**
   * Service-specific initialization
   * Sets up dependency injection and validates configuration
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

      // Initialize service dependencies through service manager
      await this.initializeDependencies();

      // Test Slack client connection
      await this.testSlackConnection();

      this.logInfo('SlackInterface initialized successfully', {
        hasTokenManager: !!this.tokenManager,
        hasToolExecutor: !!this.toolExecutorService
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
      // Clear processed events cache
      this.processedEvents.clear();
      
      // Reset service references
      this.tokenManager = null;
      this.toolExecutorService = null;

      this.logInfo('SlackInterface destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackInterface destruction', error);
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
   * Initialize service dependencies through dependency injection
   */
  private async initializeDependencies(): Promise<void> {
    // Get TokenManager service
    this.tokenManager = serviceManager.getService('tokenManager') as TokenManager;
    if (!this.tokenManager) {
      this.logWarn('TokenManager not available - OAuth functionality will be limited');
    } else {
      this.logDebug('TokenManager service injected successfully');
    }

    // Get ToolExecutorService
    this.toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;
    if (!this.toolExecutorService) {
      throw new Error('ToolExecutorService is required but not available');
    } else {
      this.logDebug('ToolExecutorService injected successfully');
    }

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
    } catch (error) {
      this.logError('Failed to verify Slack connection', error);
      throw new Error('Slack client authentication failed');
    }
  }

  /**
   * Main entry point for handling Slack events
   * Processes events with deduplication and delegates to appropriate handlers
   */
  async handleEvent(event: any, teamId: string): Promise<void> {
    this.assertReady();

    const startTime = Date.now();
    let eventId: string | undefined;

    try {
      // Create unique event ID for deduplication
      eventId = `${event.ts}-${event.user}-${event.channel}-${event.type}`;
      
      // Check for duplicate events
      if (this.isEventProcessed(eventId)) {
        this.logInfo('Duplicate event detected, skipping processing', {
          eventId,
          eventType: event.type,
          userId: event.user,
          channelId: event.channel
        });
        return;
      }
      
      // Mark event as being processed
      this.markEventProcessed(eventId);
      
      this.logInfo('Processing Slack event', {
        eventId,
        eventType: event.type,
        userId: event.user,
        channelId: event.channel,
        teamId
      });

      // Extract Slack context from event
      const slackContext = await this.extractSlackContext(event, teamId);
      
      // Determine event type
      const eventType = this.determineEventType(event);
      if (!eventType) {
        this.logWarn('Unsupported event type', { eventType: event.type });
        return;
      }

      // Route to appropriate handler
      await this.routeEvent(event, slackContext, eventType);

      const processingTime = Date.now() - startTime;
      this.logInfo('Slack event processed successfully', {
        eventId,
        eventType,
        processingTimeMs: processingTime
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('Error processing Slack event', error, {
        eventId,
        eventType: event.type,
        processingTimeMs: processingTime
      });
      
      // Don't throw - we want to acknowledge receipt even if processing fails
    }
  }

  /**
   * Check if event has already been processed (deduplication)
   */
  private isEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  /**
   * Mark event as processed and manage cache size
   */
  private markEventProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
    
    // Clean up old events to prevent memory leaks
    if (this.processedEvents.size > 1000) {
      const eventsArray = Array.from(this.processedEvents);
      const eventsToRemove = eventsArray.slice(0, 500);
      eventsToRemove.forEach(id => this.processedEvents.delete(id));
      
      this.logDebug('Cleaned up processed events cache', {
        removed: eventsToRemove.length,
        remaining: this.processedEvents.size
      });
    }
  }

  /**
   * Extract Slack context from raw event
   */
  private async extractSlackContext(event: any, teamId: string): Promise<SlackContext> {
    try {
      // Get additional user information if available
      let userName: string | undefined;
      let userEmail: string | undefined;
      
      if (event.user) {
        try {
          const userInfo = await this.client.users.info({ user: event.user });
          if (userInfo.user) {
            userName = userInfo.user.name;
            userEmail = userInfo.user.profile?.email;
          }
        } catch (userError) {
          this.logDebug('Could not fetch additional user info', { error: userError });
        }
      }
      
      return {
        userId: event.user || 'unknown',
        channelId: event.channel || 'unknown',
        teamId: teamId,
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im',
        userName,
        userEmail
      };
    } catch (error) {
      this.logError('Error extracting Slack context', error);
      
      // Return basic context as fallback
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
        text: 'I received your message but it appears to be empty. Please try sending a message with some content.',
        thread_ts: context.threadTs
      });
      return;
    }

    // Check for email-related requests and OAuth requirements
    const requiresOAuth = await this.checkOAuthRequirement(message, context);
    if (requiresOAuth) {
      return; // OAuth message already sent by checkOAuthRequirement
    }

    // Create agent request
    const agentRequest: SlackAgentRequest = {
      message: message,
      context: context,
      eventType: eventType,
      metadata: {
        timestamp: new Date().toISOString(),
        eventId: `${context.userId}-${Date.now()}`
      }
    };

    // Route to master agent through tool executor
    const agentResponse = await this.routeToAgent(agentRequest);

    // Send response back to Slack
    await this.sendAgentResponse(agentResponse, context);
  }

  /**
   * Check if request requires OAuth and handle accordingly
   */
  private async checkOAuthRequirement(message: string, context: SlackContext): Promise<boolean> {
    const emailKeywords = ['email', 'gmail', 'send email', 'compose', 'mail', 'inbox', 'contact', 'contacts'];
    const isEmailRelated = emailKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isEmailRelated && this.tokenManager) {
      const hasOAuth = await this.tokenManager.hasValidOAuthTokens(context.teamId, context.userId);
      if (!hasOAuth) {
        this.logInfo('Email-related request detected but no OAuth tokens found', { 
          userId: context.userId,
          message: message.substring(0, 100)
        });
        
        await this.sendOAuthRequiredMessage(context);
        return true;
      }
    }

    return false;
  }

  /**
   * Route request to master agent through existing system
   */
  private async routeToAgent(request: SlackAgentRequest): Promise<SlackAgentResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.toolExecutorService) {
        throw new Error('ToolExecutorService not available');
      }

      this.logInfo('Routing Slack request to MasterAgent', { 
        message: request.message,
        eventType: request.eventType,
        userId: request.context.userId
      });

      // Generate session ID
      const sessionId = `user:${request.context.teamId}:${request.context.userId}`;
      
      // Get OAuth tokens if available
      let accessToken: string | undefined;
      if (this.tokenManager) {
        try {
          accessToken = await this.tokenManager.getValidTokens(
            request.context.teamId, 
            request.context.userId
          ) || undefined;
        } catch (error) {
          this.logError('Error retrieving OAuth tokens', error, { sessionId });
        }
      }
      
      // Initialize MasterAgent
      const { createMasterAgent } = await import('../config/agent-factory-init');
      const masterAgent = createMasterAgent({ 
        openaiApiKey: process.env.OPENAI_API_KEY || 'dummy-key' 
      });
      
      // Route to MasterAgent for intent parsing
      const masterResponse = await masterAgent.processUserInput(
        request.message,
        sessionId,
        request.context.userId
      );

      // Execute tool calls if present
      const toolResults: ToolResult[] = [];
      if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
        const executionContext: ToolExecutionContext = {
          sessionId,
          userId: request.context.userId,
          timestamp: new Date(),
          slackContext: request.context
        };

        for (const toolCall of masterResponse.toolCalls) {
          try {
            const result = await this.toolExecutorService.executeTool(
              toolCall,
              executionContext,
              accessToken
            );
            
            if (result) {
              toolResults.push(result);
            }
          } catch (error) {
            this.logError(`Error executing tool ${toolCall.name}`, error);
            toolResults.push({
              toolName: toolCall.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown execution error',
              result: null,
              executionTime: 0
            });
          }
        }
      }

      // Format response for Slack
      const slackResponse = await this.formatAgentResponse(
        { ...masterResponse, toolResults },
        request.context
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        response: slackResponse,
        shouldRespond: true,
        executionMetadata: {
          processingTime,
          toolResults,
          masterAgentResponse: masterResponse.message
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('Error routing to agent', error, {
        processingTimeMs: processingTime,
        userId: request.context.userId
      });

      return {
        success: true,
        response: {
          text: 'I apologize, but I encountered an error while processing your request. Please try again.'
        },
        shouldRespond: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionMetadata: {
          processingTime,
          toolResults: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Format agent response for Slack
   */
  private async formatAgentResponse(
    masterResponse: any, 
    slackContext: SlackContext
  ): Promise<SlackResponse> {
    try {
      return this.createFallbackResponse(masterResponse, slackContext);
    } catch (error) {
      this.logError('Error formatting agent response', error);
      return { text: masterResponse.message || 'I processed your request successfully.' };
    }
  }

  /**
   * Create fallback response when formatter service is not available
   */
  private createFallbackResponse(masterResponse: any, slackContext: SlackContext): SlackResponse {
    const response: SlackResponse = {
      text: masterResponse.message || 'I processed your request successfully.'
    };

    // Add simple formatting for tool results
    if (masterResponse.toolResults && masterResponse.toolResults.length > 0) {
      const successfulResults = masterResponse.toolResults.filter((tr: any) => tr.success);
      const failedResults = masterResponse.toolResults.filter((tr: any) => !tr.success);

      if (failedResults.length > 0) {
        const oauthFailures = failedResults.filter((fr: any) => 
          fr.error?.includes('OAuth authentication required')
        );
        
        if (oauthFailures.length > 0) {
          response.text += '\n\n🔐 Some features require Gmail authentication. Please connect your account to use email functionality.';
        }
      }
    }

    return response;
  }

  /**
   * Send agent response back to Slack
   */
  private async sendAgentResponse(response: SlackAgentResponse, context: SlackContext): Promise<void> {
    if (response.shouldRespond !== false && response.response) {
      try {
        if (response.response.blocks && response.response.blocks.length > 0) {
          await this.sendFormattedMessage(context.channelId, response.response.blocks, {
            text: response.response.text,
            thread_ts: context.threadTs
          });
        } else if (response.response.text) {
          await this.sendMessage(context.channelId, {
            text: response.response.text,
            thread_ts: context.threadTs
          });
        }
      } catch (error) {
        this.logError('Error sending agent response to Slack', error);
      }
    }
  }

  /**
   * Send OAuth required message
   */
  private async sendOAuthRequiredMessage(context: SlackContext): Promise<void> {
    try {
      const oauthUrl = await this.generateOAuthUrl(context);
      
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🔐 Gmail Authentication Required*\n' +
                  'To use email, calendar, or contact features, you need to connect your Gmail account first.\n\n' +
                  'This is a one-time setup that keeps your data secure.'
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 Connect Gmail Account'
            },
            style: 'primary',
            action_id: 'gmail_oauth',
            url: oauthUrl
          }
        }
      ];

      await this.sendFormattedMessage(context.channelId, blocks, {
        text: 'Gmail authentication required. Please connect your Gmail account to use email features.',
        thread_ts: context.threadTs
      });
    } catch (error) {
      this.logError('Error sending OAuth required message', error);
      await this.sendMessage(context.channelId, {
        text: '🔐 Gmail authentication required. Please contact support to connect your Gmail account.',
        thread_ts: context.threadTs
      });
    }
  }

  /**
   * Generate OAuth URL for Slack user authentication
   */
  private async generateOAuthUrl(slackContext: SlackContext): Promise<string> {
    try {
      const { ENVIRONMENT } = await import('../config/environment');
      const baseUrl = ENVIRONMENT.baseUrl;
      const clientId = ENVIRONMENT.google.clientId;
      const redirectUri = ENVIRONMENT.google.redirectUri || `${baseUrl}/auth/callback`;

      if (!clientId) {
        throw new Error('Google OAuth client ID not configured');
      }

      const state = JSON.stringify({
        source: 'slack',
        team_id: slackContext.teamId,
        user_id: slackContext.userId,
        channel_id: slackContext.channelId
      });

      const scopes = [
        'openid',
        'email', 
        'profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/contacts.readonly'
      ].join(' ');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes,
        state: state,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent'
      });

      return authUrl;
    } catch (error) {
      this.logError('Error generating OAuth URL', error);
      const { ENVIRONMENT } = await import('../config/environment');
      return `${ENVIRONMENT.baseUrl}/auth/error?message=OAuth+URL+generation+failed`;
    }
  }

  /**
   * Send simple text message to Slack
   */
  private async sendMessage(channelId: string, message: { text: string; thread_ts?: string }): Promise<void> {
    try {
      await this.client.chat.postMessage({
        channel: channelId,
        text: message.text,
        thread_ts: message.thread_ts
      });
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
    options?: { text?: string; thread_ts?: string }
  ): Promise<void> {
    try {
      const messagePayload: any = {
        channel: channelId,
        blocks: blocks
      };

      if (options?.text) messagePayload.text = options.text;
      if (options?.thread_ts) messagePayload.thread_ts = options.thread_ts;

      await this.client.chat.postMessage(messagePayload);
    } catch (error) {
      this.logError('Error sending formatted message to Slack', error);
      
      // Fallback to simple text message
      if (options?.text) {
        await this.sendMessage(channelId, { 
          text: options.text, 
          thread_ts: options.thread_ts 
        });
      }
    }
  }

  /**
   * Clean Slack message (remove mentions, normalize whitespace)
   */
  private cleanMessage(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/<@[UW][A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/<#[C][A-Z0-9]+\|[^>]+>/g, '') // Remove channel mentions
      .replace(/<![^>]+>/g, '') // Remove special mentions (@channel, @here)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
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
        dependencies: {
          tokenManager: !!this.tokenManager,
          toolExecutorService: !!this.toolExecutorService,
        },
        processedEventsCount: this.processedEvents.size
      }
    };
  }
}