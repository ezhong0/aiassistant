import { WebClient } from '@slack/web-api';
import { ServiceManager, getService } from '../../services/service-manager';
import {
  SlackContext,
  SlackEventType,
  SlackAgentRequest,
  SlackAgentResponse,
  SlackEvent,
  SlackSayFunction,
  SlackMessage,
  SlackBlock,
  SlackRespondFunction,
  SlackHandlers,
  SlackSlashCommandPayload
} from '../slack/slack.types';
import { ToolExecutionContext, ToolResult } from '../tools';
import { TokenStorageService } from '../../services/token-storage.service';
import { TokenManager } from '../../services/token-manager';
import { AIClassificationService } from '../../services/ai-classification.service';
import { ToolRoutingService } from '../../services/tool-routing.service';
import logger from '../../utils/logger';
import { APP_CONSTANTS } from '../../config/constants';
import { MasterAgentResponse } from '../../agents/master.agent';
import {
  validateSlackEvent,
  validateSlackContext,
  validateSlackMessage,
  isSlackEvent,
  isSlackContext
} from '../../utils/type-guards';

// Master Agent interface
interface MasterAgentInterface {
  processUserInput: (message: string, sessionId: string, userId: string, context: SlackContext) => Promise<MasterAgentResponse>;
  processToolResultsWithLLM: (message: string, toolResults: ToolResult[], sessionId: string) => Promise<string>;
}

export interface SlackConfig {
  signingSecret: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  development: boolean;
}

export class SlackInterface {
  private client: WebClient;
  private serviceManager: ServiceManager;
  private config: SlackConfig;
  private tokenStorageService: TokenStorageService | null = null;
  private tokenManager: TokenManager | null = null;
  private processedEvents = new Map<string, number>(); // Track processed events with timestamps for TTL
  private pendingActions = new Map<string, any>(); // Store pending actions awaiting confirmation
  private botUserId: string | null = null; // Cache bot user ID to prevent infinite loops

  constructor(config: SlackConfig, serviceManager: ServiceManager) {
    this.config = config;
    this.serviceManager = serviceManager;

    // Initialize token storage and token managers
    this.tokenStorageService = this.serviceManager.getService('tokenStorageService') as unknown as TokenStorageService;
    this.tokenManager = this.serviceManager.getService('tokenManager') as unknown as TokenManager;

    // Initialize Slack client for direct API calls
    this.client = new WebClient(config.botToken);

    logger.debug('SlackInterface initialized with manual routing');
  }

  /**
   * Start the Slack interface
   * No-op since we're using manual routing through /slack/events
   */
  public async start(): Promise<void> {
    try {
      logger.debug('Slack interface started (manual routing)');
    } catch (error) {
      logger.error('Failed to start Slack interface:', error);
      throw error;
    }
  }

  /**
   * Stop the Slack interface
   * No-op since we don't have a Bolt app instance
   */
  public async stop(): Promise<void> {
    try {
      logger.debug('Slack interface stopped');
    } catch (error) {
      logger.error('Failed to stop Slack interface:', error);
      throw error;
    }
  }

  /**
   * Handle Slack events directly
   */
  public async handleEvent(event: unknown, teamId: string): Promise<void> {
    try {
      // Validate event structure using type guards
      const validatedEvent = validateSlackEvent(event);

      // Create unique event ID for deduplication
      const ts = 'ts' in validatedEvent ? validatedEvent.ts : Date.now().toString();
      const user = 'user' in validatedEvent ? validatedEvent.user : 'user_id' in validatedEvent ? (validatedEvent as any).user_id : 'unknown';
      const channel = 'channel' in validatedEvent ? validatedEvent.channel : 'channel_id' in validatedEvent ? (validatedEvent as any).channel_id : 'unknown';
      const eventType = 'type' in validatedEvent ? validatedEvent.type : 'slash_command';
      const eventId = `${ts}-${user}-${channel}-${eventType}`;

      // Check if we've already processed this event (TTL-based)
      this.cleanupExpiredEvents();
      if (this.processedEvents.has(eventId)) {
        logger.debug('Duplicate event detected, skipping');
        return;
      }

      // Mark event as being processed with timestamp
      this.processedEvents.set(eventId, Date.now());
      
      logger.debug('Processing Slack event', {
        eventId,
        eventType: eventType,
        userId: user,
        channelId: channel
      });

      // Skip bot messages to prevent infinite loops
      if ((validatedEvent as any).bot_id || (validatedEvent as any).subtype === 'bot_message') {
        logger.debug('Bot message detected, skipping to prevent infinite loop', {
          eventId,
          botId: (validatedEvent as any).bot_id,
          subtype: (validatedEvent as any).subtype
        });
        return;
      }

      // Skip messages from the bot user itself
      if (this.botUserId && user === this.botUserId) {
        logger.debug('Message from bot user detected, skipping to prevent infinite loop', {
          eventId,
          botUserId: this.botUserId,
          eventUserId: user
        });
        return;
      }

      // Initialize bot user ID if not cached
      if (!this.botUserId) {
        try {
          const authTest = await this.client.auth.test();
          this.botUserId = authTest.user_id as string;
          logger.debug('Bot user ID cached', { botUserId: this.botUserId });
          
          // Double-check with cached value
          if (user === this.botUserId) {
            logger.debug('Message from bot user detected (cached check), skipping to prevent infinite loop', {
              eventId,
              botUserId: this.botUserId,
              eventUserId: user
            });
            return;
          }
        } catch (error) {
          logger.warn('Could not verify bot user ID, continuing with processing', { error });
        }
      }

      // Create Slack context from event
      const threadTs = 'thread_ts' in validatedEvent ? validatedEvent.thread_ts : undefined;
      const slackContext: SlackContext = {
        userId: user,
        channelId: channel,
        teamId: teamId,
        threadTs: threadTs,
        isDirectMessage: (validatedEvent as any).channel_type === 'im'
      };

      // Validate the created context using type guards
      if (!isSlackContext(slackContext)) {
        logger.error('Invalid SlackContext created from event', { eventId, slackContext });
        return;
      }

      // Enforce DM-only mode - reject channel-based interactions
      if (!slackContext.isDirectMessage) {
        logger.warn('Channel interaction rejected - DM-only mode enforced', {
          eventId,
          eventType: eventType,
          userId: user,
          channelId: channel,
          channelType: (validatedEvent as any).channel_type
        });

        // Send a polite message explaining DM-only policy
        await this.client.chat.postMessage({
          channel: slackContext.channelId,
          text: "🔒 AI Assistant works exclusively through direct messages to protect your privacy. Please send me a direct message to get assistance."
        });
        return;
      }

      // Determine event type for processing
      let processEventType: SlackEventType;
      if (eventType === 'app_mention') {
        processEventType = 'app_mention';
      } else if (eventType === 'message') {
        processEventType = 'message';
      } else if (eventType === 'slash_command') {
        processEventType = 'slash_command';
      } else {
        logger.warn('Unsupported event type', { eventType: eventType });
        return;
      }

      // Process the event using existing logic
      await this.handleSlackEvent(
        (validatedEvent as any).text || '',
        slackContext,
        processEventType,
        {
          say: async (message: string | SlackMessage) => {
            // Send response back to Slack via Web API
            const postMessageArgs: any = {
              channel: slackContext.channelId,
              text: typeof message === 'string' ? message : message.text
            };

            if (typeof message !== 'string' && message.blocks) {
              postMessageArgs.blocks = message.blocks;
            }

            await this.client.chat.postMessage(postMessageArgs);
          },
          client: this.client
        }
      );

    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid SlackEvent')) {
        logger.warn('Invalid Slack event structure received', {
          error: error.message,
          eventData: typeof event === 'object' ? JSON.stringify(event) : event
        });
        return; // Silently ignore invalid events
      }

      logger.error('Error handling Slack event directly', error);
    }
  }


  /**
   * Enhanced context extraction from Slack events
   */
  private async createSlackContextFromEvent(event: SlackEvent, payload?: SlackEvent): Promise<SlackContext> {
    try {
      // Extract user ID safely from different event types
      const userId = 'user' in event ? event.user : 'user_id' in event ? (event as any).user_id : 'unknown';

      // Get additional user information if available
      let userName: string | undefined;
      let userEmail: string | undefined;

      if (userId && userId !== 'unknown') {
        try {
          const userInfo = await this.client.users.info({ user: userId });
          if (userInfo.user) {
            userName = userInfo.user.name;
            userEmail = userInfo.user.profile?.email;
          }
        } catch (userError) {
          logger.debug('Could not fetch additional user info:', userError);
        }
      }

      // Extract team ID safely from different event types
      const teamId = ('team_id' in event ? (event as any).team_id : null) ||
                     (payload && 'team' in payload ? (payload as any).team?.id : null) ||
                     (await this.client.auth.test()).team_id;
      
      // Extract channel ID safely from different event types
      const channelId = 'channel' in event ? event.channel : 'channel_id' in event ? (event as any).channel_id : 'unknown';

      // Extract thread timestamp safely
      const threadTs = 'thread_ts' in event ? event.thread_ts : undefined;

      // Extract channel type safely
      const isDirectMessage = 'channel_type' in event ? (event as any).channel_type === 'im' : false;

      return {
        userId,
        channelId,
        teamId: teamId as string,
        threadTs,
        isDirectMessage,
        userName,
        userEmail
      };
    } catch (error) {
      logger.error('Error creating enhanced Slack context:', error);
      
      // Fallback to basic context with safe property access
      const fallbackUserId = 'user' in event ? event.user : 'user_id' in event ? (event as any).user_id : 'unknown';
      const fallbackChannelId = 'channel' in event ? event.channel : 'channel_id' in event ? (event as any).channel_id : 'unknown';
      const fallbackTeamId = 'team_id' in event ? (event as any).team_id : 'unknown';
      const fallbackThreadTs = 'thread_ts' in event ? event.thread_ts : undefined;
      const fallbackIsDirectMessage = 'channel_type' in event ? (event as any).channel_type === 'im' : false;

      return {
        userId: fallbackUserId,
        channelId: fallbackChannelId,
        teamId: fallbackTeamId,
        threadTs: fallbackThreadTs,
        isDirectMessage: fallbackIsDirectMessage
      };
    }
  }

  /**
   * Extract and clean message text with smart handling
   */
  private extractAndCleanMessage(text: string): string {
    if (!text) return '';
    
    // Remove bot mentions more intelligently
    return text
      .replace(/<@[UW][A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/<#[C][A-Z0-9]+\|[^>]+>/g, '') // Remove channel mentions
      .replace(/<![^>]+>/g, '') // Remove special mentions (@channel, @here)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Parse slash command text with parameter extraction
   */
  private async parseSlashCommandText(text: string): Promise<{ 
    message: string; 
    isHelpRequest: boolean; 
    parameters: Record<string, string> 
  }> {
    if (!text) {
      return { message: '', isHelpRequest: true, parameters: {} };
    }

    const trimmedText = text.trim().toLowerCase();
    
    // Check for help requests using AI
    let isHelpRequest = false;
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (aiClassificationService) {
        isHelpRequest = await aiClassificationService.detectHelpRequest(text);
      }
    } catch (error) {
      logger.warn('Failed to detect help request with AI:', error);
      // Continue without AI detection
    }

    // Simple parameter extraction (can be enhanced further)
    const parameters: Record<string, string> = {};
    const paramMatches = text.match(/--(\w+)=([^\s]+)/g);
    if (paramMatches) {
      paramMatches.forEach(match => {
        const [, key, value] = match.match(/--(\w+)=([^\s]+)/) || [];
        if (key && value) {
          parameters[key] = value;
        }
      });
    }

    return {
      message: text.replace(/--\w+=\S+/g, '').trim(),
      isHelpRequest,
      parameters
    };
  }

  /**
   * Check if user is interacting for the first time
   */
  private isFirstTimeUser(context: SlackContext): boolean {
    // Simple implementation - can be enhanced with actual user tracking
    // For now, return false to avoid overwhelming users
    return false;
  }

  /**
   * Send welcome message to new users
   */
  private async sendWelcomeMessage(say: SlackSayFunction, context: SlackContext): Promise<void> {
    // Validate context before proceeding
    if (!isSlackContext(context)) {
      logger.error('Invalid SlackContext provided to sendWelcomeMessage');
      return;
    }

    const welcomeMessage = {
      text: "👋 Welcome to your AI Assistant!",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "👋 Welcome to your AI Assistant!"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "I'm here to help you manage your email, calendar, and contacts directly from Slack. Here's how to get started:"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "• *Send me a direct message* with what you'd like to do\n• *Use commands* like 'check my email' or 'schedule a meeting'\n• *Type 'help'* anytime for more information\n\n🔒 *Privacy Protected:* All conversations happen through direct messages to keep your data secure."
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Get Help"
              },
              action_id: "show_help",
              style: "primary"
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Check Email"
              },
              action_id: "quick_email_check"
            }
          ]
        }
      ]
    };

    // Validate message before sending
    try {
      validateSlackMessage(welcomeMessage);
      await say(welcomeMessage as SlackMessage);
    } catch (error) {
      logger.error('Invalid welcome message structure', { error });
      // Fallback to simple text message
      await say({ text: "👋 Welcome to your AI Assistant!" });
    }
  }

  /**
   * Send a welcome message specifically for email-related requests for first-time users
   */
  private async sendEmailWelcomeMessage(say: SlackSayFunction, context: SlackContext): Promise<void> {
    try {
      const oauthUrl = await this.generateOAuthUrl(context);
      
      const welcomeMessage = {
        text: "👋 Welcome to your AI Assistant!",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "👋 Welcome to your AI Assistant!"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "I'm here to help you manage your email directly from Slack. To get started, you need to connect your Gmail account. Here's how:"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "• *Click the 'Connect Gmail Account' button* below to securely connect your Gmail account.\n• *Authorize* the connection in Google.\n• *Return to Slack* and try your email request again."
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "🔗 Connect Gmail Account"
                },
                action_id: "gmail_oauth",
                url: oauthUrl,
                style: "primary"
              }
            ]
          }
        ]
      };

      await say(welcomeMessage as SlackMessage);
    } catch (error) {
      logger.error('Error sending email welcome message', { error, userId: context.userId });
      
      // Fallback to simple text message
      await say({
        text: "👋 Welcome! I can help with email management. Please use `/assistant auth` to connect your Gmail account first."
      });
    }
  }

  /**
   * Format quick help response for empty commands
   */
  private formatQuickHelpResponse(): SlackMessage {
    return {
      response_type: 'ephemeral' as const,
      text: "👋 How can I help you today?",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👋 *How can I help you today?*\n\nJust type `/assistant` followed by what you need:\n• `/assistant check my email`\n• `/assistant schedule a meeting`\n• `/assistant find contact information`\n• Or ask me anything else!"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Show All Commands"
              },
              action_id: "show_full_help"
            }
          ]
        }
      ]
    };
  }

  /**
   * Format comprehensive help response
   */
  private formatHelpResponse(): SlackMessage {
    return {
      response_type: 'ephemeral' as const,
      text: "🤖 AI Assistant Help",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🤖 AI Assistant Help"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Ways to interact with me:*\n• Send me a direct message\n• Use `/assistant` followed by any request\n\n🔒 *Privacy-First Design:* All interactions happen through direct messages to protect your privacy."
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📧 *Email Management*\n• `/assistant check my email`\n• `/assistant send email to john@company.com about the meeting`\n• `/assistant find emails from Sarah about the project`"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📅 *Calendar Management*\n• `/assistant schedule meeting with team tomorrow at 2pm`\n• `/assistant check if I'm free Thursday afternoon`\n• `/assistant move my 3pm meeting to 4pm`"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👤 *Contact Management*\n• `/assistant find contact info for John Smith`\n• `/assistant add jane@company.com to my contacts`\n• `/assistant who is the contact for Acme Corp?`"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "💡 *Pro Tips:*\n• Just type `/assistant` followed by what you need\n• I understand natural language - no need for specific commands\n• Try asking me anything - I'll figure out what you need!"
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "plain_text_input" as any, // Temporary fix for complex Slack type
              text: {
                type: "mrkdwn",
                text: "💡 *Example:* `/assistant help me organize my day` or `/assistant what's the weather like?`"
              }
            } as any
          ]
        }
      ]
    };
  }

  /**
   * Format help response for slash commands with empty input
   */
  private formatSlashCommandHelp(): SlackMessage {
    return {
      response_type: 'ephemeral' as const,
      text: "👋 How can I help you today?",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👋 *How can I help you today?*\n\nTry asking me to:\n• Check your email\n• Schedule a meeting\n• Find contact information\n• Or just type `/assistant help` for more options"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Show All Commands"
              },
              action_id: "show_full_help"
            }
          ]
        }
      ]
    };
  }

  /**
   * Create Slack context from event
   */
  private async createSlackContext(event: SlackEvent): Promise<SlackContext> {
    return this.createSlackContextFromEvent(event);
  }

  /**
   * Create Slack context from slash command
   */
  private createSlackContextFromCommand(command: SlackSlashCommandPayload): SlackContext {
    return {
      userId: command.user_id,
      channelId: command.channel_id,
      teamId: command.team_id,
      isDirectMessage: command.channel_name === 'directmessage'
    };
  }


  /**
   * Create or get session for Slack user with simplified management
   */
  private async createOrGetSession(slackContext: SlackContext): Promise<string> {
    // Generate standardized session ID using the new format
    const sessionId = `user:${slackContext.teamId}:${slackContext.userId}`;
    
    logger.info('Generated session ID for Slack user', { 
      sessionId, 
      userId: slackContext.userId,
      teamId: slackContext.teamId
    });
    
    return sessionId;
  }

  /**
   * Handle Slack events by routing to agents with comprehensive error handling
   */
  private async handleSlackEvent(
    message: string, 
    context: SlackContext, 
    eventType: SlackEventType,
    slackHandlers: { 
      say: SlackSayFunction;
      client: WebClient; 
      thread_ts?: string;
      commandInfo?: {
        command: string;
        channelName: string;
        triggerId: string;
        responseUrl: string;
      }
    }
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Processing Slack event', { 
        eventType, 
        userId: context.userId, 
        channelId: context.channelId,
        messageLength: message.length,
        userName: context.userName,
        isDirectMessage: context.isDirectMessage
      });

      // Validate message
      if (!message || message.trim().length === 0) {
        await slackHandlers.say({
          text: 'I received your message but it appears to be empty. Please try sending a message with some content.'
        });
        return;
      }



      // Early detection of email-related requests for better OAuth experience using AI
      let isEmailRelated = false;
      try {
        const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
        if (aiClassificationService) {
          const oauthRequirement = await aiClassificationService.detectOAuthRequirement(message);
          isEmailRelated = oauthRequirement === 'email_send' || oauthRequirement === 'email_read';
        }
      } catch (error) {
        logger.warn('Failed to detect email-related request with AI:', error);
        // Continue without AI detection
      }

      if (isEmailRelated) {
        const hasOAuth = await this.hasOAuthTokens(context);
        if (!hasOAuth) {
          logger.info('Email-related request detected but no OAuth tokens found', { 
            userId: context.userId,
            message: message.substring(0, 100)
          });
          
          await this.sendOAuthRequiredMessage(slackHandlers.say, context);
          return;
        } else {
          // User has OAuth tokens, check if they recently completed authentication
          const isRecentlyConnected = await this.isRecentlyConnected(context);
          if (isRecentlyConnected) {
            // Send OAuth success message in the current thread context
            await this.sendOAuthSuccessMessage(slackHandlers.say, context);
            // Don't continue processing - let user send their request again
            return;
          }
        }
      }

      // Show typing indicator for longer operations
      if (eventType !== 'slash_command') {
        await this.sendTypingIndicator(context.channelId);
      }

      // Create enhanced agent request
      const agentRequest: SlackAgentRequest = {
        message: this.extractAndCleanMessage(message),
        context: {
          ...context,
          userName: context.userName,
          userEmail: context.userEmail
        },
        eventType,
        metadata: {
          timestamp: new Date().toISOString(),
          triggerId: slackHandlers.commandInfo?.triggerId || undefined,
          responseUrl: slackHandlers.commandInfo?.responseUrl || undefined
        }
      };

      // Route to Master Agent through existing system
      const agentResponse = await this.routeToAgent(agentRequest);

      // Enhanced response handling
      if (agentResponse.shouldRespond !== false) {
        logger.info('Sending response to Slack', {
          eventId: `${context.userId}-${Date.now()}`,
          hasBlocks: !!(agentResponse.response.blocks && agentResponse.response.blocks.length > 0),
          hasText: !!agentResponse.response.text,
          blocksCount: agentResponse.response.blocks?.length || 0,
          responseMethod: agentResponse.response.blocks && agentResponse.response.blocks.length > 0 ? 'sendFormattedMessage' : 'say'
        });

        if (agentResponse.response.blocks && agentResponse.response.blocks.length > 0) {
          await this.sendFormattedMessage(
            context.channelId, 
            agentResponse.response.blocks,
            {
              text: agentResponse.response.text || undefined,
              response_type: eventType === 'slash_command' ? 'in_channel' : undefined
            }
          );
          logger.info('Formatted message sent successfully');
        } else if (agentResponse.response.text) {
          await slackHandlers.say({
            text: agentResponse.response.text
          });
          logger.info('Text message sent successfully via say()');
        } else {
          logger.warn('No response content to send', { agentResponse: agentResponse.response });
        }
      } else {
        logger.info('Agent response marked as shouldRespond=false, skipping response');
      }

      // Handle follow-up actions
      if (agentResponse.followUpActions && agentResponse.followUpActions.length > 0) {
        await this.processFollowUpActions(agentResponse.followUpActions, context);
      }

      // Log successful completion
      const processingTime = Date.now() - startTime;
      logger.info('Slack event processed successfully', {
        eventType,
        userId: context.userId,
        processingTimeMs: processingTime,
        responseBlocks: agentResponse.response.blocks?.length || 0,
        followUpActions: agentResponse.followUpActions?.length || 0
      });

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      // Detailed error logging
      logger.error('Error in handleSlackEvent', error, {
        eventType,
        userId: context.userId,
        channelId: context.channelId,
        messageLength: message.length,
        processingTimeMs: processingTime,
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        errorStack: error?.stack
      });

      // User-friendly error responses based on error type
      let errorMessage = 'I apologize, but I encountered an error while processing your request.';
      
      if (error?.message?.includes('rate limit')) {
        errorMessage = 'I\'m receiving too many requests right now. Please wait a moment and try again.';
      } else if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
        errorMessage = 'I\'m having trouble connecting to my services. Please try again in a moment.';
      } else if (error?.message?.includes('permission') || error?.message?.includes('authorization')) {
        errorMessage = 'I don\'t have the necessary permissions to complete that action. Please check your settings or contact an admin.';
      }

      try {
        await slackHandlers.say({
          text: `${errorMessage} If the issue persists, please contact support.`
        });
      } catch (sayError) {
        logger.error('Failed to send error message to user:', sayError);
      }
    }
  }

  /**
   * Clean Slack message (remove mentions, etc.)
   */
  private cleanSlackMessage(message: string): string {
    return this.extractAndCleanMessage(message);
  }

  /**
   * Route to agent system - Complete integration with MasterAgent
   * Flow: Slack Event → MasterAgent (intent parsing) → Tool Execution → Slack Response
   */
  private async routeToAgent(request: SlackAgentRequest): Promise<SlackAgentResponse> {
    const startTime = Date.now();
    let masterAgent: MasterAgentInterface | null = null;
    
    try {
      logger.info('Routing Slack request to MasterAgent', { 
        message: request.message,
        eventType: request.eventType,
        userId: request.context.userId,
        channelId: request.context.channelId,
        isDirectMessage: request.context.isDirectMessage
      });

      // Check for confirmation responses first
      const confirmationResponse = await this.handleConfirmationResponse(request);
      if (confirmationResponse) {
        return confirmationResponse;
      }

      // 1. Create or get session for Slack user with enhanced context
      const sessionId = await this.createOrGetSession(request.context);
      
      logger.info('Slack session created/retrieved for OAuth check', { 
        sessionId, 
        userId: request.context.userId,
        teamId: request.context.teamId,
        channelId: request.context.channelId
      });
      
      // 2. Get OAuth tokens for this session if available
      let accessToken: string | undefined;
      try {
        if (!this.tokenManager) {
          logger.warn('TokenManager not available for Slack integration');
        } else {
          logger.info('Retrieving OAuth tokens for Slack user', { 
            sessionId, 
            userId: request.context.userId,
            teamId: request.context.teamId
          });
          
          accessToken = await this.tokenManager.getValidTokens(request.context.teamId, request.context.userId) || undefined;
          
          if (accessToken) {
            logger.debug('Retrieved valid Google OAuth access token for Slack user', { 
              sessionId, 
              hasToken: !!accessToken,
              tokenLength: accessToken.length
            });
          } else {
            logger.warn('❌ No valid OAuth tokens found for Slack user', { 
              sessionId,
              userId: request.context.userId,
              teamId: request.context.teamId
            });
          }
        }
      } catch (error) {
        logger.error('Error retrieving OAuth tokens for Slack user', { error, sessionId });
      }
      
      // 3. Initialize MasterAgent with consistent configuration
      const { createMasterAgent } = await import('../../config/agent-factory-init');
      masterAgent = createMasterAgent({ 
        openaiApiKey: process.env.OPENAI_API_KEY || 'dummy-key' 
      });
      
      logger.debug('MasterAgent initialized', { sessionId, useOpenAI: !!process.env.OPENAI_API_KEY });
      
      // 4. Route to MasterAgent for intent parsing (EXISTING LOGIC - DO NOT DUPLICATE)
      const masterResponse = await masterAgent.processUserInput(
        request.message,
        sessionId,
        request.context.userId,
        request.context  // Pass slackContext for context detection
      );

      logger.debug('MasterAgent response received', {
        hasMessage: !!masterResponse.message,
        toolCallsCount: masterResponse.toolCalls?.length || 0,
        needsThinking: masterResponse.needsThinking
      });

      // 5. Initialize tool results collection for comprehensive response
      const toolResults: ToolResult[] = [];
      
      // 6. Execute tool calls with enhanced Slack context and OAuth token
      if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
        const toolExecutorService = this.serviceManager.getService('toolExecutorService');
        
        if (!toolExecutorService) {
          logger.error('ToolExecutorService not available for Slack integration');
          throw new Error('Tool execution system not available');
        }

        // Create enhanced execution context with Slack-specific information
        const baseExecutionContext: ToolExecutionContext = {
          sessionId,
          userId: request.context.userId,
          timestamp: new Date(),
          slackContext: request.context
        };

        logger.debug('Executing tool calls', { 
          toolCount: masterResponse.toolCalls.length,
          tools: masterResponse.toolCalls.map((tc: any) => tc.name),
          hasAccessToken: !!accessToken
        });

        // Step 1: First run tools in preview mode to check for confirmation needs
        const previewResults = [];
        for (const toolCall of masterResponse.toolCalls) {
          try {
            logger.debug(`Running preview for tool: ${toolCall.name}`, { 
              parameters: Object.keys(toolCall.parameters || {}),
              hasAccessToken: !!accessToken
            });

            // Check if this tool requires OAuth and we don't have a token
            if (this.toolRequiresOAuth(toolCall.name) && !accessToken) {
              logger.warn(`Tool ${toolCall.name} requires OAuth but no access token available`, { sessionId });
              
              // Add failed result to collection
              previewResults.push({
                toolName: toolCall.name,
                success: false,
                error: 'OAuth authentication required. Please authenticate with Gmail first.',
                result: null,
                executionTime: 0
              });
              
              continue; // Skip execution and move to next tool
            }

            const executionContext: any = {
              ...baseExecutionContext,
              previousResults: previewResults // Pass previous results for context
            };

            // First run in preview mode to check for confirmation needs
            const previewResult: any = await (toolExecutorService as any).executeTool(
              toolCall,
              executionContext,
              accessToken,
              { preview: true } // Run in preview mode first
            );

            previewResults.push(previewResult);
            
          } catch (error) {
            logger.error(`Preview execution failed for tool ${toolCall.name}:`, error);
            previewResults.push({
              toolName: toolCall.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              result: null,
              executionTime: 0
            });
          }
        }

        // Step 2: Check if any tools require confirmation
        const needsConfirmation = previewResults.some(result => 
          result.result && typeof result.result === 'object' && 
          'awaitingConfirmation' in result.result && 
          result.result.awaitingConfirmation === true
        );

        logger.info('Slack preview check completed', {
          needsConfirmation,
          previewResultsCount: previewResults.length,
          toolsRequiringConfirmation: previewResults
            .filter(r => r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result)
            .map(r => r.toolName)
        });

        if (needsConfirmation) {
          // Return confirmation request to Slack
          return await this.createConfirmationResponse(previewResults, sessionId, request.message, request.context.channelId);
        }

        // Step 3: No confirmation needed, use preview results as final results
        // (No need to execute again - preview mode already executed the tools)
        logger.info('No confirmation needed, using preview results as final results', {
          previewResultsCount: previewResults.length,
          toolNames: previewResults.map(r => r.toolName)
        });
        
        toolResults.push(...previewResults);
      }

      // 7. Process tool results through LLM to generate natural language response
      let naturalLanguageResponse = masterResponse.message;
      if (toolResults.length > 0 && masterAgent) {
        try {
          logger.info('Processing tool results through LLM for natural language response', {
            toolResultsCount: toolResults.length,
            successfulTools: toolResults.filter(tr => tr.success).length,
            userMessage: request.message.substring(0, 100)
          });
          
          naturalLanguageResponse = await masterAgent.processToolResultsWithLLM(
            request.message,
            toolResults,
            sessionId
          );
          
          logger.info('Natural language response generated successfully', {
            responseLength: naturalLanguageResponse.length,
            originalMessageLength: masterResponse.message?.length || 0
          });
        } catch (error) {
          logger.error('Failed to process tool results with LLM, using fallback', { 
            error: error instanceof Error ? error.message : error,
            toolResultsCount: toolResults.length
          });
          // Keep the original message as fallback
        }
      }

      // 8. Enhance master response with tool execution results and natural language response
      const enhancedMasterResponse = {
        ...masterResponse,
        message: naturalLanguageResponse, // Use LLM-processed natural language response
        toolResults: toolResults,
        executionMetadata: {
          totalExecutionTime: Date.now() - startTime,
          toolsExecuted: toolResults.length,
          successfulTools: toolResults.filter(tr => tr.success).length,
          slackContext: request.context
        }
      };

      // 9. Format response for Slack with comprehensive context
      const slackResponse = await this.formatAgentResponseForSlack(
        enhancedMasterResponse, 
        request.context
      );
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Slack request processed successfully', {
        processingTimeMs: processingTime,
        toolsExecuted: toolResults.length,
        responseHasBlocks: !!(slackResponse.blocks && slackResponse.blocks.length > 0),
        responseTextLength: slackResponse.text?.length || 0
      });

      return {
        success: true,
        response: slackResponse,
        shouldRespond: true,
        executionMetadata: {
          processingTime,
          toolResults: toolResults.map(tr => ({
            toolName: tr.toolName,
            success: tr.success,
            executionTime: tr.executionTime,
            error: tr.error || undefined,
            result: tr.result
          })),
          masterAgentResponse: masterResponse.message
        }
      };
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error routing to agent', error, {
        processingTimeMs: processingTime,
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        userId: request.context.userId,
        eventType: request.eventType
      });

      // Enhanced error response based on error type
      let errorMessage = 'I apologize, but I encountered an error while processing your request.';
      
      if (error?.message?.includes('OpenAI service is required')) {
        errorMessage = 'I\'m having trouble with my AI processing service. Please try again in a moment.';
      } else if (error?.message?.includes('TokenStorageService not available')) {
        errorMessage = 'I\'m experiencing some connection issues. Please try again.';
      } else if (error?.message?.includes('Tool execution system')) {
        errorMessage = 'I\'m having trouble accessing my tools. Please try again shortly.';
      }
      
      return {
        success: true, // Changed to true to ensure response is sent
        response: {
          text: `${errorMessage} If the problem persists, please contact support.`
        },
        error: error?.message || 'Unknown error',
        shouldRespond: true,
        executionMetadata: {
          processingTime,
          toolResults: [],
          error: error?.message
        }
      };
    }
  }

  /**
   * Format agent response for Slack with comprehensive formatting
   */
  private async formatAgentResponseForSlack(
    masterResponse: MasterAgentResponse,
    slackContext: SlackContext
  ): Promise<{ text: string; blocks?: SlackBlock[] }> {
    try {
      logger.debug('Formatting agent response for Slack', {
        hasMessage: !!masterResponse.message,
        toolResultsCount: masterResponse.toolResults?.length || 0,
        hasExecutionMetadata: !!masterResponse.executionMetadata
      });

      // Use simple fallback formatting
      
      // 2. Enhanced fallback formatting with tool results integration
      let responseText = masterResponse.message || 'I processed your request successfully.';
      const blocks: any[] = [];

      // 3. Create main response block
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: responseText
        }
      });

      // 4. Handle failed tool results only (for OAuth guidance)
      if (masterResponse.toolResults && masterResponse.toolResults.length > 0) {
        const failedResults = masterResponse.toolResults.filter((tr: any) => !tr.success);

        // Handle failed results with OAuth guidance
        if (failedResults.length > 0) {
          const oauthFailures = failedResults.filter((fr: any) =>
            fr.error?.includes('OAuth authentication required') ||
            fr.error?.includes('Access token is required') ||
            fr.error?.includes('Calendar authentication required') ||
            fr.needsReauth === true
          );
          
          if (oauthFailures.length > 0) {
            blocks.push({ type: 'divider' });
            
            // Determine if this is calendar-specific or general auth
            const hasCalendarFailures = oauthFailures.some((fr: any) =>
              fr.error?.includes('Calendar authentication required') ||
              fr.reauth_reason?.includes('calendar') ||
              fr.reauth_reason?.includes('missing_calendar_scopes')
            );

            // Add OAuth guidance block
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: hasCalendarFailures
                  ? '*🔐 Google Calendar Authentication Required*\n' +
                    'To create calendar events and manage your schedule, you need to connect your Google account with calendar permissions.\n\n' +
                    'This is a one-time setup that keeps your data secure.'
                  : '*🔐 Gmail Authentication Required*\n' +
                    'To send emails, read your Gmail, or access contacts, you need to connect your Gmail account first.\n\n' +
                    'This is a one-time setup that keeps your data secure.'
              },
              accessory: {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: hasCalendarFailures ? '🔗 Connect Google Account' : '🔗 Connect Gmail Account'
                },
                style: 'primary',
                action_id: 'gmail_oauth',
                url: await this.generateOAuthUrl(slackContext)
              }
            });
            
            blocks.push({
              type: 'context',
              elements: [{
                type: 'mrkdwn',
                text: '_Click the button above to securely connect your Gmail account. You\'ll be redirected to Google to authorize access._'
              }]
            });
            
            // Add helpful information
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*What happens next?*\n' +
                      '• Click "Connect Gmail Account"\n' +
                      '• Authorize with Google\n' +
                      '• Return to Slack\n' +
                      '• Try your email request again'
              }
            });
          }
        }


        // Log failed results for debugging (don't show to user)
        if (failedResults.length > 0) {
          logger.warn('Some tools failed execution in Slack context', {
            failedTools: failedResults.map((fr: any) => ({ name: fr.toolName, error: fr.error })),
            userId: slackContext.userId
          });
        }
      }

      // 5. Add help hint for certain contexts
      if (slackContext.isDirectMessage && masterResponse.message?.length < 50) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: '_Type "help" anytime for assistance with commands_'
          }]
        });
      }

      const finalResponse = {
        text: responseText,
        blocks: blocks.length > 1 ? blocks : undefined
      };

      logger.debug('Response formatted for Slack', {
        textLength: finalResponse.text.length,
        blocksCount: finalResponse.blocks?.length || 0,
        hasSuccessfulResults: (masterResponse.toolResults?.filter((tr: any) => tr.success) || []).length > 0
      });

      return finalResponse;
      
    } catch (error: any) {
      logger.error('Error formatting agent response for Slack', error);
      
      // Ultimate fallback - just return the basic message
      return { 
        text: masterResponse.message || 'I processed your request successfully.' 
      };
    }
  }

  /**
   * Send help message for slash commands
   */
  private async sendHelpMessage(respond: SlackRespondFunction, context: SlackContext): Promise<void> {
    try {
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🤖 AI Assistant Help*\n' +
                  'Here\'s what I can help you with:'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📧 Email Features*\n' +
                  '• Send emails\n' +
                  '• Read Gmail\n' +
                  '• Manage contacts\n\n' +
                  '*📅 Calendar Features*\n' +
                  '• Schedule meetings\n' +
                  '• Check availability\n\n' +
                  '*🔍 Other Features*\n' +
                  '• Web search\n' +
                  '• Content creation\n' +
                  '• Task assistance'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*💡 Usage Examples*\n' +
                  '• `/assistant send an email to john@example.com`\n' +
                  '• `/assistant schedule a meeting tomorrow at 2pm`\n' +
                  '• `/assistant search for latest AI news`\n' +
                  '• `/assistant auth` - Check authentication status\n' +
                  '• `/assistant status` - Check connection status'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🔐 Authentication*\n' +
                  'Email and calendar features require Gmail authentication. Use `/assistant auth` to connect your account.'
          }
        }
      ];

      await respond({
        blocks: blocks,
        text: 'AI Assistant Help - I can help with email, calendar, search, and more!',
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error sending help message', { error, userId: context.userId });
      
      await respond({
        text: '🤖 AI Assistant Help\n\nI can help with:\n• Email management\n• Calendar scheduling\n• Web search\n• Content creation\n\nTry: `/assistant send an email to...`',
        response_type: 'ephemeral'
      });
    }
  }

  /**
   * Handle authentication-related commands
   */
  private async handleAuthCommand(respond: SlackRespondFunction, context: SlackContext): Promise<void> {
    try {
      const hasOAuth = await this.hasOAuthTokens(context);
      
      if (hasOAuth) {
        await respond({
          text: '✅ *Authentication Status: Connected*\n\nYour Gmail account is connected and ready to use! You can now:\n• Send emails\n• Read Gmail\n• Access contacts\n• Use calendar features',
          response_type: 'ephemeral'
        });
      } else {
        await this.sendOAuthRequiredMessage(respond, context);
      }
    } catch (error) {
      logger.error('Error handling auth command', { error, userId: context.userId });
      
      await respond({
        text: '❌ Error checking authentication status. Please try again or contact support.',
        response_type: 'ephemeral'
      });
    }
  }

  /**
   * Handle status command to check authentication status
   */
  private async handleStatusCommand(respond: SlackRespondFunction, context: SlackContext): Promise<void> {
    try {
      const hasOAuth = await this.hasOAuthTokens(context);
      const statusMessage = hasOAuth ? 
        '✅ *Authentication Status: Connected*\n\nYour Gmail account is connected and ready to use! You can now:\n• Send emails\n• Read Gmail\n• Access contacts\n• Use calendar features' :
        '❌ *Authentication Status: Disconnected*\n\nYour Gmail account is not connected. Please use `/assistant auth` to connect your account.';

      await respond({
        text: statusMessage,
        response_type: 'ephemeral'
      });
    } catch (error) {
      logger.error('Error handling status command', { error, userId: context.userId });
      await respond({
        text: '❌ Error checking authentication status. Please try again or contact support.',
        response_type: 'ephemeral'
      });
    }
  }

  /**
   * Send a success message when OAuth is completed
   */
  private async sendOAuthSuccessMessage(say: any, slackContext: SlackContext): Promise<void> {
    try {
      // Only show this message if we haven't shown it recently for this user
      const successMessageKey = `oauth_success_${slackContext.userId}_${slackContext.teamId}`;
      const hasShownSuccess = await this.checkIfSuccessMessageShown(successMessageKey);
      
      if (hasShownSuccess) {
        logger.debug('OAuth success message already shown recently, skipping', {
          userId: slackContext.userId,
          teamId: slackContext.teamId
        });
        return;
      }

      // Mark that we've shown the success message
      await this.markSuccessMessageShown(successMessageKey);

      const successMessage = {
        text: "🎉 Gmail Successfully Connected!",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🎉 Gmail Successfully Connected!"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Great! Your Gmail account is now connected and ready to use. You can now:"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "• 📧 Send emails through the AI Assistant\n• 📋 Read and manage your Gmail\n• 👤 Access your contacts\n• 📅 Use calendar features"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Try your email request again!* The AI Assistant now has access to your Gmail account."
            }
          }
        ]
      };

      await say({
        ...successMessage
      });
    } catch (error) {
      logger.error('Error sending OAuth success message', { error, userId: slackContext.userId });
      
      // Fallback to simple text message
      await say({
        text: "🎉 Gmail successfully connected! You can now try your email request again."
      });
    }
  }

  /**
   * Check if a user has recently completed OAuth authentication
   */
  private async isRecentlyConnected(slackContext: SlackContext): Promise<boolean> {
    try {
      // Since session storage is removed, skip recent connection detection
      // This functionality could be implemented with a dedicated cache if needed
      logger.debug('Skipping recent connection check (session storage removed)', { 
        userId: slackContext.userId, 
        teamId: slackContext.teamId 
      });
      
      return false;
    } catch (error) {
      logger.error('Error checking if recently connected', { error, userId: slackContext.userId });
      return false;
    }
  }

  /**
   * Check if we've already shown the OAuth success message for a session
   */
  private async checkIfSuccessMessageShown(successMessageKey: string): Promise<boolean> {
    try {
      // Success message tracking removed with session storage
      // This could be implemented with a dedicated cache if needed
      logger.debug('Skipping success message check (session storage removed)', { successMessageKey });
      return false;
    } catch (error) {
      logger.debug('Error checking if success message was shown', { error, successMessageKey });
      return false;
    }
  }

  /**
   * Mark that we've shown the OAuth success message for a session
   */
  private async markSuccessMessageShown(successMessageKey: string): Promise<void> {
    try {
      // Success message marking removed with session storage  
      // This could be implemented with a dedicated cache if needed
      logger.debug('Skipping success message marking (session storage removed)', { successMessageKey });
    } catch (error) {
      logger.debug('Error marking success message as shown', { error, successMessageKey });
    }
  }



  /**
   * Check if a user has OAuth tokens for Gmail access
   */
  private async hasOAuthTokens(slackContext: SlackContext): Promise<boolean> {
    try {
      if (!this.tokenManager) {
        logger.warn('TokenManager not available in hasOAuthTokens', { 
          userId: slackContext.userId,
          teamId: slackContext.teamId 
        });
        return false;
      }

      return await this.tokenManager.hasValidOAuthTokens(slackContext.teamId, slackContext.userId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('💥 Error in hasOAuthTokens (Slack interface)', { 
        error,
        errorMessage,
        errorStack,
        errorType: error?.constructor?.name,
        userId: slackContext.userId,
        teamId: slackContext.teamId
      });
      return false;
    }
  }

  /**
   * Send a helpful message when user doesn't have OAuth tokens
   */
  private async sendOAuthRequiredMessage(say: any, slackContext: SlackContext): Promise<void> {
    try {
      const oauthUrl = await this.generateOAuthUrl(slackContext);
      
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
        },
        {
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: '_Click the button above to securely connect your Gmail account. You\'ll be redirected to Google to authorize access._'
          }]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*What happens next?*\n' +
                  '• Click "Connect Gmail Account"\n' +
                  '• Authorize with Google\n' +
                  '• Return to Slack\n' +
                  '• Try your email request again'
          }
        }
      ];

      await say({
        blocks: blocks,
        text: 'Gmail authentication required. Please connect your Gmail account to use email features.'
      });
    } catch (error) {
      logger.error('Error sending OAuth required message', { error, userId: slackContext.userId });
      
      // Fallback to simple text message
      await say({
        text: '🔐 Gmail authentication required. Please contact support to connect your Gmail account.'
      });
    }
  }

  /**
   * Check if a tool requires OAuth authentication
   */
  private toolRequiresOAuth(toolName: string): boolean {
    const oauthRequiredTools = [
      'emailAgent',
      'calendarAgent', 
      'contactAgent'
    ];
    
    return oauthRequiredTools.includes(toolName);
  }

  /**
   * Create confirmation response for Slack with action preview
   */
  private async createConfirmationResponse(previewResults: any[], sessionId: string, userMessage: string, channel: string): Promise<SlackAgentResponse> {
    // Extract the main preview data
    const mainPreview = previewResults.find(r => 
      r.result && typeof r.result === 'object' && 'awaitingConfirmation' in r.result && r.result.preview
    );

    if (!mainPreview?.result?.preview) {
      return {
        success: true,
        response: {
          text: 'I need your confirmation before proceeding with this action. Reply with "yes" to confirm or "no" to cancel.'
        },
        shouldRespond: true
      };
    }

    const preview = mainPreview.result.preview;
    
    // Create detailed preview message for Slack
    let previewText = `🔍 Action Preview\n\n`;
    previewText += `${preview.title}\n`;
    previewText += `${preview.description}\n\n`;

    // Add risk assessment
    const riskEmoji = preview.riskAssessment.level === 'high' ? '🔴' :
                     preview.riskAssessment.level === 'medium' ? '🟡' : '🟢';
    previewText += `${riskEmoji} Risk Level: ${preview.riskAssessment.level.toUpperCase()}\n`;
    previewText += `Risk Factors: ${preview.riskAssessment.factors.join(', ')}\n`;

    // Add warnings if any
    if (preview.riskAssessment.warnings) {
      previewText += `⚠️ Warnings:\n`;
      preview.riskAssessment.warnings.forEach((warning: string) => {
        previewText += `• ${warning}\n`;
      });
    }

    // Add specific preview data using dynamic formatting
    try {
      const toolRoutingService = getService<ToolRoutingService>('toolRoutingService');
      if (toolRoutingService && preview.previewData) {
        const formattedDetails = await toolRoutingService.formatPreviewDetails(
          preview.actionType,
          preview.previewData
        );
        previewText += `\n${formattedDetails}\n`;
      } else {
        // Fallback to basic preview info if service unavailable
        previewText += `\n🔧 Action Details:\n`;
        previewText += `• Type: ${preview.actionType}\n`;
        if (preview.previewData) {
          previewText += `• Parameters: Available\n`;
        }
      }
    } catch (error) {
      logger.warn('Failed to format preview details dynamically:', error);
      // Fallback to basic preview info
      previewText += `\n🔧 Action Details:\n`;
      previewText += `• Type: ${preview.actionType}\n`;
    }

    previewText += `\nEstimated Execution Time: ${preview.estimatedExecutionTime}\n`;
    previewText += `Reversible: ${preview.reversible ? 'Yes' : 'No'}\n\n`;
    previewText += `Do you want to proceed with this action?\nReply with "yes" to confirm or "no" to cancel.`;

    // Store pending action for confirmation handling
    const pendingAction = {
      actionId: preview.actionId,
      type: preview.actionType,
      parameters: preview.parameters,
      awaitingConfirmation: true,
      originalQuery: userMessage,
      sessionId: sessionId,
      preview: preview,
      timestamp: Date.now()
    };

    this.pendingActions.set(`${sessionId}:${channel}`, pendingAction);

    // Set timeout to clean up pending action after 5 minutes
    setTimeout(() => {
      this.pendingActions.delete(`${sessionId}:${channel}`);
    }, 5 * 60 * 1000);

    return {
      success: true,
      response: {
        text: previewText
      },
      shouldRespond: true
    };
  }

  /**
   * Handle confirmation responses from users
   */
  private async handleConfirmationResponse(request: SlackAgentRequest): Promise<SlackAgentResponse | null> {
    const sessionId = await this.createOrGetSession(request.context);
    const pendingActionKey = `${sessionId}:${request.context.channelId}`;
    const pendingAction = this.pendingActions.get(pendingActionKey);

    if (!pendingAction) {
      return null; // No pending action, continue with normal processing
    }

    const message = request.message.trim();
    let isConfirmation = false;
    let isRejection = false;

    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (aiClassificationService) {
        const classification = await aiClassificationService.classifyConfirmationResponse(message);
        isConfirmation = classification === 'confirm';
        isRejection = classification === 'reject';
      }
    } catch (error) {
      logger.warn('Failed to classify confirmation response with AI:', error);
      // Continue without AI detection
    }

    if (!isConfirmation && !isRejection) {
      return null; // Not a confirmation response, continue with normal processing
    }

    // Remove pending action
    this.pendingActions.delete(pendingActionKey);

    logger.info('Processing confirmation response', {
      sessionId,
      actionId: pendingAction.actionId,
      confirmed: isConfirmation,
      userMessage: message
    });

    if (isRejection) {
      return {
        success: true,
        response: {
          text: `✅ Action cancelled. The ${pendingAction.type} operation will not be performed.`
        },
        shouldRespond: true
      };
    }

    // Execute the confirmed action
    try {
      const toolExecutorService = this.serviceManager.getService('toolExecutorService');
      if (!toolExecutorService) {
        throw new Error('Tool executor service not available');
      }

      // Get access token
      let accessToken: string | undefined;
      try {
        if (this.tokenManager) {
          const token = await this.tokenManager.getValidTokens(request.context.teamId, request.context.userId);
          accessToken = token || undefined;
        }
      } catch (error) {
        logger.warn('Could not retrieve access token for confirmed action', { sessionId, error });
      }

      // Check if access token is required and available
      if ((pendingAction.type === 'email' || pendingAction.type === 'calendar') && !accessToken) {
        logger.error('Access token required but not available for confirmed action', {
          sessionId,
          actionType: pendingAction.type,
          actionId: pendingAction.actionId
        });

        return {
          success: true,
          response: {
            text: `❌ Action Failed\n\n` +
              `Cannot execute ${pendingAction.preview.title} because you need to authenticate with Google first.\n\n` +
              `Please use the OAuth link provided earlier to connect your Google account, then try your request again.`
          },
          shouldRespond: true
        };
      }

      // Create execution context
      const executionContext = {
        sessionId,
        userId: request.context.userId,
        timestamp: new Date()
      };

      // Create tool call based on action type
      let toolCall: any;
      if (pendingAction.type === 'email') {
        toolCall = {
          name: 'emailAgent',
          parameters: { 
            query: pendingAction.originalQuery,
            accessToken 
          }
        };
      } else if (pendingAction.type === 'calendar') {
        toolCall = {
          name: 'calendarAgent',
          parameters: { 
            ...pendingAction.preview.parameters,  // Use parsed parameters from preview
            accessToken
          }
        };
      } else {
        throw new Error(`Unsupported action type: ${pendingAction.type}`);
      }

      // Execute the tool normally (not in preview mode)
      logger.info('Executing confirmed action', {
        sessionId,
        actionId: pendingAction.actionId,
        actionType: pendingAction.type,
        toolName: toolCall.name,
        hasAccessToken: !!accessToken
      });

      const result = await (toolExecutorService as any).executeTool(
        toolCall,
        executionContext,
        accessToken,
        { preview: false }
      );

      logger.info('Confirmed action execution result', {
        sessionId,
        actionId: pendingAction.actionId,
        success: result.success,
        hasError: !!result.error,
        errorMessage: result.error,
        hasResult: !!result.result
      });

      if (result.success) {
        const successMessage = `✅ Action Completed Successfully!\n\n` +
          `${pendingAction.preview.title} has been executed.\n\n` +
          `${result.result?.message || 'Operation completed successfully.'}`;

        return {
          success: true,
          response: {
            text: successMessage
          },
          shouldRespond: true
        };
      } else {
        const errorMessage = `❌ Action Failed\n\n` +
          `Failed to execute ${pendingAction.preview.title}.\n\n` +
          `Error: ${result.error || 'Unknown error occurred'}`;

        return {
          success: true,
          response: {
            text: errorMessage
          },
          shouldRespond: true
        };
      }

    } catch (error) {
      logger.error('Failed to execute confirmed action', {
        actionId: pendingAction.actionId,
        error: error instanceof Error ? error.message : error
      });

      const errorMessage = `❌ Execution Error\n\n` +
        `An error occurred while executing ${pendingAction.preview.title}.\n\n` +
        `Please try again or contact support if the issue persists.`;

      return {
        success: true,
        response: {
          text: errorMessage
        },
        shouldRespond: true
      };
    }
  }

  /**
   * Generate OAuth URL for Slack user authentication
   */
  private async generateOAuthUrl(slackContext: SlackContext): Promise<string> {
    try {
      const { ENVIRONMENT } = await import('../../config/environment');
      let baseUrl = ENVIRONMENT.baseUrl;
      const clientId = ENVIRONMENT.google.clientId;
      
      if (!clientId) {
        logger.error('Google OAuth client ID not configured');
        return `${baseUrl}/auth/error?message=OAuth+not+configured`;
      }

      // Ensure baseUrl doesn't have trailing paths - it should just be the domain
      // Fix for cases where BASE_URL might be set to include /auth/google or similar
      if (baseUrl.includes('/auth/')) {
        const originalBaseUrl = baseUrl;
        const parts = baseUrl.split('/auth/');
        baseUrl = parts[0] || baseUrl; // Fallback to original if split fails
        logger.warn('Base URL contained /auth/ path, corrected', { 
          original: originalBaseUrl, 
          corrected: baseUrl 
        });
      }

      // Use configured redirect URI or fall back to default
      const redirectUri = ENVIRONMENT.google.redirectUri || `${baseUrl}/auth/callback`;
      
      // Validate redirect URI format
      if (!redirectUri.startsWith('http')) {
        logger.error('Invalid redirect URI format', { redirectUri, baseUrl });
        return `${baseUrl}/auth/error?message=Invalid+redirect+URI+format`;
      }

      // Ensure redirect URI points to the correct callback endpoint
      if (!redirectUri.endsWith('/auth/callback')) {
        logger.warn('Redirect URI does not end with /auth/callback, this may cause OAuth issues', { 
          redirectUri, 
          expected: `${baseUrl}/auth/callback` 
        });
      }

      // Create state parameter with Slack context
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

      // Use the proper Google OAuth endpoint instead of our custom /auth/init route
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes,
        state: state,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent'
      });

      logger.info('Generated Google OAuth URL for Slack user', {
        userId: slackContext.userId,
        teamId: slackContext.teamId,
        channelId: slackContext.channelId,
        redirectUri: redirectUri,
        usingConfiguredRedirect: !!ENVIRONMENT.google.redirectUri,
        baseUrl: baseUrl,
        clientIdConfigured: !!clientId,
        generatedUrl: authUrl.substring(0, 100) + '...', // Log first 100 chars for debugging
        fullRedirectUri: redirectUri,
        fullBaseUrl: baseUrl,
        environmentRedirectUri: ENVIRONMENT.google.redirectUri
      });

      return authUrl;
    } catch (error) {
      logger.error('Error generating OAuth URL', { error, slackContext });
      
      // Return a fallback error URL
      const { ENVIRONMENT } = await import('../../config/environment');
      return `${ENVIRONMENT.baseUrl}/auth/error?message=OAuth+URL+generation+failed`;
    }
  }

  /**
   * Format individual tool result for Slack display
   */
  private formatToolResultForSlack(toolResult: ToolResult): string {
    try {
      if (!toolResult.result) return '';

      // Handle different result types
      if (typeof toolResult.result === 'string') {
        return this.truncateForSlack(toolResult.result, 200);
      }

      if (typeof toolResult.result === 'object') {
        // Handle common structured results
        if (toolResult.result.summary) {
          return this.truncateForSlack(toolResult.result.summary, 200);
        }
        
        if (toolResult.result.message) {
          return this.truncateForSlack(toolResult.result.message, 200);
        }

        if (Array.isArray(toolResult.result)) {
          return `Found ${toolResult.result.length} items`;
        }

        // Format object as readable text
        const formatted = JSON.stringify(toolResult.result, null, 2);
        return this.truncateForSlack(formatted, 200);
      }

      return String(toolResult.result);
      
    } catch (error: any) {
      logger.debug('Error formatting tool result', { toolName: toolResult.toolName, error: error.message });
      return 'Result processed successfully';
    }
  }

  /**
   * Get user-friendly display name for tools
   */
  private getToolDisplayName(toolName: string): string {
    const displayNames: Record<string, string> = {
      'emailAgent': '📧 Email',
      'contactAgent': '👤 Contacts',
      'calendarAgent': '📅 Calendar',
      'Think': '🤔 Analysis'
    };
    
    return displayNames[toolName] || `🔧 ${toolName}`;
  }

  /**
   * Truncate text for Slack display with smart word boundaries
   */
  private truncateForSlack(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Enhanced response sending functionality using WebClient
   */
  private async sendFormattedMessage(
    channelId: string,
    blocks: SlackBlock[],
    options?: {
      text?: string;
      response_type?: 'in_channel' | 'ephemeral';
      replace_original?: boolean;
    }
  ): Promise<void> {
    try {
      const messagePayload: any = {
        channel: channelId,
        blocks: blocks,
        text: options?.text
      };

      // Add optional parameters
      if (options?.text) messagePayload.text = options.text;
      if (options?.response_type === 'ephemeral') messagePayload.ephemeral = true;

      logger.debug('Sending formatted Slack message', { 
        channel: channelId, 
        blocks: blocks.length,
        messagePayload: JSON.stringify(messagePayload)
      });

      const result = await this.client.chat.postMessage(messagePayload);
      
      logger.debug('Slack message sent successfully', { 
        channel: channelId, 
        timestamp: result.ts,
        messageId: result.ts 
      });
    } catch (error) {
      logger.error('Error sending formatted message to Slack:', error, {
        channel: channelId,
        blocks_count: blocks.length,
        error_code: (error as any).code,
        error_data: (error as any).data
      });
      
      // Only send fallback if the error indicates message wasn't sent
      // Throw error instead of sending fallback message
      throw error;
    }
  }

  /**
   * Send simple text message (removed fallback functionality)
   */
  private async sendFallbackTextMessage(channelId: string, text: string): Promise<void> {
    // This method is kept for compatibility but no longer used as fallback
    throw new Error('Fallback text message sending is disabled');
  }

  /**
   * Send typing indicator to show the bot is working
   */
  private async sendTypingIndicator(channelId: string): Promise<void> {
    try {
      // Note: conversations.typing is not available in all Slack SDK versions
      // For now, we'll skip this feature as it's non-critical
      logger.debug('Typing indicator requested for channel:', channelId);
    } catch (error) {
      logger.debug('Could not send typing indicator:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Update existing message (useful for progressive responses)
   */
  private async updateMessage(
    channelId: string, 
    timestamp: string, 
    blocks: any[], 
    text?: string
  ): Promise<void> {
    try {
      await this.client.chat.update({
        channel: channelId,
        ts: timestamp,
        blocks: blocks,
        text: text || undefined
      });
    } catch (error) {
      logger.error('Error updating Slack message:', error);
    }
  }

  /**
   * Process follow-up actions
   */
  private async processFollowUpActions(actions: any[], context: SlackContext): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'schedule_message':
            // TODO: Implement scheduled message sending
            logger.debug('Scheduling follow-up message', action);
            break;
            
          case 'update_message':
            // TODO: Implement message updating
            logger.debug('Updating message', action);
            break;
            
          case 'send_dm':
            // TODO: Implement DM sending
            logger.debug('Sending DM', action);
            break;
            
          default:
            logger.warn('Unknown follow-up action type', { type: action.type });
        }
      } catch (error) {
        logger.error('Error processing follow-up action', error, { action });
      }
    }
  }

  /**
   * Get help message for users
   */
  private getHelpMessage(): string {
    return `🤖 *AI Assistant Help*

*Available Commands:*
• \`/assistant <your request>\` - Get AI assistance with any task
• \`/help\` - Show this help message

*What I can help with:*
• 📧 Email management and composition
• 📅 Calendar scheduling and management
• 👤 Contact lookup and management
• 🤖 Intelligent task assistance
• 💬 General questions and support

*How to use:*
• Mention me in any channel: \`@AI Assistant help me schedule a meeting\`
• Send me a direct message
• Use the \`/assistant\` slash command

*Examples:*
• "Schedule a meeting with John tomorrow at 2pm"
• "Send an email to the team about the project update"
• "Find contact information for Sarah Johnson"

Need more help? Just ask!`;
  }

  /**
   * Clean up expired events from processedEvents Map based on TTL
   */
  private cleanupExpiredEvents(): void {
    const now = Date.now();
    const expiredEvents: string[] = [];

    // Find expired events
    for (const [eventId, timestamp] of this.processedEvents.entries()) {
      if (now - timestamp > APP_CONSTANTS.EVENT_TTL_MS) {
        expiredEvents.push(eventId);
      }
    }

    // Remove expired events
    expiredEvents.forEach(eventId => {
      this.processedEvents.delete(eventId);
    });

    // Log cleanup if events were removed
    if (expiredEvents.length > 0) {
      logger.debug('Cleaned up expired events', {
        expiredCount: expiredEvents.length,
        remainingCount: this.processedEvents.size
      });
    }

    // Safety fallback - if we still have too many events, remove oldest ones
    if (this.processedEvents.size > APP_CONSTANTS.EVENT_CLEANUP_THRESHOLD) {
      const entries = Array.from(this.processedEvents.entries());
      entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp
      const toRemove = entries.slice(0, 500); // Remove oldest 500
      toRemove.forEach(([eventId]) => {
        this.processedEvents.delete(eventId);
      });

      logger.warn('Emergency cleanup performed - removed oldest events', {
        removedCount: toRemove.length,
        remainingCount: this.processedEvents.size
      });
    }
  }

  /**
   * Get health status of the Slack interface
   */
  public getHealth(): { healthy: boolean; details?: any } {
    try {
      const isConfigured = !!(
        this.config.signingSecret &&
        this.config.botToken &&
        this.config.clientId
      );

      return {
        healthy: isConfigured,
        details: {
          configured: isConfigured,
          development: this.config.development,
          endpoints: {
            events: '/slack/events',
            commands: '/slack/commands',
            interactive: '/slack/interactive'
          },
          note: 'Using manual routing (no Bolt framework)'
        }
      };
    } catch (error) {
      logger.error('Error getting Slack interface health:', error);
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
