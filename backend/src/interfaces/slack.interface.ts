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

    // Create Express receiver for Slack
    this.receiver = new ExpressReceiver({
      signingSecret: config.signingSecret,
      endpoints: {
        events: '/slack/events',
        commands: '/slack/commands',
        interactive: '/slack/interactive'
      }
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
   */
  public async start(): Promise<void> {
    try {
      await this.app.start();
      logger.info('Slack interface started successfully');
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
    // Main assistant command with sophisticated parsing
    this.app.command('/assistant', async ({ command, ack, respond, client }) => {
      await ack();
      
      try {
        logger.info('Slash command received', { 
          user: command.user_id, 
          channel: command.channel_id,
          text: command.text?.substring(0, 100) + '...'
        });

        const context = this.createSlackContextFromCommand(command);
        const parsedCommand = this.parseSlashCommandText(command.text || '');
        
        // Handle empty commands
        if (!parsedCommand.message.trim()) {
          const helpResponse = this.formatQuickHelpResponse();
          await respond(helpResponse);
          return;
        }

        // Handle help requests specifically
        if (parsedCommand.isHelpRequest) {
          const helpResponse = this.formatHelpResponse();
          await respond(helpResponse);
          return;
        }

        await this.handleSlackEvent(
          parsedCommand.message,
          context,
          'slash_command',
          { 
            say: respond, 
            client, 
            thread_ts: undefined,
            commandInfo: {
              command: command.command,
              channelName: command.channel_name,
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
          response_type: 'ephemeral' as const,
          text: 'I apologize, but I encountered an error processing your command. Please try again or contact support if the issue persists.'
        });
      }
    });

    // Dedicated help command
    this.app.command('/assistant-help', async ({ command, ack, respond }) => {
      await ack();
      
      try {
        logger.info('Help command received', { user: command.user_id });
        const helpResponse = this.formatHelpResponse();
        await respond(helpResponse);
      } catch (error: any) {
        logger.error('Error handling help command:', error);
        await respond({
          response_type: 'ephemeral' as const,
          text: 'I apologize, but I encountered an error. Please try again.'
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

    // Handle generic button clicks
    this.app.action(/.*/, async ({ ack, body, client }) => {
      await ack();
      try {
        logger.info('Generic button/action clicked:', { 
          actionId: (body as any).actions?.[0]?.action_id,
          user: body.user?.id 
        });
        
        // Route to appropriate handler based on action_id
        // This can be expanded based on specific button needs
      } catch (error) {
        logger.error('Error handling generic action:', error);
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
            text: "*Ways to interact with me:*\n• Direct message me\n• Mention me in channels (@AI Assistant)\n• Use the `/assistant` command"
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📧 *Email Management*\n• \"Check my email\"\n• \"Send email to john@company.com about the meeting\"\n• \"Find emails from Sarah about the project\""
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📅 *Calendar Management*\n• \"Schedule meeting with team tomorrow at 2pm\"\n• \"Check if I'm free Thursday afternoon\"\n• \"Move my 3pm meeting to 4pm\""
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👤 *Contact Management*\n• \"Find contact info for John Smith\"\n• \"Add jane@company.com to my contacts\"\n• \"Who is the contact for Acme Corp?\""
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 *Tip:* I understand natural language, so just tell me what you need!"
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
      
      // 2. Initialize MasterAgent with OpenAI configuration
      const { MasterAgent } = await import('../agents/master.agent');
      masterAgent = new MasterAgent({ 
        openaiApiKey: process.env.OPENAI_API_KEY || 'dummy-key' 
      });
      
      logger.debug('MasterAgent initialized', { sessionId, useOpenAI: !!process.env.OPENAI_API_KEY });
      
      // 3. Route to MasterAgent for intent parsing (EXISTING LOGIC - DO NOT DUPLICATE)
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

      // 4. Initialize tool results collection for comprehensive response
      const toolResults: ToolResult[] = [];
      
      // 5. Execute tool calls with enhanced Slack context
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
          tools: masterResponse.toolCalls.map((tc: any) => tc.name)
        });

        // Execute all tool calls in sequence with proper error handling
        for (const toolCall of masterResponse.toolCalls) {
          try {
            logger.debug(`Executing tool: ${toolCall.name}`, { 
              parameters: Object.keys(toolCall.parameters || {})
            });

            const executionContext = {
              ...baseExecutionContext,
              previousResults: toolResults // Pass previous results for context
            };

            const result = await (toolExecutorService as any).executeTool(
              toolCall,
              executionContext
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

      // 6. Enhance master response with tool execution results
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

      // 7. Format response for Slack with comprehensive context
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
            events: '/slack/events',
            commands: '/slack/commands',
            interactive: '/slack/interactive'
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
