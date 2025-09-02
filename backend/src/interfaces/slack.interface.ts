import { App, ExpressReceiver, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { ServiceManager } from '../services/service-manager';
import { SlackContext, SlackEventType, SlackAgentRequest, SlackAgentResponse } from '../types/slack.types';
import { ToolExecutionContext, ToolResult } from '../types/tools';
import logger from '../utils/logger';

export interface SlackConfig {
  signingSecret: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  development: boolean;
}

export class SlackInterface {
  private app: App;
  private client: WebClient;
  private receiver: ExpressReceiver;
  private serviceManager: ServiceManager;
  private config: SlackConfig;

  constructor(config: SlackConfig, serviceManager: ServiceManager) {
    this.config = config;
    this.serviceManager = serviceManager;

    // Create Express receiver for Slack with default endpoints
    // The receiver will be mounted at /slack/bolt, so default endpoints will work
    this.receiver = new ExpressReceiver({
      signingSecret: config.signingSecret
    });

    // Initialize Slack app
    this.app = new App({
      receiver: this.receiver,
      token: config.botToken,
      logLevel: config.development ? LogLevel.DEBUG : LogLevel.INFO
    });

    // Initialize Slack client
    this.client = new WebClient(config.botToken);

    this.setupEventHandlers();
    this.setupSlashCommands();
    this.setupInteractiveComponents();
  }

  /**
   * Get the Express router for Slack endpoints
   */
  public get router() {
    return this.receiver.router;
  }

  /**
   * Start the Slack interface
   * Note: We don't call app.start() because we're mounting the receiver manually
   */
  public async start(): Promise<void> {
    try {
      // Don't call app.start() since we're using the receiver's router directly
      logger.info('Slack interface started successfully (using manual router mounting)');
    } catch (error) {
      logger.error('Failed to start Slack interface:', error);
      throw error;
    }
  }

  /**
   * Stop the Slack interface
   */
  public async stop(): Promise<void> {
    try {
      await this.app.stop();
      logger.info('Slack interface stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Slack interface:', error);
      throw error;
    }
  }

  /**
   * Handle Slack events directly
   */
  public async handleEvent(event: any, teamId: string): Promise<void> {
    try {
      logger.info('Handling Slack event directly', {
        eventType: event.type,
        userId: event.user,
        channelId: event.channel
      });

      // Create Slack context from event
      const slackContext: SlackContext = {
        userId: event.user,
        channelId: event.channel,
        teamId: teamId,
        threadTs: event.ts,
        isDirectMessage: event.channel_type === 'im'
      };

      // Determine event type
      let eventType: SlackEventType;
      if (event.type === 'app_mention') {
        eventType = 'app_mention';
      } else if (event.type === 'message') {
        eventType = 'message';
      } else {
        logger.warn('Unsupported event type', { eventType: event.type });
        return;
      }

      // Process the event using existing logic
      await this.handleSlackEvent(
        event.text || '', 
        slackContext, 
        eventType,
        {
          say: async (message: any) => {
            // Send response back to Slack via Web API
            await this.client.chat.postMessage({
              channel: slackContext.channelId,
              text: typeof message === 'string' ? message : message.text,
              blocks: message.blocks,
              thread_ts: slackContext.threadTs
            });
          },
          client: this.client
        }
      );

    } catch (error) {
      logger.error('Error handling Slack event directly', error);
    }
  }

  /**
   * Setup Slack event handlers
   */
  private setupEventHandlers(): void {
    // Handle app mentions (@assistant)
    this.app.event('app_mention', async ({ event, say, client, payload }) => {
      try {
        logger.info('App mention received', { 
          user: event.user, 
          channel: event.channel,
          text: event.text?.substring(0, 100) + '...'
        });

        const context = await this.createSlackContextFromEvent(event, payload);
        const message = this.extractAndCleanMessage(event.text);
        
        // Validate message content
        if (!message.trim()) {
          await say({
            text: "I noticed you mentioned me but didn't include a message. How can I help you?",
            thread_ts: event.thread_ts
          });
          return;
        }

        await this.handleSlackEvent(
          message,
          context,
          'app_mention',
          { say, client, thread_ts: event.thread_ts }
        );
      } catch (error: any) {
        logger.error('Error handling app mention:', error, { 
          user: event.user, 
          channel: event.channel,
          error_type: error?.constructor?.name 
        });
        
        await say({
          text: 'I apologize, but I encountered an error processing your mention. Please try again or contact support if the issue persists.',
          thread_ts: event.thread_ts
        });
      }
    });

    // Handle direct messages with enhanced context management
    this.app.message(async ({ message, say, client, payload }) => {
      try {
        // Only handle direct messages to the bot and ignore bot messages
        if (message.channel_type === 'im' && !(message as any).bot_id && (message as any).text) {
          logger.info('Direct message received', { 
            user: (message as any).user, 
            channel: (message as any).channel,
            text_length: ((message as any).text || '').length 
          });

          const context = await this.createSlackContextFromEvent(message, payload);
          const messageText = this.extractAndCleanMessage((message as any).text || '');
          
          // Enhanced validation for direct messages
          if (!messageText.trim()) {
            await say({
              text: "I received your message but it appears to be empty. Please send me a message with your request, or type 'help' to see what I can do!"
            });
            return;
          }

          // Welcome first-time users
          if (this.isFirstTimeUser(context)) {
            await this.sendWelcomeMessage(say, context);
          }

          // Check if this is a first-time email-related request
          const emailKeywords = ['email', 'gmail', 'send email', 'compose', 'mail', 'inbox', 'contact', 'contacts'];
          const isEmailRelated = emailKeywords.some(keyword => 
            messageText.toLowerCase().includes(keyword.toLowerCase())
          );

          if (isEmailRelated && this.isFirstTimeUser(context)) {
            await this.sendEmailWelcomeMessage(say, context);
          } else if (isEmailRelated) {
            // Check if user has OAuth tokens for email requests
            const hasOAuth = await this.hasOAuthTokens(context);
            if (!hasOAuth) {
              await this.sendOAuthRequiredMessage(say, context);
              return; // Don't process the request without OAuth
            } else {
              // User has OAuth tokens, check if they recently completed authentication
              const isRecentlyConnected = await this.isRecentlyConnected(context);
              if (isRecentlyConnected) {
                await this.sendOAuthSuccessMessage(say, context);
              }
            }
          }

          await this.handleSlackEvent(
            messageText,
            context,
            'message',
            { say, client, thread_ts: undefined }
          );
        }
      } catch (error: any) {
        logger.error('Error handling direct message:', error, { 
          user: (message as any).user, 
          channel: (message as any).channel,
          error_type: error?.constructor?.name 
        });
        
        await say({
          text: 'I apologize, but I encountered an error processing your message. Please try again or contact support if the issue persists.'
        });
      }
    });

    // Handle team join events for new users
    this.app.event('team_join', async ({ event }) => {
      try {
        logger.info('New team member joined', { userId: event.user?.id });
        // Could send welcome message or setup user here
      } catch (error) {
        logger.error('Error handling team join event:', error);
      }
    });

    // Handle app uninstalled events
    this.app.event('app_uninstalled', async ({ event }) => {
      try {
        logger.info('Slack app uninstalled', { event });
        // Could cleanup team data here
      } catch (error) {
        logger.error('Error handling app uninstalled event:', error);
      }
    });
  }

  /**
   * Setup slash commands with enhanced parameter parsing
   */
  private setupSlashCommands(): void {
    // Handle slash commands
    this.app.command('/assistant', async ({ command, ack, respond }) => {
      await ack();
      try {
        logger.info('Slash command received', { 
          command: command.command,
          user: command.user_id,
          channel: command.channel_id,
          text: command.text?.substring(0, 100) + '...'
        });

        const context = await this.createSlackContextFromEvent(command, { team: { id: command.team_id } });
        const message = this.parseSlashCommandText(command.text || '');
        
        // Handle special commands
        if (message.isHelpRequest) {
          await this.sendHelpMessage(respond, context);
          return;
        }

        if (message.message.toLowerCase().includes('auth') || message.message.toLowerCase().includes('connect')) {
          await this.handleAuthCommand(respond, context);
          return;
        }

        if (message.message.toLowerCase().includes('status') || message.message.toLowerCase().includes('check')) {
          await this.handleStatusCommand(respond, context);
          return;
        }

        await this.handleSlackEvent(
          message.message,
          context,
          'slash_command',
          { 
            say: respond, 
            client: this.client,
            commandInfo: {
              command: command.command,
              channelName: command.channel_name || 'unknown',
              triggerId: command.trigger_id,
              responseUrl: command.response_url
            }
          }
        );
      } catch (error: any) {
        logger.error('Error handling slash command:', error, { 
          user: command.user_id, 
          channel: command.channel_id,
          error_type: error?.constructor?.name 
        });
        
        await respond({
          text: 'I apologize, but I encountered an error processing your command. Please try again or contact support if the issue persists.',
          response_type: 'ephemeral'
        });
      }
    });
  }

  /**
   * Setup interactive components with enhanced handling
   */
  private setupInteractiveComponents(): void {
    // Handle help button clicks
    this.app.action('show_help', async ({ ack, respond, client, body }) => {
      await ack();
      try {
        logger.info('Help button clicked', { user: body.user?.id });
        const helpResponse = this.formatHelpResponse();
        await respond(helpResponse);
      } catch (error) {
        logger.error('Error handling help button:', error);
        await respond({
          response_type: 'ephemeral' as const,
          text: 'Sorry, I encountered an error. Please try again.'
        });
      }
    });

    // Handle full help button clicks
    this.app.action('show_full_help', async ({ ack, respond, client, body }) => {
      await ack();
      try {
        logger.info('Full help button clicked', { user: body.user?.id });
        const helpResponse = this.formatHelpResponse();
        await respond(helpResponse);
      } catch (error) {
        logger.error('Error handling full help button:', error);
        await respond({
          response_type: 'ephemeral' as const,
          text: 'Sorry, I encountered an error. Please try again.'
        });
      }
    });

    // Handle quick email check button
    this.app.action('quick_email_check', async ({ ack, respond, client, body }) => {
      await ack();
      try {
        logger.info('Quick email check button clicked', { user: body.user?.id });
        
        const context: SlackContext = {
          userId: body.user?.id || 'unknown',
          channelId: body.channel?.id || 'unknown',
          teamId: body.team?.id || 'unknown',
          isDirectMessage: true
        };

        await this.handleSlackEvent(
          'check my email',
          context,
          'interactive_component',
          { say: respond, client }
        );
      } catch (error) {
        logger.error('Error handling quick email check:', error);
        await respond({
          response_type: 'ephemeral' as const,
          text: 'Sorry, I encountered an error checking your email. Please try again.'
        });
      }
    });

    // Handle OAuth button clicks
    this.app.action('gmail_oauth', async ({ ack, body, client }) => {
      await ack();
      try {
        logger.info('OAuth button clicked', { 
          user: body.user?.id,
          channel: body.channel?.id,
          teamId: body.team?.id
        });

        // Send a confirmation message
        const channelId = body.channel?.id || (body as any).channel_id;
        if (channelId) {
          await client.chat.postEphemeral({
            channel: channelId,
            user: body.user?.id || 'unknown',
            text: '🔗 *OAuth Redirect*\n\nYou\'re being redirected to Google to connect your Gmail account. Please complete the authorization process and then return to Slack to try your request again.'
          });
        }
      } catch (error) {
        logger.error('Error handling OAuth button click', { error, body });
      }
    });

    // Handle other button clicks
    this.app.action(/.*/, async ({ ack, body, client }) => {
      await ack();
      try {
        logger.info('Generic button action received', { 
          actionId: (body as any).actions?.[0]?.action_id,
          user: body.user?.id,
          channel: body.channel?.id
        });
        
        // Handle other button actions as needed
      } catch (error) {
        logger.error('Error handling button action', { error, body });
      }
    });

    // Handle modal submissions
    this.app.view('email_compose_modal', async ({ ack, body, view, client }) => {
      await ack();
      try {
        logger.info('Email compose modal submitted', { user: body.user?.id });
        
        // Extract modal data
        const values = view.state?.values;
        if (values) {
          // Process email composition from modal
          logger.debug('Modal values received:', values);
        }
      } catch (error) {
        logger.error('Error handling modal submission:', error);
      }
    });

    // Handle other view submissions
    this.app.view(/.*/, async ({ ack, body, view, client }) => {
      await ack();
      try {
        logger.info('Generic view submitted:', { 
          viewId: view.callback_id,
          user: body.user?.id 
        });
        // Handle other view types as needed
      } catch (error) {
        logger.error('Error handling view submission:', error);
      }
    });
  }

  /**
   * Enhanced context extraction from Slack events
   */
  private async createSlackContextFromEvent(event: any, payload?: any): Promise<SlackContext> {
    try {
      // Get additional user information if available
      let userName: string | undefined;
      let userEmail: string | undefined;
      
      try {
        const userInfo = await this.client.users.info({ user: event.user });
        if (userInfo.user) {
          userName = userInfo.user.name;
          userEmail = userInfo.user.profile?.email;
        }
      } catch (userError) {
        logger.debug('Could not fetch additional user info:', userError);
      }

      const teamId = event.team_id || payload?.team?.id || (await this.client.auth.test()).team_id;
      
      return {
        userId: event.user || event.user_id,
        channelId: event.channel || event.channel_id,
        teamId: teamId as string,
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im',
        userName,
        userEmail
      };
    } catch (error) {
      logger.error('Error creating enhanced Slack context:', error);
      
      // Fallback to basic context
      return {
        userId: event.user || event.user_id || 'unknown',
        channelId: event.channel || event.channel_id || 'unknown',
        teamId: event.team_id || 'unknown',
        threadTs: event.thread_ts,
        isDirectMessage: event.channel_type === 'im'
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
  private parseSlashCommandText(text: string): { 
    message: string; 
    isHelpRequest: boolean; 
    parameters: Record<string, string> 
  } {
    if (!text) {
      return { message: '', isHelpRequest: true, parameters: {} };
    }

    const trimmedText = text.trim().toLowerCase();
    
    // Check for help requests
    const helpKeywords = ['help', '?', 'usage', 'commands', 'guide'];
    const isHelpRequest = helpKeywords.some(keyword => 
      trimmedText === keyword || trimmedText.startsWith(keyword + ' ')
    );

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
  private async sendWelcomeMessage(say: any, context: SlackContext): Promise<void> {
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
            text: "• *Send me a message* with what you'd like to do\n• *Use commands* like 'check my email' or 'schedule a meeting'\n• *Type 'help'* anytime for more information"
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

    await say(welcomeMessage);
  }

  /**
   * Send a welcome message specifically for email-related requests for first-time users
   */
  private async sendEmailWelcomeMessage(say: any, context: SlackContext): Promise<void> {
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

      await say(welcomeMessage);
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
  private formatQuickHelpResponse(): any {
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
  private formatHelpResponse(): any {
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
            text: "*Ways to interact with me:*\n• Direct message me\n• Mention me in channels (@AI Assistant)\n• Use `/assistant` followed by any request"
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
              type: "mrkdwn",
              text: "💡 *Example:* `/assistant help me organize my day` or `/assistant what's the weather like?`"
            }
          ]
        }
      ]
    };
  }

  /**
   * Format help response for slash commands with empty input
   */
  private formatSlashCommandHelp(): any {
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
   * Create Slack context from event (legacy method for compatibility)
   */
  private async createSlackContext(event: any): Promise<SlackContext> {
    return this.createSlackContextFromEvent(event);
  }

  /**
   * Create Slack context from slash command
   */
  private createSlackContextFromCommand(command: any): SlackContext {
    return {
      userId: command.user_id,
      channelId: command.channel_id,
      teamId: command.team_id,
      isDirectMessage: command.channel_name === 'directmessage'
    };
  }


  /**
   * Create or get session for Slack user with enhanced context management
   */
  private async createOrGetSession(slackContext: SlackContext): Promise<string> {
    try {
      const sessionService = this.serviceManager.getService('sessionService');
      if (!sessionService) {
        logger.warn('SessionService not available for Slack integration');
        throw new Error('SessionService not available');
      }

      // Create unique session ID for Slack context
      // Format: slack_{teamId}_{userId}_{threadTs|channel|main}
      let sessionSuffix = 'main';
      if (slackContext.threadTs) {
        // For threaded conversations, include thread timestamp
        sessionSuffix = `thread_${slackContext.threadTs.replace('.', '_')}`;
      } else if (!slackContext.isDirectMessage) {
        // For channel conversations (non-DM), include channel
        sessionSuffix = `channel_${slackContext.channelId}`;
      }
      
      const sessionId = `slack_${slackContext.teamId}_${slackContext.userId}_${sessionSuffix}`;
      
      logger.info('Creating/retrieving Slack session with detailed context', { 
        sessionId, 
        userId: slackContext.userId,
        teamId: slackContext.teamId,
        channelId: slackContext.channelId,
        isDirectMessage: slackContext.isDirectMessage,
        threadTs: slackContext.threadTs,
        sessionSuffix,
        fullSessionId: sessionId
      });
      
      // Get or create session using existing SessionService with enhanced context
      const session = (sessionService as any).getOrCreateSession(sessionId, slackContext.userId);
      
      // Store Slack-specific context in the session for agents to use
      if (session && typeof (sessionService as any).updateSessionContext === 'function') {
        try {
          await (sessionService as any).updateSessionContext(sessionId, {
            slack: {
              teamId: slackContext.teamId,
              channelId: slackContext.channelId,
              isDirectMessage: slackContext.isDirectMessage,
              userName: slackContext.userName,
              userEmail: slackContext.userEmail,
              threadTs: slackContext.threadTs,
              lastInteraction: new Date().toISOString()
            }
          });
        } catch (contextError: any) {
          logger.debug('Could not update session context (non-critical)', contextError);
        }
      }
      
      logger.debug('Slack session created/retrieved', { 
        sessionId, 
        userId: slackContext.userId,
        teamId: slackContext.teamId,
        isDirectMessage: slackContext.isDirectMessage,
        hasThread: !!slackContext.threadTs
      });
      
      return sessionId;
    } catch (error: any) {
      logger.error('Error creating/retrieving Slack session', error);
      
      // Enhanced fallback with more context preservation
      const fallbackId = `slack_fallback_${slackContext.teamId}_${slackContext.userId}_${Date.now()}`;
      
      logger.warn('Using fallback session ID for Slack', { 
        fallbackId,
        originalError: error?.message,
        userId: slackContext.userId
      });
      
      return fallbackId;
    }
  }

  /**
   * Handle Slack events by routing to agents with comprehensive error handling
   */
  private async handleSlackEvent(
    message: string, 
    context: SlackContext, 
    eventType: SlackEventType,
    slackHandlers: { 
      say: any; 
      client: any; 
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
          text: 'I received your message but it appears to be empty. Please try sending a message with some content.',
          thread_ts: slackHandlers.thread_ts
        });
        return;
      }

      // Early detection of email-related requests for better OAuth experience
      const emailKeywords = ['email', 'gmail', 'send email', 'compose', 'mail', 'inbox', 'contact', 'contacts'];
      const isEmailRelated = emailKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isEmailRelated) {
        const hasOAuth = await this.hasOAuthTokens(context);
        if (!hasOAuth) {
          logger.info('Email-related request detected but no OAuth tokens found', { 
            userId: context.userId,
            message: message.substring(0, 100)
          });
          
          await this.sendOAuthRequiredMessage(slackHandlers.say, context, slackHandlers.thread_ts);
          return;
        } else {
          // User has OAuth tokens, send a helpful message
          logger.info('Email-related request detected with OAuth tokens available', { 
            userId: context.userId,
            message: message.substring(0, 100)
          });
          
          // Check if this is the first time using OAuth tokens (recently connected)
          const isRecentlyConnected = await this.isRecentlyConnected(context);
          if (isRecentlyConnected) {
            await this.sendOAuthSuccessMessage(slackHandlers.say, context, slackHandlers.thread_ts);
          } else {
            // Send a brief confirmation that OAuth is available
            await slackHandlers.say({
              text: '✅ *Gmail Connected*\n\nI can see your Gmail account is connected. Processing your email request...',
              thread_ts: slackHandlers.thread_ts
            });
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
          triggerId: slackHandlers.commandInfo?.triggerId,
          responseUrl: slackHandlers.commandInfo?.responseUrl
        }
      };

      // Route to Master Agent through existing system
      const agentResponse = await this.routeToAgent(agentRequest);

      // Enhanced response handling
      if (agentResponse.shouldRespond !== false) {
        if (agentResponse.response.blocks && agentResponse.response.blocks.length > 0) {
          await this.sendFormattedMessage(
            context.channelId, 
            agentResponse.response.blocks,
            {
              text: agentResponse.response.text,
              thread_ts: slackHandlers.thread_ts,
              response_type: eventType === 'slash_command' ? 'in_channel' : undefined
            }
          );
        } else if (agentResponse.response.text) {
          await slackHandlers.say({
            text: agentResponse.response.text,
            thread_ts: slackHandlers.thread_ts
          });
        }
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
          text: `${errorMessage} If the issue persists, please contact support.`,
          thread_ts: slackHandlers.thread_ts
        });
      } catch (sayError) {
        logger.error('Failed to send error message to user:', sayError);
      }
    }
  }

  /**
   * Clean Slack message (remove mentions, etc.) - Legacy method
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
    let masterAgent: any = null;
    
    try {
      logger.info('Routing Slack request to MasterAgent', { 
        message: request.message,
        eventType: request.eventType,
        userId: request.context.userId,
        channelId: request.context.channelId,
        isDirectMessage: request.context.isDirectMessage
      });

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
        const sessionService = this.serviceManager.getService('sessionService');
        if (sessionService) {
          logger.info('Attempting to retrieve OAuth tokens', { 
            sessionId, 
            userId: request.context.userId,
            teamId: request.context.teamId
          });
          
          // Check what tokens are available
          const allTokens = (sessionService as any).getOAuthTokens(sessionId);
          logger.info('Available OAuth tokens for session', { 
            sessionId, 
            hasTokens: !!allTokens,
            googleToken: !!allTokens?.google?.access_token,
            slackToken: !!allTokens?.slack,
            tokenDetails: allTokens ? {
              google: {
                hasAccessToken: !!allTokens.google?.access_token,
                hasRefreshToken: !!allTokens.google?.refresh_token,
                expiresIn: allTokens.google?.expires_in,
                expiryDate: allTokens.google?.expiry_date
              },
              slack: {
                teamId: allTokens.slack?.team_id,
                userId: allTokens.slack?.user_id
              }
            } : null
          });
          
          accessToken = (sessionService as any).getGoogleAccessToken(sessionId);
          if (accessToken) {
            logger.info('✅ Retrieved Google OAuth access token for Slack user', { 
              sessionId, 
              hasToken: !!accessToken,
              tokenLength: accessToken.length
            });
          } else {
            logger.warn('❌ No Google OAuth access token found for Slack user', { 
              sessionId,
              availableTokens: allTokens
            });
            
            // Try to find tokens in other possible session locations
            const possibleSessionIds = [
              `slack_${request.context.teamId}_${request.context.userId}_main`,
              `slack_${request.context.teamId}_${request.context.userId}_channel_${request.context.channelId}`,
              `slack_${request.context.teamId}_${request.context.userId}_fallback_${Date.now()}`
            ];
            
            for (const possibleSessionId of possibleSessionIds) {
              if (possibleSessionId === sessionId) continue; // Skip the current session
              
              try {
                const possibleTokens = (sessionService as any).getOAuthTokens(possibleSessionId);
                if (possibleTokens?.google?.access_token) {
                  accessToken = possibleTokens.google.access_token;
                  logger.info('✅ Found OAuth tokens in alternative session', { 
                    originalSessionId: sessionId,
                    foundInSessionId: possibleSessionId,
                    hasToken: !!accessToken
                  });
                  break;
                }
              } catch (alternativeError) {
                logger.debug('Could not check alternative session for tokens', { 
                  alternativeSessionId: possibleSessionId,
                  error: alternativeError
                });
              }
            }
            
            if (!accessToken) {
              logger.warn('❌ No OAuth tokens found in any session location', { 
                checkedSessions: [sessionId, ...possibleSessionIds],
                userId: request.context.userId,
                teamId: request.context.teamId
              });
            }
          }
        }
      } catch (error) {
        logger.error('Error retrieving OAuth tokens for Slack user', { error, sessionId });
      }
      
      // 3. Initialize MasterAgent with OpenAI configuration
      const { MasterAgent } = await import('../agents/master.agent');
      masterAgent = new MasterAgent({ 
        openaiApiKey: process.env.OPENAI_API_KEY || 'dummy-key' 
      });
      
      logger.debug('MasterAgent initialized', { sessionId, useOpenAI: !!process.env.OPENAI_API_KEY });
      
      // 4. Route to MasterAgent for intent parsing (EXISTING LOGIC - DO NOT DUPLICATE)
      const masterResponse = await masterAgent.processUserInput(
        request.message,
        sessionId,
        request.context.userId
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

        // Execute all tool calls in sequence with proper error handling
        for (const toolCall of masterResponse.toolCalls) {
          try {
            logger.debug(`Executing tool: ${toolCall.name}`, { 
              parameters: Object.keys(toolCall.parameters || {}),
              hasAccessToken: !!accessToken
            });

            // Check if this tool requires OAuth and we don't have a token
            if (this.toolRequiresOAuth(toolCall.name) && !accessToken) {
              logger.warn(`Tool ${toolCall.name} requires OAuth but no access token available`, { sessionId });
              
              // Add failed result to collection
              toolResults.push({
                toolName: toolCall.name,
                success: false,
                error: 'OAuth authentication required. Please authenticate with Gmail first.',
                result: null,
                executionTime: 0
              });
              
              continue; // Skip execution and move to next tool
            }

            const executionContext = {
              ...baseExecutionContext,
              previousResults: toolResults // Pass previous results for context
            };

            const result = await (toolExecutorService as any).executeTool(
              toolCall,
              executionContext,
              accessToken // Pass the OAuth access token to the tool executor
            );

            // Collect results for response formatting
            if (result) {
              toolResults.push(result);
              
              if (result.success) {
                logger.debug(`Tool ${toolCall.name} executed successfully`, {
                  executionTime: result.executionTime
                });
              } else {
                logger.warn(`Tool ${toolCall.name} execution failed`, { 
                  error: result.error,
                  executionTime: result.executionTime
                });
              }
            }
            
          } catch (error: any) {
            logger.error(`Error executing tool ${toolCall.name}:`, error);
            
            // Add failed result to collection
            toolResults.push({
              toolName: toolCall.name,
              success: false,
              error: error?.message || 'Unknown execution error',
              result: null,
              executionTime: 0
            });
          }
        }
      }

      // 7. Enhance master response with tool execution results
      const enhancedMasterResponse = {
        ...masterResponse,
        toolResults: toolResults,
        executionMetadata: {
          totalExecutionTime: Date.now() - startTime,
          toolsExecuted: toolResults.length,
          successfulTools: toolResults.filter(tr => tr.success).length,
          slackContext: request.context
        }
      };

      // 8. Format response for Slack with comprehensive context
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
          toolResults,
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
      } else if (error?.message?.includes('SessionService not available')) {
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
    masterResponse: any, 
    slackContext: SlackContext
  ): Promise<{ text: string; blocks?: any[] }> {
    try {
      logger.debug('Formatting agent response for Slack', {
        hasMessage: !!masterResponse.message,
        toolResultsCount: masterResponse.toolResults?.length || 0,
        hasExecutionMetadata: !!masterResponse.executionMetadata
      });

      // 1. First try to use SlackFormatterService for rich formatting
      const slackFormatterService = this.serviceManager.getService('slackFormatterService');
      
      if (slackFormatterService && typeof (slackFormatterService as any).formatAgentResponse === 'function') {
        try {
          const formattedResponse = await (slackFormatterService as any).formatAgentResponse(
            masterResponse, 
            slackContext
          );
          
          if (formattedResponse && (formattedResponse.text || formattedResponse.blocks)) {
            logger.debug('Using SlackFormatterService response');
            return formattedResponse;
          }
        } catch (formatterError: any) {
          logger.warn('SlackFormatterService failed, using fallback formatting', formatterError);
        }
      }
      
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

      // 4. Process and format tool execution results
      if (masterResponse.toolResults && masterResponse.toolResults.length > 0) {
        const successfulResults = masterResponse.toolResults.filter((tr: any) => tr.success);
        const failedResults = masterResponse.toolResults.filter((tr: any) => !tr.success);

        // Add successful results
        if (successfulResults.length > 0) {
          blocks.push({ type: 'divider' });
          
          for (const toolResult of successfulResults) {
            if (toolResult.result) {
              const resultText = this.formatToolResultForSlack(toolResult);
              if (resultText) {
                blocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*${this.getToolDisplayName(toolResult.toolName)}*\n${resultText}`
                  }
                });
              }
            }
          }
        }

        // Handle failed results with OAuth guidance
        if (failedResults.length > 0) {
          const oauthFailures = failedResults.filter((fr: any) => 
            fr.error?.includes('OAuth authentication required') || 
            fr.error?.includes('Access token is required')
          );
          
          if (oauthFailures.length > 0) {
            blocks.push({ type: 'divider' });
            
            // Add OAuth guidance block
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*🔐 Gmail Authentication Required*\n' +
                      'To send emails, read your Gmail, or access contacts, you need to connect your Gmail account first.\n\n' +
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

        // Add execution summary if multiple tools were used
        if (masterResponse.executionMetadata && masterResponse.toolResults.length > 1) {
          const metadata = masterResponse.executionMetadata;
          blocks.push({
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: `✅ ${metadata.successfulTools}/${metadata.toolsExecuted} tools executed successfully` +
                    (metadata.totalExecutionTime ? ` • ${metadata.totalExecutionTime}ms` : '')
            }]
          });
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
        blocks: blocks.length > 1 ? blocks : undefined // Only include blocks if we have more than just the main text
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
  private async sendHelpMessage(respond: any, context: SlackContext): Promise<void> {
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
  private async handleAuthCommand(respond: any, context: SlackContext): Promise<void> {
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
  private async handleStatusCommand(respond: any, context: SlackContext): Promise<void> {
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
  private async sendOAuthSuccessMessage(say: any, slackContext: SlackContext, threadTs?: string): Promise<void> {
    try {
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
        ...successMessage,
        thread_ts: threadTs
      });
    } catch (error) {
      logger.error('Error sending OAuth success message', { error, userId: slackContext.userId });
      
      // Fallback to simple text message
      await say({
        text: "🎉 Gmail successfully connected! You can now try your email request again.",
        thread_ts: threadTs
      });
    }
  }

  /**
   * Check if a user has recently completed OAuth authentication
   */
  private async isRecentlyConnected(slackContext: SlackContext): Promise<boolean> {
    try {
      const sessionService = this.serviceManager.getService('sessionService');
      if (!sessionService) {
        return false;
      }

      // Check if tokens were stored recently (within the last 5 minutes)
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      // Check multiple possible session locations
      const possibleSessionIds = [
        `slack_${slackContext.teamId}_${slackContext.userId}_main`,
        `slack_${slackContext.teamId}_${slackContext.userId}_channel_${slackContext.channelId}`,
        `slack_${slackContext.teamId}_${slackContext.userId}_fallback_${Date.now()}`
      ];

      for (const sessionId of possibleSessionIds) {
        try {
          const session = (sessionService as any).getSession(sessionId);
          if (session?.oauthTokens?.google?.access_token && session.lastActivity) {
            const lastActivity = new Date(session.lastActivity).getTime();
            if (lastActivity > fiveMinutesAgo) {
              return true;
            }
          }
        } catch (error) {
          logger.debug('Could not check session for recent connection', { sessionId, error });
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking if recently connected', { error, userId: slackContext.userId });
      return false;
    }
  }

  /**
   * Check if a user has OAuth tokens for Gmail access
   */
  private async hasOAuthTokens(slackContext: SlackContext): Promise<boolean> {
    try {
      const sessionService = this.serviceManager.getService('sessionService');
      if (!sessionService) {
        return false;
      }

      // Check multiple possible session locations
      const possibleSessionIds = [
        `slack_${slackContext.teamId}_${slackContext.userId}_main`,
        `slack_${slackContext.teamId}_${slackContext.userId}_channel_${slackContext.channelId}`,
        `slack_${slackContext.teamId}_${slackContext.userId}_fallback_${Date.now()}`
      ];

      for (const sessionId of possibleSessionIds) {
        try {
          const tokens = (sessionService as any).getOAuthTokens(sessionId);
          if (tokens?.google?.access_token) {
            return true;
          }
        } catch (error) {
          logger.debug('Could not check session for OAuth tokens', { sessionId, error });
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking OAuth tokens', { error, userId: slackContext.userId });
      return false;
    }
  }

  /**
   * Send a helpful message when user doesn't have OAuth tokens
   */
  private async sendOAuthRequiredMessage(say: any, slackContext: SlackContext, threadTs?: string): Promise<void> {
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
        text: 'Gmail authentication required. Please connect your Gmail account to use email features.',
        thread_ts: threadTs
      });
    } catch (error) {
      logger.error('Error sending OAuth required message', { error, userId: slackContext.userId });
      
      // Fallback to simple text message
      await say({
        text: '🔐 Gmail authentication required. Please contact support to connect your Gmail account.',
        thread_ts: threadTs
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
   * Generate OAuth URL for Slack user authentication
   */
  private async generateOAuthUrl(slackContext: SlackContext): Promise<string> {
    try {
      const { ENVIRONMENT } = await import('../config/environment');
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
      const { ENVIRONMENT } = await import('../config/environment');
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
      'Think': '🤔 Analysis',
      'tavilyAgent': '🔍 Search',
      'contentCreatorAgent': '✍️ Content'
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
    blocks: any[], 
    options?: {
      text?: string;
      thread_ts?: string;
      response_type?: 'in_channel' | 'ephemeral';
      replace_original?: boolean;
    }
  ): Promise<void> {
    try {
      const messagePayload: any = {
        channel: channelId,
        blocks: blocks
      };

      // Add optional parameters
      if (options?.text) messagePayload.text = options.text;
      if (options?.thread_ts) messagePayload.thread_ts = options.thread_ts;
      if (options?.response_type === 'ephemeral') messagePayload.ephemeral = true;

      logger.debug('Sending formatted Slack message', { 
        channel: channelId, 
        blocks: blocks.length,
        thread_ts: options?.thread_ts 
      });

      const result = await this.client.chat.postMessage(messagePayload);
      
      logger.debug('Slack message sent successfully', { 
        channel: channelId, 
        timestamp: result.ts 
      });
    } catch (error) {
      logger.error('Error sending formatted message to Slack:', error, {
        channel: channelId,
        blocks_count: blocks.length,
        error_code: (error as any).code,
        error_data: (error as any).data
      });
      
      // Try fallback text message
      try {
        await this.sendFallbackTextMessage(channelId, 'I encountered an error sending a formatted response. Please try again.');
      } catch (fallbackError) {
        logger.error('Fallback message also failed:', fallbackError);
      }
    }
  }

  /**
   * Send simple text message as fallback
   */
  private async sendFallbackTextMessage(channelId: string, text: string, thread_ts?: string): Promise<void> {
    try {
      await this.client.chat.postMessage({
        channel: channelId,
        text: text,
        thread_ts: thread_ts
      });
    } catch (error) {
      logger.error('Error sending fallback text message:', error);
    }
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
        text: text
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
            events: '/slack/bolt/events',
            commands: '/slack/bolt/commands',
            interactive: '/slack/bolt/interactive'
          }
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
